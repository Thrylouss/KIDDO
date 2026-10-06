<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * H7 — Organization Deactivation Must Terminate Active Sessions
 *
 * When a Super Admin deactivates an organization, two gaps previously existed:
 *
 *   1. Existing Sanctum tokens of the org's users were NOT revoked, so any
 *      logged-in admin/teacher/parent could continue making API calls
 *      indefinitely after their org was deactivated.
 *
 *   2. AuthController::login() only checked user.is_active, not
 *      organization.is_active, so a user of a deactivated org could obtain
 *      a fresh token by simply logging in again.
 *
 * Fixes applied:
 *   - OrganizationController::deactivate() now calls
 *     $org->users()->each(fn($u) => $u->tokens()->delete())
 *   - AuthController::login() rejects login when the user's org is inactive.
 *
 * Testing note on Sanctum guard caching:
 *   Laravel's application is a singleton within a test case. The Sanctum guard
 *   caches the authenticated user in $this->user after the first successful
 *   token lookup. When a subsequent withToken() call uses a DIFFERENT token
 *   in the same test, the guard returns the cached user rather than looking up
 *   the new token.
 *
 *   Strategy: use actingAs() for the super-admin deactivation request (which
 *   bypasses token auth entirely), then call $this->app['auth']->forgetGuards()
 *   to clear the cache before the next withToken() revocation check. This lets
 *   the final request do a fresh DB token lookup and correctly see the 401.
 */
class OrganizationSessionTerminationTest extends TestCase
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
            'password'        => Hash::make('AdminPass1'),
        ]);
        return [$org, $admin];
    }

    // ── 1. Token revocation on deactivation ───────────────────────────

    public function test_deactivating_org_revokes_org_admin_token(): void
    {
        [$org, $admin] = $this->orgWithAdmin();
        $sa = $this->superAdmin();

        // Create a real Sanctum token for the org admin.
        $adminToken = $admin->createToken('admin-session')->plainTextToken;

        // Deactivate the org via actingAs (avoids Sanctum guard cache collision
        // that would occur if we used withToken for both SA and admin calls).
        $this->actingAs($sa, 'sanctum')
             ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
             ->assertOk();

        // Flush the Sanctum guard's per-test user cache so the next request
        // performs a real DB token lookup (and finds nothing — token deleted).
        $this->app['auth']->forgetGuards();

        // Admin token must now be invalid.
        $this->withToken($adminToken)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    public function test_deactivating_org_revokes_tokens_for_all_org_users(): void
    {
        $org     = Organization::factory()->create(['is_active' => true]);
        $admin   = User::factory()->create(['role' => User::ROLE_ADMIN,   'organization_id' => $org->id, 'is_active' => true]);
        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id, 'is_active' => true]);
        $sa      = $this->superAdmin();

        $adminToken   = $admin->createToken('admin-session')->plainTextToken;
        $teacherToken = $teacher->createToken('teacher-session')->plainTextToken;

        // Deactivate the org.
        $this->actingAs($sa, 'sanctum')
             ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
             ->assertOk();

        $this->app['auth']->forgetGuards();

        // Both tokens must be revoked.
        $this->withToken($adminToken)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();

        $this->app['auth']->forgetGuards();

        $this->withToken($teacherToken)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    public function test_deactivating_org_does_not_revoke_super_admin_token(): void
    {
        [$org] = $this->orgWithAdmin();
        $sa    = $this->superAdmin();

        // SA creates a real token before the deactivation.
        $saToken = $sa->createToken('sa-session')->plainTextToken;

        // Deactivate the org (SA acts via session, not via the token we created above).
        $this->actingAs($sa, 'sanctum')
             ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
             ->assertOk();

        // Fresh guard — now use the SA's real token.
        $this->app['auth']->forgetGuards();

        // SA's token must still be valid — it was not in the revoked org.
        $this->withToken($saToken)
             ->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.role', 'super_admin');
    }

    public function test_org_is_marked_inactive_after_deactivation(): void
    {
        [$org] = $this->orgWithAdmin();
        $sa    = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
             ->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")
             ->assertOk();

        $this->assertDatabaseHas('organizations', ['id' => $org->id, 'is_active' => false]);
    }

    // ── 2. Login blocked for deactivated-org users ────────────────────

    public function test_user_of_deactivated_org_cannot_login(): void
    {
        $org = Organization::factory()->create(['is_active' => false]);
        User::factory()->create([
            'phone'           => '+998901110101',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110101',
            'password' => 'Password1',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['phone']);
    }

    public function test_deactivated_org_login_error_is_generic(): void
    {
        // Must return the same generic message as wrong credentials
        // to prevent org-status enumeration.
        $org = Organization::factory()->create(['is_active' => false]);
        User::factory()->create([
            'phone'           => '+998901110102',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110102',
            'password' => 'Password1',
        ])->assertUnprocessable()
          ->assertJson(['errors' => ['phone' => ['Telefon raqami yoki parol noto\'g\'ri.']]]);
    }

    public function test_user_of_active_org_can_login(): void
    {
        $org = Organization::factory()->create(['is_active' => true]);
        User::factory()->create([
            'phone'           => '+998901110103',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110103',
            'password' => 'Password1',
        ])->assertOk();
    }

    public function test_super_admin_without_org_can_always_login(): void
    {
        // Super admins have organization_id = null — the org check must be skipped.
        User::factory()->create([
            'phone'           => '+998901110104',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110104',
            'password' => 'Password1',
        ])->assertOk();
    }

    public function test_reactivating_org_allows_login_again(): void
    {
        $org = Organization::factory()->create(['is_active' => false]);
        User::factory()->create([
            'phone'           => '+998901110105',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        // Blocked while inactive.
        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110105',
            'password' => 'Password1',
        ])->assertUnprocessable();

        $org->update(['is_active' => true]);

        // Allowed after reactivation.
        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110105',
            'password' => 'Password1',
        ])->assertOk();
    }

    // ── 3. Regression: existing checks unaffected ─────────────────────

    public function test_individually_deactivated_user_cannot_login_even_if_org_is_active(): void
    {
        $org = Organization::factory()->create(['is_active' => true]);
        User::factory()->create([
            'phone'           => '+998901110106',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => false,  // user-level deactivation
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110106',
            'password' => 'Password1',
        ])->assertUnprocessable();
    }
}
