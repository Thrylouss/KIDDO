<?php

namespace Tests\Feature\SuperAdmin;

use App\Console\Commands\DevTestAccounts;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Test/demo tashkilotlar (is_demo) haqiqiy platforma statistikasiga qo'shilmaydi va ro'yxatda alohida filtrlanadi.
 * Super Admin bog'cha paneliga faqat ko'rish uchun kiradi.
 */
class DemoOrganizationTest extends TestCase
{
    use RefreshDatabase;

    private User $sa;
    private Organization $real;
    private Organization $demo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sa   = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->real = Organization::factory()->create(['name' => '1-sonli DMTT']);
        Organization::factory()->create(['name' => '2-sonli DMTT', 'is_active' => false]);
        $this->demo = Organization::factory()->create(['name' => "Namoyish bog'chasi (DEMO)", 'is_demo' => true]);

        foreach ([$this->real, $this->demo] as $org) {
            $group = Group::factory()->create(['organization_id' => $org->id]);
            Child::factory()->count($org->is_demo ? 5 : 2)->create(['organization_id' => $org->id, 'group_id' => $group->id]);
            $teacher = User::factory()->teacher()->create(['organization_id' => $org->id]);
            TeacherProfile::factory()->create(['user_id' => $teacher->id, 'organization_id' => $org->id]);
        }
    }

    public function test_dashboard_faqat_haqiqiy_tashkilotlarni_hisoblaydi(): void
    {
        $this->actingAs($this->sa, 'sanctum')->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->assertJsonPath('jami_bogchalar', 2)
            ->assertJsonPath('faol_bogchalar', 1)
            ->assertJsonPath('nofaol_bogchalar', 1)
            ->assertJsonPath('demo_bogchalar', 1)
            ->assertJsonPath('jami_foydalanuvchilar', 2)          // super admin + haqiqiy bog'cha tarbiyachisi
            ->assertJsonPath('platforma.jami_bolalar', 2)
            ->assertJsonPath('platforma.jami_guruhlar', 1)
            ->assertJsonPath('platforma.jami_tarbiyachilar', 1)
            ->assertJsonPath('platforma.bugungi_davomat.jami', 2)
            ->assertJsonMissing(['name' => "Namoyish bog'chasi (DEMO)"]); // oxirgi bog'chalar ro'yxatida ham yo'q
    }

    public function test_royxat_standart_haqiqiy_demo_va_hammasi_filtrlari(): void
    {
        $names = fn (string $qs) => collect($this->actingAs($this->sa, 'sanctum')
            ->getJson("/api/v1/super-admin/organizations{$qs}")->assertOk()->json('data'))->pluck('name')->sort()->values()->all();

        $this->assertSame(['1-sonli DMTT', '2-sonli DMTT'], $names(''));
        $this->assertSame(["Namoyish bog'chasi (DEMO)"], $names('?turi=demo'));
        $this->assertCount(3, $names('?turi=all'));

        $this->actingAs($this->sa, 'sanctum')->getJson('/api/v1/super-admin/organizations?turi=demo')
            ->assertJsonPath('data.0.is_demo', true)->assertJsonPath('meta.total', 1);
        $this->actingAs($this->sa, 'sanctum')->getJson("/api/v1/super-admin/organizations/{$this->real->id}")
            ->assertJsonPath('data.is_demo', false);
    }

    public function test_hisobotlar_ham_demo_tashkilotlarni_hisoblamaydi(): void
    {
        $this->actingAs($this->sa, 'sanctum')->getJson('/api/v1/super-admin/reports/organizations')
            ->assertOk()->assertJsonPath('counts.total', 2)->assertJsonPath('counts.inactive', 1);
    }

    public function test_super_admin_bogcha_panelida_faqat_koradi(): void
    {
        $headers = ['X-Impersonated-Org' => (string) $this->real->id];
        $child   = Child::where('organization_id', $this->real->id)->first();

        $this->actingAs($this->sa, 'sanctum')->withHeaders($headers)->getJson('/api/v1/admin/dashboard')
            ->assertOk()->assertJsonPath('bolalar_soni', 2);
        $this->actingAs($this->sa, 'sanctum')->withHeaders($headers)->getJson('/api/v1/admin/children')->assertOk();

        $this->actingAs($this->sa, 'sanctum')->withHeaders($headers)
            ->putJson("/api/v1/admin/children/{$child->id}", ['first_name' => 'X'])
            ->assertForbidden()
            ->assertJsonPath('message', "Super Admin bog'cha ma'lumotlarini faqat ko'ra oladi. O'zgartirishlarni bog'cha rahbari bajaradi.");
        $this->actingAs($this->sa, 'sanctum')->withHeaders($headers)
            ->postJson('/api/v1/admin/messages', ['body' => 'Salom'])->assertForbidden();
        $this->assertNotSame('X', $child->fresh()->first_name);

        // Bog'cha rahbari o'z bog'chasida yozishda davom etadi
        $owner = User::factory()->admin()->create(['organization_id' => $this->real->id]);
        $this->app['auth']->forgetGuards();
        $this->actingAs($owner, 'sanctum')->putJson("/api/v1/admin/children/{$child->id}", ['first_name' => 'Yangi'])->assertOk();
    }

    public function test_dev_buyrugi_test_bogchasini_demo_deb_belgilaydi(): void
    {
        // Avval belgisiz yaratilgan test bog'chasi ham (migratsiyadan oldingi holat) belgilanadi
        $old = Organization::factory()->create(['name' => DevTestAccounts::ORG_NAME, 'district' => null, 'number' => null, 'is_demo' => false]);

        $this->app->detectEnvironment(fn () => 'local');
        config(['kiddo.dev_test_mode' => true, 'kiddo.dev_test_password' => 'Test-parol-1',
            'kiddo.dev_test_database' => DB::connection()->getDatabaseName()]);
        $this->artisan('kiddo:dev-accounts')->assertSuccessful();

        $this->assertTrue($old->fresh()->is_demo);
        $this->assertSame(1, Organization::where('name', DevTestAccounts::ORG_NAME)->count());
        $this->assertFalse($this->real->fresh()->is_demo);
    }
}
