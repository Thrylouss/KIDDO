<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Uses real login/logout round trips instead of actingAs(), so the DB-backed
 * Sanctum token and the kiddo_token cookie are exercised end to end.
 */
class LogoutSessionInvalidationTest extends TestCase
{
    use RefreshDatabase;

    private const PHONE    = '+998901112233';
    private const PASSWORD = 'password123';

    protected function setUp(): void
    {
        parent::setUp();
        // Flush cache so rate limiter buckets don't bleed between tests
        Cache::flush();

        $org = Organization::factory()->create(['is_active' => true]);
        User::factory()->admin()->create([
            'phone'           => self::PHONE,
            'password'        => Hash::make(self::PASSWORD),
            'organization_id' => $org->id,
        ]);
    }

    private function login(): TestResponse
    {
        return $this->postJson('/api/v1/login', [
            'phone'    => self::PHONE,
            'password' => self::PASSWORD,
        ])->assertOk();
    }

    private function tokenFrom(TestResponse $response): string
    {
        $token = $response->getCookie('kiddo_token', false)?->getValue();
        $this->assertNotEmpty($token);

        return $token;
    }

    /** The Sanctum guard caches the user; reset it so each request re-authenticates. */
    private function freshGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    // ── Logout ─────────────────────────────────────────────────────

    public function test_old_cookie_is_rejected_after_logout(): void
    {
        $token = $this->tokenFrom($this->login());
        // JSON requests only send cookies when withCredentials() is enabled.
        $this->withCredentials()->withUnencryptedCookie('kiddo_token', $token);

        $this->freshGuards();
        $this->getJson('/api/v1/me')->assertOk();

        $this->freshGuards();
        $this->postJson('/api/v1/logout')
             ->assertOk()
             ->assertCookieExpired('kiddo_token');

        // Replaying the cookie captured before logout must not work.
        $this->freshGuards();
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_logout_deletes_the_token_from_the_database(): void
    {
        $this->withCredentials()->withUnencryptedCookie('kiddo_token', $this->tokenFrom($this->login()));
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->freshGuards();
        $this->postJson('/api/v1/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_old_token_is_rejected_as_bearer_after_logout(): void
    {
        $token = $this->tokenFrom($this->login());

        $this->freshGuards();
        $this->withToken($token)->postJson('/api/v1/logout')->assertOk();

        $this->freshGuards();
        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_new_login_invalidates_previous_session(): void
    {
        $first  = $this->tokenFrom($this->login());
        $second = $this->tokenFrom($this->login());

        $this->freshGuards();
        $this->withToken($first)->getJson('/api/v1/me')->assertUnauthorized();

        $this->freshGuards();
        $this->withToken($second)->getJson('/api/v1/me')->assertOk();
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/v1/logout')->assertUnauthorized();
    }

    // ── Cookie attributes ──────────────────────────────────────────

    public function test_login_cookie_is_http_only_and_same_site_strict(): void
    {
        $cookie = $this->login()->getCookie('kiddo_token', false);

        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', strtolower((string) $cookie->getSameSite()));
    }

    public function test_login_cookie_is_secure_in_production(): void
    {
        config(['app.env' => 'production']);

        $cookie = $this->login()->getCookie('kiddo_token', false);

        $this->assertTrue($cookie->isSecure());
    }
}
