<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Write paths for children must never reach another kindergarten's records.
 * Read/list isolation is covered in SuperAdmin\MultiTenantSecurityTest.
 */
class CrossKindergartenChildAccessTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_cannot_delete_other_org_child(): void
    {
        [$admin]    = $this->adminWithOrg();
        $otherChild = Child::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/v1/admin/children/{$otherChild->id}")
             ->assertNotFound();

        $this->assertNotSoftDeleted('children', ['id' => $otherChild->id]);
    }

    public function test_failed_cross_org_update_leaves_child_unchanged(): void
    {
        [$admin]    = $this->adminWithOrg();
        $otherChild = Child::factory()->create(['first_name' => 'Asl']);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/children/{$otherChild->id}", ['first_name' => 'Buzilgan'])
             ->assertNotFound();

        $this->assertDatabaseHas('children', ['id' => $otherChild->id, 'first_name' => 'Asl']);
    }

    public function test_admin_cannot_move_own_child_into_other_org_group(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $ownGroup      = Group::factory()->create(['organization_id' => $org->id]);
        $child         = Child::factory()->create(['organization_id' => $org->id, 'group_id' => $ownGroup->id]);
        $otherGroup    = Group::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/children/{$child->id}", ['group_id' => $otherGroup->id])
             ->assertNotFound();

        $this->assertDatabaseHas('children', ['id' => $child->id, 'group_id' => $ownGroup->id]);
    }

    public function test_organization_id_in_payload_is_ignored_on_create(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $otherOrg      = Organization::factory()->create();

        $res = $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name'      => 'Kamola',
                 'last_name'       => 'Yusupova',
                 'birth_date'      => '2022-03-15',
                 'gender'          => 'ayol',
                 'organization_id' => $otherOrg->id,
             ])
             ->assertCreated();

        $this->assertDatabaseHas('children', ['id' => $res->json('data.id'), 'organization_id' => $org->id]);
        $this->assertSame(0, Child::where('organization_id', $otherOrg->id)->count());
    }

    public function test_organization_id_in_payload_is_ignored_on_update(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $otherOrg      = Organization::factory()->create();
        $child         = Child::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/children/{$child->id}", ['organization_id' => $otherOrg->id])
             ->assertOk();

        $this->assertDatabaseHas('children', ['id' => $child->id, 'organization_id' => $org->id]);
    }

    public function test_impersonating_super_admin_cannot_touch_child_of_another_org(): void
    {
        $orgA       = Organization::factory()->create();
        $childB     = Child::factory()->create(['first_name' => 'Asl']);
        $superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $request = $this->actingAs($superAdmin, 'sanctum')
                        ->withHeaders(['X-Impersonated-Org' => $orgA->id]);

        $request->getJson("/api/v1/admin/children/{$childB->id}")->assertNotFound();
        // Super Admin bog'cha panelida faqat ko'radi — yozish amallari umuman rad etiladi
        $request->putJson("/api/v1/admin/children/{$childB->id}", ['first_name' => 'X'])->assertForbidden();
        $request->deleteJson("/api/v1/admin/children/{$childB->id}")->assertForbidden();

        $this->assertDatabaseHas('children', ['id' => $childB->id, 'first_name' => 'Asl', 'deleted_at' => null]);
    }
}
