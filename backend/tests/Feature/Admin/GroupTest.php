<?php

namespace Tests\Feature\Admin;

use App\Models\Group;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GroupTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_guruhlar_royhati(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        Group::factory(3)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/groups')
             ->assertOk()
             ->assertJsonCount(3, 'data');
    }

    public function test_boshqa_org_guruhlari_korsatilmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $other = Organization::factory()->create();
        Group::factory(2)->create(['organization_id' => $other->id]);
        Group::factory(1)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/groups')
             ->assertOk()
             ->assertJsonCount(1, 'data');
    }

    public function test_guruh_yaratish(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', [
                 'name'         => 'Bahor guruhi',
                 'age_category' => '3-4 yosh',
                 'capacity'     => 20,
             ])
             ->assertCreated()
             ->assertJsonPath('data.name', 'Bahor guruhi')
             ->assertJsonPath('data.capacity', 20);
    }

    public function test_guruh_yaratishda_nom_majburiy(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name']);
    }

    public function test_guruh_faqat_oz_orgga_tegishli_yaratiladi(): void
    {
        [$admin, $org] = $this->adminWithOrg();

        $response = $this->actingAs($admin, 'sanctum')
                         ->postJson('/api/v1/admin/groups', ['name' => 'Test guruh'])
                         ->assertCreated();

        $this->assertEquals($org->id, $response->json('data.organization_id'));
    }
}
