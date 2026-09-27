<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function admin(): User
    {
        $org = Organization::factory()->create();
        return User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);
    }

    private function makeOrg(bool $active = true): Organization
    {
        return Organization::factory()->create(['is_active' => $active]);
    }

    private function makePlan(array $attrs = []): Plan
    {
        return Plan::factory()->create($attrs);
    }

    private function makeSub(Organization $org, Plan $plan, string $status = 'active'): Subscription
    {
        return Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => $status,
            'starts_at'       => now()->subDays(10),
            'ends_at'         => now()->addDays(20),
        ]);
    }

    private function makePayment(Organization $org, float $amount, string $status = 'paid', ?Subscription $sub = null): Payment
    {
        return Payment::factory()->create([
            'organization_id' => $org->id,
            'subscription_id' => $sub?->id,
            'amount'          => $amount,
            'status'          => $status,
            'paid_at'         => $status === 'paid' ? now() : null,
        ]);
    }

    private function makeInvoice(Organization $org, float $amount, string $status = 'pending'): Invoice
    {
        return Invoice::factory()->create([
            'organization_id' => $org->id,
            'amount'          => $amount,
            'status'          => $status,
            'paid_at'         => $status === 'paid' ? now() : null,
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    // Authorization
    // ══════════════════════════════════════════════════════════════

    public function test_guest_cannot_access_reports(): void
    {
        $this->getJson('/api/v1/super-admin/reports/overview')->assertUnauthorized();
        $this->getJson('/api/v1/super-admin/reports/revenue')->assertUnauthorized();
        $this->getJson('/api/v1/super-admin/reports/subscriptions')->assertUnauthorized();
        $this->getJson('/api/v1/super-admin/reports/organizations')->assertUnauthorized();
        $this->getJson('/api/v1/super-admin/reports/users')->assertUnauthorized();
    }

    public function test_regular_admin_cannot_access_reports(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/revenue')
            ->assertForbidden();
    }

    // ══════════════════════════════════════════════════════════════
    // Overview
    // ══════════════════════════════════════════════════════════════

    public function test_overview_returns_expected_structure(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->assertJsonStructure([
                'period'        => ['from', 'to'],
                'organizations' => ['total', 'active', 'inactive', 'new'],
                'subscriptions' => ['active', 'trial', 'past_due', 'expired', 'cancelled', 'new', 'mrr', 'arr'],
                'revenue'       => ['total_paid', 'total_pending', 'total_refunded', 'gross_revenue', 'period_paid', 'period_pending', 'avg_revenue_per_org'],
                'invoices'      => ['total', 'draft', 'pending', 'paid', 'overdue', 'cancelled', 'paid_amount', 'pending_amount'],
            ]);
    }

    public function test_overview_org_counts_are_accurate(): void
    {
        $sa = $this->superAdmin();
        $this->makeOrg(true);
        $this->makeOrg(true);
        $this->makeOrg(false);

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('organizations');

        $this->assertEquals(3, $data['total']);
        $this->assertEquals(2, $data['active']);
        $this->assertEquals(1, $data['inactive']);
    }

    public function test_overview_new_orgs_counts_within_period(): void
    {
        $sa = $this->superAdmin();
        Organization::factory()->create(['created_at' => now()->subDays(5)]);
        Organization::factory()->create(['created_at' => now()->subDays(60)]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/overview?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('organizations');

        $this->assertEquals(1, $data['new']);
    }

    public function test_overview_revenue_totals_are_accurate(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 500000, 'paid');
        $this->makePayment($org, 200000, 'paid');
        $this->makePayment($org, 100000, 'pending');
        $this->makePayment($org, 50000,  'refunded');

        $rev = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('revenue');

        $this->assertEquals(700000.0, $rev['total_paid']);
        $this->assertEquals(100000.0, $rev['total_pending']);
        $this->assertEquals(50000.0,  $rev['total_refunded']);
        $this->assertEquals(750000.0, $rev['gross_revenue']);
    }

    public function test_overview_subscription_status_counts(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        $this->makeSub($org, $plan, 'active');
        $this->makeSub($org, $plan, 'trial');
        $this->makeSub($org, $plan, 'expired');

        $subs = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('subscriptions');

        $this->assertEquals(1, $subs['active']);
        $this->assertEquals(1, $subs['trial']);
        $this->assertEquals(1, $subs['expired']);
    }

    public function test_overview_invoice_counts_and_amounts(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeInvoice($org, 400000, 'paid');
        $this->makeInvoice($org, 300000, 'pending');
        $this->makeInvoice($org, 200000, 'overdue');
        $this->makeInvoice($org, 100000, 'cancelled');

        $inv = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('invoices');

        $this->assertEquals(4,        $inv['total']);
        $this->assertEquals(1,        $inv['paid']);
        $this->assertEquals(1,        $inv['pending']);
        $this->assertEquals(1,        $inv['overdue']);
        $this->assertEquals(1,        $inv['cancelled']);
        $this->assertEquals(400000.0, $inv['paid_amount']);
        $this->assertEquals(500000.0, $inv['pending_amount']); // pending + overdue
    }

    public function test_overview_returns_zeros_with_empty_database(): void
    {
        $sa = $this->superAdmin();

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk();

        $this->assertEquals(0, $data->json('organizations.total'));
        $this->assertEquals(0, $data->json('revenue.total_paid'));
        $this->assertEquals(0, $data->json('subscriptions.active'));
        $this->assertEquals(0, $data->json('invoices.total'));
    }

    public function test_overview_avg_revenue_per_org_is_zero_when_no_payments(): void
    {
        $sa = $this->superAdmin();

        $avg = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('revenue.avg_revenue_per_org');

        $this->assertEquals(0.0, $avg);
    }

    public function test_overview_arr_is_twelve_times_mrr(): void
    {
        $sa = $this->superAdmin();

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk();

        $mrr = $data->json('subscriptions.mrr');
        $arr = $data->json('subscriptions.arr');

        $this->assertEquals($mrr * 12, $arr);
    }

    // ══════════════════════════════════════════════════════════════
    // Revenue
    // ══════════════════════════════════════════════════════════════

    public function test_revenue_returns_expected_structure(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/revenue')
            ->assertOk()
            ->assertJsonStructure([
                'period'   => ['from', 'to'],
                'group_by',
                'series',
                'total',
                'by_plan',
                'by_method',
            ]);
    }

    public function test_revenue_series_sums_to_total(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 300000, 'paid');
        $this->makePayment($org, 200000, 'paid');

        $data = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/revenue')
            ->assertOk();

        $seriesTotal = collect($data->json('series'))->sum('total');
        $this->assertEquals($data->json('total'), $seriesTotal);
    }

    public function test_revenue_excludes_non_paid_payments(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 500000, 'paid');
        $this->makePayment($org, 999999, 'pending');
        $this->makePayment($org, 999999, 'refunded');

        $total = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/revenue')
            ->assertOk()
            ->json('total');

        $this->assertEquals(500000.0, $total);
    }

    public function test_revenue_date_filter_works(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        Payment::factory()->create([
            'organization_id' => $org->id,
            'amount'          => 100000,
            'status'          => 'paid',
            'paid_at'         => now()->subDays(5),
        ]);
        Payment::factory()->create([
            'organization_id' => $org->id,
            'amount'          => 999000,
            'status'          => 'paid',
            'paid_at'         => now()->subDays(40),
        ]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $total = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/revenue?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('total');

        $this->assertEquals(100000.0, $total);
    }

    public function test_revenue_uses_monthly_grouping_for_long_periods(): void
    {
        $sa = $this->superAdmin();

        $from = now()->subDays(90)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $groupBy = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/revenue?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('group_by');

        $this->assertEquals('month', $groupBy);
    }

    public function test_revenue_uses_daily_grouping_for_short_periods(): void
    {
        $sa = $this->superAdmin();

        $from = now()->subDays(30)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $groupBy = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/revenue?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('group_by');

        $this->assertEquals('day', $groupBy);
    }

    public function test_revenue_by_plan_groups_correctly(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['name' => 'Premium']);
        $sub  = $this->makeSub($org, $plan);

        Payment::factory()->create([
            'organization_id' => $org->id,
            'subscription_id' => $sub->id,
            'amount'          => 499000,
            'status'          => 'paid',
            'paid_at'         => now(),
        ]);

        $byPlan = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/revenue')
            ->assertOk()
            ->json('by_plan');

        $this->assertNotEmpty($byPlan);
        $premiumEntry = collect($byPlan)->firstWhere('plan_name', 'Premium');
        $this->assertNotNull($premiumEntry);
        $this->assertEquals(499000.0, $premiumEntry['total']);
    }

    // ══════════════════════════════════════════════════════════════
    // Subscriptions
    // ══════════════════════════════════════════════════════════════

    public function test_subscriptions_returns_expected_structure(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/subscriptions')
            ->assertOk()
            ->assertJsonStructure([
                'period'              => ['from', 'to'],
                'status_distribution' => ['active', 'trial', 'past_due', 'expired', 'cancelled'],
                'plan_distribution',
                'new_in_period',
                'cancelled_in_period',
                'expired_in_period',
                'expiring_soon',
                'mrr',
                'arr',
            ]);
    }

    public function test_subscriptions_status_distribution_is_accurate(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        $this->makeSub($org, $plan, 'active');
        $this->makeSub($org, $plan, 'active');
        $this->makeSub($org, $plan, 'trial');
        $this->makeSub($org, $plan, 'expired');
        $this->makeSub($org, $plan, 'cancelled');

        $dist = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/subscriptions')
            ->assertOk()
            ->json('status_distribution');

        $this->assertEquals(2, $dist['active']);
        $this->assertEquals(1, $dist['trial']);
        $this->assertEquals(1, $dist['expired']);
        $this->assertEquals(1, $dist['cancelled']);
    }

    public function test_subscriptions_new_in_period_counted_correctly(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => 'active',
            'created_at'      => now()->subDays(3),
        ]);
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => 'active',
            'created_at'      => now()->subDays(60),
        ]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $new = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/subscriptions?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('new_in_period');

        $this->assertEquals(1, $new);
    }

    public function test_subscriptions_plan_filter_works(): void
    {
        $sa    = $this->superAdmin();
        $org   = $this->makeOrg();
        $planA = $this->makePlan();
        $planB = $this->makePlan();

        $this->makeSub($org, $planA, 'active');
        $this->makeSub($org, $planA, 'active');
        $this->makeSub($org, $planB, 'active');

        $dist = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/subscriptions?plan_id={$planA->id}")
            ->assertOk()
            ->json('status_distribution');

        $this->assertEquals(2, $dist['active']);
    }

    public function test_subscriptions_expiring_soon_counts_next_30_days(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        // Expiring in 15 days → should be counted
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => 'active',
            'ends_at'         => now()->addDays(15),
        ]);

        // Expiring in 60 days → should NOT be counted
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => 'active',
            'ends_at'         => now()->addDays(60),
        ]);

        $soon = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/subscriptions')
            ->assertOk()
            ->json('expiring_soon');

        $this->assertEquals(1, $soon);
    }

    public function test_subscriptions_plan_distribution_only_includes_active_and_trial(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['name' => 'Standard']);

        $this->makeSub($org, $plan, 'active');
        $this->makeSub($org, $plan, 'expired');   // should NOT appear

        $planDist = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/subscriptions')
            ->assertOk()
            ->json('plan_distribution');

        $entry = collect($planDist)->firstWhere('plan_name', 'Standard');
        $this->assertNotNull($entry);
        $this->assertEquals(1, $entry['count']); // only the active one
    }

    // ══════════════════════════════════════════════════════════════
    // Organizations
    // ══════════════════════════════════════════════════════════════

    public function test_organizations_returns_expected_structure(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()
            ->assertJsonStructure([
                'period' => ['from', 'to'],
                'counts' => ['total', 'active', 'inactive', 'new_in_period', 'with_unpaid_invoices', 'with_expired_subs'],
                'plan_distribution',
                'growth_series',
            ]);
    }

    public function test_organizations_counts_are_accurate(): void
    {
        $sa = $this->superAdmin();
        $this->makeOrg(true);
        $this->makeOrg(true);
        $this->makeOrg(false);

        $counts = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()
            ->json('counts');

        $this->assertEquals(3, $counts['total']);
        $this->assertEquals(2, $counts['active']);
        $this->assertEquals(1, $counts['inactive']);
    }

    public function test_organizations_with_unpaid_invoices_counted(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $plan = $this->makePlan();

        $sub1 = $this->makeSub($org1, $plan, 'active');
        Invoice::factory()->create([
            'organization_id' => $org1->id,
            'subscription_id' => $sub1->id,
            'status'          => 'pending',
        ]);

        // org2 has no unpaid invoices
        $sub2 = $this->makeSub($org2, $plan, 'active');
        Invoice::factory()->create([
            'organization_id' => $org2->id,
            'subscription_id' => $sub2->id,
            'status'          => 'paid',
            'paid_at'         => now(),
        ]);

        $counts = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()
            ->json('counts');

        $this->assertEquals(1, $counts['with_unpaid_invoices']);
    }

    public function test_organizations_with_expired_subs_counted(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();
        $plan = $this->makePlan();

        $this->makeSub($org1, $plan, 'expired');
        $this->makeSub($org2, $plan, 'active');

        $counts = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()
            ->json('counts');

        $this->assertEquals(1, $counts['with_expired_subs']);
    }

    public function test_organizations_growth_series_has_12_months(): void
    {
        $sa = $this->superAdmin();

        $series = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()
            ->json('growth_series');

        $this->assertCount(12, $series);
    }

    public function test_organizations_new_in_period_date_filter(): void
    {
        $sa = $this->superAdmin();
        Organization::factory()->create(['created_at' => now()->subDays(3)]);
        Organization::factory()->create(['created_at' => now()->subDays(45)]);

        $from = now()->subDays(7)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $new = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/organizations?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('counts.new_in_period');

        $this->assertEquals(1, $new);
    }

    // ══════════════════════════════════════════════════════════════
    // Users
    // ══════════════════════════════════════════════════════════════

    public function test_users_returns_expected_structure(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/users')
            ->assertOk()
            ->assertJsonStructure([
                'period' => ['from', 'to'],
                'counts' => ['total', 'active', 'inactive', 'new_in_period'],
                'by_role' => ['super_admin', 'admin', 'teacher', 'parent'],
                'by_organization',
            ]);
    }

    public function test_users_counts_by_role(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        User::factory()->create(['role' => 'admin',   'organization_id' => $org->id]);
        User::factory()->create(['role' => 'teacher', 'organization_id' => $org->id]);
        User::factory()->create(['role' => 'parent',  'organization_id' => $org->id]);

        $byRole = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/users')
            ->assertOk()
            ->json('by_role');

        $this->assertEquals(1, $byRole['super_admin']); // the SA itself
        $this->assertEquals(1, $byRole['admin']);
        $this->assertEquals(1, $byRole['teacher']);
        $this->assertEquals(1, $byRole['parent']);
    }

    public function test_users_new_in_period_filter(): void
    {
        // Create super admin before the test period to exclude it from new_in_period
        $sa  = User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
            'created_at'      => now()->subDays(90),
        ]);
        $org = $this->makeOrg();

        User::factory()->create(['role' => 'admin', 'organization_id' => $org->id, 'created_at' => now()->subDays(3)]);
        User::factory()->create(['role' => 'admin', 'organization_id' => $org->id, 'created_at' => now()->subDays(60)]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $new = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/users?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('counts.new_in_period');

        $this->assertEquals(1, $new);
    }

    public function test_users_total_includes_all_roles(): void
    {
        $sa  = $this->superAdmin();  // 1 user already
        $org = $this->makeOrg();

        User::factory()->create(['role' => 'admin',   'organization_id' => $org->id]);
        User::factory()->create(['role' => 'teacher', 'organization_id' => $org->id]);

        $total = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/users')
            ->assertOk()
            ->json('counts.total');

        $this->assertEquals(3, $total);
    }

    public function test_users_active_vs_inactive_split(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        User::factory()->create(['role' => 'admin', 'organization_id' => $org->id, 'is_active' => true]);
        User::factory()->create(['role' => 'admin', 'organization_id' => $org->id, 'is_active' => false]);

        $counts = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/users')
            ->assertOk()
            ->json('counts');

        // SA (active=true) + admin(active) + admin(inactive)
        $this->assertEquals($counts['total'], $counts['active'] + $counts['inactive']);
    }

    public function test_users_by_organization_limited_to_10(): void
    {
        $sa = $this->superAdmin();

        for ($i = 0; $i < 12; $i++) {
            $org = $this->makeOrg();
            User::factory()->create(['role' => 'admin', 'organization_id' => $org->id]);
        }

        $byOrg = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/users')
            ->assertOk()
            ->json('by_organization');

        $this->assertLessThanOrEqual(10, count($byOrg));
    }

    // ══════════════════════════════════════════════════════════════
    // Financial consistency
    // ══════════════════════════════════════════════════════════════

    public function test_total_paid_matches_net_revenue_from_overview(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 300000, 'paid');
        $this->makePayment($org, 200000, 'paid');
        $this->makePayment($org, 100000, 'refunded'); // should not affect total_paid

        $rev = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/reports/overview')
            ->assertOk()
            ->json('revenue');

        $this->assertEquals(500000.0, $rev['total_paid']);
        $this->assertEquals(600000.0, $rev['gross_revenue']); // paid + refunded
    }

    public function test_revenue_endpoint_total_matches_overview_period_paid(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $from = now()->startOfMonth()->format('Y-m-d');
        $to   = now()->endOfMonth()->format('Y-m-d');

        Payment::factory()->create([
            'organization_id' => $org->id,
            'amount'          => 400000,
            'status'          => 'paid',
            'paid_at'         => now(),
        ]);

        $overviewPeriodPaid = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/overview?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('revenue.period_paid');

        $revenueTotal = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/reports/revenue?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('total');

        $this->assertEquals($overviewPeriodPaid, $revenueTotal);
    }
}
