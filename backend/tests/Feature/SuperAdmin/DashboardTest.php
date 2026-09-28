<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
        ], $overrides));
    }

    private function admin(): User
    {
        $org = Organization::factory()->create();
        return User::factory()->create([
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
        ]);
    }

    private function makeOrg(bool $active = true): Organization
    {
        return Organization::factory()->create(['is_active' => $active]);
    }

    private function makePlan(array $attrs = []): Plan
    {
        return Plan::factory()->create($attrs);
    }

    private function makeSub(Organization $org, Plan $plan, string $status = 'active', array $extra = []): Subscription
    {
        return Subscription::factory()->create(array_merge([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => $status,
            'starts_at'       => now()->subDays(10),
            'ends_at'         => now()->addDays(20),
        ], $extra));
    }

    private function makePayment(Organization $org, float $amount, string $status = 'paid', array $extra = []): Payment
    {
        return Payment::factory()->create(array_merge([
            'organization_id' => $org->id,
            'amount'          => $amount,
            'status'          => $status,
            'paid_at'         => $status === 'paid' ? now() : null,
        ], $extra));
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

    public function test_guest_cannot_access_summary(): void
    {
        $this->getJson('/api/v1/super-admin/dashboard')->assertUnauthorized();
    }

    public function test_admin_cannot_access_summary(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertForbidden();
    }

    public function test_guest_cannot_access_recent(): void
    {
        $this->getJson('/api/v1/super-admin/dashboard/recent')->assertUnauthorized();
    }

    public function test_admin_cannot_access_recent(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertForbidden();
    }

    public function test_super_admin_can_access_summary(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk();
    }

    public function test_super_admin_can_access_recent(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk();
    }

    // ══════════════════════════════════════════════════════════════
    // Summary structure
    // ══════════════════════════════════════════════════════════════

    public function test_summary_has_expected_structure(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'period'                => ['from', 'to'],
                'jami_bogchalar',
                'faol_bogchalar',
                'nofaol_bogchalar',
                'yangi_bogchalar',
                'muddati_yaqin',
                'tolov_kutilmoqda',
                'jami_foydalanuvchilar',
                'oxirgi_bogchalar',
                'obuna_holati'          => ['active', 'trial', 'past_due', 'expired', 'cancelled'],
                'billing'               => [
                    'mrr', 'arr', 'monthly_revenue', 'pending_revenue',
                    'period_paid', 'prev_period_paid', 'total_paid', 'total_refunded',
                ],
            ]);
    }

    // ══════════════════════════════════════════════════════════════
    // Organization counts
    // ══════════════════════════════════════════════════════════════

    public function test_summary_counts_organizations_correctly(): void
    {
        $sa = $this->superAdmin();
        Organization::factory()->count(3)->create(['is_active' => true]);
        Organization::factory()->count(2)->create(['is_active' => false]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(5, $res['jami_bogchalar']);
        $this->assertEquals(3, $res['faol_bogchalar']);
        $this->assertEquals(2, $res['nofaol_bogchalar']);
    }

    public function test_summary_yangi_bogchalar_filters_by_period(): void
    {
        // SA created far in the past so it doesn't affect counts
        $sa = $this->superAdmin(['created_at' => now()->subDays(90)]);

        Organization::factory()->create(['created_at' => now()->subDays(60)]);    // outside
        Organization::factory()->count(2)->create(['created_at' => now()->subDays(5)]); // inside

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/dashboard?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json();

        $this->assertEquals(2, $res['yangi_bogchalar']);
    }

    public function test_summary_nofaol_bogchalar_is_total_minus_active(): void
    {
        $sa = $this->superAdmin();
        Organization::factory()->count(4)->create(['is_active' => true]);
        Organization::factory()->count(1)->create(['is_active' => false]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals($res['jami_bogchalar'] - $res['faol_bogchalar'], $res['nofaol_bogchalar']);
    }

    // ══════════════════════════════════════════════════════════════
    // Users count
    // ══════════════════════════════════════════════════════════════

    public function test_summary_jami_foydalanuvchilar_counts_all_users(): void
    {
        $sa = $this->superAdmin();
        User::factory()->count(4)->create(['role' => User::ROLE_ADMIN]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        // 1 SA + 4 admins = 5
        $this->assertEquals(5, $res['jami_foydalanuvchilar']);
    }

    // ══════════════════════════════════════════════════════════════
    // Billing / Financial fields
    // ══════════════════════════════════════════════════════════════

    public function test_summary_billing_period_paid_filters_by_date(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 100000, 'paid', ['paid_at' => now()->subDays(5)]);
        $this->makePayment($org, 200000, 'paid', ['paid_at' => now()->subDays(60)]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/dashboard?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json();

        $this->assertEquals(100000.0, $res['billing']['period_paid']);
    }

    public function test_summary_billing_total_paid_sums_all_paid(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 100000, 'paid', ['paid_at' => now()->subDays(5)]);
        $this->makePayment($org, 200000, 'paid', ['paid_at' => now()->subDays(60)]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(300000.0, $res['billing']['total_paid']);
    }

    public function test_summary_billing_total_refunded(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makePayment($org, 50000, 'refunded');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(50000.0, $res['billing']['total_refunded']);
    }

    public function test_summary_billing_prev_period_paid_uses_previous_window(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        // In current period (last 10 days)
        $this->makePayment($org, 100000, 'paid', ['paid_at' => now()->subDays(5)]);
        // In previous period (~11-20 days ago)
        $this->makePayment($org, 80000,  'paid', ['paid_at' => now()->subDays(15)]);
        // Way outside both periods
        $this->makePayment($org, 999000, 'paid', ['paid_at' => now()->subDays(90)]);

        $from = now()->subDays(10)->format('Y-m-d');
        $to   = now()->format('Y-m-d');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/dashboard?date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json();

        $this->assertEquals(100000.0, $res['billing']['period_paid']);
        $this->assertEquals(80000.0,  $res['billing']['prev_period_paid']);
    }

    public function test_summary_billing_mrr_uses_active_subscriptions_only(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['price_monthly' => 299000]);

        $this->makeSub($org, $plan, 'active');

        $org2 = $this->makeOrg();
        $this->makeSub($org2, $plan, 'trial');   // not counted in MRR

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(299000.0, $res['billing']['mrr']);
        $this->assertEquals(299000.0 * 12, $res['billing']['arr']);
    }

    // ══════════════════════════════════════════════════════════════
    // Subscription status counts
    // ══════════════════════════════════════════════════════════════

    public function test_summary_obuna_holati_counts_all_statuses(): void
    {
        $sa   = $this->superAdmin();
        $plan = $this->makePlan();

        foreach (['active', 'trial', 'past_due', 'expired', 'cancelled'] as $status) {
            $org = $this->makeOrg();
            $this->makeSub($org, $plan, $status);
        }

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(1, $res['obuna_holati']['active']);
        $this->assertEquals(1, $res['obuna_holati']['trial']);
        $this->assertEquals(1, $res['obuna_holati']['past_due']);
        $this->assertEquals(1, $res['obuna_holati']['expired']);
        $this->assertEquals(1, $res['obuna_holati']['cancelled']);
    }

    public function test_summary_muddati_yaqin_counts_expiring_active_subs(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        // Expiring in 7 days
        $this->makeSub($org, $plan, 'active', ['ends_at' => now()->addDays(7)]);
        // Already expired (not counted)
        $org2 = $this->makeOrg();
        $this->makeSub($org2, $plan, 'active', ['ends_at' => now()->subDay()]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(1, $res['muddati_yaqin']);
    }

    // ══════════════════════════════════════════════════════════════
    // Recent orgs
    // ══════════════════════════════════════════════════════════════

    public function test_summary_oxirgi_bogchalar_returns_at_most_8(): void
    {
        $sa = $this->superAdmin();
        Organization::factory()->count(12)->create();

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertLessThanOrEqual(8, count($res['oxirgi_bogchalar']));
    }

    public function test_summary_oxirgi_bogchalar_includes_subscription_info(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $plan = $this->makePlan(['name' => 'Premium']);
        $this->makeSub($org, $plan, 'active');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $found = collect($res['oxirgi_bogchalar'])->firstWhere('id', $org->id);
        $this->assertNotNull($found);
        $this->assertEquals('active', $found['subscription']['status']);
        $this->assertEquals('Premium', $found['subscription']['plan']);
    }

    // ══════════════════════════════════════════════════════════════
    // Recent endpoint
    // ══════════════════════════════════════════════════════════════

    public function test_recent_has_expected_structure(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->assertJsonStructure([
                'payments',
                'invoices',
                'activity',
            ]);
    }

    public function test_recent_payments_include_organization(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makePayment($org, 300000);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertNotEmpty($res['payments']);
        $found = collect($res['payments'])->firstWhere('organization.id', $org->id);
        $this->assertNotNull($found);
        $this->assertArrayHasKey('status',   $found);
        $this->assertArrayHasKey('amount',   $found);
        $this->assertArrayHasKey('currency', $found);
    }

    public function test_recent_invoices_include_invoice_number(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeInvoice($org, 200000, 'pending');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertNotEmpty($res['invoices']);
        $this->assertArrayHasKey('invoice_number', $res['invoices'][0]);
    }

    public function test_recent_activity_includes_action_and_description(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        ActivityLog::create([
            'action'          => 'org.created',
            'description'     => 'Test org created',
            'organization_id' => $org->id,
            'user_id'         => null,
            'ip_address'      => null,
        ]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertNotEmpty($res['activity']);
        $this->assertArrayHasKey('action',      $res['activity'][0]);
        $this->assertArrayHasKey('description', $res['activity'][0]);
    }

    public function test_recent_payments_limited_to_8(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        Payment::factory()->count(12)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertLessThanOrEqual(8, count($res['payments']));
    }

    public function test_recent_invoices_limited_to_8(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        Invoice::factory()->count(12)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertLessThanOrEqual(8, count($res['invoices']));
    }

    public function test_recent_activity_limited_to_10(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        for ($i = 0; $i < 15; $i++) {
            ActivityLog::create([
                'action'          => 'test.action',
                'description'     => "Activity {$i}",
                'organization_id' => $org->id,
            ]);
        }

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard/recent')
            ->assertOk()
            ->json();

        $this->assertLessThanOrEqual(10, count($res['activity']));
    }

    // ══════════════════════════════════════════════════════════════
    // Default period (no date params)
    // ══════════════════════════════════════════════════════════════

    public function test_summary_default_period_is_current_month(): void
    {
        $sa = $this->superAdmin();

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(now()->startOfMonth()->toDateString(), $res['period']['from']);
        $this->assertEquals(now()->toDateString(), $res['period']['to']);
    }

    // ══════════════════════════════════════════════════════════════
    // Pending payments count
    // ══════════════════════════════════════════════════════════════

    public function test_summary_tolov_kutilmoqda_counts_distinct_organizations(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();

        // Two pending payments from org1 (counts as 1)
        $this->makePayment($org1, 100000, 'pending');
        $this->makePayment($org1, 50000,  'pending');
        // One pending payment from org2 (counts as 1)
        $this->makePayment($org2, 200000, 'pending');

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->json();

        $this->assertEquals(2, $res['tolov_kutilmoqda']);
    }
}
