<?php

namespace Tests\Feature\Daily;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\MealRecord;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\SleepRecord;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kengaytirilgan kundalik: ovqatlangan/ovqatlanmagan, ikkinchi nonushta, mashg'ulot ishtirokchilari,
 * yo'nalish/tugash vaqti/natija, ota-ona ko'rinishi va bola tarixi.
 */
class DailyExtendedTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private User $user;
    private Group $group;
    private Child $ali;
    private Child $vali;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));

        $this->org   = Organization::factory()->create();
        $this->user  = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $profile     = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->group = Group::factory()->create(['organization_id' => $this->org->id]);
        $profile->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);

        $this->ali  = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Ali', 'last_name' => 'Valiyev']);
        $this->vali = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Vali', 'last_name' => 'Aliyev']);
        Attendance::factory()->create(['child_id' => $this->ali->id, 'group_id' => $this->group->id, 'date' => self::TODAY, 'status' => 'present']);
        Attendance::factory()->create(['child_id' => $this->vali->id, 'group_id' => $this->group->id, 'date' => self::TODAY, 'status' => 'absent']);
    }

    private function as(?User $user = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user ?? $this->user, 'sanctum');
    }

    private function activity(array $body)
    {
        return $this->as()->postJson('/api/v1/teacher/daily/activities', $body + ['date' => self::TODAY, 'group_id' => $this->group->id]);
    }

    // ── Ovqatlanish ───────────────────────────────────────────────

    public function test_ikkinchi_nonushta_va_ovqatlanmagan_holati(): void
    {
        $this->as()->putJson('/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'ikkinchi_nonushta', 'served_at' => '10:00',
            'records' => [['child_id' => $this->ali->id, 'ate' => false, 'note' => 'Ishtahasi yo\'q']],
        ])->assertOk()
          ->assertJsonPath('children.1.meals.0.meal_type', 'ikkinchi_nonushta')
          ->assertJsonPath('children.1.meals.0.ate', false);

        $this->assertDatabaseHas('meal_records', ['child_id' => $this->ali->id, 'meal_type' => 'ikkinchi_nonushta', 'ate' => false]);

        $this->as()->putJson('/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'ikkinchi_nonushta', 'served_at' => '10:00',
            'records' => [['child_id' => $this->ali->id, 'ate' => true, 'note' => 'Ishtahasi yo\'q']],
        ])->assertOk();
        $log = ActivityLog::where('action', 'daily.meal.updated')->sole();
        $this->assertFalse($log->meta['old']['ate']);
        $this->assertTrue($log->meta['new']['ate']);
    }

    public function test_ovqat_holati_yuborilmasa_standart_ovqatlandi(): void
    {
        $this->as()->putJson('/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $this->ali->id]],
        ])->assertOk();
        $this->assertTrue(MealRecord::sole()->ate);

        $this->as()->putJson('/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->group->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $this->ali->id, 'ate' => 'ha']],
        ])->assertUnprocessable();
    }

    // ── Mashg'ulotlar ─────────────────────────────────────────────

    public function test_mashgulot_toliq_maydonlar_va_ishtirokchilar(): void
    {
        $this->activity([
            'title' => 'Ertak tinglash', 'direction' => 'nutq', 'starts_at' => '10:00', 'ends_at' => '10:30',
            'description' => 'Zumrad va Qimmat', 'result' => 'Bolalar savollarga javob berdi', 'child_ids' => [$this->ali->id],
        ])->assertCreated()
          ->assertJsonPath('activities.0.direction', 'nutq')
          ->assertJsonPath('activities.0.ends_at', '10:30')
          ->assertJsonPath('activities.0.duration_minutes', 30)
          ->assertJsonPath('activities.0.result', 'Bolalar savollarga javob berdi')
          ->assertJsonPath('activities.0.participants.0.id', $this->ali->id);

        $this->assertSame([$this->ali->id], GroupActivity::sole()->children()->pluck('children.id')->all());
    }

    public function test_kelmagan_bola_ishtirokchi_bolmaydi(): void
    {
        $this->activity(['title' => 'Rasm', 'child_ids' => [$this->ali->id, $this->vali->id]])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records.0', "Aliyev Vali bu kuni davomatda «Kelmadi» deb belgilangan — mashg'ulot ishtirokchisi sifatida yozib bo'lmaydi.");
        $this->assertSame(0, GroupActivity::count());

        $foreign = Child::factory()->create();
        $this->activity(['title' => 'Rasm', 'child_ids' => [$foreign->id]])->assertUnprocessable();
    }

    public function test_mashgulot_validatsiyasi(): void
    {
        $this->activity(['title' => 'X', 'starts_at' => '10:00', 'ends_at' => '09:30'])->assertUnprocessable()->assertJsonValidationErrors('ends_at');
        $this->activity(['title' => 'X', 'ends_at' => '10:00'])->assertUnprocessable()->assertJsonValidationErrors('ends_at');
        $this->activity(['title' => 'X', 'direction' => 'sehr'])->assertUnprocessable()->assertJsonValidationErrors('direction');
        $this->activity(['title' => 'X', 'result' => str_repeat('a', 1001)])->assertUnprocessable();
        $this->activity(['title' => 'X', 'child_ids' => 'hammasi'])->assertUnprocessable();
        $this->assertSame(0, GroupActivity::count());
    }

    public function test_tahrirlashda_ishtirokchilar_va_audit(): void
    {
        $id = $this->activity(['title' => 'Musiqa', 'starts_at' => '11:00', 'child_ids' => [$this->ali->id]])->json('activities.0.id');

        $this->as()->putJson("/api/v1/teacher/daily/activities/{$id}", ['child_ids' => [], 'ends_at' => '11:40', 'direction' => 'musiqa'])
             ->assertOk()->assertJsonPath('activities.0.participants', [])->assertJsonPath('activities.0.duration_minutes', 40);

        $log = ActivityLog::where('action', 'daily.activity.updated')->sole();
        $this->assertSame([$this->ali->id], $log->meta['old']['child_ids']);
        $this->assertSame([], $log->meta['new']['child_ids']);

        $this->as()->putJson("/api/v1/teacher/daily/activities/{$id}", ['ends_at' => '10:00'])->assertUnprocessable();
        $this->as()->putJson("/api/v1/teacher/daily/activities/{$id}", ['child_ids' => [$this->vali->id]])->assertUnprocessable();
    }

    public function test_ota_ona_faqat_oz_farzandi_qatnashganini_koradi(): void
    {
        $this->activity(['title' => 'Rasm', 'child_ids' => [$this->ali->id]])->assertCreated();

        $parent  = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $parent->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach([$this->ali->id => ['relation_type' => 'ona'], $this->vali->id => ['relation_type' => 'ona']]);

        $this->app['auth']->forgetGuards();
        $ali = $this->actingAsParent($parent)->getJson("/api/v1/parent/children/{$this->ali->id}/daily")->assertOk();
        $ali->assertJsonPath('activities.0.participated', true);
        $this->assertArrayNotHasKey('participants', $ali->json('activities.0'));

        $this->actingAsParent($parent)->getJson("/api/v1/parent/children/{$this->vali->id}/daily")->assertOk()
             ->assertJsonPath('activities.0.participated', false);
    }

    // ── Bola tarixi ───────────────────────────────────────────────

    public function test_bola_tarixi(): void
    {
        MealRecord::factory()->create(['child_id' => $this->ali->id, 'date' => '2026-10-27', 'meal_type' => 'tushlik', 'served_at' => '12:30']);
        SleepRecord::factory()->create(['child_id' => $this->ali->id, 'date' => '2026-10-27', 'started_at' => '13:00', 'ended_at' => '15:00']);
        Attendance::factory()->create(['child_id' => $this->ali->id, 'group_id' => $this->group->id, 'date' => '2026-10-20', 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma']);
        $this->activity(['title' => 'Rasm', 'child_ids' => [$this->ali->id]])->assertCreated();

        $res = $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}/history")->assertOk()
            ->assertJsonPath('from', '2026-10-15')->assertJsonPath('to', self::TODAY);

        $days = collect($res->json('days'))->keyBy('date');
        $this->assertSame(['2026-10-28', '2026-10-27', '2026-10-20'], $days->keys()->all());
        $this->assertSame('Rasm', $days['2026-10-28']['activities'][0]['title']);
        $this->assertSame('tushlik', $days['2026-10-27']['meals'][0]['meal_type']);
        $this->assertSame('15:00', $days['2026-10-27']['sleep']['ended_at']);
        $this->assertSame('kasallik', $days['2026-10-20']['excuse_reason']);
        $this->assertSame('Isitma', $days['2026-10-20']['note']);
    }

    public function test_tarix_chegaralari_va_izolyatsiya(): void
    {
        $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}/history?from=2026-08-01")->assertUnprocessable();
        $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}/history?to=2026-10-29")->assertUnprocessable();

        $otherGroupChild = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => Group::factory()->create(['organization_id' => $this->org->id])->id]);
        $this->as()->getJson("/api/v1/teacher/children/{$otherGroupChild->id}/history")->assertNotFound();
        $this->as()->getJson('/api/v1/teacher/children/' . Child::factory()->create()->id . '/history')->assertNotFound();
        $this->as(User::factory()->parent()->create(['organization_id' => $this->org->id]))->getJson("/api/v1/teacher/children/{$this->ali->id}/history")->assertForbidden();
    }
}
