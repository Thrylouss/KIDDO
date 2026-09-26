<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubscriptionManagementTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function makeOrg(): Organization
    {
        return Organization::factory()->create();
    }

    private function makePlan(array $attrs = []): Plan
    {
        return Plan::factory()->create($attrs);
    }

    private function makeSub(Organization $org, Plan $plan, array $attrs = []): Subscription
    {
        return Subscription::factory()->create(array_merge([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
        ], $attrs));
    }

    // ── Authorization ──────────────────────────────────────────────

    public function test_guest_cannot_list_subscriptions(): void
    {
        $this->getJson('/api/v1/super-admin/subscriptions')->assertUnauthorized();
    }

    public function test_admin_cannot_list_subscriptions(): void
    {
        $org   = $this->makeOrg();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions')
            ->assertForbidden();
    }

    public function test_guest_cannot_get_metrics(): void
    {
        $this->getJson('/api/v1/super-admin/subscriptions/metrics')->assertUnauthorized();
    }

    public function test_guest_cannot_create_subscription(): void
    {
        $this->postJson('/api/v1/super-admin/subscriptions', [])->assertUnauthorized();
    }

    // ── Metrics ────────────────────────────────────────────────────

    public function test_super_admin_can_get_metrics(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan(['price_monthly' => 500000]);
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();

        $this->makeSub($org1, $plan, ['status' => Subscription::STATUS_ACTIVE]);
        $this->makeSub($org2, $plan, [
            'status'        => Subscription::STATUS_TRIAL,
            'ends_at'       => null,
            'trial_ends_at' => now()->addDays(7),
        ]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions/metrics')
            ->assertOk()
            ->json('data');

        $this->assertEquals(1, $res['active']);
        $this->assertEquals(1, $res['trial']);
        $this->assertEquals(500000.0, $res['mrr']);
    }

    public function test_mrr_excludes_trial_and_expired(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan(['price_monthly' => 500000]);
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $org3 = $this->makeOrg();

        $this->makeSub($org1, $plan, ['status' => Subscription::STATUS_ACTIVE]);
        $this->makeSub($org2, $plan, [
            'status'        => Subscription::STATUS_TRIAL,
            'ends_at'       => null,
            'trial_ends_at' => now()->addDays(7),
        ]);
        $this->makeSub($org3, $plan, ['status' => Subscription::STATUS_EXPIRED]);

        $mrr = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions/metrics')
            ->assertOk()
            ->json('data.mrr');

        $this->assertEquals(500000.0, $mrr);
    }

    // ── Index ──────────────────────────────────────────────────────

    public function test_super_admin_can_list_subscriptions(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $this->makeSub($org, $plan);

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'organization', 'plan', 'status', 'ends_at', 'auto_renew']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_can_filter_subscriptions_by_status(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $this->makeSub($org1, $plan, ['status' => Subscription::STATUS_ACTIVE]);
        $this->makeSub($org2, $plan, ['status' => Subscription::STATUS_EXPIRED]);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions?status=active')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('active', $data[0]['status']);
    }

    public function test_can_filter_subscriptions_by_plan(): void
    {
        $sa    = $this->superAdmin();
        $plan1 = $this->makePlan();
        $plan2 = $this->makePlan();
        $org1  = $this->makeOrg();
        $org2  = $this->makeOrg();
        $this->makeSub($org1, $plan1);
        $this->makeSub($org2, $plan2);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/subscriptions?plan_id={$plan1->id}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals($plan1->id, $data[0]['plan_id']);
    }

    // ── Show ───────────────────────────────────────────────────────

    public function test_super_admin_can_view_subscription_detail(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $sub  = $this->makeSub($org, $plan);

        $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/subscriptions/{$sub->id}")
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'id', 'status', 'organization_detail', 'plan_detail',
                    'payment_summary' => ['total_paid', 'total_pending', 'latest_payment_at'],
                    'recent_invoices', 'recent_payments',
                ],
            ]);
    }

    public function test_show_returns_404_for_missing_subscription(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions/9999')
            ->assertNotFound();
    }

    // ── Store ──────────────────────────────────────────────────────

    public function test_super_admin_can_create_trial_subscription(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/subscriptions', [
                'organization_id' => $org->id,
                'plan_id'         => $plan->id,
                'status'          => Subscription::STATUS_TRIAL,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', Subscription::STATUS_TRIAL);

        $this->assertDatabaseHas('subscriptions', [
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_TRIAL,
        ]);
    }

    public function test_creating_active_subscription_requires_ends_at(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/subscriptions', [
                'organization_id' => $org->id,
                'plan_id'         => $plan->id,
                'status'          => Subscription::STATUS_ACTIVE,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ends_at']);
    }

    public function test_creating_active_subscription_expires_existing(): void
    {
        $sa     = $this->superAdmin();
        $plan   = $this->makePlan();
        $org    = $this->makeOrg();
        $oldSub = $this->makeSub($org, $plan, ['status' => Subscription::STATUS_ACTIVE]);

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/subscriptions', [
                'organization_id' => $org->id,
                'plan_id'         => $plan->id,
                'status'          => Subscription::STATUS_ACTIVE,
                'ends_at'         => now()->addDays(30)->format('Y-m-d'),
            ])
            ->assertCreated();

        $this->assertEquals(Subscription::STATUS_EXPIRED, $oldSub->fresh()->status);
    }

    public function test_store_logs_activity(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();

        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/subscriptions', [
                'organization_id' => $org->id,
                'plan_id'         => $plan->id,
                'status'          => Subscription::STATUS_TRIAL,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'subscription.created',
            'organization_id' => $org->id,
        ]);
    }

    // ── Toggle auto-renew ──────────────────────────────────────────

    public function test_super_admin_can_toggle_auto_renew(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $sub  = $this->makeSub($org, $plan, ['auto_renew' => false]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/subscriptions/{$sub->id}/toggle-auto-renew")
            ->assertOk()
            ->assertJsonPath('data.auto_renew', true);

        $this->assertTrue($sub->fresh()->auto_renew);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/subscriptions/{$sub->id}/toggle-auto-renew")
            ->assertOk()
            ->assertJsonPath('data.auto_renew', false);
    }

    public function test_toggle_auto_renew_logs_activity(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $sub  = $this->makeSub($org, $plan);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/subscriptions/{$sub->id}/toggle-auto-renew")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'subscription.auto_renew_changed',
            'organization_id' => $org->id,
        ]);
    }

    // ── Renew ──────────────────────────────────────────────────────

    public function test_super_admin_can_renew_subscription(): void
    {
        $sa      = $this->superAdmin();
        $plan    = $this->makePlan();
        $org     = $this->makeOrg();
        $sub     = $this->makeSub($org, $plan);
        $newEnds = now()->addDays(60)->format('Y-m-d');

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/renew", [
                'plan_id'        => $plan->id,
                'ends_at'        => $newEnds,
                'payment_status' => 'paid',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Subscription::STATUS_ACTIVE);
    }

    // ── Change plan ────────────────────────────────────────────────

    public function test_super_admin_can_change_plan(): void
    {
        $sa    = $this->superAdmin();
        $plan1 = $this->makePlan();
        $plan2 = $this->makePlan();
        $org   = $this->makeOrg();
        $sub   = $this->makeSub($org, $plan1);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/change-plan", [
                'plan_id' => $plan2->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.plan_id', $plan2->id);
    }

    // ── Cancel ─────────────────────────────────────────────────────

    public function test_super_admin_can_cancel_subscription(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $sub  = $this->makeSub($org, $plan);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/cancel", [
                'reason' => 'Test cancellation',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Subscription::STATUS_CANCELLED);

        $this->assertDatabaseHas('subscriptions', [
            'id'               => $sub->id,
            'status'           => Subscription::STATUS_CANCELLED,
            'cancelled_reason' => 'Test cancellation',
        ]);
    }

    public function test_cancel_logs_activity(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();
        $org  = $this->makeOrg();
        $sub  = $this->makeSub($org, $plan);

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/subscriptions/{$sub->id}/cancel", [])
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'subscription.cancelled',
            'organization_id' => $org->id,
        ]);
    }
}
