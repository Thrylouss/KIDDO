<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Super Admin'ni konsoldan bir martalik yaratish va login/parolini o'zgartirish. Parol chiqarilmaydi. */
class SuperAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Test-parol-123456';

    public function test_super_admin_yashirin_parol_bilan_yaratiladi(): void
    {
        $this->artisan('kiddo:super-admin:create', ['phone' => '+998900000001', '--name' => 'Operator'])
            ->expectsQuestion('Parol (kamida 12 belgi)', self::PASSWORD)
            ->expectsQuestion('Parolni takrorlang', self::PASSWORD)
            ->expectsOutputToContain('login +998900000001')
            ->doesntExpectOutputToContain(self::PASSWORD)
            ->assertSuccessful();

        $user = User::where('phone', '+998900000001')->firstOrFail();
        $this->assertSame([User::ROLE_SUPER_ADMIN, null, true], [$user->role, $user->organization_id, $user->is_active]);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
        $this->assertNotSame(self::PASSWORD, $user->getRawOriginal('password'));

        // Login ishlaydi
        $this->postJson('/api/v1/login', ['phone' => '+998900000001', 'password' => self::PASSWORD])->assertOk();
    }

    public function test_ikkinchi_marta_yaratish_rad_etiladi(): void
    {
        User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->artisan('kiddo:super-admin:create', ['phone' => '+998900000002'])
            ->expectsOutputToContain('allaqachon mavjud')
            ->assertFailed();
        $this->assertSame(1, User::where('role', User::ROLE_SUPER_ADMIN)->count());
    }

    public function test_qisqa_yoki_mos_kelmagan_parol_va_notogri_telefon_rad_etiladi(): void
    {
        $this->artisan('kiddo:super-admin:create', ['phone' => '+998900000001'])
            ->expectsQuestion('Parol (kamida 12 belgi)', 'qisqa')
            ->expectsQuestion('Parolni takrorlang', 'qisqa')
            ->assertFailed();

        $this->artisan('kiddo:super-admin:create', ['phone' => '+998900000001'])
            ->expectsQuestion('Parol (kamida 12 belgi)', self::PASSWORD)
            ->expectsQuestion('Parolni takrorlang', self::PASSWORD . 'x')
            ->expectsOutputToContain('mos kelmadi')
            ->assertFailed();

        $this->artisan('kiddo:super-admin:create', ['phone' => '90 000 00 01'])->assertFailed();

        $org = Organization::factory()->create();
        User::factory()->admin()->create(['organization_id' => $org->id, 'phone' => '+998900000009']);
        $this->artisan('kiddo:super-admin:create', ['phone' => '+998900000009'])
            ->expectsOutputToContain('boshqa foydalanuvchiga')
            ->assertFailed();

        $this->assertSame(0, User::where('role', User::ROLE_SUPER_ADMIN)->count());
    }

    public function test_login_va_parol_ozgartiriladi_sessiyalar_bekor_qilinadi(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'phone' => '+998900000001']);
        $user->createToken('web');

        $this->artisan('kiddo:super-admin:update', ['phone' => '+998900000001', '--new-phone' => '+998900000003', '--password' => true])
            ->expectsQuestion('Parol (kamida 12 belgi)', self::PASSWORD)
            ->expectsQuestion('Parolni takrorlang', self::PASSWORD)
            ->doesntExpectOutputToContain(self::PASSWORD)
            ->assertSuccessful();

        $user->refresh();
        $this->assertSame('+998900000003', $user->phone);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_update_faqat_super_admin_uchun_ishlaydi(): void
    {
        $org = Organization::factory()->create();
        User::factory()->admin()->create(['organization_id' => $org->id, 'phone' => '+998900000004']);

        $this->artisan('kiddo:super-admin:update', ['phone' => '+998900000004', '--new-phone' => '+998900000005'])
            ->expectsOutputToContain('topilmadi')
            ->assertFailed();
    }
}
