<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use App\Services\Export\XlsxWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use ZipArchive;

/**
 * DMTT larini Excel orqali import: preview bazaga yozmaydi, import alohida tenant yaratadi,
 * Excel'dagi asl qiymatlar o'zgarmasdan saqlanadi. Test ma'lumotlari — to'qima (haqiqiy shaxslar emas).
 */
class OrganizationImportTest extends TestCase
{
    use RefreshDatabase;

    private const DISTRICT = "Bo'stonliq tumani";

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    private function xlsx(array $rows): UploadedFile
    {
        $path = (new XlsxWriter())->addSheet('Reyestr', $rows)->save();

        return new UploadedFile($path, 'dmtt.xlsx', null, null, true);
    }

    /**
     * Viloyat reyestri ko'rinishidagi fayl: 1- va 3-qatorlar bo'sh (Excel ularni yozmaydi), 2-qatorda sarlavha,
     * 4-qatorda ustunlar, sharedStrings orqali matnlar — haqiqiy fayl tuzilishi bilan bir xil.
     *
     * @param array<int, array<int, string>> $rowsByNumber Excel qator raqami → kataklar
     */
    private function registryXlsx(array $rowsByNumber): UploadedFile
    {
        $strings = [];
        $sheet   = '';
        foreach ($rowsByNumber as $r => $cells) {
            $sheet .= '<row r="' . $r . '">';
            foreach (array_values($cells) as $c => $value) {
                $strings[] = $value;
                $sheet .= '<c r="' . chr(65 + $c) . $r . '" t="s"><v>' . (count($strings) - 1) . '</v></c>';
            }
            $sheet .= '</row>';
        }
        $sst = implode('', array_map(fn ($s) => '<si><t xml:space="preserve">' . htmlspecialchars($s, ENT_XML1) . '</t></si>', $strings));

        $path = tempnam(sys_get_temp_dir(), 'dmtt');
        $zip  = new ZipArchive();
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        $zip->addFromString('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . $sst . '</sst>');
        $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' . $sheet . '</sheetData></worksheet>');
        $zip->close();
        $this->beforeApplicationDestroyed(fn () => @unlink($path));

        return new UploadedFile($path, 'Дислокация (test).xlsx', null, null, true);
    }

    private function registryRows(): array
    {
        return [
            2 => ["Toshkent viloyati maktabgacha ta'lim tashkilotlari to'g'risida ma'lumot"],
            4 => ['№', 'Muassasa nomi', 'Manzili', 'Quvvati', 'Rahbari (F.I.SH)', 'Telefon raqami'],
            5 => ['1', '1-sonli DMTT', 'Olmazor MFY Bogʻ koʻchasi', '180', 'Testova Anora Testovna', '33/111-22-33'],
            6 => ['2', '2-sonli DMTT', "Yangiobod MFY  Navro'z ko'chasi 5 uy", '120', "Sinovova  Ra'no ", '99/444-55-66'],
            7 => ['3', '3-sonli DMTT', "Olmazor MFY Bahor ko'chasi", '90', 'Testova Anora Testovna', '90/777-88-99'],
        ];
    }

    private function header(): array
    {
        return ['T/r', 'Muassasa nomi', 'Raqami', 'Manzili', 'MFY', 'Quvvati', 'Rahbar F.I.Sh.', 'Rahbar telefon raqami'];
    }

    private function preview(UploadedFile $file)
    {
        return $this->actingAs($this->superAdmin, 'sanctum')
            ->post('/api/v1/super-admin/organizations/import/preview', ['file' => $file, 'district' => self::DISTRICT], ['Accept' => 'application/json']);
    }

    private function commit(UploadedFile $file, array $rows, array $confirmed = [])
    {
        return $this->actingAs($this->superAdmin, 'sanctum')->post('/api/v1/super-admin/organizations/import', [
            'file'           => $file,
            'district'       => self::DISTRICT,
            'rows'           => $rows,
            'confirmed_rows' => $confirmed,
        ], ['Accept' => 'application/json']);
    }

    public function test_reyestr_fayli_qator_raqami_mfy_raqam_va_asl_qiymatlar_bilan_oqiladi(): void
    {
        $before = [Organization::count(), User::count(), ActivityLog::count()];

        $res  = $this->preview($this->registryXlsx($this->registryRows()))->assertOk();
        $rows = $res->json('data.rows');

        // Qator raqamlari Excel'dagi bilan bir xil (bo'sh 1- va 3-qatorlar hisobga olingan)
        $this->assertSame([5, 6, 7], array_column($rows, 'row'));

        $this->assertSame('1', $rows[0]['number']);                     // nomdan («1-sonli»), «№» ustunidan emas
        $this->assertSame(['number' => 'name', 'mfy' => 'address'], $rows[0]['derived']);
        $this->assertSame('Olmazor MFY', $rows[0]['mfy']);
        $this->assertSame('Olmazor MFY Bogʻ koʻchasi', $rows[0]['address']); // manzil to'liq saqlanadi
        $this->assertSame(180, $rows[0]['capacity']);
        $this->assertSame('Testova Anora Testovna', $rows[0]['director_name']);
        $this->assertSame('+998331112233', $rows[0]['director_phone']);

        // Tozalangan qiymat va asl qiymat alohida
        $this->assertSame("Sinovova Ra'no", $rows[1]['director_name']);
        $this->assertSame("Sinovova  Ra'no ", $rows[1]['source']['Rahbari (F.I.SH)']);
        $this->assertSame("Yangiobod MFY  Navro'z ko'chasi 5 uy", $rows[1]['source']['Manzili']);
        $this->assertSame('Yangiobod MFY', $rows[1]['mfy']);
        $this->assertSame('99/444-55-66', $rows[1]['source']['Telefon raqami']);

        // Bir xil rahbar F.I.Sh. — ikkala qatorda ogohlantirish, xato emas
        $this->assertSame(['warning', 'ok', 'warning'], array_column($rows, 'status'));
        $this->assertStringContainsString('7-qatordagi', $rows[0]['warnings'][0]);
        $this->assertStringContainsString('5-qatordagi', $rows[2]['warnings'][0]);
        $this->assertSame([], $rows[0]['missing']);

        $this->assertSame($before, [Organization::count(), User::count(), ActivityLog::count()]);
    }

    public function test_import_tozalangan_qiymatlarni_maydonlarga_asl_qiymatlarni_import_source_ga_yozadi(): void
    {
        $users = User::count();
        $file  = $this->registryXlsx($this->registryRows());
        $this->preview($file)->assertOk();

        // Ogohlantirishli qatorlar (bir xil rahbar) tasdiqsiz — rad etiladi, hech narsa yaratilmaydi
        $this->commit($file, [5, 6, 7])->assertStatus(422)->assertJsonCount(2, 'data.rejected');
        $this->assertSame(0, Organization::where('district', self::DISTRICT)->count());

        // Faylda yo'q qator tanlansa — rad etiladi
        $this->commit($file, [5, 6, 99], [5])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'mos kelmadi'));

