<?php

namespace Tests\Feature;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessStructureTest extends TestCase
{
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────
    // 1. Bog'cha yaratish
    // ──────────────────────────────────────────────────────────────

    public function test_bogcha_yaratish_mumkin(): void
    {
        $org = Organization::factory()->create([
            'name'    => 'Toshkent Bog\'chasi',
            'phone'   => '+998711234567',
            'address' => 'Toshkent shahar',
        ]);

        $this->assertDatabaseHas('organizations', [
            'name'      => 'Toshkent Bog\'chasi',
            'is_active' => true,
        ]);
        $this->assertInstanceOf(Organization::class, $org);
        $this->assertNotNull($org->id);
    }

    // ──────────────────────────────────────────────────────────────
    // 2. Guruh bog'chaga tegishli bo'lishi
    // ──────────────────────────────────────────────────────────────

    public function test_guruh_bogchaga_tegishli_bolishi(): void
    {
        $org   = Organization::factory()->create();
        $group = Group::factory()->create([
            'organization_id' => $org->id,
            'name'            => 'Nilufar guruhi',
        ]);

        $this->assertEquals($org->id, $group->organization_id);
        $this->assertInstanceOf(Organization::class, $group->organization);
        $this->assertEquals($org->id, $group->organization->id);

        // Bog'cha o'z guruhini ko'radi
        $this->assertCount(1, $org->groups);
        $this->assertEquals($group->id, $org->groups->first()->id);
    }

    // ──────────────────────────────────────────────────────────────
    // 3. Bola bog'chaga tegishli bo'lishi
    // ──────────────────────────────────────────────────────────────

    public function test_bola_bogchaga_tegishli_bolishi(): void
    {
        $org   = Organization::factory()->create();
        $child = Child::factory()->create([
            'organization_id' => $org->id,
            'group_id'        => null,
        ]);

        $this->assertEquals($org->id, $child->organization_id);
        $this->assertInstanceOf(Organization::class, $child->organization);

        $this->assertCount(1, $org->children);
    }

    // ──────────────────────────────────────────────────────────────
    // 4. Bola guruhga biriktirilishi
    // ──────────────────────────────────────────────────────────────

    public function test_bola_guruhga_biriktirilishi(): void
    {
        $org   = Organization::factory()->create();
        $group = Group::factory()->create(['organization_id' => $org->id]);
        $child = Child::factory()->create([
            'organization_id' => $org->id,
            'group_id'        => $group->id,
        ]);

        $this->assertEquals($group->id, $child->group_id);
        $this->assertInstanceOf(Group::class, $child->group);

        // Guruh o'z bolalarini ko'radi
        $this->assertCount(1, $group->children);
        $this->assertEquals($child->id, $group->children->first()->id);
    }

    // ──────────────────────────────────────────────────────────────
    // 5. Bola bir nechta ota-onaga ega bo'lishi
    // ──────────────────────────────────────────────────────────────

    public function test_bola_bir_nechta_ota_onaga_ega_bolishi(): void
    {
        $org = Organization::factory()->create();

        $child = Child::factory()->create(['organization_id' => $org->id]);

        $ona = ParentProfile::factory()->create(['organization_id' => $org->id]);
        $ota = ParentProfile::factory()->create(['organization_id' => $org->id]);

        $child->parentProfiles()->attach($ona->id, [
            'relation_type' => 'ona',
            'is_primary'    => true,
        ]);
        $child->parentProfiles()->attach($ota->id, [
            'relation_type' => 'ota',
            'is_primary'    => false,
        ]);

        $this->assertCount(2, $child->parentProfiles);

        $onaRel = $child->parentProfiles->firstWhere('id', $ona->id);
        $this->assertEquals('ona', $onaRel->pivot->relation_type);
        $this->assertTrue((bool) $onaRel->pivot->is_primary);

        $otaRel = $child->parentProfiles->firstWhere('id', $ota->id);
        $this->assertEquals('ota', $otaRel->pivot->relation_type);
        $this->assertFalse((bool) $otaRel->pivot->is_primary);
    }

    // ──────────────────────────────────────────────────────────────
    // 6. Tarbiyachi guruhga biriktirilishi
    // ──────────────────────────────────────────────────────────────

    public function test_tarbiyachi_guruhga_biriktirilishi(): void
    {
        $org     = Organization::factory()->create();
        $group   = Group::factory()->create(['organization_id' => $org->id]);
        $teacher = TeacherProfile::factory()->create(['organization_id' => $org->id]);

        $teacher->groups()->attach($group->id, [
            'is_primary'  => true,
            'assigned_at' => now()->toDateString(),
        ]);

        $this->assertCount(1, $teacher->groups);
        $this->assertEquals($group->id, $teacher->groups->first()->id);
        $this->assertTrue((bool) $teacher->groups->first()->pivot->is_primary);

        // Guruh o'z tarbiyachisini ko'radi
        $this->assertCount(1, $group->teacherProfiles);
    }

