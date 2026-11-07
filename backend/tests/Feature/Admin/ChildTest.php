<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChildTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_bolalar_royhati(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        Child::factory(4)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/children')
             ->assertOk()
             ->assertJsonCount(4, 'data');
    }

    public function test_boshqa_org_bolalari_korsatilmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $other = Organization::factory()->create();
        Child::factory(3)->create(['organization_id' => $other->id]);
        Child::factory(1)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/children')
             ->assertOk()
             ->assertJsonCount(1, 'data');
    }

    public function test_bola_yaratish(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Kamola',
                 'last_name'  => 'Yusupova',
                 'birth_date' => '2022-03-15',
                 'gender'     => 'ayol',
             ])
             ->assertCreated()
             ->assertJsonPath('data.first_name', 'Kamola')
             ->assertJsonPath('data.gender', 'ayol');
    }

    public function test_bola_guruhga_biriktirish(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $group = Group::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Ali',
                 'last_name'  => 'Karimov',
                 'birth_date' => '2021-06-01',
                 'gender'     => 'erkak',
                 'group_id'   => $group->id,
             ])
             ->assertCreated()
             ->assertJsonPath('data.group_id', $group->id);
    }

    public function test_boshqa_org_guruhiga_biriktirish_mumkin_emas(): void
    {
        [$admin] = $this->adminWithOrg();
        $otherGroup = Group::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Ali',
                 'last_name'  => 'Karimov',
                 'birth_date' => '2021-06-01',
                 'gender'     => 'erkak',
                 'group_id'   => $otherGroup->id,
             ])
             ->assertNotFound();
    }

    public function test_bola_malumotlarini_yangilash(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child = Child::factory()->create(['organization_id' => $org->id, 'first_name' => 'Eski']);

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/children/{$child->id}", ['first_name' => 'Yangi'])
             ->assertOk()
             ->assertJsonPath('data.first_name', 'Yangi');
    }

    public function test_boshqa_org_bolasini_yangilab_bolmaydi(): void
    {
        [$admin]       = $this->adminWithOrg();
        $otherChild    = Child::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->putJson("/api/v1/admin/children/{$otherChild->id}", ['first_name' => 'X'])
             ->assertNotFound();
    }

    public function test_bola_ochirish(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child = Child::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/v1/admin/children/{$child->id}")
             ->assertOk();

        $this->assertSoftDeleted('children', ['id' => $child->id]);
    }

    public function test_tugilgan_sana_vaqt_zonasiz_y_m_d_formatida_qaytadi(): void
    {
        // ISO datetime (UTC) Toshkent sanasini bir kun oldinga surib ko'rsatardi
        [$admin, $org] = $this->adminWithOrg();
        $child = Child::factory()->create(['organization_id' => $org->id, 'birth_date' => '2023-09-23']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/children')
             ->assertOk()
             ->assertJsonPath('data.0.birth_date', '2023-09-23');
        $this->actingAs($admin, 'sanctum')->getJson("/api/v1/admin/children/{$child->id}")
             ->assertJsonPath('data.birth_date', '2023-09-23');
    }

    public function test_yaratishda_majburiy_maydonlar(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['first_name', 'last_name', 'birth_date', 'gender']);
    }
}
