<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * H9 — Token Revocation Gaps in Security-Remediation Paths
 *
 * Two endpoints that perform security-remediation actions previously left the
 * affected user's existing Sanctum tokens alive:
 *
 *   1. POST /api/v1/super-admin/organizations/{id}/reset-password
 *      Changed the org admin's password but never called tokens()->delete().
 *      By contrast, POST /super-admin/users/{id}/reset-password always revoked
 *      tokens. The inconsistency meant an attacker who had stolen an org admin's
 *      credentials would keep their session even after a super admin reset the
 *      password to evict them.
 *
 *   2. PUT /api/v1/super-admin/users/{id} with { "is_active": false }
 *      Deactivated the user via the general update endpoint but did not revoke
 *      tokens. The dedicated PATCH .../deactivate endpoint revoked them. Using
 *      the update path (the likely path for a management UI) was a silent bypass.
 *
 * Fixes applied:
 *   - OrganizationController::resetPassword() now calls $admin->tokens()->delete()
 *     after changing the password.
 *   - UserController::update() captures $wasActive before the update and calls
 *     $user->tokens()->delete() when is_active transitions true → false.
 */
class SecurityRemediationTokenRevocationTest extends TestCase
{
    use RefreshDatabase;

    // ── helpers ────────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
            'is_active'       => true,
        ]);
    }

    private function orgWithAdmin(): array
    {
        $org   = Organization::factory()->create(['is_active' => true]);
        $admin = User::factory()->create([
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
            'password'        => Hash::make('OldPass123'),
        ]);
        return [$org, $admin];
    }

    // ── Gap 1: org admin password reset ───────────────────────────────

    public function test_org_admin_password_reset_revokes_existing_tokens(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $sa = $this->superAdmin();

        // Admin is logged in — has an active token.
        $adminToken = $admin->createToken('admin-session')->plainTextToken;

        // Token works before the reset.
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
             ->getJson('/api/v1/me')
             ->assertOk();

        // Super admin resets the org admin's password.
        $this->app['auth']->forgetGuards();
        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => 'NewSafe789!',
             ])
             ->assertOk();

        // Token must now be invalid — the password reset must have revoked it.
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    public function test_org_admin_password_reset_revokes_all_tokens_for_that_admin(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $sa = $this->superAdmin();

        // Admin has two concurrent sessions.
        $token1 = $admin->createToken('session-a')->plainTextToken;
        $token2 = $admin->createToken('session-b')->plainTextToken;

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => 'NewSafe789!',
             ])
             ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token1)->getJson('/api/v1/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($token2)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_org_admin_password_reset_does_not_revoke_super_admin_token(): void
    {
        [$org] = $this->orgWithAdmin();
        $sa    = $this->superAdmin();

        $saToken = $sa->createToken('sa-session')->plainTextToken;

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => 'NewSafe789!',
             ])
             ->assertOk();

        // SA's token must still be valid.
        $this->app['auth']->forgetGuards();
        $this->withToken($saToken)
             ->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.role', 'super_admin');
    }

    // ── Regression: user-level reset still revokes tokens ─────────────

    public function test_user_reset_password_still_revokes_token(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => true]);

        $userToken = $user->createToken('user-session')->plainTextToken;

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                 'password' => 'NewSafe789!',
             ])
             ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/v1/me')->assertUnauthorized();
    }

    // ── Gap 2: user update with is_active=false ────────────────────────

    public function test_updating_user_is_active_to_false_revokes_their_tokens(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => true]);

        $userToken = $user->createToken('user-session')->plainTextToken;

        // Token works before deactivation via update.
        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/v1/me')->assertOk();

        // Deactivate via the general update endpoint.
        $this->app['auth']->forgetGuards();
        $this->actingAs($sa, 'sanctum')
             ->putJson("/api/v1/super-admin/users/{$user->id}", ['is_active' => false])
             ->assertOk();

        // Token must now be invalid.
        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_updating_user_name_does_not_revoke_their_tokens(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => true]);

        $userToken = $user->createToken('user-session')->plainTextToken;

        // Update a non-security field.
        $this->actingAs($sa, 'sanctum')
             ->putJson("/api/v1/super-admin/users/{$user->id}", ['name' => 'Yangi Ism'])
             ->assertOk();

        // Token must still be valid — a name change is not a deactivation.
        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/v1/me')->assertOk();
    }

    public function test_updating_user_is_active_to_true_does_not_revoke_tokens(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => false]);

        // Create a token even though the user is inactive (edge case).
        $userToken = $user->createToken('user-session')->plainTextToken;

        // Re-activate via the update endpoint.
        $this->actingAs($sa, 'sanctum')
             ->putJson("/api/v1/super-admin/users/{$user->id}", ['is_active' => true])
             ->assertOk();

        // Token should NOT be revoked — activation should not invalidate sessions.
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $user->id]);
    }

    public function test_update_is_active_false_revokes_tokens_but_update_is_active_false_already_inactive_does_not(): void
    {
        // If the user is already inactive, no token revocation happens —
        // there's no transition, so the guard is not triggered.
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => false]);

        $token = $user->createToken('orphan-session')->plainTextToken;

        // Already inactive — update with is_active=false again.
        $this->actingAs($sa, 'sanctum')
             ->putJson("/api/v1/super-admin/users/{$user->id}", ['is_active' => false])
             ->assertOk();

        // The orphan token is left untouched — we only revoke on true→false transition.
        $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $user->id]);
    }

    // ── Consistency: both deactivate paths now revoke tokens ───────────

    public function test_dedicated_deactivate_still_revokes_tokens(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN, 'is_active' => true]);

        $userToken = $user->createToken('user-session')->plainTextToken;

        $this->actingAs($sa, 'sanctum')
             ->patchJson("/api/v1/super-admin/users/{$user->id}/deactivate")
             ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/v1/me')->assertUnauthorized();
    }
}
