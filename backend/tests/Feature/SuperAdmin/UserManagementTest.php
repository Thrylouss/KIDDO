<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
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

    private function makeUser(array $attrs = []): User
    {
        return User::factory()->create($attrs);
    }

    // ── Authorization ──────────────────────────────────────────────

    public function test_guest_cannot_list_users(): void
    {
        $this->getJson('/api/v1/super-admin/users')->assertUnauthorized();
    }

    public function test_admin_cannot_list_users(): void
    {
        $org   = $this->makeOrg();
        $admin = $this->makeUser(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/users')
            ->assertForbidden();
    }

    public function test_teacher_cannot_list_users(): void
    {
        $org     = $this->makeOrg();
        $teacher = $this->makeUser(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id]);

        $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/v1/super-admin/users')
            ->assertForbidden();
    }

    // ── Index (list) ───────────────────────────────────────────────

    public function test_super_admin_can_list_users(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        $this->makeUser(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);
        $this->makeUser(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users');

        $res->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'name', 'phone', 'email', 'role', 'is_active', 'last_login_at', 'created_at', 'organization']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_user_list_is_paginated(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();
        User::factory()->count(25)->create(['organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?per_page=20');

        $res->assertOk();
        $this->assertCount(20, $res->json('data'));
        $this->assertGreaterThan(1, $res->json('meta.last_page'));
    }

    public function test_user_list_search_by_name(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeUser(['name' => 'Alisher Navoi', 'organization_id' => $org->id]);
        $this->makeUser(['name' => 'Bobur Mirzo', 'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?search=alisher');

        $res->assertOk();
        $data = $res->json('data');
        $this->assertCount(1, $data);
        $this->assertStringContainsStringIgnoringCase('Alisher', $data[0]['name']);
    }

    public function test_user_list_filter_by_role(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeUser(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id]);
        $this->makeUser(['role' => User::ROLE_PARENT,  'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?role=teacher');

        $res->assertOk();
        foreach ($res->json('data') as $u) {
            $this->assertEquals(User::ROLE_TEACHER, $u['role']);
        }
    }

    public function test_user_list_filter_by_status_active(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeUser(['is_active' => true,  'organization_id' => $org->id]);
        $this->makeUser(['is_active' => false, 'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?status=active');

        $res->assertOk();
        foreach ($res->json('data') as $u) {
            $this->assertTrue($u['is_active']);
        }
    }

    public function test_user_list_filter_by_status_inactive(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeUser(['is_active' => true,  'organization_id' => $org->id]);
        $this->makeUser(['is_active' => false, 'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?status=inactive');

        $res->assertOk();
        foreach ($res->json('data') as $u) {
            $this->assertFalse($u['is_active']);
        }
    }

    public function test_user_list_filter_by_organization_id(): void
    {
        $sa   = $this->superAdmin();
        $org1 = $this->makeOrg();
        $org2 = $this->makeOrg();

        $this->makeUser(['organization_id' => $org1->id]);
        $this->makeUser(['organization_id' => $org2->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/users?organization_id={$org1->id}");

        $res->assertOk();
        foreach ($res->json('data') as $u) {
            $this->assertEquals($org1->id, $u['organization']['id']);
        }
    }

    public function test_user_list_filter_by_no_organization(): void
    {
        $sa  = $this->superAdmin();
        $org = $this->makeOrg();

        $this->makeUser(['organization_id' => $org->id]);
        $this->makeUser(['organization_id' => null]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/users?organization_id=none');

        $res->assertOk();
        foreach ($res->json('data') as $u) {
            $this->assertNull($u['organization']);
        }
    }

    // ── Show (detail) ──────────────────────────────────────────────

    public function test_super_admin_can_view_user_detail(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $user = $this->makeUser(['organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/users/{$user->id}");

        $res->assertOk()
            ->assertJsonStructure(['data' => [
                'id', 'name', 'phone', 'email', 'role', 'is_active',
                'last_login_at', 'created_at', 'organization', 'recent_activity',
            ]]);
    }

    public function test_user_detail_returns_404_for_unknown_id(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/users/99999')
            ->assertNotFound();
    }

    public function test_user_detail_does_not_expose_password(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['password' => Hash::make('secret123')]);

        $res = $this->actingAs($sa, 'sanctum')
            ->getJson("/api/v1/super-admin/users/{$user->id}");

        $res->assertOk();
        $this->assertArrayNotHasKey('password', $res->json('data'));
    }

    // ── Activate ───────────────────────────────────────────────────

    public function test_super_admin_can_activate_inactive_user(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => false]);

        $res = $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/activate");

        $res->assertOk()->assertJsonPath('data.is_active', true);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => true]);
    }

    public function test_activating_already_active_user_returns_422(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => true]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/activate")
            ->assertUnprocessable();
    }

    public function test_activate_writes_audit_log(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => false]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/activate");

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.activated',
            'user_id' => $sa->id,
        ]);
    }

    // ── Deactivate ─────────────────────────────────────────────────

    public function test_super_admin_can_deactivate_active_user(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => true]);

        $res = $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/deactivate");

        $res->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_super_admin_cannot_deactivate_self(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$sa->id}/deactivate")
            ->assertUnprocessable();
    }

    public function test_deactivating_already_inactive_user_returns_422(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => false]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/deactivate")
            ->assertUnprocessable();
    }

    public function test_deactivate_writes_audit_log(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['is_active' => true]);

        $this->actingAs($sa, 'sanctum')
            ->patchJson("/api/v1/super-admin/users/{$user->id}/deactivate");

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.deactivated',
            'user_id' => $sa->id,
        ]);
    }

    // ── Reset Password ─────────────────────────────────────────────

    public function test_super_admin_can_reset_user_password(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['password' => Hash::make('oldpassword')]);

        $res = $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                'password' => 'newpassword123',
            ]);

        $res->assertOk()->assertJsonPath('message', 'Parol muvaffaqiyatli yangilandi.');
        $this->assertTrue(Hash::check('newpassword123', $user->fresh()->password));
    }

    public function test_reset_password_rejects_short_password(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser();

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                'password' => 'short',
            ])
            ->assertUnprocessable();
    }

    public function test_reset_password_without_password_generates_temporary_one(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser();

        // Parol berilmasa — tizim vaqtinchalik parol yaratadi (faqat shu javobda), birinchi kirishda almashtiriladi
        $temp = $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [])
            ->assertOk()
            ->json('data.temporary_password');

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check($temp, $user->fresh()->password));
        $this->assertTrue($user->fresh()->must_change_password);
    }

    public function test_reset_password_writes_audit_log(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser();

        $this->actingAs($sa, 'sanctum')
            ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                'password' => 'newpassword123',
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.password_reset',
            'user_id' => $sa->id,
        ]);
    }

    // ── Update ─────────────────────────────────────────────────────

    public function test_super_admin_can_update_user_name(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['name' => 'Old Name']);

        $res = $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['name' => 'New Name']);

        $res->assertOk()->assertJsonPath('data.name', 'New Name');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name']);
    }

    public function test_super_admin_can_update_user_role(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $user = $this->makeUser(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['role' => User::ROLE_ADMIN]);

        $res->assertOk()->assertJsonPath('data.role', User::ROLE_ADMIN);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'role' => User::ROLE_ADMIN]);
    }

    public function test_super_admin_can_update_user_organization(): void
    {
        $sa    = $this->superAdmin();
        $org1  = $this->makeOrg();
        $org2  = $this->makeOrg();
        $user  = $this->makeUser(['organization_id' => $org1->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['organization_id' => $org2->id]);

        $res->assertOk()->assertJsonPath('data.organization.id', $org2->id);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'organization_id' => $org2->id]);
    }

    public function test_update_allows_removing_organization(): void
    {
        $sa   = $this->superAdmin();
        $org  = $this->makeOrg();
        $user = $this->makeUser(['organization_id' => $org->id]);

        $res = $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['organization_id' => null]);

        $res->assertOk()->assertJsonPath('data.organization', null);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'organization_id' => null]);
    }

    public function test_update_rejects_duplicate_phone(): void
    {
        $sa    = $this->superAdmin();
        $other = $this->makeUser(['phone' => '+998991112233']);
        $user  = $this->makeUser();

        $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['phone' => '+998991112233'])
            ->assertUnprocessable();
    }

    public function test_update_rejects_invalid_role(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser();

        $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['role' => 'hacker'])
            ->assertUnprocessable();
    }

    public function test_admin_cannot_update_user(): void
    {
        $org   = $this->makeOrg();
        $admin = $this->makeUser(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);
        $user  = $this->makeUser(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['name' => 'Hacked'])
            ->assertForbidden();
    }

    public function test_update_does_not_change_password(): void
    {
        $sa           = $this->superAdmin();
        $originalHash = Hash::make('original123');
        $user         = $this->makeUser(['password' => $originalHash]);

        // Sending password in the update payload — must be ignored
        $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", [
                'name'     => 'Changed Name',
                'password' => 'should_be_ignored',
            ]);

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('original123', $fresh->password));
        $this->assertFalse(Hash::check('should_be_ignored', $fresh->password));
    }

    public function test_update_writes_audit_log(): void
    {
        $sa   = $this->superAdmin();
        $user = $this->makeUser(['name' => 'Before']);

        $this->actingAs($sa, 'sanctum')
            ->putJson("/api/v1/super-admin/users/{$user->id}", ['name' => 'After']);

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.updated',
            'user_id' => $sa->id,
        ]);
    }

    public function test_update_returns_404_for_unknown_user(): void
    {
        $this->actingAs($this->superAdmin(), 'sanctum')
            ->putJson('/api/v1/super-admin/users/99999', ['name' => 'Ghost'])
            ->assertNotFound();
    }
}
