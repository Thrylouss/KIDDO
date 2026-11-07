<?php

namespace Tests\Feature\Parent;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/v1/parent/children — ota-ona faqat o'ziga bog'langan,
 * o'z bog'chasidagi farzandlarni ko'radi.
 */
class ParentChildrenTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/parent/children';

    /** Ota-ona foydalanuvchisi va uning profili (bir bog'chada). */
    private function parentIn(Organization $org): array
    {
        $user    = User::factory()->parent()->create(['organization_id' => $org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $org->id]);
        return [$user, $profile];
    }

    private function link(ParentProfile $profile, Child $child, string $relation = 'ona'): void
    {
        $profile->children()->attach($child->id, ['relation_type' => $relation]);
    }

    private function idsFor(User $user, string $query = ''): array
    {
        return collect(
            $this->actingAsParent($user)->getJson(self::URL . $query)->assertOk()->json('data')
        )->pluck('id')->sort()->values()->all();
    }

    // ── Kirish huquqi ─────────────────────────────────────────────

    public function test_autentifikatsiyasiz_rad_etiladi(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
    }

    public function test_tarbiyachi_va_super_admin_kira_olmaydi(): void
    {
        $org = Organization::factory()->create();

        foreach ([
            User::factory()->teacher()->create(['organization_id' => $org->id]),
            User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]),
        ] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson(self::URL)->assertForbidden();
        }
    }

    public function test_admin_ota_ona_endpointiga_kira_olmaydi(): void
    {
        // Admin ota-onalarni faqat /admin/* orqali boshqaradi
        $org   = Organization::factory()->create();
        $admin = User::factory()->admin()->create(['organization_id' => $org->id]);
        Child::factory()->count(2)->create(['organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')->getJson(self::URL)->assertForbidden();
    }

    // ── Faqat o'z farzandlari ─────────────────────────────────────

    public function test_ota_ona_faqat_ozi_bilan_boglangan_farzandlarni_koradi(): void
    {
        $org             = Organization::factory()->create();
        [$user, $mine]   = $this->parentIn($org);
        [, $otherParent] = $this->parentIn($org);

        $myChild      = Child::factory()->create(['organization_id' => $org->id]);
        $siblingChild = Child::factory()->create(['organization_id' => $org->id]);
        $othersChild  = Child::factory()->create(['organization_id' => $org->id]);
        Child::factory()->create(['organization_id' => $org->id]); // hech kimga bog'lanmagan

        $this->link($mine, $myChild);
        $this->link($mine, $siblingChild, 'ota');
        $this->link($otherParent, $othersChild);

        $this->assertSame(collect([$myChild->id, $siblingChild->id])->sort()->values()->all(), $this->idsFor($user));
    }

    public function test_boshqa_bogcha_bolasi_bog_langan_bolsa_ham_korinmaydi(): void
    {
        $orgA          = Organization::factory()->create();
        $orgB          = Organization::factory()->create();
        [$user, $mine] = $this->parentIn($orgA);

        $foreignChild = Child::factory()->create(['organization_id' => $orgB->id]);
        $this->link($mine, $foreignChild); // noto'g'ri bog'lanish (masalan, qo'lda kiritilgan)

        $this->assertSame([], $this->idsFor($user));
    }

    public function test_sorov_parametrlari_e_tiborga_olinmaydi(): void
    {
        $orgA          = Organization::factory()->create();
        $orgB          = Organization::factory()->create();
        [$user, $mine] = $this->parentIn($orgA);

        $myChild    = Child::factory()->create(['organization_id' => $orgA->id]);
        $groupB     = Group::factory()->create(['organization_id' => $orgB->id]);
        $foreignOne = Child::factory()->create(['organization_id' => $orgB->id, 'group_id' => $groupB->id]);
        $this->link($mine, $myChild);

        $query = "?organization_id={$orgB->id}&child_id={$foreignOne->id}&group_id={$groupB->id}&parent_profile_id=999";

        $this->assertSame([$myChild->id], $this->idsFor($user, $query));
    }

    public function test_profil_boshqa_bogchada_bolsa_hech_narsa_qaytmaydi(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();

        // Foydalanuvchi A bog'chasida, profil esa B da — mos kelmaydi
        $user    = User::factory()->parent()->create(['organization_id' => $orgA->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $orgB->id]);
        $this->link($profile, Child::factory()->create(['organization_id' => $orgB->id]));

        $this->assertSame([], $this->idsFor($user));
    }

    public function test_profili_yoq_yoki_bogchasiz_ota_ona_bosh_royxat_oladi(): void
    {
        $org = Organization::factory()->create();
        Child::factory()->create(['organization_id' => $org->id]);

        foreach ([
            User::factory()->parent()->create(['organization_id' => $org->id]),
            User::factory()->parent()->create(['organization_id' => null]),
        ] as $user) {
            $this->app['auth']->forgetGuards();
            $this->assertSame([], $this->idsFor($user));
        }
    }

    public function test_ochirilgan_bola_korinmaydi(): void
    {
        $org           = Organization::factory()->create();
        [$user, $mine] = $this->parentIn($org);
        $child         = Child::factory()->create(['organization_id' => $org->id]);
        $this->link($mine, $child);

        $child->delete();

        $this->assertSame([], $this->idsFor($user));
    }

    // ── Javob shakli ──────────────────────────────────────────────

    public function test_javob_faqat_kerakli_maydonlarni_qaytaradi(): void
    {
        $org           = Organization::factory()->create();
        [$user, $mine] = $this->parentIn($org);
        $group         = Group::factory()->create(['organization_id' => $org->id, 'name' => 'Kamalak guruhi']);
        $child         = Child::factory()->create([
            'organization_id' => $org->id,
            'group_id'        => $group->id,
            'first_name'      => 'Malika',
            'last_name'       => 'Yusupova',
            'birth_date'      => '2021-04-12',
            'gender'          => 'ayol',
        ]);
        $this->link($mine, $child, 'ona');

        $this->actingAsParent($user)->getJson(self::URL)
             ->assertOk()
             ->assertExactJson(['data' => [[
                 'id'            => $child->id,
                 'first_name'    => 'Malika',
                 'last_name'     => 'Yusupova',
                 'birth_date'    => '2021-04-12',
                 'gender'        => 'ayol',
                 'is_active'     => true,
                 'photo_url'     => null,
                 'relation_type' => 'ona',
                 'group'         => ['id' => $group->id, 'name' => 'Kamalak guruhi', 'age_category' => $group->age_category],
                 'organization'  => ['id' => $org->id, 'name' => $org->name, 'address' => $org->address, 'phone' => $org->phone],
                 'teachers'      => [],
             ]]]);
    }
}
