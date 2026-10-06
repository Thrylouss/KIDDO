<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H6 — Consistent Password Minimum Length
 *
 * Two endpoints previously allowed min:6 passwords while the rest of the
 * codebase required min:8. This test suite verifies that every password-
 * setting endpoint in the application enforces the same min:8 floor.
 *
 * Affected endpoints (now fixed):
 *   POST /api/v1/admin/teachers          — teacher creation (Admin)
 *   POST /api/v1/super-admin/organizations/{id}/reset-password — org admin reset (SuperAdmin)
 *
 * Correct endpoints (unchanged):
 *   POST /api/v1/super-admin/organizations  — org creation (admin_password min:8)
 *   POST /api/v1/super-admin/users/{id}/reset-password — user reset (min:8)
 */
class PasswordValidationTest extends TestCase
{
    use RefreshDatabase;

    // ── helpers ────────────────────────────────────────────────────────

    private function superAdmin(): User
    {
        return User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
        ]);
    }

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    // ── H6a: Teacher creation (Admin) ──────────────────────────────────

    public function test_teacher_creation_rejects_password_shorter_than_8_chars(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Malika',
                 'last_name'  => 'Test',
                 'phone'      => '+998901110001',
                 'password'   => 'abc1234',   // 7 chars — must be rejected
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }

    public function test_teacher_creation_rejects_6_char_password(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Malika',
                 'last_name'  => 'Test',
                 'phone'      => '+998901110002',
                 'password'   => '123456',    // exactly 6 chars — previously accepted, now rejected
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }

    public function test_teacher_creation_accepts_exactly_8_char_password(): void
    {
        [$admin, $org] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Malika',
                 'last_name'  => 'Test',
                 'phone'      => '+998901110003',
                 'password'   => '12345678',  // exactly 8 chars — minimum accepted
             ])
             ->assertCreated();

        $this->assertDatabaseHas('users', ['phone' => '+998901110003', 'role' => 'teacher']);
    }

    public function test_teacher_creation_accepts_strong_password(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Jasur',
                 'last_name'  => 'Bekmurodov',
                 'phone'      => '+998901110004',
                 'password'   => 'StrongPass99!',
             ])
             ->assertCreated();
    }

    // ── H6b: Org admin password reset (Super Admin) ────────────────────

    public function test_org_reset_password_rejects_password_shorter_than_8_chars(): void
    {
        $sa  = $this->superAdmin();
        $org = Organization::factory()->create();
        User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => 'abc1234',     // 7 chars
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }

    public function test_org_reset_password_rejects_6_char_password(): void
    {
        $sa  = $this->superAdmin();
        $org = Organization::factory()->create();
        User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => '123456',      // 6 chars — previously accepted, now rejected
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }

    public function test_org_reset_password_accepts_exactly_8_char_password(): void
    {
        $sa    = $this->superAdmin();
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => '12345678',    // exactly 8 chars
             ])
             ->assertOk();

        $admin->refresh();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('12345678', $admin->password));
    }

    // ── Regression: previously-correct endpoints still enforce min:8 ───

    public function test_user_reset_password_still_rejects_7_char_password(): void
    {
        $sa   = $this->superAdmin();
        $user = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                 'password' => 'abc1234',     // 7 chars
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }

    public function test_org_creation_admin_password_still_rejects_7_char_password(): void
    {
        $sa = $this->superAdmin();

        $this->actingAs($sa, 'sanctum')
             ->postJson('/api/v1/super-admin/organizations', [
                 'name'           => 'New Org',
                 'admin_name'     => 'Admin',
                 'admin_phone'    => '+998901119999',
                 'admin_password' => 'abc1234',    // 7 chars
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['admin_password']);
    }

    // ── Consistency: all password endpoints use the same floor ─────────

    public function test_all_password_endpoints_reject_5_char_password(): void
    {
        $sa  = $this->superAdmin();
        $org = Organization::factory()->create();
        $orgAdmin = User::factory()->admin()->create(['organization_id' => $org->id]);
        [$admin]  = $this->adminWithOrg();
        $user     = User::factory()->create(['role' => User::ROLE_ADMIN]);

        // Teacher creation
        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'X',
                 'last_name'  => 'Y',
                 'phone'      => '+998901110010',
                 'password'   => 'abc12',
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);

        // Org admin reset
        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/organizations/{$org->id}/reset-password", [
                 'password' => 'abc12',
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);

        // User reset
        $this->actingAs($sa, 'sanctum')
             ->postJson("/api/v1/super-admin/users/{$user->id}/reset-password", [
                 'password' => 'abc12',
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['password']);
    }
}
