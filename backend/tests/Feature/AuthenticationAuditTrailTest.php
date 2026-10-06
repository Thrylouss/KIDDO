<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * H11 — Authentication Audit Trail
 *
 * Two bugs existed in AuthController:
 *
 * 1. User::$fillable was missing 'last_login_at', so the
 *    $user->update(['last_login_at' => now()]) call silently did nothing —
 *    the field was mass-assignment-guarded. Every user showed null last_login_at
 *    in the DB despite the code appearing to update it.
 *
 * 2. ActivityLog::record() was never called for login or logout events. Every
 *    other security-sensitive action (deactivation, password reset, org changes)
 *    was audited, but authentication events left zero trace — making incident
 *    response and compromise detection much harder.
 *
 * Fix applied:
 *   User::$fillable — 'last_login_at' added.
 *   AuthController::login()  — ActivityLog::record('user.login', ...) added.
 *   AuthController::logout() — ActivityLog::record('user.logout', ...) added.
 */
class AuthenticationAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    // ── last_login_at is persisted ──────────────────────────────────────────

    public function test_login_updates_last_login_at_in_database(): void
    {
        $user = User::factory()->create([
            'phone'        => '+998901110001',
            'password'     => Hash::make('Password1'),
            'is_active'    => true,
            'last_login_at' => null,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110001',
            'password' => 'Password1',
        ])->assertOk();

        $user->refresh();
        $this->assertNotNull($user->last_login_at, 'last_login_at must be saved to the DB after login.');
        $this->assertTrue(
            $user->last_login_at->isAfter(now()->subSeconds(5)),
            'last_login_at must reflect the current login time.'
        );
    }

    public function test_failed_login_does_not_update_last_login_at(): void
    {
        $user = User::factory()->create([
            'phone'        => '+998901110002',
            'password'     => Hash::make('Password1'),
            'is_active'    => true,
            'last_login_at' => null,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110002',
            'password' => 'WrongPassword',
        ])->assertStatus(422);

        $user->refresh();
        $this->assertNull($user->last_login_at, 'last_login_at must not change after a failed login attempt.');
    }

    // ── Login creates an activity log entry ────────────────────────────────

    public function test_successful_login_creates_activity_log_entry(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901110003',
            'password'  => Hash::make('Password1'),
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110003',
            'password' => 'Password1',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.login',
            'user_id' => $user->id,
        ]);
    }

    public function test_login_activity_log_contains_correct_user_id_and_role(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901110004',
            'password'  => Hash::make('Password1'),
            'role'      => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110004',
            'password' => 'Password1',
        ])->assertOk();

        $log = ActivityLog::where('action', 'user.login')
                          ->where('user_id', $user->id)
                          ->first();

        $this->assertNotNull($log);
        $this->assertEquals($user->id, $log->user_id);
        $this->assertEquals('admin', $log->meta['role'] ?? null);
    }

    public function test_org_admin_login_logs_organization_id(): void
    {
        $org  = Organization::factory()->create(['is_active' => true]);
        $user = User::factory()->create([
            'phone'           => '+998901110005',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_ADMIN,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110005',
            'password' => 'Password1',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'user.login',
            'user_id'         => $user->id,
            'organization_id' => $org->id,
        ]);
    }

    public function test_super_admin_login_logs_null_organization_id(): void
    {
        $sa = User::factory()->create([
            'phone'           => '+998901110006',
            'password'        => Hash::make('Password1'),
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
            'is_active'       => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110006',
            'password' => 'Password1',
        ])->assertOk();

        $log = ActivityLog::where('action', 'user.login')
                          ->where('user_id', $sa->id)
                          ->first();

        $this->assertNotNull($log);
        $this->assertNull($log->organization_id, 'Super admin login must log null organization_id.');
    }

    public function test_failed_login_does_not_create_activity_log_entry(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901110007',
            'password'  => Hash::make('Password1'),
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110007',
            'password' => 'WrongPassword',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('activity_logs', [
            'action'  => 'user.login',
            'user_id' => $user->id,
        ]);
    }

    // ── Logout creates an activity log entry ───────────────────────────────

    public function test_logout_creates_activity_log_entry(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/v1/logout')
             ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'  => 'user.logout',
            'user_id' => $user->id,
        ]);
    }

    public function test_logout_activity_log_contains_correct_user_and_org(): void
    {
        $org  = Organization::factory()->create(['is_active' => true]);
        $user = User::factory()->create([
            'role'            => User::ROLE_TEACHER,
            'organization_id' => $org->id,
            'is_active'       => true,
        ]);

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/v1/logout')
             ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action'          => 'user.logout',
            'user_id'         => $user->id,
            'organization_id' => $org->id,
        ]);
    }

    // ── Multiple logins each produce a log entry ───────────────────────────

    public function test_each_login_produces_a_separate_audit_entry(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901110008',
            'password'  => Hash::make('Password1'),
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110008',
            'password' => 'Password1',
        ])->assertOk();

        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110008',
            'password' => 'Password1',
        ])->assertOk();

        $count = ActivityLog::where('action', 'user.login')
                            ->where('user_id', $user->id)
                            ->count();

        $this->assertEquals(2, $count, 'Each successful login must produce its own audit log entry.');
    }
}
