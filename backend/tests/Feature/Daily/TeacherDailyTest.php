<?php

namespace Tests\Feature\Daily;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\Organization;
use App\Models\SleepRecord;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tarbiyachi: /v1/teacher/daily — ovqatlanish, uyqu, mashg'ulotlar.
 */
class TeacherDailyTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private User $user;
    private TeacherProfile $teacher;
    private Group $group;
    private Child $ali;
    private Child $vali;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));

        $this->org     = Organization::factory()->create();
        $this->user    = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $this->teacher = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->group   = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->teacher->groups()->attach($this->group->id, ['assigned_at' => self::TODAY, 'is_primary' => true]);
        $this->ali  = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Ali', 'last_name' => 'Valiyev']);
        $this->vali = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Vali', 'last_name' => 'Aliyev']);
    }

    private function as(?User $user = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user ?? $this->user, 'sanctum');
    }

    private function meals(array $records, array $extra = [])
    {
        return $this->as()->putJson('/api/v1/teacher/daily/meals', $extra + [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'tushlik', 'served_at' => '12:30', 'records' => $records,
        ]);
    }

    private function sleep(array $records, array $extra = [])
    {
        return $this->as()->putJson('/api/v1/teacher/daily/sleep', $extra + [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'records' => $records,
        ]);
    }

    private function attendance(Child $child, string $status, string $date = self::TODAY): void
    {
        Attendance::factory()->create(['child_id' => $child->id, 'group_id' => $this->group->id, 'date' => $date, 'status' => $status]);
    }

    /** Ovqatlanish va uyqu faqat «Keldi» bolaga yoziladi. */
    private function present(Child ...$children): void
    {
        foreach ($children as $child) {
            $this->attendance($child, 'present');
        }
    }

    // ── Kirish va ruxsat ──────────────────────────────────────────

    public function test_autentifikatsiyasiz_va_boshqa_rollar_kira_olmaydi(): void
    {
        $this->getJson('/api/v1/teacher/daily')->assertUnauthorized();
        $this->putJson('/api/v1/teacher/daily/meals', [])->assertUnauthorized();

        foreach ([
            User::factory()->admin()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
            User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]),
        ] as $other) {
            $this->as($other)->getJson('/api/v1/teacher/daily')->assertForbidden();
            $this->as($other)->putJson('/api/v1/teacher/daily/meals', [])->assertForbidden();
            $this->as($other)->postJson('/api/v1/teacher/daily/activities', [])->assertForbidden();
        }
    }

    public function test_nofaol_tarbiyachi_403(): void
    {
        $this->teacher->update(['is_active' => false]);

        $this->as()->getJson('/api/v1/teacher/daily')->assertForbidden();
        $this->meals([['child_id' => $this->ali->id]])->assertForbidden();
    }

    public function test_kun_korinishi_va_guruh_tanlovi(): void
    {
        $this->attendance($this->ali, 'present');
        MealRecord::factory()->create(['child_id' => $this->ali->id, 'date' => self::TODAY, 'meal_type' => 'nonushta', 'served_at' => '08:30']);
        SleepRecord::factory()->create(['child_id' => $this->vali->id, 'date' => self::TODAY, 'started_at' => '13:00', 'ended_at' => null]);
        GroupActivity::factory()->create(['group_id' => $this->group->id, 'date' => self::TODAY, 'title' => 'Rasm', 'starts_at' => '10:00']);

        $res = $this->as()->getJson('/api/v1/teacher/daily')->assertOk()
            ->assertJsonPath('group.id', $this->group->id)
            ->assertJsonPath('date', self::TODAY)
            ->assertJsonPath('editable', true)
            ->assertJsonPath('meal_types', ['nonushta', 'ikkinchi_nonushta', 'tushlik', 'peshinlik', 'kechki_ovqat'])
            ->assertJsonPath('activities.0.title', 'Rasm')
            ->assertJsonPath('activities.0.starts_at', '10:00');

        $rows = collect($res->json('children'))->keyBy('first_name');
        $this->assertSame('present', $rows['Ali']['attendance']);
        $this->assertSame('08:30', $rows['Ali']['meals'][0]['served_at']);
        $this->assertNull($rows['Vali']['attendance']);
        $this->assertTrue($rows['Vali']['sleep']['is_sleeping']);
        $this->assertSame('Hali uxlayapti', $rows['Vali']['sleep']['status_text']);
    }

    public function test_biriktirilmagan_guruh_404_kelajak_sanasi_422(): void
    {
        $other = Group::factory()->create(['organization_id' => $this->org->id]);

        $this->as()->getJson("/api/v1/teacher/daily?group_id={$other->id}")->assertNotFound();
        $this->as()->getJson('/api/v1/teacher/daily?date=2026-10-29')->assertUnprocessable();
        $this->meals([['child_id' => $this->ali->id]], ['group_id' => $other->id])->assertNotFound();
        $this->assertSame(0, MealRecord::count());
    }

    public function test_guruhsiz_tarbiyachi_bosh_javob(): void
    {
        $this->teacher->groups()->detach();

        $this->as()->getJson('/api/v1/teacher/daily')->assertOk()
             ->assertJsonPath('group', null)->assertJsonPath('children', [])->assertJsonPath('editable', false);
    }

    // ── Ovqatlanish ───────────────────────────────────────────────

    public function test_ovqat_yoziladi_va_takrorlansa_yangilanadi_audit_bilan(): void
    {
        $this->present($this->ali, $this->vali);
        $this->meals([['child_id' => $this->ali->id, 'note' => 'Hammasini yedi'], ['child_id' => $this->vali->id]])
             ->assertOk()->assertJsonPath('message', 'Ovqatlanish saqlandi.');

        $this->assertDatabaseHas('meal_records', [
            'child_id' => $this->ali->id, 'meal_type' => 'tushlik', 'note' => 'Hammasini yedi',
            'group_id' => $this->group->id, 'organization_id' => $this->org->id, 'recorded_by' => $this->user->id,
        ]);
        $this->assertSame(0, ActivityLog::where('action', 'daily.meal.updated')->count());

        // Xuddi shu qiymat — o'zgarish yo'q, log yo'q
        $this->meals([['child_id' => $this->ali->id, 'note' => 'Hammasini yedi']])->assertOk();
        $this->assertSame(0, ActivityLog::where('action', 'daily.meal.updated')->count());

        // Tuzatish — yangi qator emas, audit log
        $this->meals([['child_id' => $this->ali->id, 'note' => 'Yarmini yedi']], ['served_at' => '12:45'])->assertOk();
        $this->assertSame(1, MealRecord::where('child_id', $this->ali->id)->count());
        $log = ActivityLog::where('action', 'daily.meal.updated')->sole();
        $this->assertSame(['served_at' => '12:30', 'ate' => true, 'note' => 'Hammasini yedi'], $log->meta['old']);
        $this->assertSame(['served_at' => '12:45', 'ate' => true, 'note' => 'Yarmini yedi'], $log->meta['new']);
        $this->assertSame($this->org->id, $log->organization_id);
    }

    public function test_kelmadi_deb_belgilangan_bolaga_ovqat_va_uyqu_yozilmaydi(): void
    {
        $this->attendance($this->ali, 'absent');
        $this->present($this->vali);

        $this->meals([['child_id' => $this->vali->id], ['child_id' => $this->ali->id]])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records.0', "Valiyev Ali bu kuni davomatda «Kelmadi» deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.");
        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:00']])->assertUnprocessable();

        // Butun so'rov rad etiladi — boshqa bolaga ham yozilmaydi
        $this->assertSame(0, MealRecord::count());
        $this->assertSame(0, SleepRecord::count());
    }

    public function test_sababli_holati_alohida_xabar_bilan_rad_etiladi(): void
    {
        $this->attendance($this->ali, 'excused');

        $this->meals([['child_id' => $this->ali->id]])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records.0', "Valiyev Ali bu kuni davomatda «Sababli» (bog'chaga kelmagan) deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.");
        $this->assertSame(0, MealRecord::count());
    }

    public function test_belgilanmagan_bolaga_yozilmaydi_faqat_keldi_ga_yoziladi(): void
    {
        $this->present($this->ali);

        // Vali uchun davomat belgilanmagan — butun so'rov rad etiladi
        $this->meals([['child_id' => $this->ali->id], ['child_id' => $this->vali->id]])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records', ["Aliyev Vali uchun bu kuni davomat belgilanmagan — avval davomatda «Keldi» deb belgilang."]);
        $this->sleep([['child_id' => $this->vali->id, 'started_at' => '13:00']])->assertUnprocessable();
        $this->assertSame(0, MealRecord::count());
        $this->assertSame(0, SleepRecord::count());

        $this->meals([['child_id' => $this->ali->id]])->assertOk();
        $this->assertSame(1, MealRecord::count());
    }

    public function test_bir_nechta_rad_etilgan_bola_uchun_har_biriga_xabar(): void
    {
        $this->attendance($this->ali, 'excused');

        $this->meals([['child_id' => $this->ali->id], ['child_id' => $this->vali->id]])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records', [
                 "Valiyev Ali bu kuni davomatda «Sababli» (bog'chaga kelmagan) deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.",
                 "Aliyev Vali uchun bu kuni davomat belgilanmagan — avval davomatda «Keldi» deb belgilang.",
             ]);
    }

    public function test_davomat_keldi_ga_ozgartirilgach_yozish_ochiladi(): void
    {
        $this->attendance($this->ali, 'excused');
        $this->meals([['child_id' => $this->ali->id]])->assertUnprocessable();

        Attendance::where('child_id', $this->ali->id)->update(['status' => 'present']);
        $this->meals([['child_id' => $this->ali->id]])->assertOk();
    }

    public function test_boshqa_guruh_va_boshqa_bogcha_bolasi_422(): void
    {
        $otherGroupChild = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => Group::factory()->create(['organization_id' => $this->org->id])->id]);
        $foreign = Child::factory()->create();

        foreach ([$otherGroupChild, $foreign] as $child) {
            $this->meals([['child_id' => $child->id]])
                 ->assertUnprocessable()->assertJsonPath('errors.records.0', "Ro'yxatdagi bolalardan biri bu guruhga tegishli emas.");
        }
        $this->assertSame(0, MealRecord::count());
    }

    public function test_ovqat_validatsiyasi(): void
    {
        foreach ([
            ['meal_type' => 'kechlik'],
            ['meal_type' => ''],
            ['served_at' => '25:00'],
            ['served_at' => '12:30:00'],
            ['date' => '28.10.2026'],
            ['records' => []],
            ['records' => [['child_id' => $this->ali->id], ['child_id' => $this->ali->id]]],
            ['records' => [['child_id' => $this->ali->id, 'note' => str_repeat('a', 256)]]],
        ] as $override) {
            $body = $override + [
                'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
                'records' => [['child_id' => $this->ali->id]],
            ];
            $this->as()->putJson('/api/v1/teacher/daily/meals', $body)->assertUnprocessable();
        }
        $this->assertSame(0, MealRecord::count());
    }

    public function test_bugun_uchun_kelajak_vaqti_422_otgan_kun_uchun_ruxsat(): void
    {
        $this->present($this->ali);
        $this->attendance($this->ali, 'present', '2026-10-27');
        $this->meals([['child_id' => $this->ali->id]], ['served_at' => '18:00'])
             ->assertUnprocessable()->assertJsonValidationErrors('served_at');
        $this->meals([['child_id' => $this->ali->id]], ['served_at' => '18:00', 'date' => '2026-10-27'])->assertOk();
    }

    public function test_muddat_va_kelajak_sanasi_backendda_majburiy(): void
    {
        $this->attendance($this->ali, 'present', '2026-10-26');
        $this->attendance($this->ali, 'present', '2026-10-25');
        $this->meals([['child_id' => $this->ali->id]], ['date' => '2026-10-26'])->assertOk();   // 2 kun oldin
        $this->meals([['child_id' => $this->ali->id]], ['date' => '2026-10-25'])
             ->assertForbidden()->assertJsonPath('message', "Bu sana uchun yozuvlarni o'zgartirish muddati tugagan.");
        $this->meals([['child_id' => $this->ali->id]], ['date' => '2026-10-29'])
             ->assertForbidden()->assertJsonPath('message', "Kelajakdagi sana uchun yozuv kiritib bo'lmaydi.");
    }

    public function test_ovqatni_ochirish_audit_bilan_va_qayta_yozish(): void
    {
        $this->present($this->ali);
        $this->meals([['child_id' => $this->ali->id]])->assertOk();
        $meal = MealRecord::sole();

        $this->as()->deleteJson("/api/v1/teacher/daily/meals/{$meal->id}")->assertOk()
             ->assertJsonPath('message', "Ovqatlanish yozuvi o'chirildi.");
        $this->assertSoftDeleted('meal_records', ['id' => $meal->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'daily.meal.deleted', 'organization_id' => $this->org->id]);

        $this->meals([['child_id' => $this->ali->id]])->assertOk();
        $this->assertSame(1, MealRecord::count());
    }

    public function test_yozuvni_id_orqali_ochirish_chegaralari(): void
    {
        $foreign       = MealRecord::factory()->create();
        $otherGroup    = Group::factory()->create(['organization_id' => $this->org->id]);
        $otherGroupRec = MealRecord::factory()->create(['child_id' => Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $otherGroup->id])->id]);
        $old           = MealRecord::factory()->create(['child_id' => $this->ali->id, 'date' => '2026-10-20']);

        $this->as()->deleteJson("/api/v1/teacher/daily/meals/{$foreign->id}")->assertNotFound();
        $this->as()->deleteJson("/api/v1/teacher/daily/meals/{$otherGroupRec->id}")->assertNotFound();
        $this->as()->deleteJson("/api/v1/teacher/daily/meals/{$old->id}")->assertForbidden();
        $this->as()->deleteJson('/api/v1/teacher/daily/meals/abc')->assertNotFound();

        $this->assertSame(3, MealRecord::count());
    }

    // ── Uyqu ──────────────────────────────────────────────────────

    public function test_uyqu_hali_uxlayapti_keyin_tugash_vaqti_qoshiladi(): void
    {
        $this->present($this->ali);
        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:00']])->assertOk()
             ->assertJsonPath('children.1.sleep.is_sleeping', true)
             ->assertJsonPath('children.1.sleep.status_text', 'Hali uxlayapti');

        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:00', 'ended_at' => '15:10']])->assertOk()
             ->assertJsonPath('children.1.sleep.ended_at', '15:10')
             ->assertJsonPath('children.1.sleep.is_sleeping', false);

        $this->assertSame(1, SleepRecord::count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'daily.sleep.updated']);
    }

    public function test_uyqu_tugashi_boshlanishdan_oldin_yoki_teng_bolmaydi(): void
    {
        foreach (['12:59', '13:00'] as $end) {
            $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:00', 'ended_at' => $end]])
                 ->assertUnprocessable()
                 ->assertJsonPath('errors', ['records.0.ended_at' => ["Uyg'onish vaqti uxlash boshlangan vaqtdan keyin bo'lishi kerak."]]);
        }
        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '17:00']])->assertUnprocessable(); // bugun, hali kelmagan vaqt
        $this->assertSame(0, SleepRecord::count());
    }

    public function test_uyqu_validatsiyasi(): void
    {
        foreach ([
            [['child_id' => $this->ali->id]],
            [['child_id' => $this->ali->id, 'started_at' => '1300']],
            [['child_id' => $this->ali->id, 'started_at' => '13:00', 'ended_at' => '15']],
            [['child_id' => $this->ali->id, 'started_at' => '13:00'], ['child_id' => $this->ali->id, 'started_at' => '13:30']],
        ] as $records) {
            $this->sleep($records)->assertUnprocessable();
        }
        $this->assertSame(0, SleepRecord::count());
    }

    public function test_uyquni_ochirish(): void
    {
        $this->present($this->ali);
        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:00', 'ended_at' => '15:00']])->assertOk();
        $sleep = SleepRecord::sole();

        $this->as()->deleteJson("/api/v1/teacher/daily/sleep/{$sleep->id}")->assertOk();
        $this->assertSoftDeleted('sleep_records', ['id' => $sleep->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'daily.sleep.deleted']);
        $this->sleep([['child_id' => $this->ali->id, 'started_at' => '13:30']])->assertOk();
    }

    // ── Mashg'ulotlar ─────────────────────────────────────────────

    public function test_mashgulot_yaratish_tahrirlash_ochirish(): void
    {
        $this->as()->postJson('/api/v1/teacher/daily/activities', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'title' => 'Rasm chizish', 'description' => 'Kuz manzarasi', 'starts_at' => '10:00',
        ])->assertCreated()->assertJsonPath('activities.0.title', 'Rasm chizish');
        $this->as()->postJson('/api/v1/teacher/daily/activities', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'title' => 'Musiqa',
        ])->assertCreated()->assertJsonCount(2, 'activities');

        $activity = GroupActivity::where('title', 'Rasm chizish')->sole();
        $this->assertSame($this->org->id, $activity->organization_id);

        $this->as()->putJson("/api/v1/teacher/daily/activities/{$activity->id}", ['title' => 'Loy bilan ishlash', 'group_id' => 999, 'date' => '2026-10-01'])
             ->assertOk()->assertJsonPath('message', "Mashg'ulot yangilandi.");
        $this->assertSame('Loy bilan ishlash', $activity->fresh()->title);
        $this->assertSame($this->group->id, $activity->fresh()->group_id);
        $this->assertSame(self::TODAY, $activity->fresh()->date->toDateString());
        $log = ActivityLog::where('action', 'daily.activity.updated')->sole();
        $this->assertSame('Rasm chizish', $log->meta['old']['title']);

        $this->as()->deleteJson("/api/v1/teacher/daily/activities/{$activity->id}")->assertOk();
        $this->assertSoftDeleted('group_activities', ['id' => $activity->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'daily.activity.deleted']);
    }

    public function test_mashgulot_validatsiyasi_va_chegaralari(): void
    {
        foreach ([
            ['title' => ''],
            ['title' => str_repeat('a', 151)],
            ['description' => str_repeat('a', 1001)],
            ['starts_at' => '9'],
        ] as $override) {
            $this->as()->postJson('/api/v1/teacher/daily/activities', $override + [
                'date' => self::TODAY, 'group_id' => $this->group->id, 'title' => 'Rasm',
            ])->assertUnprocessable();
        }

        $foreign = GroupActivity::factory()->create();
        $this->as()->putJson("/api/v1/teacher/daily/activities/{$foreign->id}", ['title' => 'X'])->assertNotFound();
        $this->as()->deleteJson("/api/v1/teacher/daily/activities/{$foreign->id}")->assertNotFound();
        $this->as()->postJson('/api/v1/teacher/daily/activities', ['date' => '2026-10-25', 'group_id' => $this->group->id, 'title' => 'X'])->assertForbidden();

        $this->assertSame(1, GroupActivity::count());
        $this->assertNotSame('X', $foreign->fresh()->title);
    }

    // ── Tarix ─────────────────────────────────────────────────────

    public function test_bola_guruhi_almashgach_eski_yozuv_eski_guruhda_qoladi(): void
    {
        $this->attendance($this->ali, 'present', '2026-10-27');
        $this->meals([['child_id' => $this->ali->id]], ['date' => '2026-10-27'])->assertOk();

        $newGroup = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->ali->update(['group_id' => $newGroup->id]);

        $this->assertDatabaseHas('meal_records', ['child_id' => $this->ali->id, 'group_id' => $this->group->id, 'date' => '2026-10-27']);
        $names = collect($this->as()->getJson('/api/v1/teacher/daily?date=2026-10-27')->json('children'))->pluck('first_name');
        $this->assertContains('Ali', $names);
        $names = collect($this->as()->getJson('/api/v1/teacher/daily?date=' . self::TODAY)->json('children'))->pluck('first_name');
        $this->assertNotContains('Ali', $names);
    }
}
