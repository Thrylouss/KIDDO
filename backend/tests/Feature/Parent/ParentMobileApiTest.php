<?php

namespace Tests\Feature\Parent;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mobil ilova sharoiti: cookie yo'q, faqat Authorization: Bearer <token>.
 * actingAs() ishlatilmaydi — haqiqiy Sanctum token bilan so'rov yuboriladi.
 */
class ParentMobileApiTest extends TestCase
{
    use RefreshDatabase;

    private User $parent;
    private string $token;
    private Child $own;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));

        $org          = Organization::factory()->create();
        $this->parent = User::factory()->parent()->create(['organization_id' => $org->id]);
        $profile      = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $org->id]);
        $this->own    = Child::factory()->create(['organization_id' => $org->id]);
        $profile->children()->attach($this->own->id, ['relation_type' => 'ota']);
        Attendance::factory()->create(['child_id' => $this->own->id, 'date' => '2026-10-28', 'status' => 'present']);

        $this->token = $this->parent->createToken('kiddo-mobile', [User::ROLE_PARENT])->plainTextToken;
    }

    private function bearer(string $method, string $url)
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($this->token)->json($method, $url);
    }

    public function test_bearer_token_bilan_profil_farzandlar_va_davomat(): void
    {
        $this->bearer('GET', '/api/v1/me')->assertOk()->assertJsonPath('user.role', 'parent');

        $this->bearer('GET', '/api/v1/parent/children')
             ->assertOk()
             ->assertJsonPath('data.0.id', $this->own->id)
             ->assertJsonCount(1, 'data');

        $this->bearer('GET', "/api/v1/parent/children/{$this->own->id}/attendance")
             ->assertOk()
             ->assertJsonPath('records.0.status', 'present');
    }

    public function test_boshqa_oila_va_boshqa_bogcha_bolalari_rad_etiladi(): void
    {
        $sameOrgOther = Child::factory()->create(['organization_id' => $this->parent->organization_id]);
        $foreign      = Child::factory()->create();
        Attendance::factory()->create(['child_id' => $sameOrgOther->id]);
        Attendance::factory()->create(['child_id' => $foreign->id]);

        foreach ([$sameOrgOther, $foreign] as $child) {
            $this->bearer('GET', "/api/v1/parent/children/{$child->id}/attendance")->assertNotFound();
        }
        $ids = collect($this->bearer('GET', '/api/v1/parent/children')->json('data'))->pluck('id')->all();
        $this->assertSame([$this->own->id], $ids);
    }

    public function test_boshqa_rollar_endpointlari_yopiq(): void
    {
        foreach ([
            '/api/v1/admin/children',
            '/api/v1/admin/attendance',
            '/api/v1/teacher/dashboard',
            '/api/v1/super-admin/organizations',
        ] as $url) {
            $this->bearer('GET', $url)->assertForbidden();
        }
        $this->bearer('PUT', '/api/v1/teacher/attendance')->assertForbidden();
    }

    public function test_bekor_qilingan_yoki_notogri_token_401(): void
    {
        $this->parent->tokens()->delete();
        $this->bearer('GET', '/api/v1/parent/children')->assertUnauthorized();

        $this->token = 'notogri|token';
        $this->bearer('GET', '/api/v1/me')->assertUnauthorized();
    }

    public function test_faol_bolmagan_ota_ona_tokeni_bekor_qilinadi(): void
    {
        // Super-admin foydalanuvchini o'chirganda tokenlar bekor qilinadi (mobil sessiya ham)
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->actingAs($sa, 'sanctum')->patchJson("/api/v1/super-admin/users/{$this->parent->id}/deactivate")->assertOk();

        $this->bearer('GET', '/api/v1/parent/children')->assertUnauthorized();
    }
}