    // ──────────────────────────────────────────────────────────────
    // 7. Multi-tenant izolyatsiyasi
    // ──────────────────────────────────────────────────────────────

    public function test_multi_tenant_izolyatsiyasi(): void
    {
        $org1 = Organization::factory()->create();
        $org2 = Organization::factory()->create();

        Child::factory(3)->create(['organization_id' => $org1->id]);
        Child::factory(2)->create(['organization_id' => $org2->id]);

        // Har bir org faqat o'z bolalarini ko'radi
        $org1Children = Child::forOrganization($org1->id)->get();
        $org2Children = Child::forOrganization($org2->id)->get();

        $this->assertCount(3, $org1Children);
        $this->assertCount(2, $org2Children);

        // org1 bolalari org2 da yo'q
        $org1Ids = $org1Children->pluck('id')->toArray();
        $org2Ids = $org2Children->pluck('id')->toArray();
        $this->assertEmpty(array_intersect($org1Ids, $org2Ids));
    }

    // ──────────────────────────────────────────────────────────────
    // 8. Parent faqat o'z bolasini ko'rishi
    // ──────────────────────────────────────────────────────────────

    public function test_parent_faqat_oz_bolasini_korishi(): void
    {
        $org = Organization::factory()->create();

        $parentUser    = User::factory()->create(['role' => 'parent', 'organization_id' => $org->id]);
        $parentProfile = ParentProfile::factory()->create([
            'user_id'         => $parentUser->id,
            'organization_id' => $org->id,
        ]);

        // Ushbu ota-onaga tegishli bola
        $myChild = Child::factory()->create(['organization_id' => $org->id]);
        $parentProfile->children()->attach($myChild->id, [
            'relation_type' => 'ona',
            'is_primary'    => true,
        ]);

        // Boshqa bolalar
        Child::factory(3)->create(['organization_id' => $org->id]);

        // Ota-ona faqat o'z bolasini ko'radi (relationship orqali)
        $visibleChildren = $parentProfile->children;

        $this->assertCount(1, $visibleChildren);
        $this->assertEquals($myChild->id, $visibleChildren->first()->id);
    }

    // ──────────────────────────────────────────────────────────────
    // 9. Teacher faqat o'z guruhini ko'rishi
    // ──────────────────────────────────────────────────────────────

    public function test_teacher_faqat_oz_guruhini_korishi(): void
    {
        $org = Organization::factory()->create();

        $teacherUser    = User::factory()->create(['role' => 'teacher', 'organization_id' => $org->id]);
        $teacherProfile = TeacherProfile::factory()->create([
            'user_id'         => $teacherUser->id,
            'organization_id' => $org->id,
        ]);

        // Ushbu tarbiyachining guruhi
        $myGroup = Group::factory()->create(['organization_id' => $org->id]);
        $teacherProfile->groups()->attach($myGroup->id, [
            'is_primary'  => true,
            'assigned_at' => now()->toDateString(),
        ]);

        // Boshqa guruhlar
        Group::factory(2)->create(['organization_id' => $org->id]);

        // Tarbiyachi faqat o'ziga biriktirilgan guruhni ko'radi
        $visibleGroups = $teacherProfile->groups;

        $this->assertCount(1, $visibleGroups);
        $this->assertEquals($myGroup->id, $visibleGroups->first()->id);
    }

    // ──────────────────────────────────────────────────────────────
    // 10. Admin faqat o'z bog'chasini ko'rishi
    // ──────────────────────────────────────────────────────────────

    public function test_admin_faqat_oz_bogchasini_korishi(): void
    {
        $myOrg    = Organization::factory()->create();
        $otherOrg = Organization::factory()->create();

        $adminUser = User::factory()->create([
            'role'            => 'admin',
            'organization_id' => $myOrg->id,
        ]);

        // Har ikkala orgda guruhlar
        Group::factory(2)->create(['organization_id' => $myOrg->id]);
        Group::factory(3)->create(['organization_id' => $otherOrg->id]);

        // Admin faqat o'z org guruhlarini ko'radi
        $myOrgGroups = Group::forOrganization($adminUser->organization_id)->get();

        $this->assertCount(2, $myOrgGroups);

        // Boshqa org guruhlarini ko'rmaydi
        foreach ($myOrgGroups as $group) {
            $this->assertEquals($myOrg->id, $group->organization_id);
        }
    }
}
