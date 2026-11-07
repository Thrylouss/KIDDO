<?php

namespace Tests\Feature;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** kiddo:demo-data — namoyish ma'lumotlari: bog'lanishlar, idempotentlik, izolyatsiya, purge va himoyalar. */
class DemoDataTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Test-parol-1';

    /** @var Organization[] */
    private array $orgs;
    private Organization $busy;
    private Organization $demoOrg;
    private Child $realChild;

    protected function setUp(): void
    {
        parent::setUp();
        foreach ([[1, 180], [2, 90], [3, 280]] as [$number, $capacity]) {
            $this->orgs[] = Organization::factory()->create(['name' => "{$number}-sonli DMTT", 'number' => (string) $number,
                'capacity' => $capacity, 'district' => "Bo'stonliq tumani"]);
        }
        // Haqiqiy ishlatilayotgan bog'cha (demo bo'lmagan bolasi bor) — tegilmasligi kerak
        $this->busy      = Organization::factory()->create(['name' => '4-sonli DMTT', 'number' => '4', 'capacity' => 150]);
        $this->realChild = Child::factory()->create(['organization_id' => $this->busy->id,
            'group_id' => Group::factory()->create(['organization_id' => $this->busy->id])->id]);
        $this->demoOrg   = Organization::factory()->create(['name' => "Test bog'chasi (DEV)", 'is_demo' => true]);
    }

    private function enableDevMode(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config(['kiddo.dev_test_mode' => true, 'kiddo.dev_test_password' => self::PASSWORD,
            'kiddo.dev_test_database' => DB::connection()->getDatabaseName()]);
    }

    private function snapshot(): array
    {
        return collect(['groups', 'children', 'users', 'teacher_profiles', 'parent_profiles', 'child_parent', 'teacher_group',
            'attendances', 'group_activities', 'meal_records', 'sleep_records', 'child_payments', 'demo_records'])
            ->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all();
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    public function test_har_bir_bogchaga_turli_hajmda_ozaro_boglangan_malumot_yaratiladi(): void
    {
        $this->enableDevMode();
        $this->artisan('kiddo:demo-data')->assertSuccessful();

        $children = array_map(fn ($o) => Child::where('organization_id', $o->id)->count(), $this->orgs);
        $this->assertCount(3, array_unique($children), 'bolalar soni har bog\'chada har xil');
        foreach ($this->orgs as $i => $org) {
            $this->assertGreaterThanOrEqual(12, $children[$i]);
            $this->assertLessThanOrEqual((int) ceil($org->capacity * 0.30), $children[$i]);
            $groups = Group::where('organization_id', $org->id)->pluck('id');
            $this->assertGreaterThanOrEqual(2, $groups->count());

            // Har bir bola o'z bog'chasining guruhida; har bir guruhda tarbiyachi bor
            $this->assertSame(0, Child::where('organization_id', $org->id)->whereNotIn('group_id', $groups)->count());
            foreach ($groups as $gid) {
                $this->assertTrue(DB::table('teacher_group')->join('teacher_profiles', 'teacher_profiles.id', '=', 'teacher_group.teacher_profile_id')
                    ->where('group_id', $gid)->where('teacher_profiles.organization_id', $org->id)->exists());
            }
            // Rahbar akkaunti — aynan shu bog'chaga biriktirilgan
            $admin = User::where('username', "dmtt{$org->number}")->sole();
            $this->assertSame([User::ROLE_ADMIN, $org->id, false], [$admin->role, $admin->organization_id, (bool) $admin->must_change_password]);
            $this->assertTrue(Hash::check(self::PASSWORD, $admin->password));
        }

        // Ota-ona va bola bir bog'chada; telefonlar sun'iy (+99800)
        $this->assertSame(0, DB::table('child_parent')->join('children', 'children.id', '=', 'child_parent.child_id')
            ->join('parent_profiles', 'parent_profiles.id', '=', 'child_parent.parent_profile_id')
            ->whereColumn('children.organization_id', '!=', 'parent_profiles.organization_id')->count());
        $this->assertGreaterThan(0, ParentProfile::count());
        $this->assertSame(0, User::where('role', User::ROLE_PARENT)->where('phone', 'not like', '+99800%')->count());
        $this->assertSame(0, ParentProfile::doesntHave('children')->count());

        // Davomat, mashg'ulot, ovqat, uyqu
        $this->assertGreaterThan(0, DB::table('attendances')->count());
        $this->assertGreaterThan(0, DB::table('group_activities')->count());
        $this->assertGreaterThan(0, DB::table('meal_records')->count());
        $this->assertGreaterThan(0, DB::table('sleep_records')->count());
        $this->assertGreaterThan(0, DB::table('child_payments')->count());
        $this->assertSame(0, DB::table('child_payments')->join('children', 'children.id', '=', 'child_payments.child_id')
            ->whereColumn('children.organization_id', '!=', 'child_payments.organization_id')->count());
        $this->assertSame(0, DB::table('attendances')->join('children', 'children.id', '=', 'attendances.child_id')
            ->whereColumn('children.organization_id', '!=', 'attendances.organization_id')->count());
    }

    public function test_idempotent_qayta_ishga_tushirish_takror_yaratmaydi_parollarni_ozgartirmaydi(): void
    {
        $this->enableDevMode();
        $this->artisan('kiddo:demo-data')->assertSuccessful();
        $first  = $this->snapshot();
        $hashes = User::orderBy('id')->pluck('password', 'id')->all();

        $this->artisan('kiddo:demo-data')->assertSuccessful();
        $this->artisan('kiddo:demo-data')->assertSuccessful();

        $this->assertSame($first, $this->snapshot());
        $this->assertSame($hashes, User::orderBy('id')->pluck('password', 'id')->all());
        $this->assertSame(0, Child::select('organization_id', 'first_name', 'last_name', 'birth_date')
            ->groupBy('organization_id', 'first_name', 'last_name', 'birth_date')->havingRaw('count(*) > 1')->count());
    }

    public function test_real_malumotli_va_demo_bogchaga_tegilmaydi(): void
    {
        $this->enableDevMode();
        $this->artisan('kiddo:demo-data')->expectsOutputToContain("o'tkazib yuborildi")->assertSuccessful();

        $this->assertSame(1, Child::where('organization_id', $this->busy->id)->count());
        $this->assertSame(0, User::where('organization_id', $this->busy->id)->count());
        $this->assertSame(0, Child::where('organization_id', $this->demoOrg->id)->count());
    }

    public function test_tenant_izolyatsiyasi_va_super_admin_statistikasi(): void
    {
        $this->enableDevMode();
        $this->artisan('kiddo:demo-data')->assertSuccessful();
        [$a, $b] = $this->orgs;

        // Rahbar faqat o'z bog'chasini ko'radi
        $owner = User::where('username', "dmtt{$a->number}")->sole();
        $ids   = collect($this->as($owner)->getJson('/api/v1/admin/children')->assertOk()->json('data'))->pluck('organization_id')->unique()->all();
        $this->assertSame([$a->id], $ids);
        $foreign = Child::where('organization_id', $b->id)->first();
        $this->as($owner)->getJson("/api/v1/admin/children/{$foreign->id}")->assertNotFound();
        $this->as($owner)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('bolalar_soni', Child::where('organization_id', $a->id)->count());

        // Tarbiyachi faqat o'z guruhlarini ko'radi
        $teacher  = User::where('username', "dmtt{$a->number}.t1")->sole();
        $mine     = $teacher->teacherProfile->groups()->pluck('groups.id')->all();
        $dash     = $this->as($teacher)->getJson('/api/v1/teacher/dashboard')->assertOk();
        $this->assertEqualsCanonicalizing($mine, collect($dash->json('groups'))->pluck('id')->all());
        $notMine  = Group::where('organization_id', $a->id)->whereNotIn('id', $mine)->value('id');
        $this->as($teacher)->getJson("/api/v1/teacher/dashboard?group_id={$notMine}")->assertNotFound();

        // Ota-ona faqat o'z farzandi
        $parent = User::where('role', User::ROLE_PARENT)->where('organization_id', $a->id)->first();
        $own    = $parent->parentProfile->children()->pluck('children.id')->all();
        $this->app['auth']->forgetGuards();
        $seen   = collect($this->actingAsParent($parent)->getJson('/api/v1/parent/children')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing($own, $seen);

        // Super Admin: barcha haqiqiy bog'chalar bo'yicha agregat (demo bog'chasiz)
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $realIds = Organization::real()->pluck('id');
        $this->as($sa)->getJson('/api/v1/super-admin/dashboard')->assertOk()
            ->assertJsonPath('jami_bogchalar', 4)
            ->assertJsonPath('platforma.jami_bolalar', Child::whereIn('organization_id', $realIds)->count())
            ->assertJsonPath('platforma.jami_guruhlar', Group::whereIn('organization_id', $realIds)->active()->count());
    }

    public function test_purge_faqat_demo_yozuvlarni_olib_tashlaydi(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->enableDevMode();
        $this->artisan('kiddo:demo-data')->assertSuccessful();
        $this->assertGreaterThan(0, DB::table('demo_records')->count());

        $this->artisan('kiddo:demo-data', ['--purge' => true])->assertSuccessful();

        foreach ($this->orgs as $org) {
            $this->assertSame(0, Child::withTrashed()->where('organization_id', $org->id)->count());
            $this->assertSame(0, Group::withTrashed()->where('organization_id', $org->id)->count());
            $this->assertSame(0, User::where('organization_id', $org->id)->count());
        }
        $this->assertSame(0, DB::table('attendances')->count());
        $this->assertSame(0, DB::table('demo_records')->count());
        $this->assertSame(5, Organization::count()); // bog'chalarning hammasi joyida
        $this->assertNotNull($this->realChild->fresh());
        $this->assertNotNull($sa->fresh());
    }

    public function test_faqat_dev_test_mode_da_ishlaydi(): void
    {
        foreach (['production', 'testing'] as $env) {
            $this->enableDevMode();
            $this->app->detectEnvironment(fn () => $env);
            $this->artisan('kiddo:demo-data')->expectsOutputToContain('APP_ENV=local')->assertFailed();
            $this->artisan('kiddo:demo-data', ['--purge' => true])->assertFailed();
        }
        $this->enableDevMode();
        config(['kiddo.dev_test_database' => 'boshqa_baza']);
        $this->artisan('kiddo:demo-data')->assertFailed();

        $this->assertSame(1, Child::count());
        $this->assertSame(0, DB::table('demo_records')->count());
    }
}
