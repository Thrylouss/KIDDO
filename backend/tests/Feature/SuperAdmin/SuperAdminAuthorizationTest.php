<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Child;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Role boundaries around /super-admin and the X-Impersonated-Org header.
 * The role middleware rejects before any controller runs, so placeholder IDs are fine.
 */
class SuperAdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const SUPER_ADMIN_GET_ROUTES = [
        '/api/v1/super-admin/dashboard',
        '/api/v1/super-admin/dashboard/revenue',
        '/api/v1/super-admin/plans',
        '/api/v1/super-admin/subscriptions',
        '/api/v1/super-admin/subscriptions/metrics',
        '/api/v1/super-admin/payments',
        '/api/v1/super-admin/invoices',
        '/api/v1/super-admin/organizations',
        '/api/v1/super-admin/organizations/1',
        '/api/v1/super-admin/notifications',
        '/api/v1/super-admin/activity-logs',
        '/api/v1/super-admin/users',
        '/api/v1/super-admin/reports/overview',
        '/api/v1/super-admin/reports/revenue',
    ];

    private const ADMIN_GET_ROUTES = [
        '/api/v1/admin/dashboard',
        '/api/v1/admin/groups',
        '/api/v1/admin/children',
        '/api/v1/admin/teachers',
        '/api/v1/admin/parents',
    ];

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function assertAllForbidden(User $user, array $routes): void
    {
        foreach ($routes as $route) {
            $this->app['auth']->forgetGuards();
            $status = $this->actingAs($user, 'sanctum')->getJson($route)->status();
            $this->assertSame(403, $status, "{$user->role} got {$status} on GET {$route}");
        }
    }

    // ── Role boundaries ────────────────────────────────────────────

    public function test_unauthenticated_requests_are_rejected_everywhere(): void
    {
        foreach ([...self::SUPER_ADMIN_GET_ROUTES, ...self::ADMIN_GET_ROUTES] as $route) {
            $status = $this->getJson($route)->status();
            $this->assertSame(401, $status, "Guest got {$status} on GET {$route}");
        }
    }

    public function test_admin_cannot_read_any_super_admin_route(): void
    {
        $org = Organization::factory()->create();

        $this->assertAllForbidden(
            User::factory()->admin()->create(['organization_id' => $org->id]),
            self::SUPER_ADMIN_GET_ROUTES
        );
    }

    public function test_teacher_cannot_read_admin_or_super_admin_routes(): void
    {
        $org = Organization::factory()->create();

        $this->assertAllForbidden(
            User::factory()->teacher()->create(['organization_id' => $org->id]),
            [...self::ADMIN_GET_ROUTES, ...self::SUPER_ADMIN_GET_ROUTES]
        );
    }

    public function test_parent_cannot_read_admin_or_super_admin_routes(): void
    {
        $org = Organization::factory()->create();

        $this->assertAllForbidden(
            User::factory()->parent()->create(['organization_id' => $org->id]),
            [...self::ADMIN_GET_ROUTES, ...self::SUPER_ADMIN_GET_ROUTES]
        );
    }

    // ── Privileged writes ──────────────────────────────────────────

    public function test_admin_cannot_promote_self_to_super_admin(): void
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/super-admin/users/{$admin->id}", ['role' => User::ROLE_SUPER_ADMIN])
             ->assertForbidden();

        $this->assertSame(User::ROLE_ADMIN, $admin->fresh()->role);
    }

    public function test_admin_cannot_reset_password_through_super_admin_api(): void
    {
        $org      = Organization::factory()->create();
        $admin    = User::factory()->admin()->create(['organization_id' => $org->id]);
        $original = $admin->password;

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", ['password' => 'NewPassword123'])
             ->assertForbidden();

        $this->assertSame($original, $admin->fresh()->password);
        $this->assertFalse(Hash::check('NewPassword123', $admin->fresh()->password));
    }

    public function test_admin_cannot_create_or_deactivate_organizations(): void
    {
        $org   = Organization::factory()->create(['is_active' => true]);
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/super-admin/organizations', ['name' => 'Yangi bog\'cha'])
             ->assertForbidden();

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
             ->assertForbidden();

        $this->assertSame(1, Organization::count());
        $this->assertTrue($org->fresh()->is_active);
    }

    // ── X-Impersonated-Org ─────────────────────────────────────────

    public function test_super_admin_needs_impersonation_header_for_admin_routes(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
             ->getJson('/api/v1/admin/children')
             ->assertForbidden();
    }

    public function test_super_admin_with_invalid_impersonation_header_is_rejected(): void
    {
        $superAdmin = $this->superAdmin();

        foreach (['0', 'abc', '-1', ''] as $value) {
            $this->app['auth']->forgetGuards();
            $status = $this->actingAs($superAdmin, 'sanctum')
                           ->withHeaders(['X-Impersonated-Org' => $value])
                           ->getJson('/api/v1/admin/children')
                           ->status();
            $this->assertSame(403, $status, "X-Impersonated-Org '{$value}' returned {$status}");
        }
    }

    public function test_super_admin_impersonation_scopes_children_to_one_org(): void
    {
        $orgA   = Organization::factory()->create();
        $childA = Child::factory()->create(['organization_id' => $orgA->id]);
        Child::factory()->count(2)->create();

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $orgA->id])
             ->getJson('/api/v1/admin/children')
             ->assertOk();

        $this->assertSame([$childA->id], collect($res->json('data'))->pluck('id')->all());
    }

    public function test_impersonation_header_is_ignored_for_regular_admin(): void
    {
        $orgA   = Organization::factory()->create();
        $orgB   = Organization::factory()->create();
        $admin  = User::factory()->admin()->create(['organization_id' => $orgA->id]);
        $childB = Child::factory()->create(['organization_id' => $orgB->id]);

        $res = $this->actingAs($admin, 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $orgB->id])
             ->getJson('/api/v1/admin/children')
             ->assertOk();

        $this->assertCount(0, $res->json('data'));

        $this->actingAs($admin, 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $orgB->id])
             ->getJson("/api/v1/admin/children/{$childB->id}")
             ->assertNotFound();
    }
}