        $created = $this->commit($file, [5, 6, 7], [5, 7])->assertCreated()->json('data.created');
        $this->assertCount(3, $created);

        // Har biri alohida tenant; bir xil rahbar bo'lsa ham birlashtirilmaydi
        $orgs = Organization::whereIn('id', array_column($created, 'id'))->orderBy('id')->get();
        $this->assertCount(3, $orgs->pluck('id')->unique());

        $second = $orgs[1];
        $this->assertSame(['2-sonli DMTT', '2', 'Yangiobod MFY', "Yangiobod MFY Navro'z ko'chasi 5 uy", 120, "Sinovova Ra'no", '+998994445566', null, self::DISTRICT],
            [$second->name, $second->number, $second->mfy, $second->address, $second->capacity, $second->director_name, $second->director_phone, $second->phone, $second->district]);
        $this->assertSame('Дислокация (test).xlsx', $second->import_source['file']);
        $this->assertSame(6, $second->import_source['row']);
        $this->assertSame("Sinovova  Ra'no ", $second->import_source['values']['Rahbari (F.I.SH)']);
        $this->assertSame('2', $second->import_source['values']['№']);
        $this->assertSame(['number' => 'name', 'mfy' => 'address'], $second->import_source['derived']);

        // Rahbarlarga login/parol yaratilmaydi
        $this->assertSame($users, User::count());
        $this->assertSame(0, User::whereIn('organization_id', $orgs->pluck('id'))->count());
        $this->assertSame(3, ActivityLog::where('action', 'organization.created')->whereIn('organization_id', $orgs->pluck('id'))->count());

