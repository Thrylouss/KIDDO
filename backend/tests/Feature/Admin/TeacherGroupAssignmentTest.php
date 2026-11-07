<?php

namespace Tests\Feature\Admin;

use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin: tarbiyachini guruhlarga biriktirish — faqat o'z bog'chasi doirasida.
 */
class TeacherGroupAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    private function groupIdsOf(TeacherProfile $teacher): array
    {
        return $teacher->groups()->pluck('groups.id')->sort()->values()->all();
    }

    public function test_admin_tarbiyachini_guruhlarga_biriktiradi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $groups        = Group::factory()->count(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => $groups->pluck('id')->all()])
             ->assertOk()
             ->assertJsonCount(2, 'data.groups');

        $this->assertSame($groups->pluck('id')->sort()->values()->all(), $this->groupIdsOf($teacher));
        $this->assertDatabaseHas('teacher_group', ['teacher_profile_id' => $teacher->id, 'assigned_at' => now()->toDateString()]);
    }

    public function test_qayta_sinxronlash_eski_biriktirish_sanasini_saqlaydi_va_ortiqchasini_olib_tashlaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        [$keep, $drop] = Group::factory()->count(2)->create(['organization_id' => $org->id])->all();
        $teacher->groups()->attach([
            $keep->id => ['assigned_at' => '2026-01-10'],
            $drop->id => ['assigned_at' => '2026-01-10'],
        ]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$keep->id]])
             ->assertOk();

        $this->assertSame([$keep->id], $this->groupIdsOf($teacher));
        $this->assertDatabaseHas('teacher_group', ['group_id' => $keep->id, 'assigned_at' => '2026-01-10']);
    }

    public function test_bosh_royxat_barcha_guruhlardan_ajratadi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $group         = Group::factory()->create(['organization_id' => $org->id]);
        $teacher->groups()->attach($group->id, ['assigned_at' => '2026-01-10']);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => []])
             ->assertOk();

        $this->assertSame([], $this->groupIdsOf($teacher));
    }

    public function test_boshqa_bogcha_guruhini_biriktirib_bolmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $ownGroup      = Group::factory()->create(['organization_id' => $org->id]);
        $foreignGroup  = Group::factory()->create();
        $teacher->groups()->attach($ownGroup->id, ['assigned_at' => '2026-01-10']);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$ownGroup->id, $foreignGroup->id]])
             ->assertNotFound();

        // Hech narsa o'zgarmagan
        $this->assertSame([$ownGroup->id], $this->groupIdsOf($teacher));
    }

    public function test_boshqa_bogcha_tarbiyachisini_ozgartirib_bolmaydi(): void
    {
        [$admin, $org]  = $this->adminWithOrg();
        $foreignTeacher = TeacherProfile::factory()->create();
        $ownGroup       = Group::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$foreignTeacher->id}/groups", ['group_ids' => [$ownGroup->id]])
             ->assertNotFound();

        $this->assertDatabaseCount('teacher_group', 0);
    }

    public function test_ochirilgan_guruhni_biriktirib_bolmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $group         = Group::factory()->create(['organization_id' => $org->id]);
        $group->delete();

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$group->id]])
             ->assertNotFound();

        $this->assertDatabaseCount('teacher_group', 0);
    }

    public function test_validatsiya(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher       = TeacherProfile::factory()->create(['organization_id' => $org->id]);
        $group         = Group::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", [])
             ->assertStatus(422)
             ->assertJsonValidationErrors(['group_ids']);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$group->id, $group->id]])
             ->assertStatus(422);
    }

    public function test_tarbiyachi_ozini_guruhga_biriktira_olmaydi(): void
    {
        $org         = Organization::factory()->create();
        $teacherUser = User::factory()->teacher()->create(['organization_id' => $org->id]);
        $teacher     = TeacherProfile::factory()->create(['organization_id' => $org->id, 'user_id' => $teacherUser->id]);
        $group       = Group::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($teacherUser, 'sanctum')
             ->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$group->id]])
             ->assertForbidden();

        $this->assertDatabaseCount('teacher_group', 0);
    }
}
