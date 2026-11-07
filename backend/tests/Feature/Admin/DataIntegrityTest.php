<?php

namespace Tests\Feature\Admin;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Asosiy vakil yagonaligi, faol bo'lmagan tarbiyachi, davomat takrorlanmasligi.
 */
class DataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));
        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
    }

    private function link(Child $child, ParentProfile $parent, bool $primary)
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson("/api/v1/admin/children/{$child->id}/parents", [
            'parent_profile_id' => $parent->id, 'relation_type' => 'ota', 'is_primary' => $primary,
        ]);
    }

    private function primaryIds(Child $child): array
    {
        return $child->parentProfiles()->wherePivot('is_primary', true)->pluck('parent_profiles.id')->all();
    }

    // ── Asosiy vakil ──────────────────────────────────────────────

    public function test_bolada_faqat_bitta_asosiy_vakil_boladi(): void
    {
        $child = Child::factory()->create(['organization_id' => $this->org->id]);
        [$a, $b] = ParentProfile::factory(2)->create(['organization_id' => $this->org->id]);

        $this->link($child, $a, true)->assertOk();
        $this->link($child, $b, true)->assertOk();
        $this->assertSame([$b->id], $this->primaryIds($child));

        // Asosiy bo'lmagan sifatida yangilash boshqasini qayta asosiy qilmaydi
        $this->link($child, $a, false)->assertOk();
        $this->assertSame([$b->id], $this->primaryIds($child));
        $this->assertSame(2, $child->parentProfiles()->count());
    }

    public function test_asosiy_vakil_boshqa_bolaga_tasir_qilmaydi(): void
    {
        [$c1, $c2] = Child::factory(2)->create(['organization_id' => $this->org->id]);
        [$a, $b]   = ParentProfile::factory(2)->create(['organization_id' => $this->org->id]);

        $this->link($c1, $a, true)->assertOk();
        $this->link($c2, $a, true)->assertOk();
        $this->link($c2, $b, true)->assertOk();

        $this->assertSame([$a->id], $this->primaryIds($c1));
        $this->assertSame([$b->id], $this->primaryIds($c2));
    }

    // ── Faol bo'lmagan tarbiyachi ─────────────────────────────────

    public function test_faol_bolmagan_tarbiyachiga_guruh_biriktirilmaydi(): void
    {
        $group = Group::factory()->create(['organization_id' => $this->org->id]);
        $inactiveProfile = TeacherProfile::factory()->create(['organization_id' => $this->org->id, 'is_active' => false]);
        $inactiveUser    = TeacherProfile::factory()->create([
            'organization_id' => $this->org->id,
            'user_id' => User::factory()->teacher()->inactive()->create(['organization_id' => $this->org->id])->id,
        ]);

        foreach ([$inactiveProfile, $inactiveUser] as $teacher) {
            $this->actingAs($this->admin, 'sanctum')
                 ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$group->id]])
                 ->assertUnprocessable()
                 ->assertJsonPath('message', "Faol bo'lmagan tarbiyachini guruhga biriktirib bo'lmaydi.");
            $this->assertSame(0, $teacher->groups()->count());
        }
    }

    public function test_faol_bolmagan_tarbiyachini_guruhdan_ajratish_mumkin(): void
    {
        $group   = Group::factory()->create(['organization_id' => $this->org->id]);
        $teacher = TeacherProfile::factory()->create(['organization_id' => $this->org->id]);
        $teacher->groups()->attach($group->id, ['assigned_at' => '2026-10-01']);
        $teacher->update(['is_active' => false]);

        // Mavjud guruhni saqlash ham, hammasidan ajratish ham ruxsat etiladi
        $this->actingAs($this->admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$group->id]])->assertOk();
        $this->actingAs($this->admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => []])->assertOk();
        $this->assertSame(0, $teacher->groups()->count());
    }

    // ── Davomat ───────────────────────────────────────────────────

    public function test_davomat_bir_bola_bir_sana_uchun_bitta_yozuv(): void
    {
        $group = Group::factory()->create(['organization_id' => $this->org->id]);
        $child = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $group->id]);
        $body  = fn (string $status) => [
            'date' => '2026-10-28', 'group_id' => $group->id,
            'records' => [['child_id' => $child->id, 'status' => $status]],
        ];

        $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/admin/attendance', $body('present'))->assertOk();
        $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/admin/attendance', $body('absent'))->assertOk();

        $this->assertSame(1, Attendance::where('child_id', $child->id)->count());
        $this->assertSame('absent', Attendance::where('child_id', $child->id)->value('status'));
    }

    public function test_davomat_unique_cheklovi_bazada_majburiy(): void
    {
        $child = Child::factory()->create(['organization_id' => $this->org->id]);
        Attendance::factory()->create(['child_id' => $child->id, 'organization_id' => $this->org->id, 'date' => '2026-10-28']);

        $this->expectException(UniqueConstraintViolationException::class);
        Attendance::factory()->create(['child_id' => $child->id, 'organization_id' => $this->org->id, 'date' => '2026-10-28']);
    }

    public function test_tahrirlash_muddati_tashqarisida_backend_rad_etadi(): void
    {
        $group = Group::factory()->create(['organization_id' => $this->org->id]);
        $child = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $group->id]);

        $this->actingAs($this->admin, 'sanctum')->putJson('/api/v1/admin/attendance', [
            'date' => '2026-08-01', 'group_id' => $group->id,
            'records' => [['child_id' => $child->id, 'status' => 'present']],
        ])->assertForbidden();

        $this->assertSame(0, Attendance::count());
    }
}
