<?php

namespace Tests\Feature;

use App\Console\Commands\DevTestAccounts;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Username yoki telefon orqali kirish va DEV TEST MODE akkauntlari (kiddo:dev-accounts). */
class UsernameLoginTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Test-parol-1';

    private function enableDevMode(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config([
            'kiddo.dev_test_mode'     => true,
            'kiddo.dev_test_database' => DB::connection()->getDatabaseName(),
            'kiddo.dev_test_password' => self::PASSWORD,
        ]);
    }

    private function login(array $body)
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/login', $body);
    }

    // ── Login ──────────────────────────────────────────────────────────

    public function test_username_bilan_kirish_katta_kichik_harfsiz(): void
    {
        User::factory()->admin()->create(['username' => 'Bogcha7', 'phone' => null, 'password' => self::PASSWORD,
            'organization_id' => Organization::factory()->create()->id]);

        $this->assertSame('bogcha7', User::first()->username);
        $this->login(['login' => 'BOGCHA7', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('user.username', 'bogcha7')->assertJsonPath('user.role', 'admin')
            ->assertCookie('kiddo_token');
    }

    public function test_telefon_bilan_kirish_login_va_eski_phone_maydoni_orqali_ishlaydi(): void
    {
        User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'phone' => '+998901112233', 'password' => self::PASSWORD]);

        $this->login(['login' => '+998901112233', 'password' => self::PASSWORD])->assertOk();
        $this->login(['phone' => '+998901112233', 'password' => self::PASSWORD])->assertOk();
    }

    public function test_notogri_login_umumiy_xato_qaytaradi(): void
    {
        User::factory()->admin()->create(['username' => 'bogcha7', 'password' => self::PASSWORD, 'organization_id' => Organization::factory()->create()->id]);

        $this->login(['login' => 'bogcha7', 'password' => 'xato-parol'])
            ->assertStatus(422)->assertJsonPath('errors.login.0', "Login yoki parol noto'g'ri.");
        $this->login(['login' => 'yoq-foydalanuvchi', 'password' => self::PASSWORD])
            ->assertStatus(422)->assertJsonPath('errors.login.0', "Login yoki parol noto'g'ri.");
        // Eski klient — eski xabar va maydon
        $this->login(['phone' => '+998900000000', 'password' => 'x'])
            ->assertStatus(422)->assertJsonPath('errors.phone.0', "Telefon raqami yoki parol noto'g'ri.");
        $this->login(['password' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['login', 'phone']);
    }

    public function test_username_telefon_bilan_chalkashmaydi(): void
    {
        // Raqam bilan boshlanadigan qiymat — faqat telefon sifatida qidiriladi
        User::factory()->admin()->create(['username' => 'a901112233', 'phone' => '901112233', 'password' => self::PASSWORD,
            'organization_id' => Organization::factory()->create()->id]);

        $this->login(['login' => '901112233', 'password' => self::PASSWORD])->assertOk()->assertJsonPath('user.username', 'a901112233');
        $this->login(['login' => 'a901112233', 'password' => self::PASSWORD])->assertOk();
    }

    public function test_nofaol_bogcha_username_bilan_ham_kira_olmaydi(): void
    {
        $org = Organization::factory()->create(['is_active' => false]);
        User::factory()->admin()->create(['username' => 'bogcha8', 'password' => self::PASSWORD, 'organization_id' => $org->id]);

        $this->login(['login' => 'bogcha8', 'password' => self::PASSWORD])->assertStatus(422);
    }

    // ── DEV TEST MODE ──────────────────────────────────────────────────

    public function test_dev_mode_faqat_local_bayroq_va_toghri_bazada_ishlaydi(): void
    {
        // testing muhiti
        config(['kiddo.dev_test_mode' => true, 'kiddo.dev_test_password' => self::PASSWORD,
            'kiddo.dev_test_database' => DB::connection()->getDatabaseName()]);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('APP_ENV=local')->assertFailed();

        $this->enableDevMode();
        config(['kiddo.dev_test_mode' => false]);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('KIDDO_DEV_TEST_MODE')->assertFailed();

        $this->enableDevMode();
        config(['kiddo.dev_test_database' => 'kiddo_dev_boshqa']);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('ruxsat etilgan baza')->assertFailed();

        $this->enableDevMode();
        config(['kiddo.dev_test_password' => null]);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('KIDDO_DEV_TEST_PASSWORD')->assertFailed();

        $this->app->detectEnvironment(fn () => 'production');
        config(['kiddo.dev_test_password' => self::PASSWORD]);
        $this->artisan('kiddo:dev-accounts')->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_dev_akkauntlar_yaratiladi_mavjud_super_admin_ga_tegilmaydi_va_idempotent(): void
    {
        $existing = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'phone' => '+998900000001']);
        $imported = Organization::factory()->create(['name' => '1-sonli DMTT', 'district' => "Bo'stonliq tumani", 'number' => '1']);
        $importedBefore = $imported->fresh()->toArray();

        $this->enableDevMode();
        $this->artisan('kiddo:dev-accounts')->doesntExpectOutputToContain(self::PASSWORD)->assertSuccessful();
        $this->artisan('kiddo:dev-accounts')->assertSuccessful(); // qayta — takrorlamaydi

        // Mavjud Super Admin'ga tegilmaydi va umumiy «admin» test akkaunti endi yaratilmaydi
        $this->assertSame(1, User::where('role', User::ROLE_SUPER_ADMIN)->count());
        $this->assertNull($existing->fresh()->username);
        $this->assertSame($existing->password, $existing->fresh()->password);
        $this->assertFalse(User::where('username', 'admin')->exists());
        $this->assertSame(3, User::count());

        $org = Organization::where('name', DevTestAccounts::ORG_NAME)->sole();
        $this->assertSame(1, Group::where('organization_id', $org->id)->count());
        $this->assertSame(5, Child::where('organization_id', $org->id)->count());
        $this->assertEquals($importedBefore, $imported->fresh()->toArray()); // haqiqiy bog'cha o'zgarmagan

        foreach (['bogcha1' => 'admin', 'tarbiyachi1' => 'teacher'] as $username => $role) {
            $user = User::where('username', $username)->sole();
            $this->assertSame($role, $user->role);
            $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
            $this->assertNotSame(self::PASSWORD, $user->getRawOriginal('password'));
            $this->login(['login' => $username, 'password' => self::PASSWORD])->assertOk()->assertJsonPath('user.role', $role);
        }
        $this->assertSame($org->id, User::where('username', 'bogcha1')->value('organization_id'));
        $this->assertSame($org->id, User::where('username', 'tarbiyachi1')->value('organization_id'));
    }

    public function test_dev_super_admin_bir_marta_yaratiladi_va_username_bilan_kiradi(): void
    {
        $this->enableDevMode();
        config(['kiddo.dev_superadmin_username' => 'Demo_Kiddo', 'kiddo.dev_superadmin_password' => 'Demo-parol-123456']);

        $this->artisan('kiddo:dev-accounts')->doesntExpectOutputToContain('Demo-parol-123456')->assertSuccessful();
        $user = User::where('username', 'demo_kiddo')->sole();
        $hash = $user->password;
        $this->assertSame([User::ROLE_SUPER_ADMIN, null, null], [$user->role, $user->organization_id, $user->phone]);
        $this->assertStringStartsWith('$2y$', $hash);
        $this->assertTrue(Hash::check('Demo-parol-123456', $hash));

        // Qayta ishga tushirish (backend restart) — takroriy akkaunt yo'q, hash qayta yozilmaydi
        $this->artisan('kiddo:dev-accounts')->assertSuccessful();
        $this->artisan('kiddo:dev-accounts')->assertSuccessful();
        $this->assertSame(1, User::where('username', 'demo_kiddo')->count());
        $this->assertSame($hash, User::where('username', 'demo_kiddo')->value('password'));
        $this->assertSame(1, User::where('role', User::ROLE_SUPER_ADMIN)->count()); // faqat demo_kiddo

        // Katta-kichik harf farqsiz kirish → Super Admin
        $this->login(['login' => 'Demo_Kiddo', 'password' => 'Demo-parol-123456'])->assertOk()->assertJsonPath('user.role', 'super_admin');
        $this->login(['login' => 'Demo_Kiddo', 'password' => 'xato'])->assertStatus(422)->assertJsonPath('errors.login.0', "Login yoki parol noto'g'ri.");
    }

    public function test_dev_super_admin_production_va_testing_muhitida_yaratilmaydi(): void
    {
        foreach (['production', 'testing', 'staging'] as $env) {
            $this->enableDevMode();
            config(['kiddo.dev_superadmin_username' => 'demo_kiddo', 'kiddo.dev_superadmin_password' => 'Demo-parol-123456']);
            $this->app->detectEnvironment(fn () => $env);

            $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('APP_ENV=local')->assertFailed();
        }

        $this->assertSame(0, User::count());
        $this->login(['login' => 'demo_kiddo', 'password' => 'Demo-parol-123456'])->assertStatus(422);
    }

    public function test_dev_super_admin_notogri_sozlama_yoki_band_username_rad_etiladi(): void
    {
        $this->enableDevMode();
        config(['kiddo.dev_superadmin_username' => '1demo', 'kiddo.dev_superadmin_password' => 'Demo-parol-123456']);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('KIDDO_DEV_SUPERADMIN_USERNAME')->assertFailed();

        config(['kiddo.dev_superadmin_username' => 'demo_kiddo', 'kiddo.dev_superadmin_password' => 'qisqa']);
        $this->artisan('kiddo:dev-accounts')->assertFailed();

        $org = Organization::factory()->create();
        User::factory()->admin()->create(['username' => 'demo_kiddo', 'organization_id' => $org->id]);
        config(['kiddo.dev_superadmin_password' => 'Demo-parol-123456']);
        $this->artisan('kiddo:dev-accounts')->expectsOutputToContain('boshqa roldagi')->assertFailed();
        $this->assertSame(User::ROLE_ADMIN, User::where('username', 'demo_kiddo')->value('role'));
    }

    public function test_dev_akkauntlar_faqat_ozi_ruxsat_etilgan_joyni_koradi(): void
    {
        $foreignOrg   = Organization::factory()->create();
        $foreignChild = Child::factory()->create(['organization_id' => $foreignOrg->id,
            'group_id' => Group::factory()->create(['organization_id' => $foreignOrg->id])->id]);

        $this->enableDevMode();
        config(['kiddo.dev_superadmin_username' => 'demo_kiddo', 'kiddo.dev_superadmin_password' => 'Demo-parol-123456']);
        $this->artisan('kiddo:dev-accounts')->assertSuccessful();

        $as = function (string $username) {
            $this->app['auth']->forgetGuards();
            return $this->actingAs(User::where('username', $username)->sole(), 'sanctum');
        };

        // bogcha1 — faqat o'z bog'chasi
        $ids = collect($as('bogcha1')->getJson('/api/v1/admin/children')->assertOk()->json('data'))->pluck('id');
        $this->assertCount(5, $ids);
        $this->assertNotContains($foreignChild->id, $ids->all());
        $as('bogcha1')->getJson("/api/v1/admin/children/{$foreignChild->id}")->assertNotFound();
        $as('bogcha1')->getJson('/api/v1/super-admin/organizations')->assertForbidden();
        $as('bogcha1')->getJson('/api/v1/teacher/dashboard')->assertForbidden();

        // tarbiyachi1 — faqat o'z guruhi
        $as('tarbiyachi1')->getJson('/api/v1/teacher/dashboard')->assertOk()->assertJsonPath('summary.total', 5);
        $as('tarbiyachi1')->getJson("/api/v1/teacher/children/{$foreignChild->id}")->assertNotFound();
        $as('tarbiyachi1')->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $as('tarbiyachi1')->getJson('/api/v1/super-admin/dashboard')->assertForbidden();

        // admin — Super Admin paneli
        $as('demo_kiddo')->getJson('/api/v1/super-admin/dashboard')->assertOk();
    }
}
