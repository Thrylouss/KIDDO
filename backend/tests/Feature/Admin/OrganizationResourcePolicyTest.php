<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

/**
 * ChildPolicy, GroupPolicy, ParentProfilePolicy, TeacherProfilePolicy
 * (umumiy OrganizationResourcePolicy) va admin API'dagi salbiy holatlar.
 */
class OrganizationResourcePolicyTest extends TestCase
{
    use RefreshDatabase;

    private Organization $orgA;
    private Organization $orgB;
    private User $adminA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->orgA   = Organization::factory()->create();
        $this->orgB   = Organization::factory()->create();
        $this->adminA = User::factory()->admin()->create(['organization_id' => $this->orgA->id]);
    }

    /** @return array<string, \Illuminate\Database\Eloquent\Model> */
    private function resources(Organization $org): array
    {
        return [
            'child'   => Child::factory()->create(['organization_id' => $org->id]),
            'group'   => Group::factory()->create(['organization_id' => $org->id]),
            'parent'  => ParentProfile::factory()->create(['organization_id' => $org->id]),
            'teacher' => TeacherProfile::factory()->create(['organization_id' => $org->id]),
        ];
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'sanctum');
    }

    // ── Policy qoidalari ──────────────────────────────────────────

    public function test_admin_faqat_oz_bogchasi_resurslarini_boshqaradi(): void
    {
        foreach ($this->resources($this->orgA) as $name => $model) {
            foreach (['view', 'update', 'delete'] as $ability) {
                $this->assertTrue(Gate::forUser($this->adminA)->allows($ability, $model), "{$name}.{$ability} o'z bog'chasi");
            }
        }
        foreach ($this->resources($this->orgB) as $name => $model) {
            foreach (['view', 'update', 'delete'] as $ability) {
                $this->assertTrue(Gate::forUser($this->adminA)->denies($ability, $model), "{$name}.{$ability} boshqa bog'cha");
            }
        }
    }

    public function test_tarbiyachi_va_ota_ona_oz_bogchasida_ham_admin_resurslarini_boshqara_olmaydi(): void
    {
        $users = [
            User::factory()->teacher()->create(['organization_id' => $this->orgA->id]),
            User::factory()->parent()->create(['organization_id' => $this->orgA->id]),
        ];
        foreach ($users as $user) {
            foreach ([Child::class, Group::class, ParentProfile::class, TeacherProfile::class] as $class) {
                $this->assertTrue(Gate::forUser($user)->denies('viewAny', $class));
                $this->assertTrue(Gate::forUser($user)->denies('create', $class));
            }
            foreach ($this->resources($this->orgA) as $model) {
                foreach (['view', 'update', 'delete'] as $ability) {
                    $this->assertTrue(Gate::forUser($user)->denies($ability, $model));
                }
            }
        }
    }

    public function test_bogchasiz_admin_hech_narsa_yarata_olmaydi_va_korolmaydi(): void
    {
        $admin = User::factory()->admin()->create(['organization_id' => null]);

        foreach ([Child::class, Group::class, ParentProfile::class, TeacherProfile::class] as $class) {
            $this->assertTrue(Gate::forUser($admin)->allows('viewAny', $class)); // ro'yxat bo'sh qaytadi
            $this->assertTrue(Gate::forUser($admin)->denies('create', $class));
        }
        foreach ($this->resources($this->orgA) as $model) {
            $this->assertTrue(Gate::forUser($admin)->denies('view', $model));
        }
    }

    public function test_rad_javobi_ozbekcha_va_ichki_tafsilotsiz(): void
    {
        $admin = User::factory()->admin()->create(['organization_id' => null]);

        $this->as($admin)->postJson('/api/v1/admin/groups', ['name' => 'X'])
             ->assertForbidden()
             ->assertExactJson(['message' => "Bu amalni bajarishga ruxsatingiz yo'q."]);
    }

    // ── API: tenant chegaralari ───────────────────────────────────

    public function test_boshqa_bogcha_resurslari_api_orqali_yopiq(): void
    {
        $b = $this->resources($this->orgB);
        $own = Child::factory()->create(['organization_id' => $this->orgA->id]);

        $this->as($this->adminA)->getJson("/api/v1/admin/children/{$b['child']->id}")->assertNotFound();
        $this->as($this->adminA)->putJson("/api/v1/admin/children/{$b['child']->id}", ['first_name' => 'X'])->assertNotFound();
        $this->as($this->adminA)->deleteJson("/api/v1/admin/children/{$b['child']->id}")->assertNotFound();
        $this->as($this->adminA)->putJson("/api/v1/admin/teachers/{$b['teacher']->id}/groups", ['group_ids' => []])->assertNotFound();
        $this->as($this->adminA)->postJson("/api/v1/admin/children/{$own->id}/parents", [
            'parent_profile_id' => $b['parent']->id, 'relation_type' => 'ota',
        ])->assertNotFound();
        $this->as($this->adminA)->deleteJson("/api/v1/admin/children/{$own->id}/parents/{$b['parent']->id}")->assertNotFound();
        $this->as($this->adminA)->putJson("/api/v1/admin/children/{$own->id}", ['group_id' => $b['group']->id])->assertNotFound();

        $this->assertDatabaseHas('children', ['id' => $b['child']->id, 'deleted_at' => null]);
        $this->assertSame(0, $b['parent']->children()->count());
        $this->assertNull($own->fresh()->group_id);
    }

    public function test_admin_impersonatsiya_sarlavhasi_bilan_boshqa_bogchaga_otolmaydi(): void
    {
        $b = $this->resources($this->orgB);
        Child::factory()->create(['organization_id' => $this->orgA->id]);

        $headers = ['X-Impersonated-Org' => (string) $this->orgB->id];
        $ids = collect($this->as($this->adminA)->withHeaders($headers)->getJson('/api/v1/admin/children')->assertOk()->json('data'))
            ->pluck('organization_id')->unique()->all();
        $this->assertSame([$this->orgA->id], $ids);

        $this->as($this->adminA)->withHeaders($headers)->getJson("/api/v1/admin/children/{$b['child']->id}")->assertNotFound();
    }

    public function test_super_admin_impersonatsiyasiz_bogcha_api_ga_kira_olmaydi(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        Child::factory()->create(['organization_id' => $this->orgA->id]);

        $this->as($sa)->getJson('/api/v1/admin/children')->assertForbidden();
        $this->as($sa)->postJson('/api/v1/admin/groups', ['name' => 'X'])->assertForbidden();
        $this->assertSame(0, Group::count());
    }

    public function test_tarbiyachi_va_ota_ona_oz_bogchasi_id_lari_bilan_ham_admin_api_ga_kira_olmaydi(): void
    {
        $a = $this->resources($this->orgA);
        $users = [
            User::factory()->teacher()->create(['organization_id' => $this->orgA->id]),
            User::factory()->parent()->create(['organization_id' => $this->orgA->id]),
        ];

        foreach ($users as $user) {
            $this->as($user)->getJson("/api/v1/admin/children/{$a['child']->id}")->assertForbidden();
            $this->as($user)->putJson("/api/v1/admin/children/{$a['child']->id}", ['first_name' => 'X'])->assertForbidden();
            $this->as($user)->deleteJson("/api/v1/admin/children/{$a['child']->id}")->assertForbidden();
            $this->as($user)->postJson("/api/v1/admin/children/{$a['child']->id}/parents", [
                'parent_profile_id' => $a['parent']->id, 'relation_type' => 'ota',
            ])->assertForbidden();
            $this->as($user)->putJson("/api/v1/admin/teachers/{$a['teacher']->id}/groups", ['group_ids' => [$a['group']->id]])->assertForbidden();
            $this->as($user)->getJson('/api/v1/super-admin/organizations')->assertForbidden();
        }
        $this->assertDatabaseHas('children', ['id' => $a['child']->id, 'deleted_at' => null]);
        $this->assertSame(0, $a['teacher']->groups()->count());
    }

    public function test_autentifikatsiyasiz_himoyalangan_endpointlar_401(): void
    {
        foreach ([
            ['GET', '/api/v1/admin/children'],
            ['POST', '/api/v1/admin/groups'],
            ['PUT', '/api/v1/admin/teachers/1/groups'],
            ['GET', '/api/v1/parent/children'],
            ['GET', '/api/v1/teacher/dashboard'],
            ['GET', '/api/v1/super-admin/organizations'],
        ] as [$method, $url]) {
            $this->json($method, $url)->assertUnauthorized();
        }
    }
}
