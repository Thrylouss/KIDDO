<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiTenantSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function admin(Organization $org): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);
    }

    // ── Children ──────────────────────────────────────────────────────

    public function test_admin_cannot_see_other_org_children(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        Child::factory()->count(3)->create(['organization_id' => $orgB->id]);

        $res = $this->actingAs($this->admin($orgA), 'sanctum')
            ->getJson('/api/v1/admin/children');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }

    public function test_admin_cannot_view_other_org_child_by_id(): void
    {
        $orgA   = Organization::factory()->create();
        $orgB   = Organization::factory()->create();
        $groupB = Group::factory()->create(['organization_id' => $orgB->id]);
        $childB = Child::factory()->create(['organization_id' => $orgB->id, 'group_id' => $groupB->id]);

        $res = $this->actingAs($this->admin($orgA), 'sanctum')
            ->getJson("/api/v1/admin/children/{$childB->id}");
        $res->assertNotFound();
    }

    // ── Groups ────────────────────────────────────────────────────────

    public function test_admin_cannot_see_other_org_groups(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        Group::factory()->count(2)->create(['organization_id' => $orgB->id]);

        $res = $this->actingAs($this->admin($orgA), 'sanctum')
            ->getJson('/api/v1/admin/groups');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }

    // ── Teachers ──────────────────────────────────────────────────────

    public function test_admin_cannot_see_other_org_teachers(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        TeacherProfile::factory()->count(2)->create(['organization_id' => $orgB->id]);

        $res = $this->actingAs($this->admin($orgA), 'sanctum')
            ->getJson('/api/v1/admin/teachers');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }

    // ── Parents ───────────────────────────────────────────────────────

    public function test_admin_cannot_see_other_org_parents(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        ParentProfile::factory()->count(2)->create(['organization_id' => $orgB->id]);

        $res = $this->actingAs($this->admin($orgA), 'sanctum')
            ->getJson('/api/v1/admin/parents');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }

    // ── Super admin routes ────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_access_admin(): void
    {
        $this->getJson('/api/v1/admin/children')->assertUnauthorized();
    }

    public function test_admin_cannot_access_super_admin_subscriptions(): void
    {
        $org   = Organization::factory()->create();
        $admin = $this->admin($org);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/subscriptions')
            ->assertForbidden();
    }

    public function test_admin_cannot_access_super_admin_payments(): void
    {
        $org   = Organization::factory()->create();
        $admin = $this->admin($org);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/payments')
            ->assertForbidden();
    }
}
