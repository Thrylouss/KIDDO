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

/**
 * «Sababli» davomat: sabab kategoriyasi va izoh majburiy, backendda saqlanadi va audit qilinadi.
 */
class ExcuseReasonTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    private User $user;
    private Group $group;
    private Child $child;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 10:00', 'Asia/Tashkent'));

        $org         = Organization::factory()->create();
        $this->user  = User::factory()->teacher()->create(['organization_id' => $org->id]);
        $teacher     = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $org->id]);
        $this->group = Group::factory()->create(['organization_id' => $org->id]);
        $teacher->groups()->attach($this->group->id, ['assigned_at' => self::TODAY]);
        $this->child = Child::factory()->create(['organization_id' => $org->id, 'group_id' => $this->group->id, 'first_name' => 'Ali', 'last_name' => 'Valiyev']);
    }

    private function mark(array $record)
    {
        return $this->actingAs($this->user, 'sanctum')->putJson('/api/v1/teacher/attendance', [
            'date' => self::TODAY, 'group_id' => $this->group->id,
            'records' => [['child_id' => $this->child->id] + $record],
        ]);
    }

    public function test_sababli_izohsiz_yoki_sababsiz_rad_etiladi(): void
    {
        $this->mark(['status' => 'excused', 'excuse_reason' => 'kasallik'])
             ->assertUnprocessable()->assertJsonValidationErrors('records.0.note');
        $this->mark(['status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => ''])
             ->assertUnprocessable()->assertJsonValidationErrors('records.0.note');
        $this->mark(['status' => 'excused', 'note' => 'Shifokorda'])
             ->assertUnprocessable()->assertJsonValidationErrors('records.0.excuse_reason');
        $this->mark(['status' => 'excused', 'excuse_reason' => 'safar', 'note' => 'X'])
             ->assertUnprocessable()->assertJsonValidationErrors('records.0.excuse_reason');

        $this->assertSame(0, Attendance::count());
    }

    public function test_xato_xabari_ozbekcha(): void
    {
        $res = $this->mark(['status' => 'excused', 'excuse_reason' => 'kasallik'])->assertUnprocessable();
        $this->assertSame('Izoh kiritilishi shart.', $res->json('errors')['records.0.note'][0]);
    }

    public function test_sababli_sabab_va_izoh_bilan_saqlanadi_va_qaytariladi(): void
    {
        $this->mark(['status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma, shifokorda'])
             ->assertOk()
             ->assertJsonPath('children.0.status', 'excused')
             ->assertJsonPath('children.0.excuse_reason', 'kasallik')
             ->assertJsonPath('children.0.note', 'Isitma, shifokorda');

        $this->assertDatabaseHas('attendances', [
            'child_id' => $this->child->id, 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma, shifokorda',
        ]);
    }

    public function test_boshqa_holatlarda_izoh_ixtiyoriy_va_sabab_saqlanmaydi(): void
    {
        $this->mark(['status' => 'present'])->assertOk();
        $this->mark(['status' => 'absent', 'excuse_reason' => 'kasallik'])->assertOk();

        $this->assertNull(Attendance::sole()->excuse_reason);
    }

    public function test_sabab_ozgarishi_audit_qilinadi(): void
    {
        $this->mark(['status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Shifokorda'])->assertOk();
        $this->mark(['status' => 'excused', 'excuse_reason' => 'oilaviy', 'note' => 'Safarda'])->assertOk();

        $log = ActivityLog::where('action', 'attendance.updated')->sole();
        $this->assertSame('kasallik', $log->meta['old']['excuse_reason']);
        $this->assertSame('oilaviy', $log->meta['new']['excuse_reason']);
        $this->assertSame('Safarda', $log->meta['new']['note']);

        // Sababli → Keldi: sabab tozalanadi
        $this->mark(['status' => 'present'])->assertOk();
        $this->assertNull(Attendance::sole()->excuse_reason);
    }

    public function test_bir_bola_bir_sana_uchun_bitta_yozuv(): void
    {
        $this->mark(['status' => 'absent'])->assertOk();
        $this->mark(['status' => 'excused', 'excuse_reason' => 'boshqa', 'note' => 'Izoh'])->assertOk();

        $this->assertSame(1, Attendance::where('child_id', $this->child->id)->count());
    }
}
