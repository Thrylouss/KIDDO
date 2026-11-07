<?php

namespace Tests\Feature;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uch rol oqimi: tarbiyachi davomatni belgilaydi → bog'cha rahbari o'z dashboardida ko'radi →
 * super-admin faqat agregat sonlarni ko'radi. Bog'cha va guruh chegaralari backendda yopiq.
 */
class ThreeRoleFlowTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private Organization $other;
    private User $owner;
    private User $teacher;
    private User $superAdmin;
    private Group $myGroup;
    private Group $otherGroup;
    private Child $ali;
    private Child $vali;
    private Child $foreignChild;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org   = Organization::factory()->create(['name' => 'Quyoshcha']);
        $this->other = Organization::factory()->create(['name' => 'Begona']);

        $this->superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->owner      = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->teacher    = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $profile          = TeacherProfile::factory()->create(['user_id' => $this->teacher->id, 'organization_id' => $this->org->id]);

        $this->myGroup    = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->otherGroup = Group::factory()->create(['organization_id' => $this->org->id]);
        $profile->groups()->attach($this->myGroup->id, ['assigned_at' => '2026-09-01']);

        $this->ali  = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id]);
        $this->vali = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id]);
        Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->otherGroup->id]);

        $foreignGroup       = Group::factory()->create(['organization_id' => $this->other->id]);
        $this->foreignChild = Child::factory()->create(['organization_id' => $this->other->id, 'group_id' => $foreignGroup->id]);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    public function test_tarbiyachi_davomati_rahbar_va_super_admin_korinishida_aks_etadi(): void
    {
        $today = AttendanceService::today()->toDateString();

        $this->as($this->teacher)->putJson('/api/v1/teacher/attendance', [
            'date'     => $today,
            'group_id' => $this->myGroup->id,
            'records'  => [
                ['child_id' => $this->ali->id,  'status' => 'present', 'note' => null],
                ['child_id' => $this->vali->id, 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma'],
            ],
        ])->assertOk()->assertJsonPath('message', 'Davomat saqlandi.');

        $this->as($this->owner)->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('bogcha.name', 'Quyoshcha')
            ->assertJsonPath('bolalar_soni', 3)
            ->assertJsonPath('bugungi_davomat.keldi', 1)
            ->assertJsonPath('bugungi_davomat.sababli', 1)
            ->assertJsonPath('bugungi_davomat.belgilanmagan', 1);

        $this->as($this->owner)->getJson("/api/v1/admin/attendance?date={$today}&group_id={$this->myGroup->id}")
            ->assertOk()
            ->assertJsonPath('summary.present', 1);

        $this->as($this->superAdmin)->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->assertJsonPath('platforma.jami_bolalar', 4)
            ->assertJsonPath('platforma.bugungi_davomat.keldi', 1);
    }

    public function test_tarbiyachi_faqat_ozi_guruhini_koradi(): void
    {
        $ids = collect($this->as($this->teacher)->getJson('/api/v1/teacher/children')->assertOk()->json('data'))->pluck('id');
        $this->assertEqualsCanonicalizing([$this->ali->id, $this->vali->id], $ids->all());

        $otherChild = Child::where('group_id', $this->otherGroup->id)->first();
        $this->as($this->teacher)->getJson("/api/v1/teacher/children/{$otherChild->id}")->assertNotFound();
        $this->as($this->teacher)->getJson("/api/v1/teacher/children/{$this->foreignChild->id}")->assertNotFound();

        $this->as($this->teacher)->putJson('/api/v1/teacher/attendance', [
            'date' => AttendanceService::today()->toDateString(), 'group_id' => $this->otherGroup->id,
            'records' => [['child_id' => $otherChild->id, 'status' => 'present', 'note' => null]],
        ])->assertNotFound();
    }

    public function test_tarbiyachi_rahbar_va_super_admin_endpointlariga_kira_olmaydi(): void
    {
        foreach (['/api/v1/admin/dashboard', '/api/v1/admin/children', '/api/v1/admin/messages', '/api/v1/super-admin/dashboard', '/api/v1/super-admin/organizations'] as $url) {
            $this->as($this->teacher)->getJson($url)->assertForbidden();
        }
    }

    public function test_rahbar_boshqa_bogcha_yozuvlariga_id_orqali_kira_olmaydi(): void
    {
        $this->as($this->owner)->getJson("/api/v1/admin/children/{$this->foreignChild->id}")->assertNotFound();
        $this->as($this->owner)->putJson("/api/v1/admin/children/{$this->foreignChild->id}", ['first_name' => 'X'])->assertNotFound();
        $this->as($this->owner)->getJson('/api/v1/super-admin/organizations')->assertForbidden();

        $ids = collect($this->as($this->owner)->getJson('/api/v1/admin/children')->assertOk()->json('data'))->pluck('id');
        $this->assertNotContains($this->foreignChild->id, $ids->all());
    }

    public function test_javoblarda_parol_va_token_yoq(): void
    {
        $body = $this->as($this->superAdmin)->getJson("/api/v1/super-admin/organizations/{$this->org->id}")->assertOk()->getContent();
        // Parol maydoni ham, bcrypt hash ham yo'q (must_change_password — faqat holat bayrog'i)
        $this->assertStringNotContainsString('"password"', $body);
        $this->assertStringNotContainsString('$2y$', $body);
        $this->assertStringNotContainsString('remember_token', $body);
    }
}
