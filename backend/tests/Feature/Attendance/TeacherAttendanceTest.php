<?php

namespace Tests\Feature\Attendance;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tarbiyachi: GET /v1/teacher/dashboard va PUT /v1/teacher/attendance.
 * Faqat biriktirilgan guruhlar, bugun va 2 kun orqaga tahrirlash.
 */
class TeacherAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private User $user;
    private TeacherProfile $teacher;
    private Group $group;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 10:00', 'Asia/Tashkent'));

        $this->org     = Organization::factory()->create();
        $this->user    = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $this->teacher = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->group   = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->teacher->groups()->attach($this->group->id, ['assigned_at' => self::TODAY, 'is_primary' => true]);
    }

    private function mark(array $body, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->user, 'sanctum')->putJson('/api/v1/teacher/attendance', $body);
    }

    private function body(array $records, string $date = self::TODAY, ?int $groupId = null): array
    {
        return ['date' => $date, 'group_id' => $groupId ?? $this->group->id, 'records' => $records];
    }

    // ── Kirish ────────────────────────────────────────────────────

    public function test_autentifikatsiyasiz_va_boshqa_rollar_kira_olmaydi(): void
    {
        $this->getJson('/api/v1/teacher/dashboard')->assertUnauthorized();
        $this->putJson('/api/v1/teacher/attendance', [])->assertUnauthorized();

        foreach ([
            User::factory()->admin()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
            User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]),
        ] as $other) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($other, 'sanctum')->getJson('/api/v1/teacher/dashboard')->assertForbidden();
        }
    }

    public function test_profili_yoq_yoki_nofaol_tarbiyachi_403(): void
    {
        $noProfile = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $this->actingAs($noProfile, 'sanctum')->getJson('/api/v1/teacher/dashboard')->assertForbidden();

        $this->teacher->update(['is_active' => false]);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard')->assertForbidden();
    }

    // ── Dashboard ─────────────────────────────────────────────────

    public function test_guruh_biriktirilmagan_tarbiyachi_bosh_holat_oladi(): void
    {
        $this->teacher->groups()->detach();

        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard')
             ->assertOk()
             ->assertJsonPath('groups', [])
             ->assertJsonPath('group', null)
             ->assertJsonPath('children', [])
             ->assertJsonPath('editable', false);
    }

    public function test_dashboard_faqat_shu_guruhning_faol_bolalarini_korsatadi(): void
    {
        $a = Child::factory()->inGroup($this->group)->create(['first_name' => 'Ali', 'last_name' => 'A']);
        $b = Child::factory()->inGroup($this->group)->create(['first_name' => 'Bek', 'last_name' => 'B']);
        Child::factory()->inGroup($this->group)->create(['is_active' => false]);
        Child::factory()->inGroup($this->group)->create()->delete();
        $otherGroup = Group::factory()->create(['organization_id' => $this->org->id]);
        Child::factory()->inGroup($otherGroup)->create();
        Attendance::factory()->create(['child_id' => $a->id, 'date' => self::TODAY, 'status' => 'absent']);

        $res = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard')
                    ->assertOk()
                    ->assertJsonPath('group.id', $this->group->id)
                    ->assertJsonPath('date', self::TODAY)
                    ->assertJsonPath('editable', true)
                    ->assertJsonPath('editable_from', '2026-10-26')
                    ->assertJsonPath('summary', ['total' => 2, 'present' => 0, 'absent' => 1, 'excused' => 0, 'unmarked' => 1]);

        $this->assertSame(
            [[$a->id, 'absent'], [$b->id, null]],
            collect($res->json('children'))->map(fn ($c) => [$c['id'], $c['status']])->all()
        );
    }

    public function test_biriktirilmagan_yoki_boshqa_bogcha_guruhi_404(): void
    {
        $sameOrgGroup = Group::factory()->create(['organization_id' => $this->org->id]);
        $foreignGroup = Group::factory()->create();
        // Noto'g'ri bog'lanish: boshqa bog'cha guruhi tarbiyachiga biriktirilgan bo'lsa ham ko'rinmasin
        $this->teacher->groups()->attach($foreignGroup->id, ['assigned_at' => self::TODAY]);

        foreach ([$sameOrgGroup, $foreignGroup] as $group) {
            $this->actingAs($this->user, 'sanctum')
                 ->getJson("/api/v1/teacher/dashboard?group_id={$group->id}")
                 ->assertNotFound();
            $this->mark($this->body([['child_id' => 1, 'status' => 'present']], self::TODAY, $group->id))->assertNotFound();
        }

        $ids = collect($this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard')->json('groups'))->pluck('id')->all();
        $this->assertSame([$this->group->id], $ids);
    }

    public function test_kelajak_sanasi_422_otgan_sana_faqat_korish(): void
    {
        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard?date=2026-10-29')->assertStatus(422);

        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard?date=2026-10-20')
             ->assertOk()
             ->assertJsonPath('date', '2026-10-20')
             ->assertJsonPath('editable', false);
    }

    public function test_sana_toshkent_vaqti_boyicha(): void
    {
        // UTC 20:00 — Toshkentda allaqachon ertangi kun (UTC+5)
        $this->travelTo(CarbonImmutable::parse('2026-10-28 20:00', 'UTC'));

        $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/teacher/dashboard')
             ->assertOk()
             ->assertJsonPath('date', '2026-10-29');
    }

    // ── Yozish ───────────────────────────────────────────────────

    public function test_davomat_yoziladi_va_takroriy_yozuv_yaratilmaydi(): void
    {
        $a = Child::factory()->inGroup($this->group)->create();
        $b = Child::factory()->inGroup($this->group)->create();

        $this->mark($this->body([
            ['child_id' => $a->id, 'status' => 'present'],
            ['child_id' => $b->id, 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Shifokorda'],
        ]))->assertOk()
           ->assertJsonPath('message', 'Davomat saqlandi.')
           ->assertJsonPath('summary.present', 1)
           ->assertJsonPath('summary.excused', 1);

        $this->assertDatabaseHas('attendances', [
            'child_id' => $b->id, 'organization_id' => $this->org->id, 'group_id' => $this->group->id,
            'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Shifokorda', 'marked_by' => $this->user->id,
        ]);

        // Bir xil ma'lumot qayta yuborilsa — yangi yozuv ham, audit ham yo'q
        $this->mark($this->body([['child_id' => $a->id, 'status' => 'present']]))->assertOk();
        $this->assertDatabaseCount('attendances', 2);
        $this->assertSame(0, ActivityLog::where('action', 'attendance.updated')->count());
    }

    public function test_tuzatish_audit_logga_yoziladi(): void
    {
        $child = Child::factory()->inGroup($this->group)->create();
        Attendance::factory()->create(['child_id' => $child->id, 'date' => '2026-10-27', 'status' => 'absent']);

        $this->mark($this->body([['child_id' => $child->id, 'status' => 'present']], '2026-10-27'))->assertOk();

        $this->assertDatabaseCount('attendances', 1);
        $this->assertDatabaseHas('attendances', ['child_id' => $child->id, 'status' => 'present', 'marked_by' => $this->user->id]);

        $log = ActivityLog::where('action', 'attendance.updated')->sole();
        $this->assertSame($this->user->id, $log->user_id);
        $this->assertSame($this->org->id, $log->organization_id);
        $this->assertSame('absent', $log->meta['old']['status']);
        $this->assertSame('present', $log->meta['new']['status']);
    }

    public function test_tahrirlash_oynasi_bugun_va_2_kun_orqaga(): void
    {
        $child = Child::factory()->inGroup($this->group)->create();
        $rec   = [['child_id' => $child->id, 'status' => 'present']];

        $this->mark($this->body($rec, '2026-10-26'))->assertOk();
        $this->mark($this->body($rec, '2026-10-25'))
             ->assertForbidden()
             ->assertJsonPath('message', "Bu sana uchun davomatni o'zgartirish muddati tugagan.");
        $this->mark($this->body($rec, '2026-10-29'))->assertForbidden();

        $this->assertDatabaseCount('attendances', 1);
    }

    public function test_boshqa_guruh_boshqa_bogcha_yoki_nofaol_bola_rad_etiladi(): void
    {
        $own          = Child::factory()->inGroup($this->group)->create();
        $otherGroup   = Group::factory()->create(['organization_id' => $this->org->id]);
        $sameOrgChild = Child::factory()->inGroup($otherGroup)->create();
        $foreignChild = Child::factory()->create();
        $inactive     = Child::factory()->inGroup($this->group)->create(['is_active' => false]);

        foreach ([$sameOrgChild, $foreignChild, $inactive] as $bad) {
            $this->mark($this->body([
                ['child_id' => $own->id, 'status' => 'present'],
                ['child_id' => $bad->id, 'status' => 'present'],
            ]))->assertStatus(422)->assertJsonValidationErrors(['records']);
        }

        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_validatsiya(): void
    {
        $child = Child::factory()->inGroup($this->group)->create();

        $this->mark($this->body([['child_id' => $child->id, 'status' => 'kasal']]))
             ->assertStatus(422)->assertJsonValidationErrors(['records.0.status']);
        $this->mark($this->body([
            ['child_id' => $child->id, 'status' => 'present'],
            ['child_id' => $child->id, 'status' => 'absent'],
        ]))->assertStatus(422);
        $this->mark(['date' => '28.10.2026', 'group_id' => $this->group->id, 'records' => []])
             ->assertStatus(422)->assertJsonValidationErrors(['date', 'records']);

        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_sorovdagi_organization_id_va_marked_by_e_tiborga_olinmaydi(): void
    {
        $child    = Child::factory()->inGroup($this->group)->create();
        $otherOrg = Organization::factory()->create();

        $this->mark($this->body([['child_id' => $child->id, 'status' => 'present']]) + [
            'organization_id' => $otherOrg->id,
            'marked_by'       => 999,
        ])->assertOk();

        $this->assertDatabaseHas('attendances', [
            'child_id' => $child->id, 'organization_id' => $this->org->id, 'marked_by' => $this->user->id,
        ]);
    }
}
