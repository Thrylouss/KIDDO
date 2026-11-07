<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Admin: ota-ona yaratish va bolaga bog'lash.
 * Barcha amallar faqat adminning o'z bog'chasi doirasida.
 */
class ParentManagementTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithOrg(): array
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        return [$admin, $org];
    }

    private function validParent(array $overrides = []): array
    {
        return array_merge([
            'first_name'    => 'Dilnoza',
            'last_name'     => 'Karimova',
            'phone'         => '+998907001122',
            'password'      => 'xavfsiz-parol',
            'relation_type' => 'ona',
        ], $overrides);
    }

    // ── Ota-ona yaratish ──────────────────────────────────────────

    public function test_admin_ota_ona_yaratadi(): void
    {
        [$admin, $org] = $this->adminWithOrg();

        $res = $this->actingAs($admin, 'sanctum')
                    ->postJson('/api/v1/admin/parents', $this->validParent())
                    ->assertCreated()
                    ->assertJsonPath('data.organization_id', $org->id)
                    ->assertJsonPath('data.relation_type', 'ona');

        $user = User::where('phone', '+998907001122')->firstOrFail();
        $this->assertSame(User::ROLE_PARENT, $user->role);
        $this->assertSame($org->id, $user->organization_id);
        $this->assertTrue(Hash::check('xavfsiz-parol', $user->password));
        $this->assertSame($user->id, $res->json('data.user_id'));
        $this->assertArrayNotHasKey('password', $res->json('data'));
    }

    public function test_sorovdagi_organization_id_va_role_e_tiborga_olinmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $otherOrg      = Organization::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/parents', $this->validParent([
                 'organization_id' => $otherOrg->id,
                 'role'            => User::ROLE_SUPER_ADMIN,
             ]))
             ->assertCreated();

        $user = User::where('phone', '+998907001122')->firstOrFail();
        $this->assertSame(User::ROLE_PARENT, $user->role);
        $this->assertSame($org->id, $user->organization_id);
        $this->assertSame(0, ParentProfile::forOrganization($otherOrg->id)->count());
    }

    public function test_yaratishda_validatsiya(): void
    {
        [$admin] = $this->adminWithOrg();
        User::factory()->create(['phone' => '+998907001122']);

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/v1/admin/parents', $this->validParent(['password' => 'qisqa', 'relation_type' => 'amaki']))
             ->assertStatus(422)
             ->assertJsonValidationErrors(['phone', 'password', 'relation_type']);

        $this->assertSame(0, ParentProfile::count());
    }

    public function test_super_admin_impersonatsiyada_ota_ona_yarata_olmaydi(): void
    {
        $org        = Organization::factory()->create();
        $superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        // Super Admin bog'cha panelida faqat ko'radi — ota-onani rahbar qo'shadi
        $this->actingAs($superAdmin, 'sanctum')
             ->withHeaders(['X-Impersonated-Org' => $org->id])
             ->postJson('/api/v1/admin/parents', $this->validParent())
             ->assertForbidden();
        $this->assertSame(0, \App\Models\ParentProfile::where('organization_id', $org->id)->count());
    }

    public function test_tarbiyachi_va_ota_ona_ota_ona_yarata_olmaydi(): void
    {
        $org = Organization::factory()->create();

        foreach ([
            User::factory()->teacher()->create(['organization_id' => $org->id]),
            User::factory()->parent()->create(['organization_id' => $org->id]),
        ] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')
                 ->postJson('/api/v1/admin/parents', $this->validParent())
                 ->assertForbidden();
        }

        $this->assertSame(0, ParentProfile::count());
    }

    // ── Bolaga bog'lash ───────────────────────────────────────────

    public function test_admin_ota_onani_bolaga_bog_laydi_va_yangilaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        $parent        = ParentProfile::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/admin/children/{$child->id}/parents", [
                 'parent_profile_id' => $parent->id,
                 'relation_type'     => 'ona',
             ])
             ->assertOk()
             ->assertJsonPath('data.parent_profiles.0.id', $parent->id);

        // Takroriy so'rov yangi yozuv yaratmaydi, faqat ma'lumotni yangilaydi
        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/admin/children/{$child->id}/parents", [
                 'parent_profile_id' => $parent->id,
                 'relation_type'     => 'vasiy',
                 'is_primary'        => true,
             ])
             ->assertOk();

        $this->assertDatabaseCount('child_parent', 1);
        $this->assertDatabaseHas('child_parent', [
            'child_id' => $child->id, 'parent_profile_id' => $parent->id,
            'relation_type' => 'vasiy', 'is_primary' => true,
        ]);
    }

    public function test_boshqa_bogcha_ota_onasini_bog_lab_bolmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        $foreignParent = ParentProfile::factory()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/admin/children/{$child->id}/parents", [
                 'parent_profile_id' => $foreignParent->id,
                 'relation_type'     => 'ona',
             ])
             ->assertNotFound();

        $this->assertDatabaseCount('child_parent', 0);
    }

    public function test_boshqa_bogcha_bolasiga_bog_lab_bolmaydi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $foreignChild  = Child::factory()->create();
        $parent        = ParentProfile::factory()->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/admin/children/{$foreignChild->id}/parents", [
                 'parent_profile_id' => $parent->id,
                 'relation_type'     => 'ona',
             ])
             ->assertNotFound();

        $this->assertDatabaseCount('child_parent', 0);
    }

    public function test_bog_lanishni_olib_tashlash(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        $parent        = ParentProfile::factory()->create(['organization_id' => $org->id]);
        $child->parentProfiles()->attach($parent->id, ['relation_type' => 'ota']);

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/v1/admin/children/{$child->id}/parents/{$parent->id}")
             ->assertOk();
        $this->assertDatabaseCount('child_parent', 0);

        // Mavjud bo'lmagan bog'lanish
        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/v1/admin/children/{$child->id}/parents/{$parent->id}")
             ->assertNotFound();
    }

    public function test_boshqa_bogcha_bog_lanishini_olib_tashlab_bolmaydi(): void
    {
        [$admin]      = $this->adminWithOrg();
        $foreignChild = Child::factory()->create();
        $foreignPar   = ParentProfile::factory()->create(['organization_id' => $foreignChild->organization_id]);
        $foreignChild->parentProfiles()->attach($foreignPar->id, ['relation_type' => 'ona']);

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/v1/admin/children/{$foreignChild->id}/parents/{$foreignPar->id}")
             ->assertNotFound();

        $this->assertDatabaseCount('child_parent', 1);
    }

    // ── Ro'yxat kontrakti ─────────────────────────────────────────

    public function test_royxat_relation_type_va_bog_lanish_ma_lumotini_qaytaradi(): void
    {
        // Frontend bolaning ota-onalarini shu javobdagi pivot ma'lumotidan oladi
        [$admin, $org] = $this->adminWithOrg();
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        $parent        = ParentProfile::factory()->create(['organization_id' => $org->id, 'relation_type' => 'ota']);
        $child->parentProfiles()->attach($parent->id, ['relation_type' => 'vasiy', 'is_primary' => true]);
        ParentProfile::factory()->create(); // boshqa bog'cha — ro'yxatda bo'lmasligi kerak

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/v1/admin/parents')
             ->assertOk()
             ->assertJsonCount(1, 'data')
             ->assertJsonPath('data.0.relation_type', 'ota')
             ->assertJsonPath('data.0.children.0.id', $child->id)
             ->assertJsonPath('data.0.children.0.pivot.relation_type', 'vasiy')
             ->assertJsonPath('data.0.children.0.pivot.is_primary', true);
    }

    // ── To'liq zanjir ─────────────────────────────────────────────

    public function test_admin_yaratgan_va_bog_lagan_ota_ona_faqat_shu_bolani_koradi(): void
    {
        [$admin, $org] = $this->adminWithOrg();
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        Child::factory()->create(['organization_id' => $org->id]); // bog'lanmagan

        $parentId = $this->actingAs($admin, 'sanctum')
                         ->postJson('/api/v1/admin/parents', $this->validParent())
                         ->assertCreated()
                         ->json('data.id');

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/v1/admin/children/{$child->id}/parents", [
                 'parent_profile_id' => $parentId,
                 'relation_type'     => 'ona',
             ])
             ->assertOk();

        $parentUser = User::where('phone', '+998907001122')->firstOrFail();
        $this->app['auth']->forgetGuards();

        $ids = collect(
            $this->actingAsParent($parentUser)->getJson('/api/v1/parent/children')->assertOk()->json('data')
        )->pluck('id')->all();

        $this->assertSame([$child->id], $ids);
    }
}
