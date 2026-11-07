<?php

namespace Tests\Feature\Admin;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PUT/DELETE /v1/admin/groups/{id}
 */
class GroupManagementTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $admin;
    private Group $group;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->group = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh', 'capacity' => 20]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'sanctum');
    }

    // ── Tahrirlash ────────────────────────────────────────────────

    public function test_admin_guruhni_tahrirlaydi(): void
    {
        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", [
            'name' => 'Oy', 'age_category' => '3-4 yosh', 'capacity' => 15,
        ])->assertOk()
          ->assertJsonPath('data.name', 'Oy')
          ->assertJsonPath('data.capacity', 15)
          ->assertJsonPath('message', 'Guruh yangilandi.');

        $this->assertDatabaseHas('groups', ['id' => $this->group->id, 'name' => 'Oy', 'age_category' => '3-4 yosh']);
    }

    public function test_tahrirlash_validatsiyasi(): void
    {
        foreach ([
            ['name' => ''],
            ['name' => str_repeat('a', 101)],
            ['capacity' => 0],
            ['capacity' => 101],
            ['capacity' => 'kop'],
        ] as $body) {
            $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", $body)->assertUnprocessable();
        }
        $this->assertSame('Quyosh', $this->group->fresh()->name);
    }

    public function test_sigim_bolalar_sonidan_kam_bolmaydi(): void
    {
        Child::factory(3)->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);

        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", ['capacity' => 2])
             ->assertUnprocessable()->assertJsonValidationErrors('capacity');
        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", ['capacity' => 3])->assertOk();
    }

    public function test_organization_id_bilan_boshqa_bogchaga_kochirib_bolmaydi(): void
    {
        $other = Organization::factory()->create();

        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", ['organization_id' => $other->id, 'name' => 'X'])
             ->assertOk();
        $this->assertSame($this->org->id, $this->group->fresh()->organization_id);
    }

    // ── O'chirish ─────────────────────────────────────────────────

    public function test_bosh_guruh_ochiriladi_tarbiyachi_biriktirishi_olinadi_davomat_saqlanadi(): void
    {
        $teacher = TeacherProfile::factory()->create(['organization_id' => $this->org->id]);
        $teacher->groups()->attach($this->group->id, ['assigned_at' => '2026-10-01']);
        $formerChild = Child::factory()->create(['organization_id' => $this->org->id]);
        $record = Attendance::factory()->create(['child_id' => $formerChild->id, 'organization_id' => $this->org->id, 'group_id' => $this->group->id]);

        $this->as($this->admin)->deleteJson("/api/v1/admin/groups/{$this->group->id}")
             ->assertOk()->assertJsonPath('message', "Guruh o'chirildi.");

        $this->assertSoftDeleted('groups', ['id' => $this->group->id]);
        $this->assertSame(0, $teacher->groups()->count());
        $this->assertDatabaseHas('attendances', ['id' => $record->id, 'group_id' => $this->group->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'group.deleted', 'organization_id' => $this->org->id]);
        $this->as($this->admin)->getJson('/api/v1/admin/groups')->assertJsonCount(0, 'data');
    }

    public function test_bolalari_bor_guruh_ochirilmaydi(): void
    {
        // Faol bo'lmagan bola ham guruhda hisoblanadi
        Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'is_active' => false]);

        $this->as($this->admin)->deleteJson("/api/v1/admin/groups/{$this->group->id}")
             ->assertUnprocessable()
             ->assertExactJson(['message' => "Guruhda bolalar bor. Avval ularni boshqa guruhga o'tkazing."]);

        $this->assertDatabaseHas('groups', ['id' => $this->group->id, 'deleted_at' => null]);
    }

    public function test_ochirilgan_bolasi_bor_guruh_ochiriladi(): void
    {
        $child = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        $child->delete();

        $this->as($this->admin)->deleteJson("/api/v1/admin/groups/{$this->group->id}")->assertOk();
    }

    public function test_ochirilgan_guruhni_qayta_tahrirlab_yoki_ochirib_bolmaydi(): void
    {
        $this->group->delete();

        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$this->group->id}", ['name' => 'X'])->assertNotFound();
        $this->as($this->admin)->deleteJson("/api/v1/admin/groups/{$this->group->id}")->assertNotFound();
    }

    // ── Ruxsat va izolyatsiya ─────────────────────────────────────

    public function test_boshqa_bogcha_guruhi_404_va_ozgarmaydi(): void
    {
        $foreign = Group::factory()->create(['name' => 'Begona']);

        $this->as($this->admin)->putJson("/api/v1/admin/groups/{$foreign->id}", ['name' => 'X'])->assertNotFound();
        $this->as($this->admin)->deleteJson("/api/v1/admin/groups/{$foreign->id}")->assertNotFound();

        $this->assertDatabaseHas('groups', ['id' => $foreign->id, 'name' => 'Begona', 'deleted_at' => null]);
    }

    public function test_tarbiyachi_ota_ona_va_autentifikatsiyasiz_rad_etiladi(): void
    {
        foreach ([
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
        ] as $user) {
            $this->as($user)->putJson("/api/v1/admin/groups/{$this->group->id}", ['name' => 'X'])->assertForbidden();
            $this->as($user)->deleteJson("/api/v1/admin/groups/{$this->group->id}")->assertForbidden();
        }

        $this->app['auth']->forgetGuards();
        $this->putJson("/api/v1/admin/groups/{$this->group->id}", ['name' => 'X'])->assertUnauthorized();
        $this->assertSame('Quyosh', $this->group->fresh()->name);
    }

    public function test_super_admin_faqat_impersonatsiya_orqali(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->as($sa)->putJson("/api/v1/admin/groups/{$this->group->id}", ['name' => 'X'])->assertForbidden();
        // Impersonatsiyada — faqat ko'rish; o'zgartirish rahbarga tegishli
        $this->as($sa)->withHeaders(['X-Impersonated-Org' => (string) $this->org->id])
             ->getJson('/api/v1/admin/groups')->assertOk();
        $this->as($sa)->withHeaders(['X-Impersonated-Org' => (string) $this->org->id])
             ->putJson("/api/v1/admin/groups/{$this->group->id}", ['name' => 'Yangi'])->assertForbidden();
        $this->assertSame('Quyosh', $this->group->fresh()->name);

        $otherOrg = Organization::factory()->create();
        $ids = collect($this->as($sa)->withHeaders(['X-Impersonated-Org' => (string) $otherOrg->id])
             ->getJson('/api/v1/admin/groups')->assertOk()->json('data'))->pluck('id');
        $this->assertNotContains($this->group->id, $ids->all());
    }

    public function test_raqam_bolmagan_id_404_qaytaradi_500_emas(): void
    {
        foreach ([
            ['PUT', '/api/v1/admin/groups/abc'],
            ['DELETE', '/api/v1/admin/groups/1abc'],
            ['GET', '/api/v1/admin/children/abc'],
            ['PATCH', '/api/v1/admin/teachers/abc/deactivate'],
            ['DELETE', '/api/v1/admin/children/1/parents/abc'],
        ] as [$method, $url]) {
            $this->as($this->admin)->json($method, $url, ['name' => 'X'])->assertNotFound();
        }
    }
}