        // Qayta import — raqamlar endi bazada bor
        $this->commit($file, [5, 6, 7], [5, 7])->assertStatus(422);
        $this->assertSame(3, Organization::where('district', self::DISTRICT)->count());
    }

    public function test_yetishmayotgan_maydonlar_toldirilmaydi_faqat_belgilanadi(): void
    {
        $rows = $this->preview($this->registryXlsx([
            4 => ['№', 'Muassasa nomi', 'Manzili', 'Quvvati', 'Rahbari (F.I.SH)', 'Telefon raqami'],
            5 => ['1', 'Quyosh DMTT', "Markaz ko'chasi", '', '', ''],
        ]))->assertOk()->json('data.rows');

        $this->assertSame(['number', 'mfy', 'capacity', 'director_name', 'director_phone'], $rows[0]['missing']);
        $this->assertNull($rows[0]['number']);
        $this->assertNull($rows[0]['mfy']);
        $this->assertSame('warning', $rows[0]['status']); // raqamsiz — takrorni faqat nom bo'yicha tekshirib bo'ladi
    }

    public function test_preview_maydonlarni_normallashtiradi_va_bazaga_yozmaydi(): void
    {
        $before = [Organization::count(), User::count(), ActivityLog::count()];

        $res = $this->preview($this->xlsx([
            ["Bo'stonliq tumani DMTT reyestri"],
            $this->header(),
            [1, '1-sonli DMTT', '№ 1', "G'azalkent sh., Navro'z ko'chasi 5", "Navro'z MFY", '120', 'Aliyeva Malika', '90 123 45 67'],
            [2, '2-sonli DMTT', '2-son', 'Chorvoq sh.', 'Chorvoq MFY', 80, 'Karimova Dilnoza', '+998 (91) 765-43-21'],
            [],
        ]))->assertOk();

        $res->assertJsonPath('data.summary', ['total' => 2, 'ok' => 2, 'warning' => 0, 'error' => 0])
            ->assertJsonPath('data.rows.0.row', 3)
            ->assertJsonPath('data.rows.0.number', '1')
            ->assertJsonPath('data.rows.0.derived', [])
            ->assertJsonPath('data.rows.0.capacity', 120)
            ->assertJsonPath('data.rows.0.director_phone', '+998901234567')
            ->assertJsonPath('data.rows.0.mfy', "Navro'z MFY")
            ->assertJsonPath('data.rows.1.number', '2')
            ->assertJsonPath('data.rows.1.director_phone', '+998917654321');

        $this->assertSame($before, [Organization::count(), User::count(), ActivityLog::count()]);
    }

    public function test_takroriy_va_notogri_qatorlar_aniqlanadi(): void
    {
        Organization::factory()->create(['name' => '5-sonli DMTT', 'district' => self::DISTRICT, 'number' => '5']);
        Organization::factory()->create(['name' => 'Quyoshcha bog\'chasi']);
        // Boshqa tumandagi 7-raqam — takror emas
        Organization::factory()->create(['name' => '7-sonli DMTT (Chirchiq)', 'district' => 'Chirchiq shahri', 'number' => '7']);

        $rows = $this->preview($this->xlsx([
            $this->header(),
            [1, '5-sonli DMTT', '5', '', '', '', '', ''],               // bazada bor → error
            [2, '6-sonli DMTT', '6', '', '', '', '', ''],               // ok
            [3, '6-sonli DMTT (filial)', '6', '', '', '', '', ''],      // fayl ichida raqam takrori → error
            [4, "Quyoshcha bog‘chasi", '8', '', '', '', '', ''],        // nom bazada bor (apostrof boshqa) → warning
            [5, '', '9', '', '', 'ko\'p', '', '12345'],                 // nom yo'q, quvvat va telefon xato
            [6, '7-sonli DMTT', '7', '', '', '', '', ''],               // boshqa tumanda — ok
            [7, '10-sonli DMTT', '11', '', '', '', '', ''],             // ustundagi raqam nomdagidan farq qiladi → warning
        ]))->assertOk()->json('data.rows');

        $this->assertSame(['error', 'ok', 'error', 'warning', 'error', 'ok', 'warning'], array_column($rows, 'status'));
        $this->assertStringContainsString('allaqachon mavjud', $rows[0]['errors'][0]);
        $this->assertStringContainsString('3-qator', $rows[2]['errors'][0]); // 6-raqam birinchi marta 3-qatorda
        $this->assertStringContainsString('bazada bor', $rows[3]['warnings'][0]);
        $this->assertCount(3, $rows[4]['errors']);
        $this->assertStringContainsString('farq qiladi', $rows[6]['warnings'][0]);
    }

    public function test_bazadagi_rahbar_va_telefon_bilan_moslik_ogohlantiriladi(): void
    {
        Organization::factory()->create(['name' => 'Eski DMTT', 'director_name' => 'Testova Anora Testovna', 'director_phone' => '+998994445566']);

        $rows = $this->preview($this->registryXlsx([
            4 => ['№', 'Muassasa nomi', 'Manzili', 'Quvvati', 'Rahbari (F.I.SH)', 'Telefon raqami'],
            5 => ['1', '1-sonli DMTT', 'Olmazor MFY', '100', 'Testova  Anora Testovna', '99/444-55-66'],
        ]))->json('data.rows');

        $this->assertSame('warning', $rows[0]['status']);
        $this->assertCount(2, $rows[0]['warnings']);
    }

    public function test_csv_nuqtali_vergul_bilan_oqiladi(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'csv');
        file_put_contents($path, "\xEF\xBB\xBFMuassasa nomi;Raqami;Quvvati;Rahbar telefon raqami\n3-sonli DMTT;3;45;998933333333\n");

        $this->preview(new UploadedFile($path, 'dmtt.csv', 'text/csv', null, true))
            ->assertOk()
            ->assertJsonPath('data.rows.0.row', 2)
            ->assertJsonPath('data.rows.0.name', '3-sonli DMTT')
            ->assertJsonPath('data.rows.0.capacity', 45)
            ->assertJsonPath('data.rows.0.director_phone', '+998933333333');
    }

    public function test_sarlavhasiz_yoki_notogri_fayl_rad_etiladi(): void
    {
        $this->preview($this->xlsx([['Ustun A', 'Ustun B'], ['x', 'y']]))
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Sarlavha'));

        $this->preview(UploadedFile::fake()->create('dmtt.pdf', 10, 'application/pdf'))
            ->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_namuna_fayl_yuklab_olinadi(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->get('/api/v1/super-admin/organizations/import/template')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    public function test_faqat_super_admin_import_qila_oladi(): void
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/super-admin/organizations/import', ['district' => self::DISTRICT, 'rows' => [2]])
            ->assertForbidden();
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/super-admin/organizations/import/template')
            ->assertForbidden();
    }

    /**
     * Haqiqiy Bo'stonliq fayli bilan quruq tekshiruv (faqat preview, bazaga yozilmaydi).
     * Fayl repoga kiritilmaydi (shaxsiy ma'lumotlar): DMTT_IMPORT_FILE=/yo'l/fayl.xlsx bilan ishga tushiriladi.
     */
    public function test_bostonliq_fayli_preview(): void
    {
        $path = getenv('DMTT_IMPORT_FILE');
        if (! $path || ! is_file($path)) {
            $this->markTestSkipped('DMTT_IMPORT_FILE berilmagan.');
        }

        $res  = $this->preview(new UploadedFile($path, basename($path), null, null, true))->assertOk();
        $rows = $res->json('data.rows');

        $this->assertSame(['total' => 28, 'ok' => 26, 'warning' => 2, 'error' => 0], $res->json('data.summary'));
        $this->assertSame(range(5, 32), array_column($rows, 'row'));
        $this->assertSame(array_map('strval', range(1, 28)), array_column($rows, 'number'));
        $this->assertSame(4910, array_sum(array_column($rows, 'capacity')));
        $this->assertSame([5, 27], array_column(array_filter($rows, fn ($r) => $r['status'] === 'warning'), 'row'));
        foreach ($rows as $r) {
            $this->assertSame([], $r['missing'], "{$r['row']}-qator");
            $this->assertMatchesRegularExpression('/^\+998\d{9}$/', $r['director_phone']);
            $this->assertStringEndsWith('MFY', $r['mfy']);
            $this->assertSame($r['source']['Manzili'] !== $r['address'], preg_match('/\s{2,}|^\s|\s$/u', $r['source']['Manzili']) === 1);
        }
        $this->assertSame(0, Organization::where('district', self::DISTRICT)->count());
    }
}
