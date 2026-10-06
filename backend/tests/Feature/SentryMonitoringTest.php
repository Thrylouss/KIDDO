<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H5 — Production Error Monitoring / Observability
 *
 * sentry/sentry-laravel 4.28.0 is integrated via bootstrap/app.php
 * ->withExceptions(). Integration::handles() hooks into the *reporting*
 * phase only — render() callbacks that return JSON responses are unaffected.
 *
 * When SENTRY_LARAVEL_DSN is unset (empty string in .env.example), Sentry's
 * ServiceProvider still registers but skips bindEvents(); captureException()
 * routes through a noop transport with no network activity.
 *
 * These tests verify application behavior without a real DSN, confirm that
 * all existing JSON error responses remain unchanged, and check that no real
 * credentials are present in source files.
 */
class SentryMonitoringTest extends TestCase
{
    use RefreshDatabase;

    // ── 1. App boots without a DSN ─────────────────────────────────

    public function test_application_boots_without_sentry_dsn(): void
    {
        // SENTRY_LARAVEL_DSN is unset in the test environment.
        // If this test passes, the app started successfully.
        $this->assertTrue(true);
    }

    public function test_sentry_dsn_is_not_configured_in_test_environment(): void
    {
        $dsn = config('sentry.dsn');

        // DSN must be null/empty in test environment — never a real credential
        $this->assertEmpty($dsn, 'SENTRY_LARAVEL_DSN must not be set in the test environment.');
    }

    public function test_health_endpoint_works_without_sentry_dsn(): void
    {
        $this->getJson('/api/health')->assertOk();
    }

    // ── 2. Existing JSON error responses are unchanged ─────────────

    public function test_unauthenticated_request_still_returns_401_with_uzbek_message(): void
    {
        $this->getJson('/api/v1/me')
             ->assertStatus(401)
             ->assertJson(['message' => 'Tizimga kirishingiz kerak.']);
    }

