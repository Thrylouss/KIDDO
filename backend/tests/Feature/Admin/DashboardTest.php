<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_dashboard_summaryni_kora_oladi(): void
    {
        [$admin, $org] = $this->adminWithOrg();

        Child::factory(3)->create(['organization_id' => $org->id]);
        Group::factory(2)->create(['organization_id' => $org->id, 'is_active' => true]);
        Group::factory(1)->create(['organization_id' => $org->id, 'is_active' => false]);
        TeacherProfile::factory(2)->create(['organization_id' => $org->id, 'is_active' => true]);
        ParentProfile::factory(4)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/dashboard')
             ->assertOk()
             ->assertJson([
                 'bolalar_soni'       => 3,
                 'guruhlar_soni'      => 2,
                 'tarbiyachilar_soni' => 2,
                 'ota_onalar_soni'    => 4,
             ]);
    }

    public function test_autentifikatsiyasiz_kira_olmaydi(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
    }

    public function test_tarbiyachi_admin_dashboardiga_kira_olmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $teacher = User::factory()->teacher()->create(['organization_id' => $org->id]);

        $this->actingAs($teacher, 'sanctum')
             ->getJson('/api/v1/admin/dashboard')
             ->assertForbidden();
    }

    public function test_boshqa_org_malumotlari_korsatilmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $otherOrg = Organization::factory()->create();

        Child::factory(5)->create(['organization_id' => $otherOrg->id]);
        Group::factory(3)->create(['organization_id' => $otherOrg->id, 'is_active' => true]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/dashboard')
             ->assertOk()
             ->assertJson([
                 'bolalar_soni'  => 0,
                 'guruhlar_soni' => 0,
             ]);
    }
}
