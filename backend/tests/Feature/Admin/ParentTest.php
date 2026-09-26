<?php

namespace Tests\Feature\Admin;

use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParentTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_ota_onalar_royhati(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        ParentProfile::factory(5)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/parents')
             ->assertOk()
             ->assertJsonCount(5, 'data');
    }

    public function test_boshqa_org_ota_onalari_korsatilmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $other = Organization::factory()->create();
        ParentProfile::factory(4)->create(['organization_id' => $other->id]);
        ParentProfile::factory(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/parents')
             ->assertOk()
             ->assertJsonCount(2, 'data');
    }

    public function test_autentifikatsiyasiz_kira_olmaydi(): void
    {
        $this->getJson('/api/v1/admin/parents')->assertUnauthorized();
    }
}
