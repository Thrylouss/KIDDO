<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Login cheklovi: telefon+IP, telefon (barcha IP'lar) va IP (barcha telefonlar) bo'yicha.
 */
class LoginRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private function attempt(string $phone, string $ip = '10.0.0.1', array $headers = [])
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
                    ->withHeaders($headers)
                    ->postJson('/api/v1/login', ['phone' => $phone, 'password' => 'notogri-parol']);
    }

    public function test_bitta_telefon_va_ip_dan_cheklovdan_keyin_429(): void
    {
        for ($i = 0; $i < AppServiceProvider::LOGIN_PER_PHONE_IP; $i++) {
            $this->attempt('+998901110001')->assertStatus(422);
        }
        $this->attempt('+998901110001')->assertStatus(429);
    }

    public function test_bloklangan_telefon_boshqa_telefonni_bloklamaydi(): void
    {
        for ($i = 0; $i <= AppServiceProvider::LOGIN_PER_PHONE_IP; $i++) {
            $this->attempt('+998901110002');
        }
        $this->attempt('+998901110003')->assertStatus(422);
    }

    public function test_ip_almashtirish_bilan_bitta_telefonga_cheklovni_aylanib_otib_bolmaydi(): void
    {
        for ($i = 0; $i < AppServiceProvider::LOGIN_PER_PHONE; $i++) {
            $this->attempt('+998901110004', "10.0.1.{$i}")->assertStatus(422);
        }
        $this->attempt('+998901110004', '10.0.2.1')->assertStatus(429);
    }

    public function test_bitta_ip_dan_kop_telefonga_urinish_cheklanadi(): void
    {
        for ($i = 0; $i < AppServiceProvider::LOGIN_PER_IP; $i++) {
            $this->attempt(sprintf('+9989020%05d', $i), '10.0.3.1')->assertStatus(422);
        }
        $this->attempt('+998903333333', '10.0.3.1')->assertStatus(429);
    }

    public function test_bosh_joy_qoshish_telefon_kalitini_ozgartirmaydi(): void
    {
        for ($i = 0; $i < AppServiceProvider::LOGIN_PER_PHONE_IP; $i++) {
            $this->attempt($i % 2 ? '+998 90 111 00 05' : '+998901110005');
        }
        $this->attempt('+998901110005')->assertStatus(429);
    }

    public function test_x_forwarded_for_sarlavhasi_cheklovni_aylanib_otmaydi(): void
    {
        // TrustProxies sozlanmagan — soxta sarlavha IP sifatida qabul qilinmaydi
        for ($i = 0; $i < AppServiceProvider::LOGIN_PER_PHONE_IP; $i++) {
            $this->attempt('+998901110006', '10.0.4.1', ['X-Forwarded-For' => "203.0.113.{$i}"]);
        }
        $this->attempt('+998901110006', '10.0.4.1', ['X-Forwarded-For' => '203.0.113.99'])->assertStatus(429);
    }

    public function test_javob_telefon_mavjudligini_oshkor_qilmaydi(): void
    {
        $org = Organization::factory()->create();
        User::factory()->admin()->create(['organization_id' => $org->id, 'phone' => '+998901110007']);
        User::factory()->admin()->inactive()->create(['organization_id' => $org->id, 'phone' => '+998901110008']);

        $known    = $this->attempt('+998901110007', '10.0.5.1');
        $inactive = $this->attempt('+998901110008', '10.0.5.2');
        $unknown  = $this->attempt('+998901119999', '10.0.5.3');

        foreach ([$known, $inactive, $unknown] as $response) {
            $response->assertStatus(422);
        }
        $this->assertSame($unknown->json(), $known->json());
        $this->assertSame($unknown->json(), $inactive->json());
    }

    public function test_muvaffaqiyatli_login_cookie_beradi_tokenni_tanada_qaytarmaydi(): void
    {
        $org  = Organization::factory()->create();
        $user = User::factory()->teacher()->create(['organization_id' => $org->id, 'phone' => '+998901110009']);

        $login = $this->postJson('/api/v1/login', ['phone' => '+998901110009', 'password' => 'password'])
                      ->assertOk()
                      ->assertJsonPath('user.role', User::ROLE_TEACHER)
                      ->assertCookie('kiddo_token');
        $this->assertArrayNotHasKey('token', $login->json());
        $this->assertSame(1, $user->tokens()->count());
    }
}
