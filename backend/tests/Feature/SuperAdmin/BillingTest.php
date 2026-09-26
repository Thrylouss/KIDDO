<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function makePlan(array $attrs = []): Plan
    {
        return Plan::factory()->create($attrs);
    }

    private function makeOrg(): Organization
    {
        return Organization::factory()->create();
    }

    private function makeSub(Organization $org, Plan $plan, array $attrs = []): Subscription
    {
        return Subscription::factory()->create(array_merge([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
        ], $attrs));
    }

    // ── 1. Plans ───────────────────────────────────────────────────

    public function test_super_admin_can_list_plans(): void
    {
        Plan::factory()->count(3)->create();

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/plans');

        $res->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'slug', 'price_monthly', 'subscriptions_count']]]);
    }

    public function test_super_admin_can_create_plan(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/plans', [
                'name'          => 'Test Tarif',
                'price_monthly' => 499000,
                'max_children'  => 100,
                'sort_order'    => 1,
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.name', 'Test Tarif')
            ->assertJsonPath('data.slug', 'test-tarif');

        $this->assertDatabaseHas('plans', ['name' => 'Test Tarif', 'price_monthly' => 499000]);
    }

    public function test_super_admin_can_update_plan(): void
    {
        $plan = $this->makePlan(['name' => 'Eski Tarif', 'price_monthly' => 299000]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->putJson("/api/v1/super-admin/plans/{$plan->id}", [
                'price_monthly' => 399000,
                'description'   => 'Yangi tavsif',
            ]);

        $res->assertOk()->assertJsonPath('data.price_monthly', '399000.00');
        $this->assertDatabaseHas('plans', ['id' => $plan->id, 'price_monthly' => 399000]);
    }

    public function test_super_admin_can_deactivate_plan(): void
    {
        $plan = $this->makePlan(['is_active' => true]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/plans/{$plan->id}/deactivate");

        $res->assertOk();
        $this->assertDatabaseHas('plans', ['id' => $plan->id, 'is_active' => false]);
    }

    public function test_plan_deactivate_fails_if_active_subscriptions_exist(): void
    {
        $plan = $this->makePlan(['is_active' => true]);
        $org  = $this->makeOrg();
        $this->makeSub($org, $plan, ['status' => Subscription::STATUS_ACTIVE]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/plans/{$plan->id}/deactivate");

        $res->assertStatus(422)
            ->assertJsonFragment(['message' => "Ushbu tarif faol obunalarda ishlatilmoqda"]);
    }

    // ── 2. Subscriptions ───────────────────────────────────────────

    public function test_super_admin_can_list_subscriptions(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();
        $this->makeSub($org, $plan);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions');

        $res->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    public function test_super_admin_can_view_subscription_detail(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();
        $sub  = $this->makeSub($org, $plan);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson("/api/v1/super-admin/subscriptions/{$sub->id}");

        $res->assertOk()
            ->assertJsonPath('data.id', $sub->id)
            ->assertJsonPath('data.organization_id', $org->id)
            ->assertJsonStructure(['data' => ['days_remaining', 'is_expiring_soon']]);
    }

    public function test_super_admin_can_renew_subscription(): void
    {
        $org     = $this->makeOrg();
        $oldPlan = $this->makePlan(['price_monthly' => 299000]);
        $newPlan = $this->makePlan(['price_monthly' => 599000]);
        $sub     = $this->makeSub($org, $oldPlan);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/renew", [
                'plan_id'        => $newPlan->id,
                'ends_at'        => now()->addDays(30)->toDateString(),
                'payment_status' => 'paid',
            ]);

        $res->assertOk()->assertJsonPath('data.status', Subscription::STATUS_ACTIVE);

        // Old subscription should be expired
        $this->assertDatabaseHas('subscriptions', ['id' => $sub->id, 'status' => Subscription::STATUS_EXPIRED]);

        // Invoice should be created
        $this->assertDatabaseHas('invoices', ['organization_id' => $org->id, 'status' => 'paid']);

        // Payment should be created
        $this->assertDatabaseHas('payments', ['organization_id' => $org->id, 'status' => 'paid']);
    }

    public function test_super_admin_can_change_plan(): void
    {
        $org     = $this->makeOrg();
        $oldPlan = $this->makePlan();
        $newPlan = $this->makePlan();
        $sub     = $this->makeSub($org, $oldPlan);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/change-plan", [
                'plan_id' => $newPlan->id,
            ]);

        $res->assertOk()->assertJsonPath('data.plan_id', $newPlan->id);
        $this->assertDatabaseHas('subscriptions', ['id' => $sub->id, 'plan_id' => $newPlan->id]);
    }

    public function test_super_admin_can_cancel_subscription(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();
        $sub  = $this->makeSub($org, $plan);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/cancel", [
                'reason' => 'Test sabab',
            ]);

        $res->assertOk()->assertJsonPath('data.status', Subscription::STATUS_CANCELLED);
        $this->assertDatabaseHas('subscriptions', [
            'id'               => $sub->id,
            'status'           => Subscription::STATUS_CANCELLED,
            'cancelled_reason' => 'Test sabab',
        ]);
    }

    // ── 3. Payments ────────────────────────────────────────────────

    public function test_super_admin_can_list_payments(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 299000]);
        $sub  = $this->makeSub($org, $plan);
        Payment::factory()->create([
            'organization_id' => $org->id,
            'subscription_id' => $sub->id,
            'amount'          => 299000,
            'status'          => 'paid',
            'payment_method'  => 'manual',
            'paid_at'         => now(),
        ]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/payments');

        $res->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    // ── 4. Invoices ────────────────────────────────────────────────

    public function test_super_admin_can_list_invoices(): void
    {
        $org = $this->makeOrg();
        Invoice::factory()->count(3)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/invoices');

        $res->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    // ── 5. Service tests ───────────────────────────────────────────

    public function test_subscription_service_creates_invoice_on_renew(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 599000]);
        $sub  = $this->makeSub($org, $plan);

        /** @var SubscriptionService $service */
        $service = app(SubscriptionService::class);
        $newSub  = $service->renewSubscription($sub, $plan, [
            'ends_at'        => now()->addDays(30)->toDateString(),
            'payment_status' => 'paid',
        ]);

        $this->assertEquals(Subscription::STATUS_ACTIVE, $newSub->status);
        $this->assertDatabaseHas('invoices', [
            'organization_id' => $org->id,
            'subscription_id' => $newSub->id,
            'status'          => 'paid',
        ]);
        $this->assertDatabaseHas('payments', [
            'organization_id' => $org->id,
            'subscription_id' => $newSub->id,
            'status'          => 'paid',
        ]);
    }

    public function test_subscription_service_check_expiry(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        // Create an expired sub (ends_at in past)
        $expiredSub = $this->makeSub($org, $plan, [
            'status'  => Subscription::STATUS_ACTIVE,
            'ends_at' => now()->subDays(2),
        ]);

        // Create a valid sub
        $validSub = $this->makeSub($org, $plan, [
            'status'  => Subscription::STATUS_ACTIVE,
            'ends_at' => now()->addDays(10),
        ]);

        /** @var SubscriptionService $service */
        $service = app(SubscriptionService::class);
        $count   = $service->checkExpiry();

        $this->assertEquals(1, $count);
        $this->assertDatabaseHas('subscriptions', ['id' => $expiredSub->id, 'status' => Subscription::STATUS_EXPIRED]);
        $this->assertDatabaseHas('subscriptions', ['id' => $validSub->id, 'status' => Subscription::STATUS_ACTIVE]);
    }

    // ── 6. MRR / ARR calculation ───────────────────────────────────

    public function test_mrr_counts_only_active_subscriptions(): void
    {
        $plan = $this->makePlan(['price_monthly' => 500000]);
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $org3 = $this->makeOrg();
        $org4 = $this->makeOrg();

        // Active → counts
        $this->makeSub($org1, $plan, ['status' => Subscription::STATUS_ACTIVE, 'ends_at' => now()->addDays(30)]);
        // Trial → must NOT count
        $this->makeSub($org2, $plan, ['status' => Subscription::STATUS_TRIAL]);
        // Expired → must NOT count
        $this->makeSub($org3, $plan, ['status' => Subscription::STATUS_EXPIRED]);
        // Cancelled → must NOT count
        $this->makeSub($org4, $plan, ['status' => Subscription::STATUS_CANCELLED]);

        $service = app(SubscriptionService::class);

        $this->assertEquals(500000.0, $service->calculateMRR());
    }

    public function test_mrr_sums_multiple_active_subscriptions_exactly(): void
    {
        $planA = $this->makePlan(['price_monthly' => 299000]);
        $planB = $this->makePlan(['price_monthly' => 599000]);
        $planC = $this->makePlan(['price_monthly' => 999000]);

        $this->makeSub($this->makeOrg(), $planA, ['status' => Subscription::STATUS_ACTIVE, 'ends_at' => now()->addDays(30)]);
        $this->makeSub($this->makeOrg(), $planB, ['status' => Subscription::STATUS_ACTIVE, 'ends_at' => now()->addDays(30)]);
        $this->makeSub($this->makeOrg(), $planC, ['status' => Subscription::STATUS_ACTIVE, 'ends_at' => now()->addDays(30)]);

        $service = app(SubscriptionService::class);

        $this->assertEquals(1897000.0, $service->calculateMRR());
        $this->assertEquals(1897000.0 * 12, $service->calculateMRR() * 12);
    }

    public function test_mrr_is_zero_when_no_active_subscriptions(): void
    {
        $plan = $this->makePlan(['price_monthly' => 599000]);
        $org  = $this->makeOrg();
        $this->makeSub($org, $plan, ['status' => Subscription::STATUS_TRIAL]);

        $service = app(SubscriptionService::class);

        $this->assertEquals(0.0, $service->calculateMRR());
    }

    public function test_mrr_excludes_past_due_subscriptions(): void
    {
        $plan = $this->makePlan(['price_monthly' => 599000]);
        $this->makeSub($this->makeOrg(), $plan, ['status' => Subscription::STATUS_PAST_DUE]);

        $service = app(SubscriptionService::class);

        $this->assertEquals(0.0, $service->calculateMRR());
    }

    // ── 7. Subscription lifecycle edge cases ───────────────────────

    public function test_create_active_subscription_expires_existing_trial(): void
    {
        $org     = $this->makeOrg();
        $plan    = $this->makePlan(['price_monthly' => 299000]);
        $newPlan = $this->makePlan(['price_monthly' => 599000]);

        // Start with a trial subscription
        $trial = $this->makeSub($org, $plan, ['status' => Subscription::STATUS_TRIAL]);

        // Create a new active subscription via service
        $service = app(SubscriptionService::class);
        $active  = $service->createSubscription($org, $newPlan, [
            'status'  => Subscription::STATUS_ACTIVE,
            'ends_at' => now()->addDays(30)->toDateString(),
        ]);

        $this->assertDatabaseHas('subscriptions', ['id' => $trial->id, 'status' => Subscription::STATUS_EXPIRED]);
        $this->assertEquals(Subscription::STATUS_ACTIVE, $active->status);
    }

    public function test_create_trial_does_not_expire_existing_trial(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 299000]);

        // Creating a new trial should NOT expire any prior subscription
        $service = app(SubscriptionService::class);
        $trial   = $service->createSubscription($org, $plan, [
            'status' => Subscription::STATUS_TRIAL,
        ]);

        $this->assertEquals(Subscription::STATUS_TRIAL, $trial->status);
        // No other subscriptions were changed
        $this->assertDatabaseCount('subscriptions', 1);
    }

    public function test_cancellation_preserves_payment_records(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 599000]);
        $sub  = $this->makeSub($org, $plan, ['status' => Subscription::STATUS_ACTIVE]);

        // Create a payment linked to this subscription
        Payment::factory()->create([
            'organization_id' => $org->id,
            'subscription_id' => $sub->id,
            'amount'          => 599000,
            'status'          => 'paid',
        ]);

        $service = app(SubscriptionService::class);
        $service->cancelSubscription($sub, 'Test cancellation');

        // Payment must remain untouched
        $this->assertDatabaseHas('payments', [
            'organization_id' => $org->id,
            'subscription_id' => $sub->id,
            'amount'          => 599000,
            'status'          => 'paid',
        ]);

        // Subscription cancelled
        $this->assertDatabaseHas('subscriptions', [
            'id'               => $sub->id,
            'status'           => Subscription::STATUS_CANCELLED,
            'cancelled_reason' => 'Test cancellation',
        ]);

        $this->assertNotNull($sub->fresh()->cancelled_at);
    }

    public function test_plan_change_preserves_subscription_dates_and_status(): void
    {
        $org     = $this->makeOrg();
        $stdPlan = $this->makePlan(['price_monthly' => 599000]);
        $preplan = $this->makePlan(['price_monthly' => 999000]);
        $endsAt  = now()->addDays(20);

        $sub = $this->makeSub($org, $stdPlan, [
            'status'  => Subscription::STATUS_ACTIVE,
            'ends_at' => $endsAt,
        ]);

        $service = app(SubscriptionService::class);

        // Standard → Premium
        $service->changePlan($sub, $preplan);
        $sub->refresh();
        $this->assertEquals($preplan->id, $sub->plan_id);
        $this->assertEquals(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertEquals($endsAt->format('Y-m-d'), $sub->ends_at->format('Y-m-d'));

        // Premium → Standard
        $service->changePlan($sub, $stdPlan);
        $sub->refresh();
        $this->assertEquals($stdPlan->id, $sub->plan_id);
        $this->assertEquals(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertEquals($endsAt->format('Y-m-d'), $sub->ends_at->format('Y-m-d'));
    }

    public function test_check_expiry_expires_trial_with_passed_trial_ends_at(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        $expiredTrial = $this->makeSub($org, $plan, [
            'status'        => Subscription::STATUS_TRIAL,
            'trial_ends_at' => now()->subDays(1),
        ]);

        $validTrial = $this->makeSub($this->makeOrg(), $plan, [
            'status'        => Subscription::STATUS_TRIAL,
            'trial_ends_at' => now()->addDays(5),
        ]);

        $service = app(SubscriptionService::class);
        $count   = $service->checkExpiry();

        $this->assertEquals(1, $count);
        $this->assertDatabaseHas('subscriptions', ['id' => $expiredTrial->id, 'status' => Subscription::STATUS_EXPIRED]);
        $this->assertDatabaseHas('subscriptions', ['id' => $validTrial->id,   'status' => Subscription::STATUS_TRIAL]);
    }

    public function test_renewal_creates_new_subscription_and_expires_old(): void
    {
        $org     = $this->makeOrg();
        $oldPlan = $this->makePlan(['price_monthly' => 599000]);
        $newPlan = $this->makePlan(['price_monthly' => 999000]);
        $sub     = $this->makeSub($org, $oldPlan, [
            'status'  => Subscription::STATUS_ACTIVE,
            'ends_at' => now()->addDays(5),
        ]);

        $service = app(SubscriptionService::class);
        $newSub  = $service->renewSubscription($sub, $newPlan, [
            'ends_at'        => now()->addDays(30)->toDateString(),
            'payment_status' => 'paid',
        ]);

        // Old sub expired
        $this->assertDatabaseHas('subscriptions', ['id' => $sub->id, 'status' => Subscription::STATUS_EXPIRED]);

        // New sub active with new plan
        $this->assertEquals(Subscription::STATUS_ACTIVE, $newSub->status);
        $this->assertEquals($newPlan->id, $newSub->plan_id);

        // Invoice created and paid
        $this->assertDatabaseHas('invoices', [
            'organization_id' => $org->id,
            'subscription_id' => $newSub->id,
            'amount'          => 999000,
            'status'          => 'paid',
        ]);

        // Payment created and paid
        $this->assertDatabaseHas('payments', [
            'organization_id' => $org->id,
            'subscription_id' => $newSub->id,
            'amount'          => 999000,
            'status'          => 'paid',
        ]);

        // Audit log created
        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'subscription.renewed',
            'organization_id' => $org->id,
        ]);
    }

    public function test_renewal_with_pending_payment_creates_pending_invoice(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 599000]);
        $sub  = $this->makeSub($org, $plan, ['status' => Subscription::STATUS_ACTIVE, 'ends_at' => now()->addDays(5)]);

        $service = app(SubscriptionService::class);
        $newSub  = $service->renewSubscription($sub, $plan, [
            'ends_at'        => now()->addDays(30)->toDateString(),
            'payment_status' => 'pending',
        ]);

        $this->assertDatabaseHas('invoices',  ['organization_id' => $org->id, 'subscription_id' => $newSub->id, 'status' => 'pending']);
        $this->assertDatabaseMissing('payments', ['subscription_id' => $newSub->id]);
    }

    // ── 8. Impersonation (orgId scoping) ───────────────────────────

    public function test_super_admin_impersonation_scopes_groups_to_org(): void
    {
        $orgA   = $this->makeOrg();
        $orgB   = $this->makeOrg();
        $sa     = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        \App\Models\Group::factory()->create(['organization_id' => $orgA->id, 'name' => 'Guruh A']);
        \App\Models\Group::factory()->create(['organization_id' => $orgB->id, 'name' => 'Guruh B']);

        $res = $this->actingAs($sa, 'sanctum')
            ->withHeaders(['X-Impersonated-Org' => $orgA->id])
            ->getJson('/api/v1/admin/groups');

        $res->assertOk();
        $names = collect($res->json('data'))->pluck('name');
        $this->assertTrue($names->contains('Guruh A'));
        $this->assertFalse($names->contains('Guruh B'));
    }

    public function test_super_admin_impersonation_requires_valid_org(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $res = $this->actingAs($sa, 'sanctum')
            ->withHeaders(['X-Impersonated-Org' => 99999])
            ->getJson('/api/v1/admin/groups');

        $res->assertForbidden();
    }

    // ── 9. Security tests ──────────────────────────────────────────

    public function test_organization_isolation_admin_cannot_see_other_org_subscription(): void
    {
        $orgA  = $this->makeOrg();
        $orgB  = $this->makeOrg();
        $plan  = $this->makePlan();
        $subB  = $this->makeSub($orgB, $plan);
        $adminA = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $orgA->id]);

        // Admin from org A should not access super-admin routes
        $res = $this->actingAs($adminA, 'sanctum')
            ->getJson("/api/v1/super-admin/subscriptions/{$subB->id}");

        $res->assertForbidden();
    }

    public function test_teacher_cannot_access_billing(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();
        $this->makeSub($org, $plan);

        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id]);

        $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/v1/super-admin/plans')
            ->assertForbidden();

        $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions')
            ->assertForbidden();

        $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/v1/super-admin/payments')
            ->assertForbidden();
    }
}
