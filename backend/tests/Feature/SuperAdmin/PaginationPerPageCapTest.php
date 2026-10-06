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

/**
 * H13 — Unbounded per_page on Paginated Super Admin List Endpoints
 *
 * Four of the six paginated list endpoints were missing the max-cap that
 * OrganizationController and ActivityLogController already applied:
 *
 *   GET /api/v1/super-admin/users           — paginate((int) per_page)   ← no cap
 *   GET /api/v1/super-admin/payments        — paginate((int) per_page)   ← no cap
 *   GET /api/v1/super-admin/invoices        — paginate((int) per_page)   ← no cap
 *   GET /api/v1/super-admin/subscriptions   — paginate((int) per_page)   ← no cap
 *
 * A super admin (or a session compromised via a stolen token) could send
 * per_page=99999 and receive the entire table in a single HTTP response —
 * bypassing pagination, exhausting server memory, and maximising the data
 * extracted in a single exfiltration call.
 *
 * The fix clamps every uncapped endpoint to min(per_page, 100), matching
 * the pattern already used in OrganizationController and ActivityLogController.
 */
class PaginationPerPageCapTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
        ]);
    }

    private function makeOrg(): Organization
    {
        return Organization::factory()->create();
    }

    // ── /users ─────────────────────────────────────────────────────

    public function test_users_per_page_above_cap_is_clamped_to_100(): void
    {
        User::factory()->count(5)->create(['organization_id' => $this->makeOrg()->id]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/users?per_page=99999');

        $res->assertOk();
        $this->assertLessThanOrEqual(100, $res->json('meta.per_page'));
    }

    public function test_users_default_per_page_is_20(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/users');

        $res->assertOk();
        $this->assertEquals(20, $res->json('meta.per_page'));
    }

    public function test_users_explicit_valid_per_page_is_respected(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/users?per_page=50');

        $res->assertOk();
        $this->assertEquals(50, $res->json('meta.per_page'));
    }

    // ── /payments ──────────────────────────────────────────────────

    public function test_payments_per_page_above_cap_is_clamped_to_100(): void
    {
        $org = $this->makeOrg();
        Payment::factory()->count(3)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/payments?per_page=99999');

        $res->assertOk();
        $this->assertLessThanOrEqual(100, $res->json('meta.per_page'));
    }

    public function test_payments_default_per_page_is_20(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/payments');

        $res->assertOk();
        $this->assertEquals(20, $res->json('meta.per_page'));
    }

    // ── /invoices ──────────────────────────────────────────────────

    public function test_invoices_per_page_above_cap_is_clamped_to_100(): void
    {
        $org = $this->makeOrg();
        Invoice::factory()->count(3)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/invoices?per_page=99999');

        $res->assertOk();
        $this->assertLessThanOrEqual(100, $res->json('meta.per_page'));
    }

    public function test_invoices_default_per_page_is_20(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/invoices');

        $res->assertOk();
        $this->assertEquals(20, $res->json('meta.per_page'));
    }

    // ── /subscriptions ─────────────────────────────────────────────

    public function test_subscriptions_per_page_above_cap_is_clamped_to_100(): void
    {
        $org  = $this->makeOrg();
        $plan = Plan::factory()->create();
        Subscription::factory()->count(3)->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
        ]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions?per_page=99999');

        $res->assertOk();
        $this->assertLessThanOrEqual(100, $res->json('meta.per_page'));
    }

    public function test_subscriptions_default_per_page_is_20(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions');

        $res->assertOk();
        $this->assertEquals(20, $res->json('meta.per_page'));
    }

    // ── Already-capped endpoints (regression guard) ─────────────────

    public function test_organizations_per_page_above_cap_is_clamped_to_100(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations?per_page=99999');

        $res->assertOk();
        $this->assertLessThanOrEqual(100, $res->json('meta.per_page'));
    }
}
