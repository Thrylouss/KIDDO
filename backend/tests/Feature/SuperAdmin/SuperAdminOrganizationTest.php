<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuperAdminOrganizationTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function orgAdmin(int $orgId): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $orgId]);
    }

    // ── Basic CRUD ────────────────────────────────────────────────────

    public function test_super_admin_can_list_organizations(): void
    {
        Organization::factory()->count(3)->create();
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations');
        $res->assertOk()->assertJsonStructure(['data', 'meta']);
    }

    public function test_organization_list_returns_pagination_meta(): void
    {
        Organization::factory()->count(5)->create();
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations?per_page=2');
        $res->assertOk();
        $this->assertEquals(2, count($res->json('data')));
        $this->assertArrayHasKey('last_page', $res->json('meta'));
    }

    public function test_super_admin_can_create_organization(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/organizations', [
                'name'  => "Yangi Bog'cha",
                'phone' => '+998712345679',
            ]);
        $res->assertStatus(201);
        $this->assertDatabaseHas('organizations', ['name' => "Yangi Bog'cha"]);
    }

    public function test_super_admin_can_create_full_tenant(): void
    {
        $plan = Plan::factory()->create(['is_active' => true]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/organizations', [
                'name'                => 'Tenant Bog\'cha',
                'phone'               => '+998991234560',
                'admin_name'          => 'Test Admin',
                'admin_phone'         => '+998991234561',
                'admin_email'         => 'admin@tenant.test',
                'admin_password'      => 'secret123',
                'plan_id'             => $plan->id,
                'subscription_status' => 'trial',
            ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('organizations', ['name' => "Tenant Bog'cha"]);
        $this->assertDatabaseHas('users', ['phone' => '+998991234561', 'role' => 'admin']);
        $this->assertDatabaseHas('subscriptions', ['status' => 'trial']);
    }

    public function test_duplicate_admin_phone_is_rejected(): void
    {
        User::factory()->create(['phone' => '+998901111111']);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/organizations', [
                'name'        => 'Another Org',
                'admin_name'  => 'Admin',
                'admin_phone' => '+998901111111',
            ]);

        $res->assertStatus(422);
        $this->assertArrayHasKey('admin_phone', $res->json('errors'));
    }

    public function test_admin_cannot_access_super_admin_routes(): void
    {
        $org = Organization::factory()->create();
        $this->actingAs($this->orgAdmin($org->id), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations')
            ->assertForbidden();
    }

    // ── Show ──────────────────────────────────────────────────────────

    public function test_super_admin_can_view_organization_detail(): void
    {
        $org = Organization::factory()->create();
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson("/api/v1/super-admin/organizations/{$org->id}");
        $res->assertOk()->assertJsonPath('data.id', $org->id);
    }

    // ── Activate / Deactivate ─────────────────────────────────────────

    public function test_super_admin_can_deactivate_organization(): void
    {
        $org = Organization::factory()->create(['is_active' => true]);
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
            ->assertOk();
        $this->assertDatabaseHas('organizations', ['id' => $org->id, 'is_active' => false]);
    }

    public function test_super_admin_can_activate_organization(): void
    {
        $org = Organization::factory()->create(['is_active' => false]);
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/organizations/{$org->id}/activate")
            ->assertOk();
        $this->assertDatabaseHas('organizations', ['id' => $org->id, 'is_active' => true]);
    }

    // ── Reset password ────────────────────────────────────────────────

    public function test_super_admin_can_reset_admin_password(): void
    {
        $org   = Organization::factory()->create();
        $admin = $this->orgAdmin($org->id);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                'password' => 'newpassword123',
            ]);

        $res->assertOk();
        // Verify old password hash was changed
        $admin->refresh();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('newpassword123', $admin->password));
    }

    public function test_reset_password_returns_404_when_no_admin(): void
    {
        $org = Organization::factory()->create();
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                'password' => 'newpassword123',
            ])
            ->assertNotFound();
    }

    // ── Audit log ─────────────────────────────────────────────────────

    public function test_create_organization_creates_audit_log(): void
    {
        $sa = $this->superAdmin();
        $this->actingAs($sa, 'sanctum')
            ->postJson('/api/v1/super-admin/organizations', ['name' => "Audit Log Test Org"])
            ->assertStatus(201);

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'organization.created',
            'user_id' => $sa->id,
        ]);
    }

    public function test_deactivate_organization_creates_audit_log(): void
    {
        $org = Organization::factory()->create(['is_active' => true]);
        $sa  = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'organization.deactivated',
            'organization_id' => $org->id,
            'user_id'         => $sa->id,
        ]);
    }

    public function test_activate_organization_creates_audit_log(): void
    {
        $org = Organization::factory()->create(['is_active' => false]);
        $sa  = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/organizations/{$org->id}/activate")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'organization.activated',
            'organization_id' => $org->id,
            'user_id'         => $sa->id,
        ]);
    }

    // ── Filters & sort ────────────────────────────────────────────────

    public function test_search_by_name_filters_results(): void
    {
        Organization::factory()->create(['name' => 'ABC Bog\'cha']);
        Organization::factory()->create(['name' => 'XYZ Maktab']);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations?search=ABC');

        $res->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertEquals("ABC Bog'cha", $res->json('data.0.name'));
    }

    public function test_filter_by_active_status(): void
    {
        Organization::factory()->create(['is_active' => true]);
        Organization::factory()->create(['is_active' => false]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/organizations?status=active');

        $res->assertOk();
        foreach ($res->json('data') as $org) {
            $this->assertTrue($org['is_active']);
        }
    }

    // ── Impersonation ─────────────────────────────────────────────────

    public function test_super_admin_can_enter_organization(): void
    {
        $org = Organization::factory()->create();
        $sa  = $this->superAdmin();

        $res = $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/organizations/{$org->id}/enter", []);

        $res->assertOk()->assertJsonPath('data.organization_id', $org->id);
        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'organization.entered',
            'organization_id' => $org->id,
            'user_id'         => $sa->id,
        ]);
    }
}
