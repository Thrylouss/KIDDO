<?php

namespace Tests\Feature\Daily;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\Organization;
use App\Models\SleepRecord;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bog'cha admini: /v1/admin/daily — barcha guruhlar, 30 kun orqaga, faqat o'z bog'chasi.
 */
class AdminDailyTest extends TestCase
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
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));

        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->group = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->child = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        // Ovqatlanish va uyqu faqat «Keldi» bolaga yoziladi
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => self::TODAY, 'status' => 'present']);
    }

    private function as(?User $user = null, array $headers = [])
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user ?? $this->admin, 'sanctum')->withHeaders($headers);
    }

    private function mealBody(array $extra = []): array
    {
        return $extra + [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'nonushta', 'served_at' => '08:30',
            'records' => [['child_id' => $this->child->id]],
        ];
    }

    public function test_admin_barcha_guruhlarni_korad_va_yozadi(): void
    {
        $second = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Oy']);

        $this->as()->getJson('/api/v1/admin/daily')->assertOk()
             ->assertJsonCount(2, 'groups')->assertJsonPath('group.name', 'Oy');
        $this->as()->getJson("/api/v1/admin/daily?group_id={$this->group->id}")->assertOk()
             ->assertJsonPath('group.id', $this->group->id)->assertJsonCount(1, 'children');

        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody())->assertOk();
        $this->assertDatabaseHas('meal_records', ['child_id' => $this->child->id, 'recorded_by' => $this->admin->id]);
        $this->assertNotNull($second);
    }

    public function test_admin_30_kunlik_muddat(): void
    {
        foreach (['2026-09-28', '2026-09-27'] as $date) {
            Attendance::factory()->create(['child_id' => $this->child->id, 'date' => $date, 'status' => 'present']);
        }
        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody(['date' => '2026-09-28']))->assertOk();
        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody(['date' => '2026-09-27']))->assertForbidden();
        $this->as()->putJson('/api/v1/admin/daily/sleep', [
            'date' => '2026-09-27', 'group_id' => $this->group->id, 'records' => [['child_id' => $this->child->id, 'started_at' => '13:00']],
        ])->assertForbidden();
    }

    public function test_kelmagan_bola_admin_uchun_ham_rad_etiladi(): void
    {
        Attendance::where('child_id', $this->child->id)->update(['status' => 'absent']);

        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody())->assertUnprocessable();
        $this->assertSame(0, MealRecord::count());
    }

    public function test_boshqa_bogcha_guruhi_bolasi_va_yozuvlari_yopiq(): void
    {
        $otherOrg   = Organization::factory()->create();
        $foreignGrp = Group::factory()->create(['organization_id' => $otherOrg->id]);
        $foreignKid = Child::factory()->create(['organization_id' => $otherOrg->id, 'group_id' => $foreignGrp->id]);
        $meal       = MealRecord::factory()->create(['child_id' => $foreignKid->id, 'date' => self::TODAY]);
        $sleep      = SleepRecord::factory()->create(['child_id' => $foreignKid->id, 'date' => self::TODAY]);
        $activity   = GroupActivity::factory()->create(['group_id' => $foreignGrp->id, 'date' => self::TODAY]);

        $this->as()->getJson("/api/v1/admin/daily?group_id={$foreignGrp->id}")->assertNotFound();
        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody(['group_id' => $foreignGrp->id, 'records' => [['child_id' => $foreignKid->id]]]))->assertNotFound();
        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody(['records' => [['child_id' => $foreignKid->id]]]))->assertUnprocessable();
        $this->as()->deleteJson("/api/v1/admin/daily/meals/{$meal->id}")->assertNotFound();
        $this->as()->deleteJson("/api/v1/admin/daily/sleep/{$sleep->id}")->assertNotFound();
        $this->as()->putJson("/api/v1/admin/daily/activities/{$activity->id}", ['title' => 'X'])->assertNotFound();
        $this->as()->deleteJson("/api/v1/admin/daily/activities/{$activity->id}")->assertNotFound();
        $this->as()->postJson('/api/v1/admin/daily/activities', ['date' => self::TODAY, 'group_id' => $foreignGrp->id, 'title' => 'X'])->assertNotFound();

        $this->assertNotSoftDeleted('meal_records', ['id' => $meal->id]);
        $this->assertNotSoftDeleted('sleep_records', ['id' => $sleep->id]);
        $this->assertNotSame('X', $activity->fresh()->title);
        $this->assertSame(1, MealRecord::count());
    }

    public function test_sorovdagi_organization_id_etiborga_olinmaydi(): void
    {
        $otherOrg = Organization::factory()->create();

        $this->as()->postJson('/api/v1/admin/daily/activities', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'title' => 'Rasm', 'organization_id' => $otherOrg->id,
        ])->assertCreated();
        $this->as()->putJson('/api/v1/admin/daily/meals', $this->mealBody(['organization_id' => $otherOrg->id]))->assertOk();

        $this->assertSame($this->org->id, GroupActivity::sole()->organization_id);
        $this->assertSame($this->org->id, MealRecord::sole()->organization_id);
    }

    public function test_tarbiyachi_ota_ona_va_autentifikatsiyasiz_admin_endpointiga_kira_olmaydi(): void
    {
        foreach ([
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
        ] as $user) {
            $this->as($user)->getJson('/api/v1/admin/daily')->assertForbidden();
            $this->as($user)->putJson('/api/v1/admin/daily/meals', $this->mealBody())->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/daily')->assertUnauthorized();
        $this->assertSame(0, MealRecord::count());
    }

    public function test_super_admin_faqat_impersonatsiya_orqali(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->as($sa)->getJson('/api/v1/admin/daily')->assertForbidden();
        $this->as($sa, ['X-Impersonated-Org' => (string) $this->org->id])
             ->getJson("/api/v1/admin/daily?group_id={$this->group->id}")->assertOk();
        $this->as($sa, ['X-Impersonated-Org' => (string) $this->org->id])
             ->putJson('/api/v1/admin/daily/meals', $this->mealBody())->assertForbidden();
        $this->assertSame(0, MealRecord::count());

        $other = Organization::factory()->create();
        $this->as($sa, ['X-Impersonated-Org' => (string) $other->id])
             ->getJson("/api/v1/admin/daily?group_id={$this->group->id}")->assertNotFound();
    }

    public function test_bogchasiz_admin_bosh_javob_oladi_va_yoza_olmaydi(): void
    {
        $unassigned = User::factory()->admin()->create(['organization_id' => null]);

        $this->as($unassigned)->getJson('/api/v1/admin/daily')->assertOk()->assertJsonPath('groups', []);
        $this->as($unassigned)->putJson('/api/v1/admin/daily/meals', $this->mealBody())->assertNotFound();
    }

    public function test_admin_impersonatsiya_sarlavhasi_bilan_boshqa_bogchaga_otolmaydi(): void
    {
        $otherOrg   = Organization::factory()->create();
        $foreignGrp = Group::factory()->create(['organization_id' => $otherOrg->id]);

        $this->as(null, ['X-Impersonated-Org' => (string) $otherOrg->id])
             ->getJson("/api/v1/admin/daily?group_id={$foreignGrp->id}")->assertNotFound();
    }
}
