<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H12 — Missing HTTP Security Response Headers + Server/Technology Version Disclosure
 *
 * Before this fix every API response was missing standard browser security
 * directives and was actively leaking server software versions:
 *
 *   Server: nginx/1.25.5      ← reveals exact nginx version to attackers
 *   X-Powered-By: PHP/8.2.34  ← reveals exact PHP version to attackers
 *
 * No security headers were present:
 *   X-Frame-Options          — missing → clickjacking possible
 *   X-Content-Type-Options   — missing → MIME-sniffing attacks possible
 *   Referrer-Policy          — missing → full URL leaked to linked resources
 *   X-Permitted-Cross-Domain-Policies — missing
 *
 * Fix applied:
 *   SecureHeadersMiddleware — appended to the 'api' middleware group; adds the
 *   four security headers and removes X-Powered-By from the Symfony response
 *   object plus calls header_remove('X-Powered-By') to suppress it at the
 *   PHP-header level.
 *
 *   docker/nginx/default.conf      — server_tokens off; fastcgi_hide_header X-Powered-By;
 *   docker/nginx/default.prod.conf — server_tokens off; fastcgi_hide_header X-Powered-By;
 *
 * Note: the Server and nginx-level X-Powered-By suppression are nginx
 * configuration changes; they are tested at the infrastructure level (curl
 * checks) rather than in this PHP test suite.
 */
class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    // ── Headers present on public (unauthenticated) responses ──────────────

    public function test_health_endpoint_has_x_frame_options(): void
    {
        $this->getJson('/api/health')
             ->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    public function test_health_endpoint_has_x_content_type_options(): void
    {
        $this->getJson('/api/health')
             ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_health_endpoint_has_referrer_policy(): void
    {
        $this->getJson('/api/health')
             ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    public function test_health_endpoint_has_x_permitted_cross_domain_policies(): void
    {
        $this->getJson('/api/health')
             ->assertHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }

    public function test_health_endpoint_does_not_expose_x_powered_by(): void
    {
        $response = $this->getJson('/api/health');
        $this->assertNull(
            $response->headers->get('X-Powered-By'),
            'X-Powered-By must not be present in API responses.'
        );
    }

    // ── Headers present on 401 (unauthenticated) responses ─────────────────

    public function test_401_response_has_security_headers(): void
    {
        $this->getJson('/api/v1/me')
             ->assertUnauthorized()
             ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
             ->assertHeader('X-Content-Type-Options', 'nosniff')
             ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    // ── Headers present on 422 (validation error) responses ────────────────

    public function test_422_response_has_security_headers(): void
    {
        $this->postJson('/api/v1/login', [
                 'phone'    => '+998901110000',
                 'password' => 'wrong',
             ])
             ->assertUnprocessable()
             ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
             ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    // ── Headers present on authenticated responses ──────────────────────────

    public function test_authenticated_endpoint_has_security_headers(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        $this->actingAs($user, 'sanctum')
             ->getJson('/api/v1/me')
             ->assertOk()
             ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
             ->assertHeader('X-Content-Type-Options', 'nosniff')
             ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
             ->assertHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }

    public function test_authenticated_endpoint_does_not_expose_x_powered_by(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        $response = $this->actingAs($user, 'sanctum')
                         ->getJson('/api/v1/me')
                         ->assertOk();

        $this->assertNull(
            $response->headers->get('X-Powered-By'),
            'X-Powered-By must not be present in authenticated responses.'
        );
    }

    // ── Headers present on 404 responses ───────────────────────────────────

    public function test_404_response_has_security_headers(): void
    {
        $this->getJson('/api/v1/nonexistent-route-xyz')
             ->assertNotFound()
             ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
             ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    // ── All four required headers present together ──────────────────────────

    public function test_all_security_headers_present_on_single_response(): void
    {
        $response = $this->getJson('/api/health')->assertOk();

        $required = [
            'X-Frame-Options'                  => 'SAMEORIGIN',
            'X-Content-Type-Options'           => 'nosniff',
            'Referrer-Policy'                  => 'strict-origin-when-cross-origin',
            'X-Permitted-Cross-Domain-Policies' => 'none',
        ];

        foreach ($required as $header => $value) {
            $response->assertHeader($header, $value);
        }
    }
}
