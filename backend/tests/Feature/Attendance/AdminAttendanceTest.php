<?php

namespace Tests\Feature\Attendance;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bog'cha admini: GET/PUT /v1/admin/attendance — o'z bog'chasi, 30 kunlik tuzatish oynasi.
 */
class AdminAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private User $admin;
    private Group $group;
    private Child $child;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 10:00', 'Asia/Tashkent'));

        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->group = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Asal']);
        $this->child = Child::factory()->inGroup($this->group)->create();
    }

    private function mark(array $records, string $date = self::TODAY, ?int $groupId = null, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->admin, 'sanctum')->putJson('/api/v1/admin/attendance', [
            'date' => $date, 'group_id' => $groupId ?? $this->group->id, 'records' => $records,
        ]);
    }

    public function test_admin_guruh_davomatini_koradi(): void
    {
        Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Bahor']);
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => self::TODAY, 'status' => 'present']);

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/attendance')
             ->assertOk()
             ->assertJsonCount(2, 'groups')
             ->assertJsonPath('group.id', $this->group->id)       // nom bo'yicha birinchi: "Asal"
             ->assertJsonPath('editable_from', '2026-09-28')
             ->assertJsonPath('children.0.status', 'present');
    }

    public function test_boshqa_bogcha_guruhi_404_va_royxatda_yoq(): void
    {
        $foreign = Group::factory()->create();

        $this->actingAs($this->admin, 'sanctum')
             ->getJson("/api/v1/admin/attendance?group_id={$foreign->id}")
             ->assertNotFound();
        $this->mark([['child_id' => $this->child->id, 'status' => 'present']], self::TODAY, $foreign->id)->assertNotFound();

        $ids = collect($this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/attendance')->json('groups'))->pluck('id');
        $this->assertFalse($ids->contains($foreign->id));
        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_boshqa_bogcha_bolasi_rad_etiladi(): void
    {
        $this->mark([['child_id' => Child::factory()->create()->id, 'status' => 'present']])
             ->assertStatus(422);
        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_tuzatish_oynasi_30_kun_va_audit(): void
    {
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => '2026-10-08', 'status' => 'absent']);

        $this->mark([['child_id' => $this->child->id, 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Ma\'lumotnoma keltirildi']], '2026-10-08')
             ->assertOk();
        $this->mark([['child_id' => $this->child->id, 'status' => 'present']], '2026-09-27')->assertForbidden();
        $this->mark([['child_id' => $this->child->id, 'status' => 'present']], '2026-10-29')->assertForbidden();

        $log = ActivityLog::where('action', 'attendance.updated')->sole();
        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame('excused', $log->meta['new']['status']);
        $this->assertDatabaseHas('attendances', ['child_id' => $this->child->id, 'status' => 'excused', 'marked_by' => $this->admin->id]);
    }

    public function test_tarbiyachi_va_ota_ona_admin_endpointiga_kira_olmaydi(): void
    {
        foreach ([
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
        ] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson('/api/v1/admin/attendance')->assertForbidden();
            $this->mark([['child_id' => $this->child->id, 'status' => 'present']], self::TODAY, null, $user)->assertForbidden();
        }
        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_super_admin_faqat_impersonatsiya_orqali(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/admin/attendance')->assertForbidden();

        $this->actingAs($sa, 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $this->org->id])
             ->getJson('/api/v1/admin/attendance?date=' . self::TODAY . "&group_id={$this->group->id}")->assertOk();

        // Davomat — kundalik boshqaruv: Super Admin belgilay olmaydi
        $this->actingAs($sa, 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $this->org->id])
             ->putJson('/api/v1/admin/attendance', [
                 'date' => self::TODAY, 'group_id' => $this->group->id,
                 'records' => [['child_id' => $this->child->id, 'status' => 'present']],
             ])->assertForbidden();

        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_guruhsiz_bogcha_bosh_holat(): void
    {
        $emptyOrg = Organization::factory()->create();
        $admin    = User::factory()->admin()->create(['organization_id' => $emptyOrg->id]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/attendance')
             ->assertOk()
             ->assertJsonPath('groups', [])
             ->assertJsonPath('group', null);
    }
}
