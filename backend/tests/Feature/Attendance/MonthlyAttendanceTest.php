<?php

namespace Tests\Feature\Attendance;

use App\Models\ActivityLog;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use ZipArchive;

/**
 * Oylik davomat tarixi va Excel/PDF eksport: GET /v1/{teacher|admin}/attendance/monthly|export
 * 2026-yil oktabr: 1-oktabr — payshanba; 3,4,10,11,17,18,24,25 — dam olish kunlari.
 */
class MonthlyAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $user;
    private Group $group;
    private Group $otherGroup;
    private Child $ali;
    private Child $vali;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));

        $this->org   = Organization::factory()->create(['name' => "Quyoshcha bog'chasi"]);
        $this->user  = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $teacher     = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->group      = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->otherGroup = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Oy']);
        $teacher->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);

        $this->ali  = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Ali', 'last_name' => 'Valiyev']);
        $this->vali = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Vali', 'last_name' => 'Aliyev']);

        foreach ([['2026-10-01', 'present'], ['2026-10-02', 'absent'], ['2026-10-05', 'present']] as [$d, $s]) {
            Attendance::factory()->create(['child_id' => $this->ali->id, 'group_id' => $this->group->id, 'date' => $d, 'status' => $s]);
        }
        Attendance::factory()->create([
            'child_id' => $this->vali->id, 'group_id' => $this->group->id, 'date' => '2026-10-01',
            'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma',
        ]);
    }

    private function fetch(string $url, ?User $as = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($as ?? $this->user, 'sanctum')->getJson($url);
    }

    // ── Oylik ko'rinish ───────────────────────────────────────────

    public function test_oylik_matritsa_va_jami(): void
    {
        $res = $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10')->assertOk()
            ->assertJsonPath('organization.name', "Quyoshcha bog'chasi")
            ->assertJsonPath('group.name', 'Quyosh')
            ->assertJsonPath('from', '2026-10-01')
            ->assertJsonPath('to', '2026-10-31')
            ->assertJsonCount(31, 'days')
            ->assertJsonPath('days.2.weekend', true)       // 3-oktabr shanba
            ->assertJsonPath('days.28.future', true);      // 29-oktabr

        // 1–28 oktabr: 28 kun − 8 dam olish kuni = 20 ish kuni
        $res->assertJsonPath('totals.working_days', 20);

        $rows = collect($res->json('children'))->keyBy('first_name');
        $this->assertSame(['present' => 2, 'absent' => 1, 'excused' => 0, 'unmarked' => 17], $rows['Ali']['totals']);
        $this->assertSame(['present' => 0, 'absent' => 0, 'excused' => 1, 'unmarked' => 19], $rows['Vali']['totals']);
        $this->assertSame('absent', $rows['Ali']['days']['2026-10-02']['status']);
        $this->assertSame('kasallik', $rows['Vali']['days']['2026-10-01']['excuse_reason']);

        $res->assertJsonPath('totals.present', 2)->assertJsonPath('totals.excused', 1)
            ->assertJsonPath('excused_notes.0.child_name', 'Aliyev Vali')
            ->assertJsonPath('excused_notes.0.note', 'Isitma');
    }

    public function test_sana_oraligi_va_bitta_bola_filtri(): void
    {
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10&from=2026-10-01&to=2026-10-02')->assertOk()
             ->assertJsonCount(2, 'days')
             ->assertJsonPath('totals.working_days', 2);

        $this->fetch("/api/v1/teacher/attendance/monthly?month=2026-10&child_id={$this->ali->id}")->assertOk()
             ->assertJsonCount(1, 'children')
             ->assertJsonPath('children.0.first_name', 'Ali');

        $foreign = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->otherGroup->id]);
        $this->fetch("/api/v1/teacher/attendance/monthly?month=2026-10&child_id={$foreign->id}")->assertNotFound();
    }

    public function test_validatsiya(): void
    {
        $this->fetch('/api/v1/teacher/attendance/monthly')->assertUnprocessable();
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-13')->assertUnprocessable();
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-11')->assertUnprocessable();                      // kelajak oyi
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10&from=2026-09-30')->assertUnprocessable();      // oydan tashqari
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10&from=2026-10-10&to=2026-10-05')->assertUnprocessable();
    }

    public function test_guruhdan_chiqqan_bolaning_tarixi_saqlanadi(): void
    {
        $this->vali->update(['group_id' => $this->otherGroup->id]);

        $names = collect($this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10')->json('children'))->pluck('first_name');
        $this->assertContains('Vali', $names->all());
    }

    // ── Ruxsat va izolyatsiya ─────────────────────────────────────

    public function test_tarbiyachi_faqat_oz_guruhini_koradi(): void
    {
        $this->fetch("/api/v1/teacher/attendance/monthly?month=2026-10&group_id={$this->otherGroup->id}")->assertNotFound();
        $this->fetch("/api/v1/teacher/attendance/export?format=xlsx&month=2026-10&group_id={$this->otherGroup->id}")->assertNotFound();

        $foreignGroup = Group::factory()->create();
        $this->fetch("/api/v1/teacher/attendance/monthly?month=2026-10&group_id={$foreignGroup->id}")->assertNotFound();
    }

    public function test_boshqa_rollar_va_autentifikatsiyasiz(): void
    {
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/teacher/attendance/monthly?month=2026-10')->assertUnauthorized();
        $this->getJson('/api/v1/teacher/attendance/export?format=pdf&month=2026-10')->assertUnauthorized();

        $parent = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10', $parent)->assertForbidden();
        $this->fetch('/api/v1/admin/attendance/export?format=pdf&month=2026-10', $parent)->assertForbidden();
        $this->fetch('/api/v1/admin/attendance/monthly?month=2026-10', $this->user)->assertForbidden();
    }

    public function test_admin_oz_bogchasi_guruhlarini_koradi_boshqa_bogchani_yoq(): void
    {
        $admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->fetch("/api/v1/admin/attendance/monthly?month=2026-10&group_id={$this->group->id}", $admin)->assertOk()
             ->assertJsonCount(2, 'groups')->assertJsonPath('totals.present', 2);

        $foreignGroup = Group::factory()->create();
        $this->fetch("/api/v1/admin/attendance/monthly?month=2026-10&group_id={$foreignGroup->id}", $admin)->assertNotFound();
        $this->fetch("/api/v1/admin/attendance/export?format=xlsx&month=2026-10&group_id={$foreignGroup->id}", $admin)->assertNotFound();
    }

    public function test_nofaol_tarbiyachi_403(): void
    {
        TeacherProfile::where('user_id', $this->user->id)->update(['is_active' => false]);
        $this->fetch('/api/v1/teacher/attendance/monthly?month=2026-10')->assertForbidden();
    }

    // ── Eksport ───────────────────────────────────────────────────

    public function test_excel_eksport_mazmuni(): void
    {
        $this->app['auth']->forgetGuards();
        $res = $this->actingAs($this->user, 'sanctum')->get('/api/v1/teacher/attendance/export?format=xlsx&month=2026-10');
        $res->assertOk()->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('davomat-Quyosh-2026-10.xlsx', $res->headers->get('Content-Disposition'));

        $file = $res->baseResponse->getFile()->getPathname();
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($file) === true);
        $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');
        $notes = $zip->getFromName('xl/worksheets/sheet2.xml');
        $zip->close();

        $this->assertStringContainsString("Quyoshcha bog&apos;chasi", $sheet);
        $this->assertStringContainsString('Guruh: Quyosh', $sheet);
        $teacher = TeacherProfile::where('user_id', $this->user->id)->sole();
        $this->assertStringContainsString("Tarbiyachi: {$teacher->last_name} {$teacher->first_name}", $sheet);
        $this->assertStringContainsString('Oktabr 2026', $sheet);
        $this->assertStringContainsString('Valiyev Ali', $sheet);
        $this->assertStringContainsString('Isitma', $notes);
        $this->assertStringContainsString('Kasallik', $notes);

        $this->assertDatabaseHas('activity_logs', ['action' => 'attendance.exported', 'organization_id' => $this->org->id]);
    }

    public function test_pdf_eksport(): void
    {
        $this->app['auth']->forgetGuards();
        $res = $this->actingAs($this->user, 'sanctum')->get('/api/v1/teacher/attendance/export?format=pdf&month=2026-10');
        $res->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment; filename="davomat-Quyosh-2026-10.pdf"', $res->headers->get('Content-Disposition'));

        $pdf = $res->getContent();
        $this->assertStringStartsWith('%PDF-1.4', $pdf);
        $this->assertStringEndsWith('%%EOF', $pdf);
        $this->assertStringContainsString('(Guruh: Quyosh)', $pdf);
        $this->assertStringContainsString('Valiyev Ali', $pdf);
        $this->assertStringContainsString('(Isitma)', $pdf);
    }

    public function test_eksport_formati_validatsiyasi(): void
    {
        $this->fetch('/api/v1/teacher/attendance/export?format=csv&month=2026-10')->assertUnprocessable();
        $this->fetch('/api/v1/teacher/attendance/export?month=2026-10')->assertUnprocessable();
        $this->assertSame(0, ActivityLog::where('action', 'attendance.exported')->count());
    }
}
