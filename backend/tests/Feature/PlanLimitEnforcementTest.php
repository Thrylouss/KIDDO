<?php

namespace Tests\Feature;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H8 — Plan Limit Enforcement
 *
 * Plan rows carry max_children, max_teachers, and max_groups caps but those
 * caps were never checked at creation time — any admin could exceed them
 * indefinitely.
 *
 * Fixes applied:
 *   - Organization::hasReachedPlanLimit(string $limitField): bool
 *     queries only active/trial subscriptions and compares the plan cap against
 *     the current resource count. null cap means "unlimited".
 *   - ChildController::store()  — checks max_children before inserting
 *   - TeacherController::store() — checks max_teachers before inserting
 *   - GroupController::store()  — checks max_groups  before inserting
 *
 * Graceful-degradation rule (MVP): past_due, expired, and cancelled
 * subscriptions do NOT trigger limit enforcement — billing lapses must not
 * lock out teachers and admins during the grace period.
 */
class PlanLimitEnforcementTest extends TestCase
{
    use RefreshDatabase;

    // ── helpers ────────────────────────────────────────────────────────

    private function orgWithAdmin(array $orgAttrs = []): array
    {
        $org   = Organization::factory()->create(array_merge(['is_active' => true], $orgAttrs));
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$org, $admin];
    }

    private function attachActiveSub(Organization $org, array $planAttrs = []): Subscription
    {
        $plan = Plan::factory()->create($planAttrs);
        return Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_ACTIVE,
        ]);
    }

    private function attachTrialSub(Organization $org, array $planAttrs = []): Subscription
    {
        $plan = Plan::factory()->create($planAttrs);
        return Subscription::factory()->trial()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
        ]);
    }

    // ── max_children ───────────────────────────────────────────────────

    public function test_creating_child_blocked_when_max_children_reached(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => 2]);

        Child::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Kamola',
                 'last_name'  => 'Test',
                 'birth_date' => '2022-01-01',
                 'gender'     => 'ayol',
             ])
             ->assertStatus(422)
             ->assertJsonPath('message', 'Reja limiti: bolalar soni chegarasiga yetildi.');
    }

    public function test_creating_child_allowed_when_under_max_children(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => 3]);

        Child::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Ali',
                 'last_name'  => 'Karimov',
                 'birth_date' => '2021-06-01',
                 'gender'     => 'erkak',
             ])
             ->assertCreated();
    }

    public function test_creating_child_allowed_when_plan_has_null_max_children(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => null]);

        Child::factory(100)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Zulfiya',
                 'last_name'  => 'Bek',
                 'birth_date' => '2020-05-10',
                 'gender'     => 'ayol',
             ])
             ->assertCreated();
    }

    // ── max_teachers ───────────────────────────────────────────────────

    public function test_creating_teacher_blocked_when_max_teachers_reached(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_teachers' => 1]);

        TeacherProfile::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Malika',
                 'last_name'  => 'Umarova',
                 'phone'      => '+998901230001',
                 'password'   => 'Password1',
             ])
             ->assertStatus(422)
             ->assertJsonPath('message', 'Reja limiti: tarbiyachilar soni chegarasiga yetildi.');
    }

    public function test_creating_teacher_allowed_when_under_max_teachers(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_teachers' => 5]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Jasur',
                 'last_name'  => 'Nazarov',
                 'phone'      => '+998901230002',
                 'password'   => 'Password1',
             ])
             ->assertCreated();
    }

    public function test_creating_teacher_allowed_when_plan_has_null_max_teachers(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_teachers' => null]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Dilnoza',
                 'last_name'  => 'Tosheva',
                 'phone'      => '+998901230003',
                 'password'   => 'Password1',
             ])
             ->assertCreated();
    }

    // ── max_groups ─────────────────────────────────────────────────────

    public function test_creating_group_blocked_when_max_groups_reached(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_groups' => 2]);

        Group::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', [
                 'name' => 'Yangi guruh',
             ])
             ->assertStatus(422)
             ->assertJsonPath('message', 'Reja limiti: guruhlar soni chegarasiga yetildi.');
    }

    public function test_creating_group_allowed_when_under_max_groups(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_groups' => 3]);

        Group::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', [
                 'name' => 'Kichkintoylar',
             ])
             ->assertCreated();
    }

    public function test_creating_group_allowed_when_plan_has_null_max_groups(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_groups' => null]);

        Group::factory(50)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', [
                 'name' => 'Cheksiz guruh',
             ])
             ->assertCreated();
    }

    // ── No subscription — no limit ──────────────────────────────────────

    public function test_creation_allowed_when_org_has_no_subscription(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        // No subscription attached — limits must be skipped entirely.

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Bola',
                 'last_name'  => 'Nosub',
                 'birth_date' => '2022-01-01',
                 'gender'     => 'erkak',
             ])
             ->assertCreated();
    }

    // ── Trial subscription enforces limits ─────────────────────────────

    public function test_trial_subscription_enforces_max_children(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachTrialSub($org, ['max_children' => 1]);

        Child::factory(1)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Ikkinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2022-01-01',
                 'gender'     => 'ayol',
             ])
             ->assertStatus(422);
    }

    // ── Graceful degradation: expired/cancelled skip enforcement ───────

    public function test_expired_subscription_does_not_enforce_limits(): void
    {
        [$org, $admin] = $this->orgWithAdmin();

        $plan = Plan::factory()->create(['max_children' => 1]);
        Subscription::factory()->expired()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
        ]);

        Child::factory(5)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Oltinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2021-01-01',
                 'gender'     => 'erkak',
             ])
             ->assertCreated();
    }

    public function test_cancelled_subscription_does_not_enforce_limits(): void
    {
        [$org, $admin] = $this->orgWithAdmin();

        $plan = Plan::factory()->create(['max_children' => 1]);
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_CANCELLED,
        ]);

        Child::factory(5)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Yettinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2021-01-01',
                 'gender'     => 'erkak',
             ])
             ->assertCreated();
    }

    // ── Limit at exactly the cap boundary ──────────────────────────────

    public function test_child_at_exact_cap_is_blocked(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => 3]);

        Child::factory(3)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'To\'rtinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2022-01-01',
                 'gender'     => 'erkak',
             ])
             ->assertStatus(422);
    }

    public function test_child_one_below_cap_is_allowed(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => 3]);

        Child::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Uchinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2022-01-01',
                 'gender'     => 'ayol',
             ])
             ->assertCreated();
    }

    // ── Cross-org isolation: limits only count own org's resources ──────

    public function test_other_org_resources_do_not_count_toward_limit(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $this->attachActiveSub($org, ['max_children' => 2]);

        // Another org has 10 children — must not count against our cap.
        $other = Organization::factory()->create();
        Child::factory(10)->create(['organization_id' => $other->id]);

        // Our org has 1 child — still under our cap of 2.
        Child::factory(1)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Ikkinchi',
                 'last_name'  => 'Bola',
                 'birth_date' => '2021-01-01',
                 'gender'     => 'erkak',
             ])
             ->assertCreated();
    }
}
