<?php

namespace Tests\Feature\Teacher;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /v1/teacher/children va /v1/teacher/children/{id} — faqat biriktirilgan guruh bolalari.
 */
class TeacherChildrenTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $user;
    private TeacherProfile $teacher;
    private Group $group;
    private Group $otherGroup;
    private Child $ali;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org        = Organization::factory()->create();
        $this->user       = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $this->teacher    = TeacherProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->group      = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh', 'age_category' => '3-4 yosh']);
        $this->otherGroup = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Oy']);
        $this->teacher->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);

        $this->ali = Child::factory()->create([
            'organization_id' => $this->org->id, 'group_id' => $this->group->id,
            'first_name' => 'Ali', 'last_name' => 'Valiyev', 'middle_name' => 'Anvarovich',
            'admitted_at' => '2025-09-01', 'medical_notes' => 'Yong\'oqqa allergiya',
        ]);
        Child::factory(2)->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->otherGroup->id]);

        $parent = ParentProfile::factory()->create(['organization_id' => $this->org->id, 'first_name' => 'Mohira', 'last_name' => 'Valiyeva', 'phone' => '+998901112233']);
        $parent->children()->attach($this->ali->id, ['relation_type' => 'ona', 'is_primary' => true]);
    }

    private function as(?User $user = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user ?? $this->user, 'sanctum');
    }

    public function test_royxat_faqat_oz_guruhi_bolalari(): void
    {
        $res = $this->as()->getJson('/api/v1/teacher/children')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('groups.0.name', 'Quyosh');

        $ali = collect($res->json('data'))->firstWhere('first_name', 'Ali');
        $this->assertSame('Quyosh', $ali['group']['name']);
        $this->assertSame(['name' => 'Valiyeva Mohira', 'phone' => '+998901112233'], $ali['contact']);
        $this->assertNull($ali['photo_url']);
        $this->assertArrayNotHasKey('medical_notes', $ali);   // ro'yxatda tibbiy ma'lumot yo'q
    }

    public function test_profil_toliq_malumot_bilan(): void
    {
        $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}")->assertOk()
             ->assertJsonPath('data.middle_name', 'Anvarovich')
             ->assertJsonPath('data.admitted_at', '2025-09-01')
             ->assertJsonPath('data.medical_notes', 'Yong\'oqqa allergiya')
             ->assertJsonPath('data.parents.0.relation_type', 'ona')
             ->assertJsonPath('data.parents.0.is_primary', true)
             ->assertJsonPath('data.parents.0.phone', '+998901112233');
    }

    public function test_boshqa_guruh_va_bogcha_bolasi_404(): void
    {
        $otherGroupChild = Child::where('group_id', $this->otherGroup->id)->first();
        $foreign = Child::factory()->create();

        $this->as()->getJson("/api/v1/teacher/children/{$otherGroupChild->id}")->assertNotFound();
        $this->as()->getJson("/api/v1/teacher/children/{$foreign->id}")->assertNotFound();
        $this->as()->getJson("/api/v1/teacher/children?group_id={$this->otherGroup->id}")->assertNotFound();
        $this->as()->getJson('/api/v1/teacher/children/abc')->assertNotFound();
    }

    public function test_guruhsiz_bola_va_guruhdan_chiqarilgan_bola_ochilmaydi(): void
    {
        $this->ali->update(['group_id' => $this->otherGroup->id]);
        $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}")->assertNotFound();

        $this->ali->update(['group_id' => null]);
        $this->as()->getJson("/api/v1/teacher/children/{$this->ali->id}")->assertNotFound();
    }

    public function test_nofaol_tarbiyachi_va_boshqa_rollar(): void
    {
        $this->as(User::factory()->parent()->create(['organization_id' => $this->org->id]))->getJson('/api/v1/teacher/children')->assertForbidden();
        $this->as(User::factory()->admin()->create(['organization_id' => $this->org->id]))->getJson("/api/v1/teacher/children/{$this->ali->id}")->assertForbidden();

        $this->teacher->update(['is_active' => false]);
        $this->as()->getJson('/api/v1/teacher/children')->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/teacher/children')->assertUnauthorized();
    }

    public function test_tibbiy_malumot_ota_ona_api_siga_chiqmaydi(): void
    {
        $parentUser = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $parentUser->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach($this->ali->id, ['relation_type' => 'ota']);

        $this->app['auth']->forgetGuards();
        $res = $this->actingAsParent($parentUser)->getJson('/api/v1/parent/children')->assertOk();
        $this->assertStringNotContainsString('allergiya', $res->getContent());
    }

    public function test_admin_yangi_profil_maydonlarini_saqlaydi(): void
    {
        $admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->as($admin)->putJson("/api/v1/admin/children/{$this->ali->id}", [
            'middle_name' => 'Botirovich', 'admitted_at' => '2025-08-15', 'medical_notes' => null,
        ])->assertOk();

        $fresh = $this->ali->fresh();
        $this->assertSame('Botirovich', $fresh->middle_name);
        $this->assertSame('2025-08-15', $fresh->admitted_at->toDateString());
        $this->assertNull($fresh->medical_notes);

        $this->as($admin)->putJson("/api/v1/admin/children/{$this->ali->id}", ['admitted_at' => '2099-01-01'])->assertUnprocessable();
    }
}
