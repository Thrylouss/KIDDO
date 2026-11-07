<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\Territory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Statistikaning yagona qoidasi: «Jami» = haqiqiy va arxivlanmagan tashkilotlar; arxivlanganlar alohida.
 * Hududiy ma'lumotnoma: rasmiy ro'yxat yuklanmagan bo'lsa — bazadagi qiymatlar; bog'chalar o'zgarmaydi.
 */
class StatsConsistencyAndTerritoryTest extends TestCase
{
    use RefreshDatabase;

    private User $sa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function saGet(string $uri)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->sa, 'sanctum')->getJson($uri)->assertOk();
    }

    public function test_dashboard_hisobot_va_bogchalar_sahifasi_bir_xil_sonlar(): void
    {
        $make = function (string $status, int $children, bool $demo = false) {
            $org = Organization::factory()->create(['type' => 'davlat', 'is_demo' => $demo]);
            if ($status !== 'active') {
                $org->update(['status' => $status]);
            }
            $g = Group::factory()->create(['organization_id' => $org->id]);
            Child::factory()->count($children)->create(['organization_id' => $org->id, 'group_id' => $g->id, 'is_active' => true]);

            return $org;
        };
        $make('active', 3);
        $make('active', 2);
        $make('inactive', 1);
        $make('suspended', 4);
        $make('archived', 7);
        $make('active', 9, true);   // demo — hisobga olinmaydi

        $stats = $this->saGet('/api/v1/super-admin/organizations/stats')->json('data');
        $this->assertSame([4, 2, 1, 1, 1], [$stats['total'], $stats['active'], $stats['inactive'], $stats['suspended'], $stats['archived']]);

        $dash = $this->saGet('/api/v1/super-admin/dashboard')->json();
        $this->assertSame($stats['total'], $dash['jami_bogchalar']);
        $this->assertSame($stats['active'], $dash['faol_bogchalar']);
        $this->assertSame(2, $dash['nofaol_bogchalar']);                       // faol emas + to'xtatilgan
        $this->assertSame([1, 1, 1], [$dash['faol_emas_bogchalar'], $dash['toxtatilgan_bogchalar'], $dash['arxiv_bogchalar']]);
        $this->assertSame($dash['jami_bogchalar'], $dash['faol_bogchalar'] + $dash['nofaol_bogchalar']);
        $this->assertSame(10, $dash['platforma']['jami_bolalar']);              // 3+2+1+4 — arxiv (7) va demo (9) kirmaydi

        $report = $this->saGet('/api/v1/super-admin/reports/organizations')->json('counts');
        $this->assertSame([4, 2, 2, 1, 1], [$report['total'], $report['active'], $report['inactive'], $report['suspended'], $report['archived']]);

        // Ro'yxat (standart filtr) jami = statistika jami; arxiv filtri = arxiv soni
        $this->assertSame($stats['total'], $this->saGet('/api/v1/super-admin/organizations')->json('meta.total'));
        $this->assertSame($stats['archived'], $this->saGet('/api/v1/super-admin/organizations?status=archived')->json('meta.total'));
        $this->assertSame($stats['suspended'], $this->saGet('/api/v1/super-admin/organizations?status=suspended')->json('meta.total'));

        // Filtr va sahifalash statistikani o'zgartirmaydi
        $this->saGet('/api/v1/super-admin/organizations?status=active&per_page=1&page=2');
        $this->assertSame($stats, $this->saGet('/api/v1/super-admin/organizations/stats')->json('data'));
    }

    public function test_malumotnoma_yoq_bolsa_bazadagi_qiymatlar_manba_bilan(): void
    {
        Organization::factory()->create(['region' => 'Toshkent viloyati', 'district' => "Bo'stonliq tumani", 'mfy' => 'Markaz MFY']);

        $this->saGet('/api/v1/super-admin/organizations/filter-options')
            ->assertJsonPath('data.source', 'organizations')
            ->assertJsonPath('data.districts', ["Bo'stonliq tumani"])
            ->assertJsonPath('data.mfys', ['Markaz MFY']);
    }

    public function test_malumotnoma_buyrugi_tekshiruv_va_yozish_bogchalarni_ozgartirmaydi(): void
    {
        $org = Organization::factory()->create(['region' => 'Eski viloyat', 'district' => 'Eski tuman', 'mfy' => 'Eski MFY']);
        $csv = tempnam(sys_get_temp_dir(), 'terr') . '.csv';
        file_put_contents($csv, "Viloyat;Tuman/shahar;MFY;Kod\nToshkent viloyati;Bo'stonliq tumani;Markaz MFY;1001\nToshkent viloyati;Bo'stonliq tumani;Navro'z MFY;1002\nToshkent viloyati;Chirchiq shahri;;\n");

        $this->artisan('kiddo:territories:import', ['file' => $csv])->assertFailed();          // --source majburiy

        // Tekshiruv rejimi — hech narsa yozilmaydi
        $this->artisan('kiddo:territories:import', ['file' => $csv, '--source' => 'Test manba'])
            ->expectsOutputToContain('Viloyatlar: 1, tumanlar: 2, MFY: 2')
            ->expectsOutputToContain('Tekshiruv rejimi')->assertSuccessful();
        $this->assertSame(0, Territory::count());

        $this->artisan('kiddo:territories:import', ['file' => $csv, '--source' => 'Test manba', '--apply' => true])->assertSuccessful();
        $this->assertSame([1, 2, 2], [
            Territory::where('kind', 'region')->count(), Territory::where('kind', 'district')->count(), Territory::where('kind', 'mfy')->count(),
        ]);
        $this->assertSame('1001', Territory::where('name', 'Markaz MFY')->value('code'));
        $this->assertSame('Test manba', Territory::first()->source);

        // Qayta yuklash — takror yaratmaydi
        $this->artisan('kiddo:territories:import', ['file' => $csv, '--source' => 'Test manba', '--apply' => true])->assertSuccessful();
        $this->assertSame(5, Territory::count());

        // Bog'cha qiymatlari avtomatik o'zgartirilmagan
        $this->assertSame(['Eski viloyat', 'Eski tuman', 'Eski MFY'], [$org->fresh()->region, $org->fresh()->district, $org->fresh()->mfy]);

        // Endi tanlovlar ma'lumotnomadan
        $this->saGet('/api/v1/super-admin/organizations/filter-options')
            ->assertJsonPath('data.source', 'directory')
            ->assertJsonPath('data.districts', ["Bo'stonliq tumani", 'Chirchiq shahri'])
            ->assertJsonPath('data.regions', ['Toshkent viloyati']);

        @unlink($csv);
    }

    public function test_malumotnoma_faylida_xato_bolsa_yozilmaydi(): void
    {
        $csv = tempnam(sys_get_temp_dir(), 'terr') . '.csv';
        file_put_contents($csv, "Viloyat;Tuman;MFY\nToshkent viloyati;;Markaz MFY\n");
        $this->artisan('kiddo:territories:import', ['file' => $csv, '--source' => 'X', '--apply' => true])
            ->expectsOutputToContain('viloyat va tuman majburiy')->assertFailed();
        $this->assertSame(0, Territory::count());
        @unlink($csv);
    }

    public function test_hududlar_migratsiyasi_takroriy_viloyatni_bloklaydi_va_rollback_xavfsiz(): void
    {
        $row = fn (string $kind, string $name, ?int $parent) => ['kind' => $kind, 'name' => $name, 'parent_id' => $parent, 'source' => 'test'];
        $region = Territory::create($row(Territory::KIND_REGION, 'Toshkent viloyati', null));
        $other  = Territory::create($row(Territory::KIND_REGION, 'Samarqand viloyati', null));

        // Bir xil nomli tuman turli viloyatlarda bo'lishi mumkin
        Territory::create($row(Territory::KIND_DISTRICT, 'Markaziy tuman', $region->id));
        Territory::create($row(Territory::KIND_DISTRICT, 'Markaziy tuman', $other->id));

        // Bir xil nomli ikkinchi viloyat (parent_id NULL) — baza darajasida rad etiladi
        DB::beginTransaction();
        try {
            Territory::create($row(Territory::KIND_REGION, 'Toshkent viloyati', null));
            $this->fail("Takroriy viloyat yaratildi");
        } catch (QueryException $e) {
            $this->assertStringContainsString('territories_root_kind_name_unique', $e->getMessage());
        } finally {
            DB::rollBack();
        }

        // Ichki hududni ota hudud o'chira olmaydi (restrictOnDelete)
        DB::beginTransaction();
        try {
            $region->delete();
            $this->fail("Ichki hududi bor viloyat o'chirildi");
        } catch (QueryException) {
            $this->assertTrue(true);
        } finally {
            DB::rollBack();
        }

        // Rollback faqat territories jadvalini olib tashlaydi, qayta up() ishlaydi; boshqa jadvallarga tegmaydi
        $orgs = Organization::count();
        $migration = require database_path('migrations/2026_11_08_000042_create_territories_table.php');
        $migration->down();
        $this->assertFalse(Schema::hasTable('territories'));
        $this->assertSame($orgs, Organization::count());
        $migration->up();
        $this->assertTrue(Schema::hasTable('territories'));
        $this->assertSame(0, Territory::count());
    }
}
