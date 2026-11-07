<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\OrganizationStatusChange;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AccountProvisioningService;
use App\Services\Export\XlsxWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;
use ZipArchive;

/**
 * Super Admin → Bog'chalar moduli: turi va holati, yaratish (rahbar akkaunti bilan, tranzaksiya), tahrirlash,
 * holat boshqaruvi va arxivlash, qidiruv/filtr/saralash/pagination, statistika, eksport, import, tafsilot,
 * ruxsatlar va tenant izolyatsiyasi.
 */
class OrganizationModuleTest extends TestCase
{
    use RefreshDatabase;

    private User $sa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'name'           => "Quyoshcha bog'chasi",
            'type'           => 'xususiy',
            'official_code'  => 'MTT-0012',
            'phone'          => '+998 (71) 123-45-67',
            'email'          => 'info@quyoshcha.uz',
            'website'        => 'quyoshcha.uz',
            'region'         => 'Toshkent shahri',
            'district'       => 'Chilonzor tumani',
            'mfy'            => 'Bunyodkor MFY',
            'street'         => "Qatortol ko'chasi, 12-uy",
            'address'        => "Toshkent shahri, Chilonzor tumani, Qatortol ko'chasi, 12-uy",
            'capacity'       => 150,
            'director_name'  => 'Karimova Dilnoza',
            'director_phone' => '90 123 45 67',
            'director_email' => 'dilnoza@quyoshcha.uz',
            'notes'          => 'Ingliz tili guruhi bor',
        ], $over);
    }

    private function list(string $qs = '')
    {
        return $this->as($this->sa)->getJson('/api/v1/super-admin/organizations' . ($qs ? "?{$qs}" : ''))->assertOk();
    }

    private function names($res): array
    {
        return array_column($res->json('data'), 'name');
    }

    // ── Yaratish ─────────────────────────────────────────────────────

    public function test_xususiy_bogcha_barcha_maydonlar_va_rahbar_akkaunti_bilan_yaratiladi(): void
    {
        $res = $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', $this->payload(['admin_username' => 'Quyoshcha.Rahbar']))
            ->assertCreated()
            ->assertJsonPath('data.admin.username', 'quyoshcha.rahbar')
            ->assertJsonPath('data.admin.name', 'Karimova Dilnoza');

        $org = Organization::findOrFail($res->json('data.id'));
        $this->assertSame(['xususiy', 'active', true, '+998711234567', '+998901234567', 'https://quyoshcha.uz', 150],
            [$org->type, $org->status, $org->is_active, $org->phone, $org->director_phone, $org->website, $org->capacity]);

        // Individual vaqtinchalik parol: hash qilingan, birinchi kirishda almashtiriladi, universal parol emas
        $temp  = $res->json('data.admin.temporary_password');
        $admin = User::where('username', 'quyoshcha.rahbar')->sole();
        $this->assertMatchesRegularExpression('/^[A-Za-z2-9]{12}$/', $temp);
        $this->assertNotSame('Kiddo123', $temp);
        $this->assertTrue(Hash::check($temp, $admin->password));
        $this->assertNotSame($temp, $admin->password);
        $this->assertTrue((bool) $admin->must_change_password);
        $this->assertSame([$org->id, User::ROLE_ADMIN], [$admin->organization_id, $admin->role]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'organization.created', 'organization_id' => $org->id]);
        $this->assertStringNotContainsString($temp, json_encode(ActivityLog::all()->toArray()));

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}")->assertOk()
            ->assertJsonPath('data.type_label', 'Xususiy')->assertJsonPath('data.status_label', 'Faol')
            ->assertJsonMissingPath('data.admins.0.temporary_password');
    }

    public function test_davlat_bogchasi_akkauntsiz_yaratiladi(): void
    {
        $id = $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', ['name' => '12-sonli DMTT', 'type' => 'davlat'])
            ->assertCreated()->assertJsonPath('data.admin', null)->json('data.id');

        $this->assertSame('davlat', Organization::find($id)->type);
        $this->assertSame(0, User::where('organization_id', $id)->count());
    }

    public function test_majburiy_maydonlar_va_ozbekcha_xatolar(): void
    {
        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', "Bog'cha nomini kiriting.")
            ->assertJsonPath('errors.type.0', 'Tashkilot turini tanlang: davlat yoki xususiy.');

        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', $this->payload([
            'type' => 'aralash', 'phone' => '123', 'director_phone' => '90 12', 'email' => 'yoq', 'capacity' => 0, 'admin_username' => '1abc',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['type', 'phone', 'director_phone', 'email', 'capacity', 'admin_username'])
            ->assertJsonPath('errors.phone.0', "Telefon raqami noto'g'ri. Masalan: +998 71 123 45 67");

        $this->assertSame(0, Organization::count());
    }

    public function test_takroriy_rasmiy_kod_va_telefon_rad_etiladi(): void
    {
        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', $this->payload())->assertCreated();

        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', $this->payload(['name' => 'Boshqa bog\'cha']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.official_code.0', 'Bu rasmiy kod boshqa bog\'chaga biriktirilgan.')
            ->assertJsonPath('errors.phone.0', 'Bu telefon raqami boshqa bog\'chada ko\'rsatilgan.');
    }

    public function test_akkaunt_yaratilmasa_bogcha_ham_saqlanmaydi_tranzaksiya(): void
    {
        $this->mock(AccountProvisioningService::class, function ($m) {
            $m->shouldReceive('createOrganizationAdmin')->andThrow(new RuntimeException('akkaunt xatosi'));
        });

        $this->withoutExceptionHandling();
        try {
            $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', $this->payload(['admin_username' => 'rahbar1']));
            $this->fail('Xato kutilgan edi');
        } catch (RuntimeException) {
        }

        $this->assertSame(0, Organization::withTrashed()->count());
        $this->assertDatabaseMissing('activity_logs', ['action' => 'organization.created']);
    }

    // ── Tahrirlash ───────────────────────────────────────────────────

    public function test_tahrirlash_va_audit_log_eski_yangi_qiymat_bilan(): void
    {
        $org = Organization::factory()->create(['name' => 'Eski nom', 'type' => 'davlat', 'district' => 'Yunusobod']);

        $this->as($this->sa)->putJson("/api/v1/super-admin/organizations/{$org->id}", [
            'name' => 'Yangi nom', 'type' => 'xususiy', 'district' => 'Chilonzor tumani', 'director_phone' => '+998 90 765 43 21',
        ])->assertOk()->assertJsonPath('data.type', 'xususiy')->assertJsonPath('data.name', 'Yangi nom');

        $log = ActivityLog::where('action', 'organization.updated')->sole();
        $this->assertSame(['old' => 'Eski nom', 'new' => 'Yangi nom'], $log->meta['changes']['name']);

        // Boshqa bog'chaning kodi bilan to'qnashuv
        Organization::factory()->create(['official_code' => 'KOD-1']);
        $this->as($this->sa)->putJson("/api/v1/super-admin/organizations/{$org->id}", ['official_code' => 'KOD-1'])
            ->assertJsonValidationErrors('official_code');
        $this->as($this->sa)->putJson("/api/v1/super-admin/organizations/{$org->id}", ['type' => 'boshqa'])
            ->assertJsonValidationErrors('type');
    }

    // ── Holat va arxivlash ───────────────────────────────────────────

    public function test_vaqtincha_toxtatish_sabab_muddat_tarix_sessiyalar_va_login(): void
    {
        $org   = Organization::factory()->create(['type' => 'davlat']);
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        $admin->createToken('web');

        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'suspended'])
            ->assertJsonValidationErrors('reason');
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'suspended', 'reason' => "To'lov masalasi", 'suspended_until' => '2000-01-01'])
            ->assertJsonValidationErrors('suspended_until');
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'inactive', 'reason' => 'Sabab', 'suspended_until' => now()->addDay()->toDateString()])
            ->assertJsonValidationErrors('suspended_until');

        $until = now()->addDays(10)->startOfMinute();
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", [
            'status' => 'suspended', 'reason' => "Hujjatlar tekshirilmoqda", 'suspended_until' => $until->toIso8601String(),
        ])->assertOk()->assertJsonPath('data.status', 'suspended')->assertJsonPath('data.status_label', "Vaqtincha to'xtatilgan");

        $org->refresh();
        $this->assertFalse($org->is_active);
        $this->assertSame("Hujjatlar tekshirilmoqda", $org->status_reason);
        $this->assertTrue($org->suspended_until->equalTo($until));
        $this->assertSame($this->sa->id, $org->status_changed_by);
        $this->assertSame(0, $admin->tokens()->count());                // sessiyalar bekor qilindi
        $this->assertFalse($admin->fresh()->canAuthenticate());          // login bloklangan
        $this->assertDatabaseHas('organization_status_changes', ['organization_id' => $org->id, 'from_status' => 'active', 'to_status' => 'suspended', 'changed_by' => $this->sa->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'organization.suspended', 'organization_id' => $org->id]);

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}/status-history")->assertOk()
            ->assertJsonPath('data.0.to_label', "Vaqtincha to'xtatilgan")->assertJsonPath('data.0.reason', 'Hujjatlar tekshirilmoqda')
            ->assertJsonPath('data.0.changed_by', $this->sa->name);

        // Muddat tugaganda scheduler avtomatik faollashtiradi
        $this->travelTo($until->copy()->addMinute());
        $this->artisan('kiddo:organizations:resume-suspended')->assertSuccessful();
        $this->assertSame('active', $org->fresh()->status);
        $this->assertTrue($admin->fresh()->canAuthenticate());
        $this->assertSame(2, OrganizationStatusChange::where('organization_id', $org->id)->count());
    }

    public function test_arxivlash_malumotlarni_saqlaydi_va_royxatdan_chiqaradi(): void
    {
        $org   = Organization::factory()->create(['name' => 'Arxiv bog\'cha', 'type' => 'davlat']);
        $group = Group::factory()->create(['organization_id' => $org->id]);
        $child = Child::factory()->create(['organization_id' => $org->id, 'group_id' => $group->id]);
        Attendance::create(['organization_id' => $org->id, 'group_id' => $group->id, 'child_id' => $child->id,
            'date' => now()->toDateString(), 'status' => Attendance::STATUS_PRESENT, 'marked_at' => now()]);
        Organization::factory()->create(['name' => 'Faol bog\'cha', 'type' => 'davlat']);

        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'archived', 'reason' => 'Faoliyatini tugatdi'])
            ->assertOk();

        $this->assertNotSoftDeleted($org);
        $this->assertSame([1, 1, 1], [Group::where('organization_id', $org->id)->count(), Child::where('organization_id', $org->id)->count(),
            Attendance::where('organization_id', $org->id)->count()]);

        $this->assertSame(["Faol bog'cha"], $this->names($this->list()));
        $this->assertSame(["Arxiv bog'cha"], $this->names($this->list('status=archived')));

        // Qayta faollashtirish
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'active'])->assertOk();
        $this->assertTrue($org->fresh()->is_active);
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/status", ['status' => 'active'])
            ->assertJsonValidationErrors('status');
    }

    public function test_eski_activate_deactivate_endpointlari_status_bilan_mos(): void
    {
        $org = Organization::factory()->create();
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/deactivate")->assertOk();
        $this->assertSame(['inactive', false], [$org->fresh()->status, $org->fresh()->is_active]);
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$org->id}/activate")->assertOk();
        $this->assertSame(['active', true], [$org->fresh()->status, $org->fresh()->is_active]);

        // Model darajasida ham sinxron (import, eski kod)
        $org->update(['is_active' => false]);
        $this->assertSame('inactive', $org->fresh()->status);
    }

    public function test_ochirish_faqat_nom_bilan_tasdiqlanganda_va_boglangan_malumot_bolmasa(): void
    {
        $empty = Organization::factory()->create(['name' => "Bo'sh bog'cha"]);
        $full  = Organization::factory()->create(['name' => "To'la bog'cha"]);
        Group::factory()->create(['organization_id' => $full->id]);

        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$empty->id}")->assertJsonValidationErrors('confirm_name');
        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$full->id}", ['confirm_name' => "To'la bog'cha"])
            ->assertStatus(422)->assertJsonPath('data.linked.guruhlar', 1);
        $this->assertNotSoftDeleted($full);

        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$empty->id}", ['confirm_name' => "  bo'sh BOG'CHA "])->assertOk();
        $this->assertSoftDeleted($empty);
        $this->assertDatabaseHas('activity_logs', ['action' => 'organization.deleted']);
    }

    // ── Ro'yxat: qidiruv, filtr, saralash, pagination ────────────────

    public function test_qidiruv_filtrlar_saralash_va_pagination(): void
    {
        $a = Organization::factory()->create(['name' => 'Alfa', 'type' => 'davlat', 'district' => 'Chilonzor tumani', 'director_name' => 'Karimova Dilnoza', 'phone' => '+998711111111', 'official_code' => 'K-777', 'created_at' => '2026-01-10']);
        $b = Organization::factory()->create(['name' => 'Beta', 'type' => 'xususiy', 'district' => 'Yunusobod tumani', 'director_phone' => '+998935554433', 'mfy' => 'Bodomzor MFY', 'created_at' => '2026-03-10']);
        $c = Organization::factory()->create(['name' => 'Gamma', 'type' => 'xususiy', 'district' => 'Chilonzor tumani', 'address' => "Navro'z ko'chasi", 'created_at' => '2026-05-10']);
        Organization::factory()->create(['name' => 'Test (DEV)', 'is_demo' => true, 'type' => 'xususiy']);
        $c->update(['status' => 'suspended']);
        $g = Group::factory()->create(['organization_id' => $b->id]);
        Child::factory()->count(3)->create(['organization_id' => $b->id, 'group_id' => $g->id, 'is_active' => true]);
        Child::factory()->create(['organization_id' => $a->id, 'group_id' => Group::factory()->create(['organization_id' => $a->id])->id, 'is_active' => true]);

        // Qidiruv backend'da: nom, mas'ul, telefon (raqamlar bo'yicha), MFY, manzil, rasmiy kod
        $this->assertSame(['Alfa'], $this->names($this->list('search=dilnoza')));
        $this->assertSame(['Alfa'], $this->names($this->list('search=' . urlencode('71 111-11'))));
        $this->assertSame(['Beta'], $this->names($this->list('search=555 44')));
        $this->assertSame(['Beta'], $this->names($this->list('search=bodomzor')));
        $this->assertSame(['Gamma'], $this->names($this->list('search=' . urlencode("navro'z"))));
        $this->assertSame(['Alfa'], $this->names($this->list('search=k-777')));

        // Bir nechta filtr birga
        $this->assertSame(['Gamma'], $this->names($this->list('type=xususiy&district=' . urlencode('chilonzor tumani'))));
        $this->assertSame(['Gamma'], $this->names($this->list('status=suspended')));
        $this->assertSame(['Beta', 'Alfa'], $this->names($this->list('status=active')));
        $this->assertSame(['Beta'], $this->names($this->list('created_from=2026-02-01&created_to=2026-04-01')));
        $this->assertSame(['Beta'], $this->names($this->list('children_min=2')));
        $this->assertSame(['Alfa'], $this->names($this->list('children_min=1&children_max=1')));
        $this->assertSame(['Test (DEV)'], $this->names($this->list('turi=demo')));

        // Saralash
        $this->assertSame(['Gamma', 'Beta', 'Alfa'], $this->names($this->list()));                      // yangi
        $this->assertSame(['Alfa', 'Beta', 'Gamma'], $this->names($this->list('sort=oldest')));
        $this->assertSame(['Alfa', 'Beta', 'Gamma'], $this->names($this->list('sort=name')));
        $this->assertSame(['Gamma', 'Beta', 'Alfa'], $this->names($this->list('sort=name_desc')));
        $this->assertSame(['Beta', 'Alfa', 'Gamma'], $this->names($this->list('sort=children_desc')));
        $this->assertSame('Gamma', $this->names($this->list('sort=children_asc'))[0]);
        $this->assertSame(['Alfa', 'Beta', 'Gamma'], $this->names($this->list('sort=name&direction=asc')));
        $this->assertSame(['Gamma', 'Alfa', 'Beta'], $this->names($this->list('sort=district&direction=asc')));  // teng qiymatda — yangi birinchi
        $this->assertSame(['Gamma', 'Beta', 'Alfa'], $this->names($this->list('sort=type&direction=desc')));

        // Pagination filtr bilan birga
        $p1 = $this->list('per_page=2&sort=name');
        $this->assertSame(['Alfa', 'Beta'], $this->names($p1));
        $p1->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.per_page', 2);
        $this->assertSame(['Gamma'], $this->names($this->list('per_page=2&page=2&sort=name')));
        $this->list('per_page=500')->assertJsonPath('meta.per_page', 100);

        // Hisoblanadigan sonlar real jadvallardan
        $beta = collect($this->list('search=beta')->json('data'))->sole();
        $this->assertSame([3, 1, 0], [$beta['children_count'], $beta['groups_count'], $beta['teachers_count']]);
    }

    public function test_statistika_va_filtr_qiymatlari(): void
    {
        Organization::factory()->count(2)->create(['type' => 'davlat', 'district' => 'Chilonzor tumani']);
        Organization::factory()->create(['type' => 'xususiy', 'region' => 'Toshkent shahri'])->update(['status' => 'suspended']);
        Organization::factory()->create(['type' => 'xususiy'])->update(['status' => 'archived']);
        Organization::factory()->create(['type' => 'davlat'])->update(['status' => 'inactive']);
        Organization::factory()->create(['type' => 'xususiy', 'is_demo' => true]);

        $this->as($this->sa)->getJson('/api/v1/super-admin/organizations/stats')->assertOk()
            ->assertJsonPath('data.total', 4)       // arxivlangan va demo hisobga kirmaydi
            ->assertJsonPath('data.davlat', 3)
            ->assertJsonPath('data.xususiy', 1)
            ->assertJsonPath('data.active', 2)
            ->assertJsonPath('data.inactive', 1)
            ->assertJsonPath('data.suspended', 1)
            ->assertJsonPath('data.archived', 1)
            ->assertJsonCount(4, 'data.recent');

        $this->as($this->sa)->getJson('/api/v1/super-admin/organizations/filter-options')->assertOk()
            ->assertJsonPath('data.districts', ['Chilonzor tumani'])
            ->assertJsonPath('data.regions', ['Toshkent shahri']);
    }

    // ── Eksport ──────────────────────────────────────────────────────

    public function test_excel_eksport_filtr_va_tanlangan_bogchalar(): void
    {
        $a = Organization::factory()->create(['name' => 'Alfa DMTT', 'type' => 'davlat']);
        $b = Organization::factory()->create(['name' => 'Beta xususiy', 'type' => 'xususiy']);

        $sheet = function (string $qs) {
            $res = $this->as($this->sa)->get("/api/v1/super-admin/organizations/export?{$qs}");
            $res->assertOk()->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            $zip = new ZipArchive();
            $this->assertTrue($zip->open($res->baseResponse->getFile()->getPathname()) === true);
            $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
            $zip->close();

            return $xml;
        };

        $all = $sheet('');
        $this->assertStringContainsString('Alfa DMTT', $all);
        $this->assertStringContainsString('Beta xususiy', $all);
        $this->assertStringContainsString('Davlat', $all);

        $filtered = $sheet('type=xususiy');
        $this->assertStringContainsString('Beta xususiy', $filtered);
        $this->assertStringNotContainsString('Alfa DMTT', $filtered);

        $selected = $sheet("ids={$a->id}");
        $this->assertStringContainsString('Alfa DMTT', $selected);
        $this->assertStringNotContainsString('Beta xususiy', $selected);

        $this->assertDatabaseHas('activity_logs', ['action' => 'organization.exported']);
    }

    // ── Import ───────────────────────────────────────────────────────

    public function test_import_tashkilot_turi_va_viloyat_bilan(): void
    {
        $path = (new XlsxWriter())->addSheet('Reyestr', [
            ['Muassasa nomi', 'Raqami', 'Manzili', 'MFY', 'Quvvati', 'Rahbar F.I.Sh.', 'Rahbar telefon raqami'],
            ['7-sonli DMTT', '7', "Markaz ko'chasi 1", 'Markaz MFY', 90, 'Aliyeva Malika', '+998901112233'],
        ])->save();
        $file = fn () => new UploadedFile($path, 'reyestr.xlsx', null, null, true);

        $this->as($this->sa)->post('/api/v1/super-admin/organizations/import/preview', ['file' => $file(), 'district' => "Bo'stonliq tumani", 'type' => 'boshqa'], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('type');

        $this->as($this->sa)->post('/api/v1/super-admin/organizations/import', [
            'file' => $file(), 'district' => "Bo'stonliq tumani", 'region' => 'Toshkent viloyati', 'rows' => [2],
        ], ['Accept' => 'application/json'])->assertCreated();

        $org = Organization::where('name', '7-sonli DMTT')->sole();
        $this->assertSame(['davlat', 'Toshkent viloyati', 'active'], [$org->type, $org->region, $org->status]);
    }

    // ── Tafsilot ─────────────────────────────────────────────────────

    public function test_tafsilot_guruhlar_tarbiyachilar_bolalar_agregat_va_davomat(): void
    {
        $org     = Organization::factory()->create(['type' => 'davlat']);
        $group   = Group::factory()->create(['organization_id' => $org->id, 'name' => 'Quyoshcha']);
        $teacher = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $teacher->groups()->attach($group->id, ['assigned_at' => now()]);
        Child::factory()->create(['organization_id' => $org->id, 'group_id' => $group->id, 'first_name' => 'Maxfiy', 'last_name' => 'Ismli', 'gender' => 'ayol', 'is_active' => true]);
        Child::factory()->create(['organization_id' => $org->id, 'group_id' => $group->id, 'gender' => 'erkak', 'is_active' => true]);

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}/groups")->assertOk()
            ->assertJsonPath('data.0.name', 'Quyoshcha')->assertJsonPath('data.0.children_count', 2)
            ->assertJsonPath('data.0.teachers.0', $teacher->user->name);

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}/teachers")->assertOk()
            ->assertJsonPath('data.0.name', $teacher->user->name)->assertJsonPath('data.0.groups.0', 'Quyoshcha');

        $summary = $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}/children-summary")->assertOk()
            ->assertJsonPath('data.faol', 2)->assertJsonPath('data.jins.qiz', 1)->assertJsonPath('data.jins.ogil', 1)
            ->assertJsonPath('data.guruhlar.0.group', 'Quyoshcha');
        // Shaxsiy ma'lumot (bola ismi, tibbiy eslatma) Super Admin'ga chiqmaydi
        $this->assertStringNotContainsString('Maxfiy', $summary->getContent());

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$org->id}/attendance?days=7")->assertOk()
            ->assertJsonStructure(['data' => [['sana', 'jami', 'keldi', 'kelmadi', 'sababli', 'belgilanmagan']]]);
    }

    // ── Ruxsatlar va tenant izolyatsiyasi ────────────────────────────

    public function test_faqat_super_admin_boshqaradi_boshqa_rollar_403_mehmon_401(): void
    {
        $org = Organization::factory()->create();
        $other = Organization::factory()->create();
        $admin   = User::factory()->admin()->create(['organization_id' => $org->id]);
        $teacher = User::factory()->teacher()->create(['organization_id' => $org->id]);

        $endpoints = [
            ['GET', '/api/v1/super-admin/organizations'],
            ['GET', '/api/v1/super-admin/organizations/stats'],
            ['GET', '/api/v1/super-admin/organizations/filter-options'],
            ['GET', '/api/v1/super-admin/organizations/export'],
            ['POST', '/api/v1/super-admin/organizations'],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}"],
            ['PUT', "/api/v1/super-admin/organizations/{$other->id}"],
            ['PATCH', "/api/v1/super-admin/organizations/{$other->id}/status"],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}/status-history"],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}/groups"],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}/teachers"],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}/children-summary"],
            ['GET', "/api/v1/super-admin/organizations/{$other->id}/attendance"],
            ['DELETE', "/api/v1/super-admin/organizations/{$other->id}"],
            ['GET', '/api/v1/super-admin/organizations/import/template'],
        ];

        foreach ($endpoints as [$method, $uri]) {
            $this->app['auth']->forgetGuards();
            $this->json($method, $uri)->assertUnauthorized();
            foreach ([$admin, $teacher] as $user) {
                $this->as($user)->json($method, $uri, ['status' => 'archived', 'reason' => 'xxx', 'name' => 'X', 'type' => 'davlat'])->assertForbidden();
            }
        }
        $this->assertSame('active', $other->fresh()->status);
        $this->assertSame(2, Organization::count());
    }

    public function test_policy_super_admin_dan_boshqaga_ruxsat_bermaydi(): void
    {
        $org = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);

        foreach (['viewAny', 'create', 'export', 'import'] as $ability) {
            $this->assertTrue($this->sa->can($ability, Organization::class));
            $this->assertFalse($admin->can($ability, Organization::class));
        }
        foreach (['view', 'update', 'changeStatus', 'delete'] as $ability) {
            $this->assertTrue($this->sa->can($ability, $org));
            $this->assertFalse($admin->can($ability, $org), "Rahbar o'z tashkilotida ham {$ability} qila olmaydi (Super Admin moduli)");
        }
    }

    public function test_tenant_izolyatsiyasi_url_va_body_orqali_boshqa_bogchaga_kirib_bolmaydi(): void
    {
        $a = Organization::factory()->create();
        $b = Organization::factory()->create();
        $adminA = User::factory()->admin()->create(['organization_id' => $a->id]);
        $groupB = Group::factory()->create(['organization_id' => $b->id]);
        $childB = Child::factory()->create(['organization_id' => $b->id, 'group_id' => $groupB->id]);

        // URL'da boshqa bog'cha bolasi ID'si — topilmaydi
        $this->as($adminA)->getJson("/api/v1/admin/children/{$childB->id}")->assertNotFound();
        // X-Impersonated-Org faqat Super Admin uchun — rahbar uchun e'tiborsiz
        $this->as($adminA)->withHeaders(['X-Impersonated-Org' => (string) $b->id])->getJson('/api/v1/admin/children')
            ->assertOk()->assertJsonMissing(['id' => $childB->id]);
        // Body'dagi organization_id e'tiborsiz — guruh o'z bog'chasida yaratiladi
        $this->as($adminA)->postJson('/api/v1/admin/groups', ['name' => 'Yangi guruh', 'age_category' => '3-4 yosh', 'capacity' => 20, 'organization_id' => $b->id])
            ->assertCreated();
        $this->assertSame($a->id, Group::where('name', 'Yangi guruh')->sole()->organization_id);
        $this->assertSame(1, Group::where('organization_id', $b->id)->count());

        // Bloklangan (to'xtatilgan) bog'cha rahbari API'dan foydalana olmaydi
        $adminA->createToken('web');
        $token = $adminA->createToken('web2')->plainTextToken;
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$a->id}/status", ['status' => 'suspended', 'reason' => "Tekshiruv"])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
        $this->postJson('/api/v1/login', ['login' => $adminA->phone, 'password' => 'password'])->assertUnprocessable();
    }

    // ── Yakuniy audit qo'shimchalari ─────────────────────────────────

    public function test_ommaviy_arxivlash_va_tiklash_xavfsiz(): void
    {
        $a = Organization::factory()->create(['name' => 'A']);
        $b = Organization::factory()->create(['name' => 'B']);
        $c = Organization::factory()->create(['name' => 'C']);
        $c->update(['status' => 'archived']);
        Group::factory()->create(['organization_id' => $a->id]);

        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations/bulk-status', ['ids' => [$a->id, $b->id], 'status' => 'archived'])
            ->assertJsonValidationErrors('reason');
        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations/bulk-status', ['ids' => [$a->id], 'status' => 'deleted', 'reason' => 'xxx'])
            ->assertJsonValidationErrors('status');

        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations/bulk-status', ['ids' => [$a->id, $b->id, $c->id, 99999], 'status' => 'archived', 'reason' => 'Mavsum yakunlandi'])
            ->assertOk()->assertJsonPath('data.changed', [$a->id, $b->id])->assertJsonPath('data.skipped', [$c->id, 99999]);

        $this->assertSame(['archived', 'archived'], [$a->fresh()->status, $b->fresh()->status]);
        $this->assertNotSoftDeleted($a);
        $this->assertSame(1, Group::where('organization_id', $a->id)->count());          // ma'lumot saqlangan
        $this->assertSame(2, OrganizationStatusChange::where('to_status', 'archived')->count());

        // Tiklash
        $this->as($this->sa)->postJson('/api/v1/super-admin/organizations/bulk-status', ['ids' => [$a->id, $b->id, $c->id], 'status' => 'active'])
            ->assertOk()->assertJsonCount(3, 'data.changed');
        $this->assertTrue($c->fresh()->is_active);

        $admin = User::factory()->admin()->create(['organization_id' => $a->id]);
        $this->as($admin)->postJson('/api/v1/super-admin/organizations/bulk-status', ['ids' => [$b->id], 'status' => 'archived', 'reason' => 'xxx'])
            ->assertForbidden();
        $this->assertSame('active', $b->fresh()->status);
    }

    public function test_mfy_viloyat_va_guruhlar_soni_filtrlari(): void
    {
        $a = Organization::factory()->create(['name' => 'Alfa', 'region' => 'Toshkent viloyati', 'mfy' => 'Bodomzor MFY']);
        $b = Organization::factory()->create(['name' => 'Beta', 'region' => 'Samarqand viloyati', 'mfy' => 'Markaz MFY']);
        Group::factory()->count(3)->create(['organization_id' => $a->id, 'is_active' => true]);
        Group::factory()->create(['organization_id' => $b->id, 'is_active' => true]);
        Group::factory()->create(['organization_id' => $b->id, 'is_active' => false]);

        $this->assertSame(['Alfa'], $this->names($this->list('mfy=bodomzor')));
        $this->assertSame(['Beta'], $this->names($this->list('region=' . urlencode('samarqand viloyati'))));
        $this->assertSame(['Alfa'], $this->names($this->list('groups_min=2')));
        $this->assertSame(['Beta'], $this->names($this->list('groups_max=1')));
        $this->assertSame([], $this->names($this->list('groups_min=2&region=' . urlencode('Samarqand viloyati'))));
    }

    public function test_import_har_qatorda_turi_ustuni_va_natija_hisoboti(): void
    {
        $path = (new XlsxWriter())->addSheet('Reyestr', [
            ['Muassasa nomi', 'Turi', 'Raqami', 'Manzili', 'MFY', 'Quvvati', 'Rahbar F.I.Sh.', 'Rahbar telefon raqami'],
            ['41-sonli DMTT', 'Davlat', '41', 'Markaz 1', 'Markaz MFY', 90, 'Aliyeva Malika', '+998901112241'],
            ['«Quyoshcha» xususiy MTT', 'Xususiy', '', 'Navro\'z 5', 'Navro\'z MFY', 60, 'Karimova Dilnoza', '+998901112242'],
            ['43-sonli DMTT', '', '43', 'Bog\' 3', 'Bog\' MFY', 80, 'Valiyeva Zarina', '+998901112243'],
            ['44-sonli DMTT', 'Aralash', '44', 'Bog\' 4', 'Bog\' MFY', 80, 'Rahimova Laylo', '+998901112244'],
        ])->save();
        $file = fn () => new UploadedFile($path, 'reyestr.xlsx', null, null, true);

        $rows = $this->as($this->sa)->post('/api/v1/super-admin/organizations/import/preview', ['file' => $file(), 'district' => "Bo'stonliq tumani"], ['Accept' => 'application/json'])
            ->assertOk()->json('data.rows');
        $byRow = collect($rows)->keyBy('row');
        $this->assertSame(['davlat', 'xususiy', null], [$byRow[2]['type'], $byRow[3]['type'], $byRow[4]['type']]);
        $this->assertSame('error', $byRow[5]['status']);
        $this->assertStringContainsString("Tashkilot turi noto'g'ri", implode(' ', $byRow[5]['errors']));

        // Faylda xatoli qator bor — import to'liq bloklanadi (xatoli qator tanlanmagan bo'lsa ham)
        $this->as($this->sa)->post('/api/v1/super-admin/organizations/import', [
            'file' => $file(), 'district' => "Bo'stonliq tumani", 'type' => 'xususiy', 'rows' => [2, 3, 4],
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonPath('data.reason', 'errors')->assertJsonCount(1, 'data.rejected')->assertJsonPath('data.rejected.0.row', 5);
        $this->assertSame(0, Organization::count());

        // Foydalanuvchi faylni tuzatib qayta yuklaydi (xatoli qator olib tashlangan)
        $fixed = (new XlsxWriter())->addSheet('Reyestr', [
            ['Muassasa nomi', 'Turi', 'Raqami', 'Manzili', 'MFY', 'Quvvati', 'Rahbar F.I.Sh.', 'Rahbar telefon raqami'],
            ['41-sonli DMTT', 'Davlat', '41', 'Markaz 1', 'Markaz MFY', 90, 'Aliyeva Malika', '+998901112241'],
            ['«Quyoshcha» xususiy MTT', 'Xususiy', '', 'Navro\'z 5', 'Navro\'z MFY', 60, 'Karimova Dilnoza', '+998901112242'],
            ['43-sonli DMTT', '', '43', 'Bog\' 3', 'Bog\' MFY', 80, 'Valiyeva Zarina', '+998901112243'],
            ['44-sonli DMTT', 'Davlat', '44', 'Bog\' 4', 'Bog\' MFY', 80, 'Rahimova Laylo', '+998901112244'],
        ])->save();
        $fixedFile = fn () => new UploadedFile($fixed, 'reyestr.xlsx', null, null, true);
        $preview = $this->as($this->sa)->post('/api/v1/super-admin/organizations/import/preview', ['file' => $fixedFile(), 'district' => "Bo'stonliq tumani"], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.can_import', true)->assertJsonPath('data.summary.error', 0);
        $warn = collect($preview->json('data.rows'))->where('status', 'warning')->pluck('row')->all();

        // 4 ta qatordan 3 tasi tanlanadi → 1 tasi o'tkazib yuboriladi; preview va natija soni mos
        $res = $this->as($this->sa)->post('/api/v1/super-admin/organizations/import', [
            'file' => $fixedFile(), 'district' => "Bo'stonliq tumani", 'type' => 'xususiy', 'rows' => [2, 3, 4], 'confirmed_rows' => $warn,
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.summary', ['total' => 4, 'created' => 3, 'skipped' => 1, 'errors' => 0]);
        $this->assertSame($preview->json('data.summary.total'), $res->json('data.summary.total'));

        $this->assertSame('davlat', Organization::where('name', '41-sonli DMTT')->value('type'));
        $this->assertSame('xususiy', Organization::where('name', '«Quyoshcha» xususiy MTT')->value('type'));
        $this->assertSame('xususiy', Organization::where('name', '43-sonli DMTT')->value('type'));  // bo'sh → formadagi standart
        $this->assertNull(Organization::where('name', '44-sonli DMTT')->first());                   // tanlanmagan
        $this->assertStringContainsString("1 ta qator o'tkazib yuborildi", $res->json('message'));
    }

    public function test_import_preview_ustun_nomi_majburiy_ustunlar_va_rasmiy_kod_takrori(): void
    {
        Organization::factory()->create(['name' => 'Mavjud', 'official_code' => 'MTT-100']);
        $path = (new XlsxWriter())->addSheet('Reyestr', [
            ['Muassasa nomi', 'Rasmiy kod', 'Quvvati', 'Rahbar telefoni'],
            ['A bog\'cha', 'MTT-200', 'yuzta', '+998901112251'],
            ['B bog\'cha', 'MTT-200', '50', '+998901112251'],
            ['C bog\'cha', 'mtt-100', '50', '90 12'],
            ['', 'MTT-300', '50', ''],
        ])->save();

        $data = $this->as($this->sa)->post('/api/v1/super-admin/organizations/import/preview',
            ['file' => new UploadedFile($path, 'r.xlsx', null, null, true), 'district' => 'Yunusobod tumani'], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.can_import', false)->assertJsonPath('data.summary.error', 4)->json('data');

        // Ustunlar: majburiy/ixtiyoriy va faylda topilgan sarlavha
        $cols = collect($data['columns'])->keyBy('field');
        $this->assertSame([true, 'Muassasa nomi'], [$cols['name']['required'], $cols['name']['header']]);
        $this->assertSame([false, 'Rasmiy kod'], [$cols['official_code']['required'], $cols['official_code']['header']]);
        $this->assertSame([false, null], [$cols['address']['required'], $cols['address']['header']]);   // faylda yo'q
        $this->assertSame('Rahbar telefoni', $cols['director_phone']['header']);

        $rows = collect($data['rows'])->keyBy('row');
        $issue = fn (int $row, string $field) => collect($rows[$row]['issues'])->firstWhere('field', $field);

        $this->assertSame(['error', 'Quvvati'], [$issue(2, 'capacity')['level'], $issue(2, 'capacity')['column']]);
        $this->assertStringContainsString('musbat butun son', $issue(2, 'capacity')['message']);
        $this->assertSame('Rasmiy kod', $issue(2, 'official_code')['column']);
        $this->assertStringContainsString('3-qator', $issue(2, 'official_code')['message']);           // fayl ichidagi takror
        $this->assertStringContainsString('#', $issue(4, 'official_code')['message']);                 // bazadagi kod (katta-kichik harfsiz)
        $this->assertSame('Rahbar telefoni', $issue(4, 'director_phone')['column']);
        $this->assertSame(['warning', 'Rahbar telefoni'], [$issue(3, 'director_phone')['level'], $issue(3, 'director_phone')['column']]); // takroriy telefon
        $this->assertSame('Muassasa nomi', $issue(5, 'name')['column']);
        // Eski matnli ro'yxat saqlangan (orqaga moslik)
        $this->assertNotEmpty($rows[2]['errors']);
    }

    public function test_eksportda_parol_va_autentifikatsiya_malumoti_yoq(): void
    {
        $org = Organization::factory()->create(['name' => 'Maxfiy test', 'type' => 'xususiy']);
        $admin = User::factory()->admin()->create(['organization_id' => $org->id, 'password' => Hash::make('SirliParol123')]);

        $res = $this->as($this->sa)->get('/api/v1/super-admin/organizations/export?type=xususiy')->assertOk();
        $zip = new ZipArchive();
        $zip->open($res->baseResponse->getFile()->getPathname());
        $xml = $zip->getFromName('xl/worksheets/sheet1.xml') . $zip->getFromName('xl/sharedStrings.xml');
        $zip->close();
        $this->assertStringContainsString('Maxfiy test', $xml);
        $this->assertStringContainsString('Xususiy', $xml);
        $this->assertStringNotContainsString($admin->password, $xml);
        $this->assertStringNotContainsString('SirliParol123', $xml);
        $this->assertStringNotContainsString('$2y$', $xml);
    }

    public function test_super_admin_korish_rejimi_yozishni_bloklaydi_va_audit_qiladi(): void
    {
        $org   = Organization::factory()->create();
        $group = Group::factory()->create(['organization_id' => $org->id, 'name' => 'Asl nom']);
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        $h = ['X-Impersonated-Org' => (string) $org->id];

        $this->as($this->sa)->withHeaders($h)->getJson('/api/v1/admin/groups')->assertOk()->assertJsonFragment(['name' => 'Asl nom']);
        foreach ([['POST', '/api/v1/admin/groups'], ['PUT', "/api/v1/admin/groups/{$group->id}"], ['DELETE', "/api/v1/admin/groups/{$group->id}"]] as [$m, $u]) {
            $this->as($this->sa)->withHeaders($h)->json($m, $u, ['name' => 'Yangi', 'age_category' => '3-4 yosh', 'capacity' => 10])->assertForbidden();
        }
        $this->assertSame('Asl nom', $group->fresh()->name);
        $this->assertNotSoftDeleted($group);
        $this->assertSame(3, ActivityLog::where('action', 'super_admin.readonly_blocked')->where('organization_id', $org->id)->count());

        // Kirish ham audit qilinadi
        $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$org->id}/enter")->assertOk();
        $this->assertDatabaseHas('activity_logs', ['action' => 'organization.entered', 'organization_id' => $org->id, 'user_id' => $this->sa->id]);

        // Rahbar o'z panelida odatdagidek ishlaydi
        $this->as($admin)->putJson("/api/v1/admin/groups/{$group->id}", ['name' => 'Rahbar o\'zgartirdi', 'age_category' => '3-4 yosh', 'capacity' => 10])->assertOk();
        $this->assertSame("Rahbar o'zgartirdi", $group->fresh()->name);
    }
}
