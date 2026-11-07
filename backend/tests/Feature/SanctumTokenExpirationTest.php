<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H10 — Sanctum Token Expiration
 *
 * Previously, config('sanctum.expiration') was null, meaning every issued
 * token lived forever in the database. The Sanctum guard's isValidAccessToken()
 * check short-circuits to true when expiration is null, so a stolen token —
 * extracted from a cookie leak, device theft, or server-side breach — would
 * never self-invalidate.
 *
 * The 7-day httpOnly cookie provides browser-side expiry, but the underlying
 * DB token survived indefinitely. H7 and H9 added explicit revocation paths
 * (deactivation, password reset), but those only help when an admin notices
 * a breach. Passive token expiration is the last line of defence.
 *
 * Fix applied:
 *   config/sanctum.php — 'expiration' set to env('SANCTUM_TOKEN_EXPIRATION',
 *   60 * 24 * 7) — 10,080 minutes (7 days), matching the cookie lifetime set
 *   in AuthController::login().
 *
 *   bootstrap/app.php — 'sanctum:prune-expired --hours=24' added to the daily
 *   scheduler so expired DB rows are cleaned up automatically.
 *
 * How Sanctum enforces the expiry (Guard::isValidAccessToken):
 *   (! $this->expiration || $accessToken->created_at->gt(now()->subMinutes($this->expiration)))
 * A token is valid only when its created_at is within the expiration window.
 */
class SanctumTokenExpirationTest extends TestCase
{
    use RefreshDatabase;

    // ── Configuration ──────────────────────────────────────────────────

    public function test_sanctum_expiration_is_configured(): void
    {
        $expiration = config('sanctum.expiration');

        $this->assertNotNull($expiration, 'sanctum.expiration must not be null — tokens must expire.');
        $this->assertIsInt($expiration);
        $this->assertGreaterThan(0, $expiration, 'sanctum.expiration must be a positive number of minutes.');
    }

    public function test_sanctum_expiration_matches_cookie_lifetime(): void
    {
        // The httpOnly cookie is set for 60 * 24 * 7 minutes in AuthController.
        // The token expiration must not exceed the cookie lifetime to avoid
        // orphaned valid tokens after the browser session ends.
        $expiration  = config('sanctum.expiration');
        $cookieMinutes = 60 * 24 * 7;   // 10,080 minutes (7 days)

        $this->assertLessThanOrEqual(
            $cookieMinutes,
            $expiration,
            'Token expiration must be ≤ cookie lifetime (7 days) to keep DB and browser sessions in sync.'
        );
    }

    // ── Active token is accepted ────────────────────────────────────────

    public function test_fresh_token_is_accepted(): void
    {
        $user  = User::factory()->create(['is_active' => true]);
        $token = $user->createToken('test-session')->plainTextToken;

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.id', $user->id);
    }

    // ── Expired token is rejected ───────────────────────────────────────

    public function test_token_expired_after_7_days_is_rejected(): void
    {
        $user  = User::factory()->create(['is_active' => true]);
        $token = $user->createToken('test-session')->plainTextToken;

        // Verify it works while fresh.
        $this->withToken($token)->getJson('/api/v1/me')->assertOk();

        // Advance time past the 7-day expiration window.
        $this->travel(8)->days();

        $this->app['auth']->forgetGuards();

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    public function test_token_one_minute_before_expiry_is_still_valid(): void
    {
        // Boundary: one minute before the expiration window the token must still
        // be accepted. Sanctum checks created_at->gt(now()->subMinutes(expiration)),
        // so at exactly T+expiration the token is already expired (gt, not gte).
        $expiration = config('sanctum.expiration'); // minutes
        $user  = User::factory()->create(['is_active' => true]);
        $token = $user->createToken('test-session')->plainTextToken;

        $this->travelTo(now()->addMinutes($expiration - 1));
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertOk();
    }

    public function test_token_one_minute_past_expiry_is_rejected(): void
    {
        $expiration = config('sanctum.expiration');   // minutes
        $user  = User::factory()->create(['is_active' => true]);
        $token = $user->createToken('test-session')->plainTextToken;

        $this->travelTo(now()->addMinutes($expiration + 1));
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    // ── Expiry spans multiple roles ─────────────────────────────────────

    public function test_super_admin_token_expires_after_7_days(): void
    {
        $sa    = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'is_active' => true]);
        $token = $sa->createToken('sa-session')->plainTextToken;

        $this->travel(8)->days();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    public function test_teacher_token_expires_after_7_days(): void
    {
        $org     = Organization::factory()->create(['is_active' => true]);
        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER, 'organization_id' => $org->id, 'is_active' => true]);
        $token   = $teacher->createToken('teacher-session')->plainTextToken;

        $this->travel(8)->days();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertUnauthorized();
    }

    // ── Prune command is scheduled ──────────────────────────────────────

    public function test_sanctum_prune_expired_command_is_scheduled(): void
    {
        // sanctum:prune-expired o'rniga tokens:prune-expired — 30 kunlik mobil refresh
        // tokenlarni created_at bo'yicha muddatidan oldin o'chirmaydi (MobileSessionTest)
        $this->artisan('schedule:list')
             ->expectsOutputToContain('tokens:prune-expired')
             ->assertExitCode(0);
    }

    // ── Login still works and new token is fresh ────────────────────────

    public function test_login_after_token_expiry_creates_fresh_token(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901110200',
            'password'  => \Illuminate\Support\Facades\Hash::make('Password1'),
            'role'      => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        // Get first token.
        $response1 = $this->postJson('/api/v1/login', [
            'phone'    => '+998901110200',
            'password' => 'Password1',
        ])->assertOk();

        // Travel past expiry.
        $this->travel(8)->days();
        $this->app['auth']->forgetGuards();

        // Log in again — must succeed regardless of the expired first token.
        $this->postJson('/api/v1/login', [
            'phone'    => '+998901110200',
            'password' => 'Password1',
        ])->assertOk();
    }
}
