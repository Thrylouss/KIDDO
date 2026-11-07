<?php

namespace Tests\Feature\Attendance;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bola guruhi o'zgarganda tarixiy davomat o'sha kungi guruhda qoladi;
 * admin dashboardidagi bugungi davomat kartasi.
 */
class AttendanceHistoryTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $admin;
    private Group $groupA;
    private Group $groupB;
    private Child $child;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));

        $this->org    = Organization::factory()->create();
        $this->admin  = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->groupA = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'A guruh']);
        $this->groupB = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'B guruh']);
        $this->child  = Child::factory()->inGroup($this->groupA)->create();
    }

    private function day(Group $group, string $date): array
    {
        return $this->actingAs($this->admin, 'sanctum')
                    ->getJson("/api/v1/admin/attendance?group_id={$group->id}&date={$date}")
                    ->assertOk()
                    ->json();
    }

    private function statusOf(array $day, Child $child): string|null|false
    {
        $row = collect($day['children'])->firstWhere('id', $child->id);
        return $row === null ? false : $row['status'];   // false — ro'yxatda yo'q
    }

    private function markAsAdmin(Group $group, string $date, string $status)
    {
        return $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/admin/attendance', [
            'date' => $date, 'group_id' => $group->id,
            // «Sababli» uchun sabab va izoh majburiy
            'records' => [['child_id' => $this->child->id, 'status' => $status]
                + ($status === 'excused' ? ['excuse_reason' => 'oilaviy', 'note' => 'Oilaviy sabab'] : [])],
        ]);
    }

    public function test_guruh_ozgargach_eski_kun_eski_guruhda_qoladi(): void
    {
        $this->markAsAdmin($this->groupA, '2026-10-27', 'present')->assertOk();
        $this->child->update(['group_id' => $this->groupB->id]);   // bugun B ga o'tkazildi

        $this->assertSame('present', $this->statusOf($this->day($this->groupA, '2026-10-27'), $this->child));
        $this->assertFalse($this->statusOf($this->day($this->groupB, '2026-10-27'), $this->child));
        $this->assertNull($this->statusOf($this->day($this->groupB, '2026-10-28'), $this->child));
        $this->assertFalse($this->statusOf($this->day($this->groupA, '2026-10-28'), $this->child));
    }

    public function test_otkazilgan_bolaning_eski_yozuvini_eski_guruh_orqali_tuzatish_mumkin(): void
    {
        $this->markAsAdmin($this->groupA, '2026-10-27', 'absent')->assertOk();
        $this->child->update(['group_id' => $this->groupB->id]);

        $this->markAsAdmin($this->groupA, '2026-10-27', 'excused')->assertOk();
        $this->assertDatabaseHas('attendances', [
            'child_id' => $this->child->id, 'group_id' => $this->groupA->id, 'status' => 'excused',
        ]);

        // Yangi guruh orqali o'sha eski kunni o'zgartirib bo'lmaydi
        $this->markAsAdmin($this->groupB, '2026-10-27', 'present')->assertStatus(422);
        $this->assertDatabaseCount('attendances', 1);
    }

    public function test_bir_kunda_belgilanib_keyin_otkazilsa_yangi_guruhda_qayta_belgilanmaydi(): void
    {
        $this->markAsAdmin($this->groupA, '2026-10-28', 'present')->assertOk();
        $this->child->update(['group_id' => $this->groupB->id]);

        $this->assertFalse($this->statusOf($this->day($this->groupB, '2026-10-28'), $this->child));
        $this->markAsAdmin($this->groupB, '2026-10-28', 'absent')->assertStatus(422);
        $this->assertSame('present', $this->statusOf($this->day($this->groupA, '2026-10-28'), $this->child));
    }

    public function test_nofaol_bolaning_eski_yozuvi_korinadi_yangi_kunda_yoq(): void
    {
        $this->markAsAdmin($this->groupA, '2026-10-27', 'present')->assertOk();
        $this->child->update(['is_active' => false]);

        $this->assertSame('present', $this->statusOf($this->day($this->groupA, '2026-10-27'), $this->child));
        $this->assertFalse($this->statusOf($this->day($this->groupA, '2026-10-28'), $this->child));
        $this->markAsAdmin($this->groupA, '2026-10-28', 'present')->assertStatus(422);
    }

    public function test_ota_ona_tarixi_guruh_ozgarishidan_qatiy_nazar_saqlanadi(): void
    {
        $user    = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach($this->child->id, ['relation_type' => 'ota']);

        $this->markAsAdmin($this->groupA, '2026-10-27', 'present')->assertOk();
        $this->child->update(['group_id' => $this->groupB->id]);
        $this->markAsAdmin($this->groupB, '2026-10-28', 'absent')->assertOk();

        $this->app['auth']->forgetGuards();
        $this->actingAsParent($user)->getJson("/api/v1/parent/children/{$this->child->id}/attendance")
             ->assertOk()
             ->assertJsonPath('records', [
                 ['date' => '2026-10-28', 'status' => 'absent',  'note' => null],
                 ['date' => '2026-10-27', 'status' => 'present', 'note' => null],
             ]);
    }

    // ── Dashboard kartasi ─────────────────────────────────────────

    public function test_dashboard_bugungi_davomat_faqat_oz_bogchasi(): void
    {
        $second   = Child::factory()->inGroup($this->groupB)->create();
        Child::factory()->inGroup($this->groupB)->create();                  // belgilanmagan
        Child::factory()->inGroup($this->groupB)->create(['is_active' => false]);
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => '2026-10-28', 'status' => 'present']);
        Attendance::factory()->create(['child_id' => $second->id,      'date' => '2026-10-28', 'status' => 'excused']);
        Attendance::factory()->create(['child_id' => $second->id,      'date' => '2026-10-27', 'status' => 'absent']); // kecha
        Attendance::factory()->create(['child_id' => Child::factory()->create()->id, 'date' => '2026-10-28']); // boshqa bog'cha

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/admin/dashboard')
             ->assertOk()
             ->assertJsonPath('bugungi_davomat', [
                 'sana' => '2026-10-28', 'jami' => 3, 'keldi' => 1, 'kelmadi' => 0, 'sababli' => 1, 'belgilanmagan' => 1,
             ]);
    }
}
