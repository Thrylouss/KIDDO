<?php

namespace Tests\Feature\Daily;

use App\Models\ActivityLog;
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
 * Uchidan-uchigacha backend integratsiyasi (HTTP + Sanctum token + Postgres kiddo_test).
 * Kundalik yozuvlar factory bilan emas, faqat API orqali yaratiladi; davomat ham API orqali belgilanadi.
 * Bu frontend/brauzer integratsiyasi emas.
 */
class DailyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private Organization $org;
    private Group $groupA;
    private Group $groupB;
    private string $teacherA;
    private string $teacherB;
    private string $admin;
    /** @var array<string, Child> */
    private array $kids = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));

        $this->org    = Organization::factory()->create();
        $this->groupA = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->groupB = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Oy']);

        $this->teacherA = $this->teacherToken($this->groupA);
        $this->teacherB = $this->teacherToken($this->groupB);
        $admin          = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->admin    = $admin->createToken('kiddo-app', [User::ROLE_ADMIN])->plainTextToken;

        foreach (['Ali' => 'Valiyev', 'Vali' => 'Aliyev', 'Malika' => 'Karimova', 'Zuhra' => 'Rasulova'] as $first => $last) {
            $this->kids[$first] = Child::factory()->create([
                'organization_id' => $this->org->id, 'group_id' => $this->groupA->id, 'first_name' => $first, 'last_name' => $last,
            ]);
        }
        $this->kids['Bobur'] = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->groupB->id]);
    }

    private function teacherToken(Group $group): string
    {
        $user    = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $profile = TeacherProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $this->org->id]);
        $profile->groups()->attach($group->id, ['assigned_at' => '2026-10-01']);

        return $user->createToken('kiddo-app', [User::ROLE_TEACHER])->plainTextToken;
    }

    private function api(string $token, string $method, string $url, array $body = [])
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($token)->json($method, $url, $body);
    }

    private function markAttendance(string $token, array $statuses, string $prefix = '/api/v1/teacher')
    {
        $path = $prefix === '/api/v1/teacher' ? '/api/v1/teacher/attendance' : '/api/v1/admin/attendance';

        return $this->api($token, 'PUT', $path, [
            'date' => self::TODAY, 'group_id' => $this->groupA->id,
            'records' => collect($statuses)->map(fn ($status, $name) => ['child_id' => $this->kids[$name]->id, 'status' => $status]
                + ($status === 'excused' ? ['excuse_reason' => 'kasallik', 'note' => 'Shifokorda'] : []))->values()->all(),
        ]);
    }

    private function meal(string $token, array $names, string $type = 'tushlik', string $base = '/api/v1/teacher/daily')
    {
        return $this->api($token, 'PUT', "{$base}/meals", [
            'date' => self::TODAY, 'group_id' => $this->groupA->id, 'meal_type' => $type, 'served_at' => '12:30',
            'records' => collect($names)->map(fn ($n) => ['child_id' => $this->kids[$n]->id])->all(),
        ]);
    }

    private function sleep(string $token, string $name, string $start = '13:00', ?string $end = null)
    {
        return $this->api($token, 'PUT', '/api/v1/teacher/daily/sleep', [
            'date' => self::TODAY, 'group_id' => $this->groupA->id,
            'records' => [['child_id' => $this->kids[$name]->id, 'started_at' => $start, 'ended_at' => $end]],
        ]);
    }

    private function parentToken(Child $child, string $phone): string
    {
        $user    = User::factory()->parent()->create(['organization_id' => $this->org->id, 'phone' => $phone]);
        $profile = ParentProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach($child->id, ['relation_type' => 'ona']);

        $this->app['auth']->forgetGuards();
        return $this->postJson('/api/v1/mobile/login', ['phone' => $phone, 'password' => 'password'])->assertOk()->json('access_token');
    }

    // ── To'liq kun: davomat → ovqat/uyqu/mashg'ulot → ota-ona ──────────────────

    public function test_toliq_kun_faqat_keldi_bolaga_yoziladi_va_ota_onaga_yetadi(): void
    {
        $this->markAttendance($this->teacherA, ['Ali' => 'present', 'Malika' => 'absent', 'Zuhra' => 'excused'])->assertOk();

        // Keldi bo'lmagan uch holat — alohida xabarlar, hech narsa yozilmaydi
        $this->meal($this->teacherA, ['Ali', 'Vali', 'Malika', 'Zuhra'])
             ->assertUnprocessable()
             ->assertJsonPath('errors.records', [
                 "Aliyev Vali uchun bu kuni davomat belgilanmagan — avval davomatda «Keldi» deb belgilang.",
                 "Karimova Malika bu kuni davomatda «Kelmadi» deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.",
                 "Rasulova Zuhra bu kuni davomatda «Sababli» (bog'chaga kelmagan) deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.",
             ]);
        foreach (['Vali', 'Malika', 'Zuhra'] as $name) {
            $this->sleep($this->teacherA, $name)->assertUnprocessable();
        }
        $this->assertSame(0, MealRecord::count());
        $this->assertSame(0, SleepRecord::count());

        // Keldi — yoziladi
        $this->meal($this->teacherA, ['Ali'])->assertOk();
        $this->sleep($this->teacherA, 'Ali')->assertOk();
        $this->api($this->teacherA, 'POST', '/api/v1/teacher/daily/activities', [
            'date' => self::TODAY, 'group_id' => $this->groupA->id, 'title' => 'Rasm chizish', 'starts_at' => '10:00',
        ])->assertCreated();

        $day = $this->api($this->teacherA, 'GET', "/api/v1/teacher/daily?group_id={$this->groupA->id}")->assertOk()->json();
        $ali = collect($day['children'])->firstWhere('first_name', 'Ali');
        $this->assertSame('present', $ali['attendance']);
        $this->assertSame('tushlik', $ali['meals'][0]['meal_type']);
        $this->assertTrue($ali['sleep']['is_sleeping']);

        // Ota-ona (mobil token) — faqat o'z farzandi
        $aliParent = $this->parentToken($this->kids['Ali'], '+998907770201');
        $this->api($aliParent, 'GET', "/api/v1/parent/children/{$this->kids['Ali']->id}/daily")->assertOk()
             ->assertJsonPath('meals.0.meal_type', 'tushlik')
             ->assertJsonPath('sleep.status_text', 'Hali uxlayapti')
             ->assertJsonPath('activities.0.title', 'Rasm chizish');
        $this->api($aliParent, 'GET', "/api/v1/parent/children/{$this->kids['Malika']->id}/daily")->assertNotFound();

        $malikaParent = $this->parentToken($this->kids['Malika'], '+998907770202');
        $this->api($malikaParent, 'GET', "/api/v1/parent/children/{$this->kids['Malika']->id}/daily")->assertOk()
             ->assertJsonPath('attendance', 'absent')->assertJsonPath('meals', [])->assertJsonPath('sleep', null)
             ->assertJsonPath('activities.0.title', 'Rasm chizish');
    }

    // ── Davomat keyin o'zgarsa ────────────────────────────────────────────────

    public function test_davomat_ozgarsa_yozuvlar_saqlanadi_va_audit_qilinadi(): void
    {
        $this->markAttendance($this->teacherA, ['Ali' => 'present'])->assertOk();
        $this->meal($this->teacherA, ['Ali'], 'nonushta')->assertOk();
        $this->meal($this->teacherA, ['Ali'], 'tushlik')->assertOk();
        $this->sleep($this->teacherA, 'Ali', '13:00', '15:00')->assertOk();

        // Keldi → Kelmadi
        $this->markAttendance($this->teacherA, ['Ali' => 'absent'])->assertOk();

        // Yozuvlar o'chirilmagan (soft delete ham emas)
        $this->assertSame(2, MealRecord::where('child_id', $this->kids['Ali']->id)->count());
        $this->assertSame(0, MealRecord::onlyTrashed()->count());
        $this->assertSame(1, SleepRecord::where('child_id', $this->kids['Ali']->id)->count());

        // Davomat o'zgarishi audit log'da, saqlangan yozuvlar soni bilan
        $log = ActivityLog::where('action', 'attendance.updated')->latest('id')->firstOrFail();
        $this->assertSame('present', $log->meta['old']['status']);
        $this->assertSame('absent', $log->meta['new']['status']);
        $this->assertSame(['meals' => 2, 'sleep' => 1], $log->meta['daily_records_kept']);

        // Yangi yozuv yoki tuzatish endi rad etiladi
        $this->meal($this->teacherA, ['Ali'], 'peshinlik')->assertUnprocessable();
        $this->sleep($this->teacherA, 'Ali', '13:00', '15:30')->assertUnprocessable();
        $this->assertSame('15:00:00', SleepRecord::sole()->ended_at);

        // Ko'rinishda saqlangan yozuvlar va yangi holat
        $ali = collect($this->api($this->teacherA, 'GET', '/api/v1/teacher/daily')->json('children'))->firstWhere('first_name', 'Ali');
        $this->assertSame('absent', $ali['attendance']);
        $this->assertCount(2, $ali['meals']);

        // O'chirish ruxsat etiladi va audit qilinadi
        $mealId = $ali['meals'][0]['id'];
        $this->api($this->teacherA, 'DELETE', "/api/v1/teacher/daily/meals/{$mealId}")->assertOk();
        $deleted = ActivityLog::where('action', 'daily.meal.deleted')->sole();
        $this->assertSame($this->kids['Ali']->id, $deleted->meta['child_id']);
        $this->assertArrayHasKey('meal_type', $deleted->meta['old']);
        $this->assertSoftDeleted('meal_records', ['id' => $mealId]);

        // Yana «Keldi» — yozish qayta ochiladi
        $this->markAttendance($this->teacherA, ['Ali' => 'present'])->assertOk();
        $this->meal($this->teacherA, ['Ali'], 'peshinlik')->assertOk();
    }

    public function test_admin_davomatni_ozgartirsa_ham_yozuvlar_saqlanadi(): void
    {
        $this->markAttendance($this->teacherA, ['Ali' => 'present'])->assertOk();
        $this->meal($this->teacherA, ['Ali'])->assertOk();

        $this->markAttendance($this->admin, ['Ali' => 'excused'], '/api/v1/admin')->assertOk();

        $this->assertSame(1, MealRecord::count());
        $log = ActivityLog::where('action', 'attendance.updated')->latest('id')->firstOrFail();
        $this->assertSame(['meals' => 1, 'sleep' => 0], $log->meta['daily_records_kept']);
        $this->meal($this->admin, ['Ali'], 'peshinlik', '/api/v1/admin/daily')->assertUnprocessable();
    }

    public function test_yozuvsiz_davomat_ozgarishida_qoshimcha_audit_kaliti_yoq(): void
    {
        $this->markAttendance($this->teacherA, ['Ali' => 'present'])->assertOk();
        $this->markAttendance($this->teacherA, ['Ali' => 'absent'])->assertOk();

        $log = ActivityLog::where('action', 'attendance.updated')->sole();
        $this->assertArrayNotHasKey('daily_records_kept', $log->meta);
    }

    // ── Tarbiyachi chegaralari ────────────────────────────────────────────────

    public function test_tarbiyachi_faqat_ozining_guruhi_bilan_ishlaydi(): void
    {
        $this->markAttendance($this->teacherA, ['Ali' => 'present'])->assertOk();
        $this->meal($this->teacherA, ['Ali'])->assertOk();
        $mealId = MealRecord::sole()->id;
        $activityId = $this->api($this->teacherA, 'POST', '/api/v1/teacher/daily/activities', [
            'date' => self::TODAY, 'group_id' => $this->groupA->id, 'title' => 'Rasm',
        ])->assertCreated()->json('activities.0.id');

        // B guruh tarbiyachisi A guruhni ko'ra olmaydi va o'zgartira olmaydi
        $this->api($this->teacherB, 'GET', "/api/v1/teacher/daily?group_id={$this->groupA->id}")->assertNotFound();
        $this->meal($this->teacherB, ['Ali'])->assertNotFound();
        $this->api($this->teacherB, 'DELETE', "/api/v1/teacher/daily/meals/{$mealId}")->assertNotFound();
        $this->api($this->teacherB, 'PUT', "/api/v1/teacher/daily/activities/{$activityId}", ['title' => 'Buzish'])->assertNotFound();
        $this->api($this->teacherB, 'DELETE', "/api/v1/teacher/daily/activities/{$activityId}")->assertNotFound();

        // A guruh tarbiyachisi B guruh bolasini o'z guruhi orqali yoza olmaydi
        $this->api($this->teacherA, 'PUT', '/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->groupA->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $this->kids['Bobur']->id]],
        ])->assertUnprocessable();

        // B guruh o'z sahifasida faqat o'z bolasini ko'radi
        $names = collect($this->api($this->teacherB, 'GET', '/api/v1/teacher/daily')->assertOk()->json('children'))->pluck('id');
        $this->assertSame([$this->kids['Bobur']->id], $names->all());

        $this->assertNotSoftDeleted('meal_records', ['id' => $mealId]);
        $this->assertSame('Rasm', GroupActivity::sole()->title);
    }

    public function test_boshqa_bogcha_malumotlariga_kirish_yopiq(): void
    {
        $otherOrg   = Organization::factory()->create();
        $otherGroup = Group::factory()->create(['organization_id' => $otherOrg->id]);
        $otherKid   = Child::factory()->create(['organization_id' => $otherOrg->id, 'group_id' => $otherGroup->id]);
        $otherUser  = User::factory()->teacher()->create(['organization_id' => $otherOrg->id]);
        TeacherProfile::factory()->create(['user_id' => $otherUser->id, 'organization_id' => $otherOrg->id])
            ->groups()->attach($otherGroup->id, ['assigned_at' => '2026-10-01']);
        $otherToken = $otherUser->createToken('kiddo-app', [User::ROLE_TEACHER])->plainTextToken;

        $this->api($otherToken, 'PUT', '/api/v1/teacher/attendance', [
            'date' => self::TODAY, 'group_id' => $otherGroup->id, 'records' => [['child_id' => $otherKid->id, 'status' => 'present']],
        ])->assertOk();
        $this->api($otherToken, 'PUT', '/api/v1/teacher/daily/meals', [
            'date' => self::TODAY, 'group_id' => $otherGroup->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $otherKid->id]],
        ])->assertOk();
        $foreignMeal = MealRecord::sole();

        // Bizning tarbiyachi va admin boshqa bog'cha guruhi, bolasi va yozuviga kira olmaydi
        $this->api($this->teacherA, 'GET', "/api/v1/teacher/daily?group_id={$otherGroup->id}")->assertNotFound();
        $this->api($this->teacherA, 'DELETE', "/api/v1/teacher/daily/meals/{$foreignMeal->id}")->assertNotFound();
        $this->api($this->admin, 'GET', "/api/v1/admin/daily?group_id={$otherGroup->id}")->assertNotFound();
        $this->api($this->admin, 'DELETE', "/api/v1/admin/daily/meals/{$foreignMeal->id}")->assertNotFound();
        $this->api($this->admin, 'PUT', '/api/v1/admin/daily/meals', [
            'date' => self::TODAY, 'group_id' => $this->groupA->id, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $otherKid->id]],
        ])->assertUnprocessable();

        $this->assertNotSoftDeleted('meal_records', ['id' => $foreignMeal->id]);
        $this->assertSame($otherOrg->id, $foreignMeal->fresh()->organization_id);
    }
}
