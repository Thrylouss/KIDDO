<?php

namespace Tests\Feature\Daily;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\SleepRecord;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ota-ona: GET /v1/parent/children/{id}/daily — faqat o'qish, haqiqiy mobil token bilan
 * (POST /v1/mobile/login orqali olinadi, actingAs ishlatilmaydi).
 */
class ParentDailyTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private User $parent;
    private Group $group;
    private Child $own;
    private string $access;
    private string $refresh;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));

        $this->org    = Organization::factory()->create();
        $this->group  = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->parent = User::factory()->parent()->create(['organization_id' => $this->org->id, 'phone' => '+998907770101']);
        $profile      = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $this->org->id]);
        $this->own    = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        $profile->children()->attach($this->own->id, ['relation_type' => 'ona']);

        $tokens = $this->postJson('/api/v1/mobile/login', ['phone' => '+998907770101', 'password' => 'password'])->assertOk()->json();
        $this->access  = $tokens['access_token'];
        $this->refresh = $tokens['refresh_token'];
    }

    private function fetch(string $url, ?string $token = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($token ?? $this->access)->getJson($url);
    }

    private function url(Child $child, string $date = self::TODAY): string
    {
        return "/api/v1/parent/children/{$child->id}/daily?date={$date}";
    }

    public function test_ota_ona_farzandining_kunini_koradi(): void
    {
        Attendance::factory()->create(['child_id' => $this->own->id, 'date' => self::TODAY, 'status' => 'present']);
        MealRecord::factory()->create(['child_id' => $this->own->id, 'date' => self::TODAY, 'meal_type' => 'nonushta', 'served_at' => '08:30', 'note' => 'Bo\'tqa', 'recorded_by' => $this->parent->id]);
        MealRecord::factory()->create(['child_id' => $this->own->id, 'date' => self::TODAY, 'meal_type' => 'tushlik', 'served_at' => '12:30']);
        SleepRecord::factory()->create(['child_id' => $this->own->id, 'date' => self::TODAY, 'started_at' => '13:00', 'ended_at' => null]);
        GroupActivity::factory()->create(['group_id' => $this->group->id, 'date' => self::TODAY, 'title' => 'Rasm', 'starts_at' => '10:00']);

        $res = $this->fetch($this->url($this->own))->assertOk()
            ->assertJsonPath('child.id', $this->own->id)
            ->assertJsonPath('attendance', 'present')
            ->assertJsonPath('meals.0.meal_type', 'nonushta')
            ->assertJsonPath('meals.0.served_at', '08:30')
            ->assertJsonPath('meals.1.meal_type', 'tushlik')
            ->assertJsonPath('sleep.is_sleeping', true)
            ->assertJsonPath('sleep.status_text', 'Hali uxlayapti')
            ->assertJsonPath('sleep.ended_at', null)
            ->assertJsonPath('activities.0.title', 'Rasm');

        // Ichki ID va kim yozgani oshkor qilinmaydi
        $this->assertArrayNotHasKey('id', $res->json('meals.0'));
        $this->assertArrayNotHasKey('recorded_by', $res->json('meals.0'));
        $this->assertArrayNotHasKey('id', $res->json('sleep'));
        $this->assertArrayNotHasKey('id', $res->json('activities.0'));
    }

    public function test_tugagan_uyqu_va_bosh_kun(): void
    {
        SleepRecord::factory()->create(['child_id' => $this->own->id, 'date' => '2026-10-27', 'started_at' => '13:00', 'ended_at' => '15:00']);

        $this->fetch($this->url($this->own, '2026-10-27'))->assertOk()
             ->assertJsonPath('sleep.is_sleeping', false)->assertJsonPath('sleep.status_text', null)->assertJsonPath('sleep.ended_at', '15:00');
        $this->fetch($this->url($this->own, '2026-10-26'))->assertOk()
             ->assertJsonPath('meals', [])->assertJsonPath('sleep', null)->assertJsonPath('activities', []);
    }

    public function test_begona_va_boshqa_bogcha_bolasi_404(): void
    {
        $sameOrgOther = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        $foreign      = Child::factory()->create();
        MealRecord::factory()->create(['child_id' => $sameOrgOther->id, 'date' => self::TODAY]);
        MealRecord::factory()->create(['child_id' => $foreign->id, 'date' => self::TODAY]);

        foreach ([$sameOrgOther, $foreign] as $child) {
            $this->fetch($this->url($child))->assertNotFound();
        }
    }

    public function test_boshqa_bola_yozuvlari_javobga_tushmaydi(): void
    {
        $sibling = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        MealRecord::factory()->create(['child_id' => $sibling->id, 'date' => self::TODAY, 'note' => 'Begona']);
        SleepRecord::factory()->create(['child_id' => $sibling->id, 'date' => self::TODAY]);

        $res = $this->fetch($this->url($this->own))->assertOk()->assertJsonPath('meals', [])->assertJsonPath('sleep', null);
        $this->assertStringNotContainsString('Begona', $res->getContent());
    }

    public function test_mashgulotlar_bolaning_osha_kundagi_guruhidan(): void
    {
        $other = Group::factory()->create(['organization_id' => $this->org->id]);
        GroupActivity::factory()->create(['group_id' => $this->group->id, 'date' => '2026-10-27', 'title' => 'Eski guruh mashg\'uloti']);
        GroupActivity::factory()->create(['group_id' => $other->id, 'date' => '2026-10-27', 'title' => 'Yangi guruh mashg\'uloti']);
        GroupActivity::factory()->create(['group_id' => $other->id, 'date' => self::TODAY, 'title' => 'Bugungi']);

        // 27-oktabrda bola eski guruhda bo'lgan (davomat), keyin guruhi almashgan
        Attendance::factory()->create(['child_id' => $this->own->id, 'group_id' => $this->group->id, 'date' => '2026-10-27', 'status' => 'present']);
        $this->own->update(['group_id' => $other->id]);

        $this->fetch($this->url($this->own, '2026-10-27'))->assertOk()
             ->assertJsonCount(1, 'activities')->assertJsonPath('activities.0.title', 'Eski guruh mashg\'uloti');
        $this->fetch($this->url($this->own))->assertOk()
             ->assertJsonCount(1, 'activities')->assertJsonPath('activities.0.title', 'Bugungi');
    }

    public function test_boglanish_uzilsa_darhol_yopiladi(): void
    {
        $this->fetch($this->url($this->own))->assertOk();
        $this->parent->parentProfile->children()->detach($this->own->id);

        $this->fetch($this->url($this->own))->assertNotFound();
    }

    public function test_tokenlar_va_rollar(): void
    {
        $this->fetch($this->url($this->own), $this->refresh)->assertUnauthorized();
        $this->fetch($this->url($this->own), 'notogri|token')->assertUnauthorized();

        $noAbility = $this->parent->createToken('boshqa', ['mobile'])->plainTextToken;
        $this->fetch($this->url($this->own), $noAbility)->assertForbidden();

        $web = $this->parent->createToken('kiddo-app', [User::ROLE_PARENT])->plainTextToken;
        $this->fetch($this->url($this->own), $web)->assertOk();

        foreach ([
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
            User::factory()->admin()->create(['organization_id' => $this->org->id]),
        ] as $user) {
            $this->fetch($this->url($this->own), $user->createToken('kiddo-app', [$user->role])->plainTextToken)->assertForbidden();
        }

        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => ''])->getJson($this->url($this->own))->assertUnauthorized();
    }

    public function test_ota_ona_yoza_olmaydi(): void
    {
        $this->app['auth']->forgetGuards();
        $this->withToken($this->access)->putJson('/api/v1/teacher/daily/meals', [])->assertForbidden();
        $this->withToken($this->access)->putJson('/api/v1/admin/daily/meals', [])->assertForbidden();
        $this->withToken($this->access)->postJson("/api/v1/parent/children/{$this->own->id}/daily")->assertStatus(405);
    }

    public function test_sana_validatsiyasi(): void
    {
        $this->fetch($this->url($this->own, '2026-10-29'))->assertUnprocessable();
        $this->fetch($this->url($this->own, '28-10-2026'))->assertUnprocessable();
        $this->fetch("/api/v1/parent/children/{$this->own->id}/daily")->assertOk()->assertJsonPath('date', self::TODAY);
    }
}
