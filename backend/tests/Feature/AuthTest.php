<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Flush cache so rate limiter buckets don't bleed between tests
        Cache::flush();
    }

    // ──────────────────────────────────────────────────────────────
    // Login
    // ──────────────────────────────────────────────────────────────

    public function test_foydalanuvchi_telefon_va_parol_bilan_kirishi_mumkin(): void
    {
        $user = User::factory()->create([
            'phone'     => '+998901111111',
            'password'  => Hash::make('password123'),
            'role'      => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901111111',
            'password' => 'password123',
        ]);

        $response->assertOk()
                 ->assertJsonStructure(['user'])
                 ->assertCookie('kiddo_token')
                 ->assertJsonPath('user.phone', '+998901111111')
                 ->assertJsonPath('user.role', 'admin');

        $this->assertArrayNotHasKey('token', $response->json());
    }

    public function test_noto_gri_parol_bilan_kirish_rad_etiladi(): void
    {
        User::factory()->create([
            'phone'     => '+998901111112',
            'password'  => Hash::make('password123'),
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901111112',
            'password' => 'xato_parol',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['phone']);
    }

    public function test_mavjud_bulmagan_telefon_bilan_kirish_rad_etiladi(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998900000000',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_faol_bulmagan_foydalanuvchi_kira_olmaydi(): void
    {
        User::factory()->create([
            'phone'     => '+998901111113',
            'password'  => Hash::make('password123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901111113',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_telefon_maydoni_majburiy(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['phone']);
    }

    public function test_super_admin_can_login_with_correct_credentials(): void
    {
        User::factory()->create([
            'phone'     => '+998901234567',
            'password'  => Hash::make('superadmin123'),
            'role'      => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901234567',
            'password' => 'superadmin123',
        ]);

        $response->assertOk()
                 ->assertJsonStructure(['user'])
                 ->assertCookie('kiddo_token')
                 ->assertJsonPath('user.phone', '+998901234567')
                 ->assertJsonPath('user.role', 'super_admin');
    }

    public function test_super_admin_login_fails_with_wrong_password(): void
    {
        User::factory()->create([
            'phone'     => '+998901234567',
            'password'  => Hash::make('superadmin123'),
            'role'      => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901234567',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['phone']);
    }

    public function test_super_admin_token_contains_role_ability(): void
    {
        $sa = User::factory()->create([
            'phone'     => '+998901234567',
            'password'  => Hash::make('superadmin123'),
            'role'      => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        $loginResponse = $this->postJson('/api/v1/login', [
            'phone'    => '+998901234567',
            'password' => 'superadmin123',
        ]);

        $loginResponse->assertOk()->assertCookie('kiddo_token');

        // Token is delivered via cookie — extract raw value to verify route access
        $tokenCookie = $loginResponse->getCookie('kiddo_token', false);
        $this->assertNotNull($tokenCookie);
        $token = $tokenCookie->getValue();
        $this->assertNotEmpty($token);

        // Verify /me works with the token
        $this->withToken($token)
             ->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.role', 'super_admin');
    }

    // ──────────────────────────────────────────────────────────────
    // Me (joriy foydalanuvchi)
    // ──────────────────────────────────────────────────────────────

    public function test_autentifikatsiya_qilingan_foydalanuvchi_profilni_olishi_mumkin(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_TEACHER]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/v1/me');

        $response->assertOk()
                 ->assertJsonPath('user.id', $user->id)
                 ->assertJsonPath('user.role', 'teacher');
    }

    public function test_autentifikatsiyasiz_profil_olish_rad_etiladi(): void
    {
        $response = $this->getJson('/api/v1/me');

        $response->assertStatus(401);
    }

    // ──────────────────────────────────────────────────────────────
    // Logout
    // ──────────────────────────────────────────────────────────────

    public function test_foydalanuvchi_tizimdan_chiqishi_mumkin(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/logout');

        $response->assertOk()
                 ->assertJsonFragment(['message' => 'Tizimdan muvaffaqiyatli chiqdingiz.'])
                 ->assertCookieExpired('kiddo_token');
    }

    // ──────────────────────────────────────────────────────────────
    // Role middleware
    // ──────────────────────────────────────────────────────────────

    public function test_admin_admin_sahifasiga_kira_oladi(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        // Admin uchun himoyalangan route (test placeholder)
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/me');

        $response->assertOk();
        $this->assertEquals('admin', $admin->role);
    }

    public function test_tarbiyachi_o_z_roliga_mos_keladi(): void
    {
        $teacher = User::factory()->create(['role' => User::ROLE_TEACHER]);

        $this->actingAs($teacher, 'sanctum')->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.role', 'teacher');
    }

    public function test_ota_ona_o_z_roliga_mos_keladi(): void
    {
        $parent = User::factory()->create(['role' => User::ROLE_PARENT]);

        $this->actingAs($parent, 'sanctum')->getJson('/api/v1/me')
             ->assertOk()
             ->assertJsonPath('user.role', 'parent');
    }

    public function test_parol_response_da_qaytarilmaydi(): void
    {
        $user = User::factory()->create([
            'phone'    => '+998901111114',
            'password' => Hash::make('password123'),
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998901111114',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $this->assertArrayNotHasKey('password', $response->json('user'));
    }

    // ──────────────────────────────────────────────────────────────
    // Rate limiting
    // ──────────────────────────────────────────────────────────────

    public function test_login_throttle_blocks_after_five_attempts(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/login', [
                'phone'    => '+998909999991',
                'password' => 'wrongpassword',
            ]);
        }

        $response = $this->postJson('/api/v1/login', [
            'phone'    => '+998909999991',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(429);
    }

    public function test_login_throttle_allows_five_attempts(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/v1/login', [
                'phone'    => '+998909999992',
                'password' => 'wrongpassword',
            ]);
            $response->assertStatus(422);
        }
    }
}
