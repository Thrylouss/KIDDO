<?php

namespace Tests\Feature;

use App\Models\DemoRequest;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/** Landing «14 kunlik bepul DEMO» arizasi: saqlash, Telegram, spam himoyasi va Super Admin bo'limi. */
class DemoRequestTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = '123456789:TEST-fake-token_abcdefghijklmnop';

    protected function setUp(): void
    {
        parent::setUp();
        config(['kiddo.telegram.bot_token' => null, 'kiddo.telegram.chat_id' => null]);
        RateLimiter::clear('demo-requests');
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'kindergarten_name' => 'Quyoshcha',
            'kindergarten_type' => 'xususiy',
            'region'            => 'Toshkent shahri',
            'district'          => 'Chilonzor tumani',
            'address'           => '7-mavze, 12-uy',
            'director_name'     => 'Karimova Dilnoza Azizovna',
            'phone'             => '+998 (90) 123-45-67',
            'children_count'    => '120',
            'groups_count'      => '6',
            'comment'           => 'Davomat moduli qiziq',
            'consent'           => true,
        ], $over);
    }

    private function configureTelegram(): void
    {
        config(['kiddo.telegram.bot_token' => self::TOKEN, 'kiddo.telegram.chat_id' => '-1001234567890']);
    }

    public function test_ariza_saqlanadi_telegram_sozlanmagan_bolsa_ham(): void
    {
        Http::fake();
        $this->postJson('/api/v1/demo-requests', $this->payload())
            ->assertCreated()
            ->assertJsonPath('message', "Arizangiz muvaffaqiyatli yuborildi! KIDDO jamoasi tez orada siz bilan bog'lanadi.")
            ->assertJsonMissingPath('data');

        $r = DemoRequest::sole();
        $this->assertSame('+998901234567', $r->phone);
        $this->assertSame(DemoRequest::STATUS_NEW, $r->status);
        $this->assertSame(DemoRequest::TELEGRAM_NOT_CONFIGURED, $r->telegram_status);
        $this->assertSame(120, $r->children_count);
        $this->assertNotNull($r->consent_at);
        $this->assertNotNull($r->ip_hash);
        $this->assertNull($r->organization_id);
        Http::assertNothingSent();
    }

    public function test_telegramga_toliq_formatdagi_xabar_yuboriladi(): void
    {
        $this->configureTelegram();
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => []])]);

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();

        Http::assertSent(function (HttpRequest $req) {
            $text = $req['text'];

            return str_ends_with($req->url(), '/sendMessage')
                && $req['chat_id'] === '-1001234567890'
                && str_starts_with($text, "🆕 YANGI KIDDO DEMO ARIZASI\n\n🏫 Bog'cha: Quyoshcha\n🏢 Turi: Xususiy\n📍 Hudud: Toshkent shahri, Chilonzor tumani")
                && str_contains($text, "👤 Rahbar: Karimova Dilnoza Azizovna\n📞 Telefon: +998901234567")
                && str_contains($text, "👶 Bolalar soni: 120\n👥 Guruhlar soni: 6\n💬 Izoh: Davomat moduli qiziq")
                && str_contains($text, '📅 Ariza vaqti: ')
                && str_ends_with($text, '🟡 Holat: Yangi ariza');
        });
        $r = DemoRequest::sole();
        $this->assertSame(DemoRequest::TELEGRAM_SENT, $r->telegram_status);
        $this->assertSame(1, $r->telegram_attempts);
        $this->assertNotNull($r->telegram_sent_at);
        $this->assertNull($r->telegram_error);
    }

    public function test_telegram_xatosi_arizani_yoqotmaydi_va_token_hech_qayerga_yozilmaydi(): void
    {
        $this->configureTelegram();
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'description' => 'Unauthorized bot' . self::TOKEN], 401)]);
        Log::spy();

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();

        $r = DemoRequest::sole();
        $this->assertSame(DemoRequest::TELEGRAM_FAILED, $r->telegram_status);
        $this->assertStringContainsString('HTTP 401', $r->telegram_error);
        $this->assertStringNotContainsString(self::TOKEN, $r->telegram_error);
        Log::shouldHaveReceived('log')->withArgs(fn ($level, $msg, $ctx) => $level === 'error' && $ctx['demo_request_id'] === $r->id
            && ! str_contains(json_encode($ctx), self::TOKEN))->once();
    }

    public function test_telegram_sozlanmagan_bolsa_ogohlantirish_logi_va_log_xatosi_arizani_buzmaydi(): void
    {
        Log::shouldReceive('log')->once()->withArgs(fn ($level, $msg, $ctx) => $level === 'warning' && str_contains($msg, 'Telegram sozlanmagan'))
            ->andThrow(new \UnexpectedValueException('storage/logs yozib bo\'lmadi'));

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $this->assertSame(DemoRequest::TELEGRAM_NOT_CONFIGURED, DemoRequest::sole()->telegram_status);
    }

    public function test_telegram_status_buyrugi_tokenni_chiqarmaydi(): void
    {
        $this->artisan('kiddo:telegram:status')->expectsOutputToContain("TELEGRAM_BOT_TOKEN: yo'q")->assertSuccessful();

        $this->configureTelegram();
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'description' => 'Not Found ' . self::TOKEN], 404)]);
        $this->artisan('kiddo:telegram:status')->expectsOutputToContain('TELEGRAM_BOT_TOKEN: berilgan')
            ->doesntExpectOutputToContain(self::TOKEN)->assertSuccessful();
        $this->artisan('kiddo:telegram:status --send-test')->doesntExpectOutputToContain(self::TOKEN)
            ->expectsOutputToContain('HTTP 404')->assertFailed();
    }

    public function test_dns_enotfound_xatosi_tushunarli_qayd_etiladi(): void
    {
        $this->configureTelegram();
        Http::fake(fn () => throw new ConnectionException('cURL error 6: Could not resolve host: api.telegram.org (see https://api.telegram.org/bot' . self::TOKEN . '/sendMessage)'));

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();

        $r = DemoRequest::sole();
        $this->assertSame(DemoRequest::TELEGRAM_FAILED, $r->telegram_status);
        $this->assertStringContainsString('ENOTFOUND', $r->telegram_error);
        $this->assertStringNotContainsString(self::TOKEN, $r->telegram_error);
    }

    public function test_boshqa_ulanish_xatosida_ham_token_tozalanadi(): void
    {
        $this->configureTelegram();
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timeout for https://api.telegram.org/bot' . self::TOKEN . '/sendMessage'));

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();

        $error = DemoRequest::sole()->telegram_error;
        $this->assertStringContainsString('cURL error 28', $error);
        $this->assertStringNotContainsString(self::TOKEN, $error);
        $this->assertStringNotContainsString('TEST-fake-token', $error);
    }

    public function test_qayta_yuborish_buyrugi(): void
    {
        $this->configureTelegram();
        Http::fakeSequence('api.telegram.org/*')->push(['ok' => false, 'description' => 'Bad Gateway'], 502)->push(['ok' => true]);

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $this->assertSame(DemoRequest::TELEGRAM_FAILED, DemoRequest::sole()->telegram_status);

        $this->artisan('kiddo:demo-requests:retry-telegram')->assertSuccessful();
        $r = DemoRequest::sole();
        $this->assertSame(DemoRequest::TELEGRAM_SENT, $r->telegram_status);
        $this->assertSame(2, $r->telegram_attempts);
    }

    public function test_validatsiya_va_ozbekcha_xabarlar(): void
    {
        $this->postJson('/api/v1/demo-requests', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['kindergarten_name', 'kindergarten_type', 'region', 'district', 'director_name', 'phone', 'consent']);

        $this->postJson('/api/v1/demo-requests', $this->payload(['phone' => '12345', 'consent' => false, 'kindergarten_type' => 'boshqa', 'children_count' => '-3']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.phone.0', "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67")
            ->assertJsonPath('errors.consent.0', "Ma'lumotlarni qayta ishlashga rozilik bering.")
            ->assertJsonValidationErrors(['kindergarten_type', 'children_count']);

        $this->assertSame(0, DemoRequest::count());
    }

    public function test_honeypot_toldirilsa_rad_etiladi(): void
    {
        $this->postJson('/api/v1/demo-requests', $this->payload(['website' => 'http://spam.example']))->assertUnprocessable();
        $this->assertSame(0, DemoRequest::count());
    }

    public function test_takroriy_ariza_yangisini_yaratmaydi_va_qayta_yubormaydi(): void
    {
        $this->configureTelegram();
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);

        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $this->postJson('/api/v1/demo-requests', $this->payload(['phone' => '901234567', 'kindergarten_name' => 'QUYOSHCHA']))->assertCreated();

        $this->assertSame(1, DemoRequest::count());
        Http::assertSentCount(1);
    }

    public function test_ip_boyicha_cheklov(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/demo-requests', $this->payload(['phone' => '+99890000000' . $i]))->assertCreated();
        }
        $this->postJson('/api/v1/demo-requests', $this->payload(['phone' => '+998900000009']))->assertStatus(429);
    }

    public function test_faqat_super_admin_arizalarni_koradi(): void
    {
        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $id  = DemoRequest::sole()->id;
        $org = Organization::factory()->create();

        $this->getJson('/api/v1/super-admin/demo-requests')->assertUnauthorized();
        foreach ([User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]),
                  User::factory()->teacher()->create(['organization_id' => $org->id])] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson('/api/v1/super-admin/demo-requests')->assertForbidden();
            $this->actingAs($user, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'active'])->assertForbidden();
        }
        $this->actingAsParent(User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $org->id]))
            ->getJson('/api/v1/super-admin/demo-requests')->assertForbidden();
        $this->assertSame(DemoRequest::STATUS_NEW, DemoRequest::sole()->status);
        $this->app['auth']->forgetGuards();

        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->actingAs($sa, 'sanctum')->getJson('/api/v1/super-admin/demo-requests')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.telegram_configured', false)
            ->assertJsonPath('data.0.kindergarten_name', 'Quyoshcha')
            ->assertJsonPath('data.0.status_label', 'Yangi ariza')
            ->assertJsonPath('data.0.telegram.status', DemoRequest::TELEGRAM_NOT_CONFIGURED)
            ->assertJsonMissingPath('data.0.ip_hash');
        $this->actingAs($sa, 'sanctum')->getJson("/api/v1/super-admin/demo-requests/{$id}")->assertOk()->assertJsonPath('data.phone', '+998901234567');
    }

    public function test_holat_va_izoh_ozgaradi_demo_faol_14_kun(): void
    {
        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $id = DemoRequest::sole()->id;
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'contacted', 'internal_note' => "Qo'ng'iroq qilindi"])
            ->assertOk()->assertJsonPath('data.status_label', "Bog'lanildi")->assertJsonPath('data.demo_starts_at', null);

        $this->travelTo(now()->startOfMinute());
        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.demo_days_left', 14)->assertJsonPath('data.handled_by', $sa->name);
        $r = DemoRequest::sole();
        $this->assertTrue($r->demo_ends_at->equalTo($r->demo_starts_at->copy()->addDays(14)));
        $this->assertSame("Qo'ng'iroq qilindi", $r->internal_note);

        // Qayta faollashtirish muddatni qayta boshlamaydi
        $start = $r->demo_starts_at;
        $this->travel(3)->days();
        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'preparing'])->assertOk();
        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'active'])->assertOk()->assertJsonPath('data.demo_days_left', 11);
        $this->assertTrue(DemoRequest::sole()->demo_starts_at->equalTo($start));

        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/demo-requests/{$id}", ['status' => 'nomalum'])->assertUnprocessable();
        $this->assertDatabaseHas('activity_logs', ['action' => 'demo_request.updated', 'user_id' => $sa->id]);
    }

    public function test_super_admin_qayta_yuborish_tugmasi(): void
    {
        $this->postJson('/api/v1/demo-requests', $this->payload())->assertCreated();
        $id = DemoRequest::sole()->id;
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->actingAs($sa, 'sanctum')->postJson("/api/v1/super-admin/demo-requests/{$id}/retry-telegram")->assertStatus(422);

        $this->configureTelegram();
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
        $this->actingAs($sa, 'sanctum')->postJson("/api/v1/super-admin/demo-requests/{$id}/retry-telegram")
            ->assertOk()->assertJsonPath('data.telegram.status', DemoRequest::TELEGRAM_SENT);
    }
}