    public function test_missing_resource_still_returns_404_with_uzbek_message(): void
    {
        $sa = User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
        ]);

        $this->actingAs($sa, 'sanctum')
             ->getJson('/api/v1/super-admin/organizations/99999')
             ->assertStatus(404)
             ->assertJson(['message' => 'Ma\'lumot topilmadi.']);
    }

    public function test_validation_failure_still_returns_422_with_uzbek_message(): void
    {
        $this->postJson('/api/v1/login', [])
             ->assertStatus(422)
             ->assertJson(['message' => 'Kiritilgan ma\'lumotlar noto\'g\'ri.'])
             ->assertJsonStructure(['message', 'errors']);
    }

    public function test_unknown_route_still_returns_404(): void
    {
        $this->getJson('/api/v1/does-not-exist-h5')
             ->assertStatus(404)
             ->assertJson(['message' => 'Ma\'lumot topilmadi.']);
    }

    public function test_403_role_response_is_still_correct(): void
    {
        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER]);

        $this->actingAs($teacher, 'sanctum')
             ->getJson('/api/v1/super-admin/organizations')
             ->assertStatus(403);
    }

    // ── 3. No real credentials in source files ─────────────────────

    public function test_sentry_dsn_env_example_is_empty(): void
    {
        $envExample = file_get_contents(base_path('.env.example'));

        // Must have the key declared
        $this->assertStringContainsString('SENTRY_LARAVEL_DSN', $envExample);

        // Must NOT contain a real DSN (sentry.io URL with a key)
        $this->assertDoesNotMatchRegularExpression(
            '/SENTRY_LARAVEL_DSN=https:\/\/[a-f0-9]{32}@/',
            $envExample,
            '.env.example must not contain a real Sentry DSN key.'
        );
    }

    public function test_sentry_config_does_not_hardcode_credentials(): void
    {
        $configContent = file_get_contents(config_path('sentry.php'));

        // Config must use env() helper, not a hardcoded DSN string
        $this->assertDoesNotMatchRegularExpression(
            '/["\']https:\/\/[a-f0-9]{32}@[a-z0-9.]+\/\d+["\']/',
            $configContent,
            'config/sentry.php must not contain a hardcoded DSN.'
        );
    }

    public function test_bootstrap_app_does_not_hardcode_sentry_credentials(): void
    {
        $bootstrapContent = file_get_contents(base_path('bootstrap/app.php'));

        $this->assertDoesNotMatchRegularExpression(
            '/["\']https:\/\/[a-f0-9]{32}@/',
            $bootstrapContent,
            'bootstrap/app.php must not contain a hardcoded Sentry DSN.'
        );
    }

    // ── 4. Sentry config structure is correct ──────────────────────

    public function test_sentry_config_file_is_loadable(): void
    {
        $config = config('sentry');

        $this->assertIsArray($config);
        $this->assertArrayHasKey('dsn', $config);
        $this->assertArrayHasKey('send_default_pii', $config);
        $this->assertArrayHasKey('ignore_exceptions', $config);
    }

    public function test_sentry_send_default_pii_is_disabled(): void
    {
        // Ensures PII (IP, user email, etc.) is not sent to Sentry by default.
        $this->assertFalse(config('sentry.send_default_pii'));
    }

    public function test_sentry_ignores_expected_http_exceptions(): void
    {
        $ignored = config('sentry.ignore_exceptions', []);

        $this->assertContains(
            \Illuminate\Auth\AuthenticationException::class,
            $ignored,
            'AuthenticationException (401) should be ignored by Sentry.'
        );

        $this->assertContains(
            \Illuminate\Validation\ValidationException::class,
            $ignored,
            'ValidationException (422) should be ignored by Sentry.'
        );

        $this->assertContains(
            \Symfony\Component\HttpKernel\Exception\HttpException::class,
            $ignored,
            'HttpException (4xx/5xx HTTP errors) should be ignored by Sentry.'
        );
    }

    // ── 5. Integration wiring ──────────────────────────────────────

    public function test_sentry_service_provider_is_registered(): void
    {
        // The service provider must be registered (package auto-discovery).
        $this->assertTrue(
            app()->providerIsLoaded(\Sentry\Laravel\ServiceProvider::class),
            'Sentry ServiceProvider must be registered.'
        );
    }

    // ── 6. APP_DEBUG guard ─────────────────────────────────────────

    public function test_app_debug_is_true_in_test_environment(): void
    {
        // The test .env has APP_DEBUG=true (local dev mode).
        // The bootstrap/app.php guard must therefore skip Integration::handles(),
        // preventing any dev noise from leaking to Sentry.
        $this->assertTrue(
            config('app.debug'),
            'Test environment should have APP_DEBUG=true so the Sentry debug guard is exercised.'
        );
    }

    public function test_bootstrap_wraps_sentry_integration_in_debug_guard(): void
    {
        // Verify that bootstrap/app.php contains the APP_DEBUG guard around Integration::handles().
        $bootstrap = file_get_contents(base_path('bootstrap/app.php'));

        $this->assertStringContainsString(
            "config('app.debug')",
            $bootstrap,
            'bootstrap/app.php must guard Integration::handles() with config(\'app.debug\').'
        );

        $this->assertStringContainsString(
            'Integration::handles',
            $bootstrap,
            'bootstrap/app.php must still wire Integration::handles() for production.'
        );
    }

    // ── 7. Request body scrubbing (before_send) ────────────────────

    public function test_sentry_config_has_before_send_callable(): void
    {
        $beforeSend = config('sentry.before_send');

        $this->assertNotNull($beforeSend, 'sentry.before_send must be configured.');
        $this->assertTrue(is_callable($beforeSend), 'sentry.before_send must be a valid PHP callable.');
    }

    public function test_request_scrubber_filters_password_field(): void
    {
        $event = \Sentry\Event::createEvent();
        $event->setRequest(['data' => ['email' => 'user@example.com', 'password' => 'secret123']]);

        $result = \App\Sentry\RequestScrubber::scrub($event, null);

        $this->assertNotNull($result);
        $this->assertSame('[Filtered]', $result->getRequest()['data']['password']);
        $this->assertSame('user@example.com', $result->getRequest()['data']['email']);
    }

    public function test_request_scrubber_filters_password_confirmation_field(): void
    {
        $event = \Sentry\Event::createEvent();
        $event->setRequest(['data' => ['password' => 'abc', 'password_confirmation' => 'abc']]);

        $result = \App\Sentry\RequestScrubber::scrub($event, null);

        $this->assertSame('[Filtered]', $result->getRequest()['data']['password']);
        $this->assertSame('[Filtered]', $result->getRequest()['data']['password_confirmation']);
    }

    public function test_request_scrubber_filters_current_password_field(): void
    {
        $event = \Sentry\Event::createEvent();
        $event->setRequest(['data' => ['current_password' => 'old', 'password' => 'new']]);

        $result = \App\Sentry\RequestScrubber::scrub($event, null);

        $this->assertSame('[Filtered]', $result->getRequest()['data']['current_password']);
        $this->assertSame('[Filtered]', $result->getRequest()['data']['password']);
    }

    public function test_request_scrubber_returns_event_unchanged_when_no_body(): void
    {
        $event = \Sentry\Event::createEvent();
        // GET request — no body data
        $event->setRequest(['method' => 'GET', 'url' => 'https://example.com']);

        $result = \App\Sentry\RequestScrubber::scrub($event, null);

        $this->assertNotNull($result);
        $this->assertArrayNotHasKey('data', $result->getRequest());
    }

    public function test_request_scrubber_preserves_non_sensitive_fields(): void
    {
        $event = \Sentry\Event::createEvent();
        $event->setRequest(['data' => ['name' => 'Alisher', 'email' => 'alisher@example.com', 'password' => 'x']]);

        $result = \App\Sentry\RequestScrubber::scrub($event, null);

        $data = $result->getRequest()['data'];
        $this->assertSame('Alisher', $data['name']);
        $this->assertSame('alisher@example.com', $data['email']);
        $this->assertSame('[Filtered]', $data['password']);
    }
}
