<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * H4 — Exception Handler Consolidation
 *
 * Laravel 11 configures exception handling exclusively through
 * bootstrap/app.php ->withExceptions(). The old app/Exceptions/Handler.php
 * (Laravel 10-style) was dead code — never instantiated by the framework and
 * containing identical renderables to those in bootstrap/app.php.
 *
 * These tests verify that the authoritative withExceptions() configuration in
 * bootstrap/app.php produces the correct Uzbek-language responses for every
 * exception type it handles, and that the deletion of Handler.php has not
 * regressed any error behavior.
 */
class ExceptionHandlerTest extends TestCase
{
    use RefreshDatabase;

    // ── 401 — AuthenticationException ─────────────────────────────

    public function test_unauthenticated_api_request_returns_401_with_uzbek_message(): void
    {
        $response = $this->getJson('/api/v1/me');

        $response->assertStatus(401)
                 ->assertJson(['message' => 'Tizimga kirishingiz kerak.']);
    }

    public function test_unauthenticated_request_to_protected_route_returns_401(): void
    {
        $response = $this->getJson('/api/v1/super-admin/organizations');

        $response->assertStatus(401)
                 ->assertJsonStructure(['message']);
    }

    // ── 403 — Role middleware (not the exception handler) ──────────

    public function test_authenticated_user_without_required_role_returns_403(): void
    {
        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER]);

        $response = $this->actingAs($teacher, 'sanctum')
            ->getJson('/api/v1/super-admin/organizations');

        $response->assertStatus(403)
                 ->assertJson(['message' => 'Bu sahifaga kirishga ruxsatingiz yo\'q.']);
    }

    public function test_admin_accessing_super_admin_route_returns_403(): void
    {
        $org   = \App\Models\Organization::factory()->create();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/organizations');

        $response->assertStatus(403);
    }

    // ── 404 — NotFoundHttpException ────────────────────────────────

    public function test_missing_resource_returns_404_with_uzbek_message(): void
    {
        $sa = User::factory()->create([
            'role'            => User::ROLE_SUPER_ADMIN,
            'organization_id' => null,
        ]);

        $response = $this->actingAs($sa, 'sanctum')
            ->getJson('/api/v1/super-admin/organizations/99999');

        $response->assertStatus(404)
                 ->assertJson(['message' => 'Ma\'lumot topilmadi.']);
    }

    public function test_unknown_api_route_returns_404(): void
    {
        $response = $this->getJson('/api/v1/this-route-does-not-exist');

        $response->assertStatus(404)
                 ->assertJson(['message' => 'Ma\'lumot topilmadi.']);
    }

    // ── 422 — ValidationException ──────────────────────────────────

    public function test_validation_failure_returns_422_with_uzbek_message_and_errors(): void
    {
        $response = $this->postJson('/api/v1/login', []);

        $response->assertStatus(422)
                 ->assertJson(['message' => 'Kiritilgan ma\'lumotlar noto\'g\'ri.'])
                 ->assertJsonStructure(['message', 'errors']);
    }

    public function test_validation_failure_errors_key_contains_field_names(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'phone'    => '',
            'password' => '',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['phone']);
    }

    // ── Response structure — no internal details exposed ───────────

    public function test_404_response_does_not_expose_exception_class_or_trace(): void
    {
        $response = $this->getJson('/api/v1/this-route-does-not-exist-h4');

        $json = $response->json();

        $this->assertArrayNotHasKey('exception', $json);
        $this->assertArrayNotHasKey('trace', $json);
        $this->assertArrayNotHasKey('file', $json);
        $this->assertArrayNotHasKey('line', $json);
    }

    public function test_401_response_does_not_expose_exception_class_or_trace(): void
    {
        $response = $this->getJson('/api/v1/me');

        $json = $response->json();

        $this->assertArrayNotHasKey('exception', $json);
        $this->assertArrayNotHasKey('trace', $json);
    }

    public function test_abort_403_response_does_not_expose_exception_class_or_trace(): void
    {
        // AdminController::orgId() — super-admin X-Impersonated-Org sarlavhasisiz → abort(403)
        $superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/v1/admin/children');

        $response->assertForbidden()->assertExactJson(['message' => "Bog'cha ID noto'g'ri."]);
    }

    public function test_policy_403_response_does_not_expose_exception_class_or_trace(): void
    {
        // AttendancePolicy::mark — Gate::authorize() AuthorizationException tashlaydi
        $org     = \App\Models\Organization::factory()->create();
        $teacher = User::factory()->teacher()->create(['organization_id' => $org->id]);
        $profile = \App\Models\TeacherProfile::factory()->create(['user_id' => $teacher->id, 'organization_id' => $org->id]);
        $group   = \App\Models\Group::factory()->create(['organization_id' => $org->id]);
        $profile->groups()->attach($group->id, ['assigned_at' => now()->toDateString()]);
        $child   = \App\Models\Child::factory()->inGroup($group)->create();

        $response = $this->actingAs($teacher, 'sanctum')->putJson('/api/v1/teacher/attendance', [
            'date'     => now('Asia/Tashkent')->subDays(10)->toDateString(),
            'group_id' => $group->id,
            'records'  => [['child_id' => $child->id, 'status' => 'present']],
        ]);

        $response->assertForbidden()
                 ->assertExactJson(['message' => "Bu sana uchun davomatni o'zgartirish muddati tugagan."]);
    }

    public function test_accept_sarlavhasisiz_autentifikatsiyasiz_sorov_500_emas_401(): void
    {
        // Ilgari Authenticate middleware route('login') ga yo'naltirmoqchi bo'lib 500 berardi
        foreach (['/api/v1/me', '/api/v1/admin/children', '/api/v1/parent/children', '/api/v1/teacher/daily'] as $url) {
            $this->get($url)
                 ->assertStatus(401)
                 ->assertExactJson(['message' => 'Tizimga kirishingiz kerak.']);
        }

        $this->withHeaders(['Authorization' => 'Bearer 1|notogri'])->get('/api/v1/me')->assertStatus(401);
    }
}
