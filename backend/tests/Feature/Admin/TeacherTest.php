<?php

namespace Tests\Feature\Admin;

use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    public function test_admin_tarbiyachilar_royhati(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        TeacherProfile::factory(3)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/teachers')
             ->assertOk()
             ->assertJsonCount(3, 'data');
    }

    public function test_boshqa_org_tarbiyachilari_korsatilmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $other = Organization::factory()->create();
        TeacherProfile::factory(2)->create(['organization_id' => $other->id]);
        TeacherProfile::factory(1)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/teachers')
             ->assertOk()
             ->assertJsonCount(1, 'data');
    }

    public function test_tarbiyachi_yaratish(): void
    {
        [$admin, $org] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Malika',
                 'last_name'  => 'Nazarova',
                 'phone'      => '+998901234567',
                 'password'   => 'secret123',
             ])
             ->assertCreated()
             ->assertJsonPath('data.first_name', 'Malika')
             ->assertJsonPath('data.organization_id', $org->id);

        $this->assertDatabaseHas('users', [
            'phone' => '+998901234567',
            'role'  => 'teacher',
        ]);

        $this->assertDatabaseHas('teacher_profiles', [
            'first_name'      => 'Malika',
            'organization_id' => $org->id,
        ]);
    }

    public function test_takrorlangan_telefon_raqami_xato_beradi(): void
    {
        [$admin] = $this->adminWithOrg();
        User::factory()->create(['phone' => '+998901111111']);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Test',
                 'last_name'  => 'Test',
                 'phone'      => '+998901111111',
                 'password'   => 'secret123',
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['phone']);
    }

    public function test_yaratishda_majburiy_maydonlar(): void
    {
        [$admin] = $this->adminWithOrg();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [])
             ->assertUnprocessable()
             // Parol majburiy emas — berilmasa tizim vaqtinchalik parol yaratadi; login (username yoki telefon) majburiy
             ->assertJsonValidationErrors(['first_name', 'last_name', 'phone'])
             ->assertJsonMissingValidationErrors(['password']);
    }
}
