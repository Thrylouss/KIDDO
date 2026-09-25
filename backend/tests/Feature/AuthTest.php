<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

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
                 ->assertJsonStructure(['token', 'user'])
                 ->assertJsonPath('user.phone', '+998901111111')
                 ->assertJsonPath('user.role', 'admin');
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
                 ->assertJsonFragment(['message' => 'Tizimdan muvaffaqiyatli chiqdingiz.']);
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
}
