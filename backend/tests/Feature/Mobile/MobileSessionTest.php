<?php

namespace Tests\Feature\Mobile;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use App\Services\MobileSessionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * Mobil ilova: login, access/refresh rotatsiyasi, qurilma sessiyalari, bekor qilish, izolyatsiya.
 * Barcha so'rovlar haqiqiy Sanctum tokenlari bilan (actingAs ishlatilmaydi).
 */
class MobileSessionTest extends TestCase
{
    use RefreshDatabase;

    private const PHONE    = '+998907770001';
    private const PASSWORD = 'password'; // UserFactory standart test paroli

    private Organization $org;
    private User $parent;
    private Child $own;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));

        $this->org    = Organization::factory()->create();
        $this->parent = User::factory()->parent()->create(['organization_id' => $this->org->id, 'phone' => self::PHONE]);
        $profile      = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $this->org->id]);
        $this->own    = Child::factory()->create(['organization_id' => $this->org->id]);
        $profile->children()->attach($this->own->id, ['relation_type' => 'ona']);
    }

    private function login(string $device = 'iPhone', string $phone = self::PHONE, string $ip = '10.1.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
                    ->postJson('/api/v1/mobile/login', ['phone' => $phone, 'password' => self::PASSWORD, 'device_name' => $device]);
    }

    private function bearer(string $token, string $method, string $url)
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($token)->json($method, $url);
    }

    private function refresh(string $refreshToken)
    {
        $this->app['auth']->forgetGuards();
        return $this->withHeaders(['Authorization' => ''])
                    ->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $refreshToken]);
    }

    // ── Login ─────────────────────────────────────────────────────

    public function test_ota_ona_tokenlarni_javob_tanasida_oladi_cookie_siz(): void
    {
        $res = $this->login()->assertOk()
                    ->assertJsonPath('token_type', 'Bearer')
                    ->assertJsonPath('user.role', User::ROLE_PARENT)
                    ->assertCookieMissing('kiddo_token');

        $this->assertNotEmpty($res->json('access_token'));
        $this->assertNotEmpty($res->json('refresh_token'));
        $this->assertNotSame($res->json('access_token'), $res->json('refresh_token'));
        $this->assertSame(now()->addMinutes(15)->toIso8601String(), $res->json('access_token_expires_at'));
        $this->assertSame(now()->addDays(30)->toIso8601String(), $res->json('refresh_token_expires_at'));
        $this->assertArrayNotHasKey('password', $res->json('user'));
    }

    public function test_boshqa_rollar_va_notogri_malumot_bir_xil_xato_oladi(): void
    {
        $wrong = $this->postJson('/api/v1/mobile/login', ['phone' => self::PHONE, 'password' => 'notogri'])->assertStatus(422)->json();

        $i = 0;
        foreach ([
            User::factory()->admin()->create(['organization_id' => $this->org->id, 'phone' => '+998907770010']),
            User::factory()->teacher()->create(['organization_id' => $this->org->id, 'phone' => '+998907770011']),
            User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'phone' => '+998907770012']),
            User::factory()->parent()->inactive()->create(['organization_id' => $this->org->id, 'phone' => '+998907770013']),
        ] as $user) {
            $this->assertSame($wrong, $this->login('X', $user->phone, '10.1.1.' . $i++)->assertStatus(422)->json());
            $this->assertSame(0, $user->tokens()->count());
        }

        $this->org->update(['is_active' => false]);
        $this->assertSame($wrong, $this->login('X', self::PHONE, '10.1.2.1')->assertStatus(422)->json());
    }

    public function test_login_web_bilan_umumiy_rate_limitga_ega(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.1.3.1'])
                 ->postJson('/api/v1/login', ['phone' => self::PHONE, 'password' => 'notogri'])->assertStatus(422);
        }
        $this->login('X', self::PHONE, '10.1.3.1')->assertStatus(429);
    }

    // ── Access va refresh token ───────────────────────────────────

    public function test_access_token_ota_ona_api_siga_kiradi_refresh_token_kira_olmaydi(): void
    {
        $t = $this->login()->json();

        $this->bearer($t['access_token'], 'GET', '/api/v1/me')->assertOk();
        $this->bearer($t['access_token'], 'GET', '/api/v1/parent/children')->assertOk()->assertJsonPath('data.0.id', $this->own->id);

        foreach (['/api/v1/me', '/api/v1/parent/children', '/api/v1/mobile/sessions'] as $url) {
            $this->bearer($t['refresh_token'], 'GET', $url)->assertUnauthorized();
        }
    }

    public function test_refresh_rotatsiya_eski_tokenlar_bekor_boladi(): void
    {
        $old = $this->login()->json();
        $this->travel(10)->minutes();

        $new = $this->refresh($old['refresh_token'])->assertOk()->json();

        $this->assertNotSame($old['refresh_token'], $new['refresh_token']);
        $this->assertSame($old['refresh_token_expires_at'], $new['refresh_token_expires_at']); // mutlaq 30 kun uzaymaydi
        $this->bearer($new['access_token'], 'GET', '/api/v1/parent/children')->assertOk();
        $this->bearer($old['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();

        // Eski refresh tokenni qayta ishlatish
        $this->refresh($old['refresh_token'])->assertUnauthorized()
             ->assertExactJson(['message' => 'Sessiya muddati tugagan. Qaytadan kiring.']);
        $this->bearer($new['access_token'], 'GET', '/api/v1/me')->assertOk();
    }

    public function test_access_token_15_daqiqadan_keyin_tugaydi_refresh_ishlaydi(): void
    {
        $t = $this->login()->json();
        $this->travel(16)->minutes();

        $this->bearer($t['access_token'], 'GET', '/api/v1/me')->assertUnauthorized();
        $this->refresh($t['refresh_token'])->assertOk();
    }

    public function test_sessiya_30_kundan_oshmaydi(): void
    {
        $t = $this->login()->json();

        // Faol foydalanish: har 6 kunda refresh — baribir 30 kundan keyin tugaydi
        for ($day = 6; $day < 30; $day += 6) {
            $this->travel(6)->days();
            $t = $this->refresh($t['refresh_token'])->assertOk()->json();
        }
        $this->travel(7)->days();

        $this->refresh($t['refresh_token'])->assertUnauthorized();
        $this->assertSame(0, $this->parent->tokens()->count());
    }

    public function test_notogri_refresh_so_rovlari(): void
    {
        $this->postJson('/api/v1/mobile/token/refresh', [])->assertStatus(422);
        $this->refresh('notogri|token')->assertUnauthorized();

        // Access token refresh token o'rnida ishlatilmaydi
        $t = $this->login()->json();
        $this->refresh($t['access_token'])->assertUnauthorized();

        // Web tokeni ham refresh token emas
        $web = $this->parent->createToken('kiddo-app', [User::ROLE_PARENT])->plainTextToken;
        $this->refresh($web)->assertUnauthorized();
    }

    // ── Bekor qilish ──────────────────────────────────────────────

    public function test_faolsizlantirilgan_akkaunt_yoki_bogcha_sessiyasi_bekor(): void
    {
        $t = $this->login()->json();

        // Faqat bazada o'zgartirilgan holat ham (tokenlar o'chirilmagan bo'lsa) bloklanadi
        $this->parent->update(['is_active' => false]);
        $this->bearer($t['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();
        $this->refresh($t['refresh_token'])->assertUnauthorized();
        $this->assertSame(0, $this->parent->tokens()->count());

        $this->parent->update(['is_active' => true]);
        $t = $this->login('X', self::PHONE, '10.1.4.1')->json();
        $this->org->update(['is_active' => false]);
        $this->bearer($t['access_token'], 'GET', '/api/v1/me')->assertUnauthorized();
        $this->refresh($t['refresh_token'])->assertUnauthorized();
    }

    public function test_super_admin_faolsizlantirsa_mobil_sessiyalar_bekor(): void
    {
        $t  = $this->login()->json();
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/users/{$this->parent->id}/deactivate")->assertOk();

        $this->refresh($t['refresh_token'])->assertUnauthorized();
        $this->bearer($t['access_token'], 'GET', '/api/v1/me')->assertUnauthorized();
    }

    public function test_logout_faqat_joriy_qurilmani_bekor_qiladi(): void
    {
        $a = $this->login('iPhone')->json();
        $b = $this->login('Android')->json();

        $this->bearer($a['access_token'], 'POST', '/api/v1/mobile/logout')->assertOk();

        $this->bearer($a['access_token'], 'GET', '/api/v1/me')->assertUnauthorized();
        $this->refresh($a['refresh_token'])->assertUnauthorized();
        $this->bearer($b['access_token'], 'GET', '/api/v1/me')->assertOk();
        $this->assertDatabaseHas('activity_logs', ['action' => 'user.mobile_logout', 'user_id' => $this->parent->id]);
    }

    public function test_umumiy_logout_mobil_token_bilan_butun_sessiyani_bekor_qiladi(): void
    {
        $t = $this->login()->json();

        $this->bearer($t['access_token'], 'POST', '/api/v1/logout')->assertOk();

        $this->refresh($t['refresh_token'])->assertUnauthorized();
        $this->assertSame(0, $this->parent->tokens()->count());
    }

    // ── Web va mobil mustaqilligi ─────────────────────────────────

    public function test_ota_ona_web_login_rad_etiladi_mobil_sessiya_buzilmaydi(): void
    {
        $mobile = $this->login()->json();

        // Ota-onalar uchun web panel yo'q: to'g'ri parol bilan ham web sessiya yaratilmaydi
        $this->postJson('/api/v1/login', ['phone' => self::PHONE, 'password' => self::PASSWORD])
             ->assertForbidden()
             ->assertJsonPath('code', 'parent_mobile_only')
             ->assertCookieMissing('kiddo_token');
        $this->assertSame(0, $this->parent->tokens()->where('name', 'kiddo-app')->count());

        $this->bearer($mobile['access_token'], 'GET', '/api/v1/me')->assertOk();
        $this->refresh($mobile['refresh_token'])->assertOk();
    }

    public function test_web_tokeni_mobil_sessiya_endpointlariga_kira_olmaydi(): void
    {
        $web = $this->parent->createToken('kiddo-app', [User::ROLE_PARENT])->plainTextToken;

        $this->bearer($web, 'GET', '/api/v1/parent/children')->assertOk(); // eski web tokeni parent API'ga kiradi, mobil sessiyalarga emas
        $this->bearer($web, 'GET', '/api/v1/mobile/sessions')
             ->assertForbidden()
             ->assertExactJson(['message' => "Bu amalni bajarishga ruxsatingiz yo'q."]);
    }

    public function test_ability_siz_ota_ona_tokeni_parent_api_ga_kira_olmaydi(): void
    {
        $token = $this->parent->createToken('boshqa', ['mobile'])->plainTextToken;

        $this->bearer($token, 'GET', '/api/v1/parent/children')->assertForbidden();
    }

    // ── Qurilmalar ────────────────────────────────────────────────

    public function test_oltinchi_qurilma_eng_eski_sessiyani_bekor_qiladi(): void
    {
        $sessions = [];
        for ($i = 1; $i <= 6; $i++) {
            $sessions[$i] = $this->login("Qurilma {$i}", self::PHONE, "10.2.0.{$i}")->assertOk()->json();
            $this->travel(1)->minutes();
        }

        $this->refresh($sessions[1]['refresh_token'])->assertUnauthorized();
        foreach (range(2, 6) as $i) {
            $this->bearer($sessions[$i]['access_token'], 'GET', '/api/v1/me')->assertOk();
        }
        $this->assertCount(5, $this->bearer($sessions[6]['access_token'], 'GET', '/api/v1/mobile/sessions')->json('data'));
    }

    public function test_rotatsiya_qurilma_tartibini_ozgartirmaydi(): void
    {
        // Eng eski qurilma refresh qilgani uchun "yangi" bo'lib qolmaydi — sessiya boshlanishi bo'yicha
        $first = $this->login('Birinchi', self::PHONE, '10.3.0.1')->json();
        $this->travel(1)->minutes();
        for ($i = 2; $i <= 5; $i++) {
            $this->login("Q{$i}", self::PHONE, "10.3.0.{$i}");
        }
        $this->travel(1)->minutes();
        $first = $this->refresh($first['refresh_token'])->assertOk()->json();

        $this->login('Oltinchi', self::PHONE, '10.3.0.6')->assertOk();
        $this->refresh($first['refresh_token'])->assertUnauthorized();
    }

    public function test_sessiyalar_royxati_va_boshqa_qurilmani_bekor_qilish(): void
    {
        $a = $this->login('iPhone | 15')->json();
        $b = $this->login('Android')->json();

        $list = $this->bearer($a['access_token'], 'GET', '/api/v1/mobile/sessions')->assertOk()->json('data');
        $this->assertCount(2, $list);
        $this->assertStringNotContainsString($a['refresh_token'], json_encode($list));
        $this->assertStringNotContainsString(explode('|', $a['access_token'])[1], json_encode($list));
        $current = collect($list)->firstWhere('current', true);
        $this->assertSame('iPhone 15', preg_replace('/\s+/', ' ', $current['device_name']));
        $other = collect($list)->firstWhere('current', false);

        $this->bearer($a['access_token'], 'DELETE', "/api/v1/mobile/sessions/{$other['id']}")->assertOk();
        $this->bearer($b['access_token'], 'GET', '/api/v1/me')->assertUnauthorized();
        $this->refresh($b['refresh_token'])->assertUnauthorized();
        $this->bearer($a['access_token'], 'GET', '/api/v1/me')->assertOk();
    }

    public function test_boshqa_foydalanuvchi_sessiyasini_bekor_qilib_bolmaydi(): void
    {
        $other = User::factory()->parent()->create(['organization_id' => $this->org->id, 'phone' => '+998907770099']);
        $theirs = $this->login('X', $other->phone, '10.4.0.1')->json();
        $sid = MobileSessionService::sessionId(PersonalAccessToken::findToken($theirs['access_token']));

        $mine = $this->login()->json();
        $this->bearer($mine['access_token'], 'DELETE', "/api/v1/mobile/sessions/{$sid}")->assertNotFound();
        $this->bearer($mine['access_token'], 'DELETE', '/api/v1/mobile/sessions/notogri%25')->assertNotFound();
        $this->bearer($theirs['access_token'], 'GET', '/api/v1/me')->assertOk();
    }

    // ── Izolyatsiya ───────────────────────────────────────────────

    public function test_mobil_token_bilan_faqat_oz_farzandi(): void
    {
        $sameOrgOther = Child::factory()->create(['organization_id' => $this->org->id]);
        $foreign      = Child::factory()->create();
        Attendance::factory()->create(['child_id' => $foreign->id]);
        $t = $this->login()->json()['access_token'];

        $this->bearer($t, 'GET', "/api/v1/parent/children/{$this->own->id}/attendance")->assertOk();
        foreach ([$sameOrgOther, $foreign] as $child) {
            $this->bearer($t, 'GET', "/api/v1/parent/children/{$child->id}/attendance")->assertNotFound();
        }
        foreach (['/api/v1/admin/children', '/api/v1/admin/attendance', '/api/v1/teacher/dashboard', '/api/v1/super-admin/organizations'] as $url) {
            $this->bearer($t, 'GET', $url)->assertForbidden();
        }

        // Bog'lanish uzilsa bola darhol ko'rinmaydi
        $this->parent->parentProfile->children()->detach($this->own->id);
        $this->bearer($t, 'GET', "/api/v1/parent/children/{$this->own->id}/attendance")->assertNotFound();
    }

    // ── Maxfiylik va tozalash ─────────────────────────────────────

    public function test_activity_log_da_token_va_parol_yoq(): void
    {
        $t = $this->login()->json();

        $log = ActivityLog::where('action', 'user.mobile_login')->firstOrFail();
        $raw = json_encode($log->toArray());
        $this->assertStringNotContainsString(explode('|', $t['access_token'])[1], $raw);
        $this->assertStringNotContainsString(explode('|', $t['refresh_token'])[1], $raw);
        $this->assertStringNotContainsString(self::PASSWORD, $raw);
    }

    public function test_tozalash_buyrugi_faol_refresh_tokenni_saqlaydi(): void
    {
        $t = $this->login()->json();
        $this->parent->createToken('kiddo-app', [User::ROLE_PARENT]); // web, expires_at yo'q

        $this->travel(10)->days(); // global 7 kun + 24 soatdan o'tdi, refresh esa hali amalda
        $this->artisan('tokens:prune-expired', ['--hours' => 24])->assertExitCode(0);

        $this->assertSame(0, $this->parent->tokens()->where('name', 'kiddo-app')->count());
        $this->assertSame(0, $this->parent->tokens()->where('name', 'like', 'mobile-access|%')->count());
        $this->refresh($t['refresh_token'])->assertOk();
    }
}
