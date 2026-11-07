<?php

namespace Tests\Feature\Attendance;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ota-ona: GET /v1/parent/children/{id}/attendance — faqat o'ziga bog'langan farzand.
 */
class ParentAttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $user;
    private ParentProfile $profile;
    private Child $child;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-28 10:00', 'Asia/Tashkent'));

        $this->org     = Organization::factory()->create();
        $this->user    = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $this->profile = ParentProfile::factory()->create(['user_id' => $this->user->id, 'organization_id' => $this->org->id]);
        $this->child   = Child::factory()->create(['organization_id' => $this->org->id]);
        $this->profile->children()->attach($this->child->id, ['relation_type' => 'ona']);
    }

    private function url(Child $child, string $query = ''): string
    {
        return "/api/v1/parent/children/{$child->id}/attendance{$query}";
    }

    public function test_ota_ona_farzandining_songgi_30_kunlik_davomatini_koradi(): void
    {
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => '2026-10-28', 'status' => 'present']);
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => '2026-10-27', 'status' => 'excused', 'note' => 'Kasal']);
        Attendance::factory()->create(['child_id' => $this->child->id, 'date' => '2026-09-28', 'status' => 'absent']); // 30 kundan oldin

        $this->actingAsParent($this->user)->getJson($this->url($this->child))
             ->assertOk()
             ->assertJsonPath('from', '2026-09-29')
             ->assertJsonPath('to', '2026-10-28')
             ->assertJsonPath('records', [
                 ['date' => '2026-10-28', 'status' => 'present', 'note' => null],
                 ['date' => '2026-10-27', 'status' => 'excused', 'note' => 'Kasal'],
             ])
             ->assertJsonPath('summary', ['present' => 1, 'absent' => 0, 'excused' => 1]);
    }

    public function test_boshqa_bola_404(): void
    {
        $sameOrg = Child::factory()->create(['organization_id' => $this->org->id]);
        $foreign = Child::factory()->create();
        Attendance::factory()->create(['child_id' => $sameOrg->id]);
        Attendance::factory()->create(['child_id' => $foreign->id]);

        foreach ([$sameOrg, $foreign] as $child) {
            $this->actingAsParent($this->user)->getJson($this->url($child))->assertNotFound();
        }
    }

    public function test_boshqa_bogcha_bolasi_bog_langan_bolsa_ham_404(): void
    {
        $foreign = Child::factory()->create();
        $this->profile->children()->attach($foreign->id, ['relation_type' => 'ona']); // noto'g'ri bog'lanish

        $this->actingAsParent($this->user)->getJson($this->url($foreign))->assertNotFound();
    }

    public function test_boshqa_rollar_va_kirishsiz_rad_etiladi(): void
    {
        $this->getJson($this->url($this->child))->assertUnauthorized();

        foreach ([
            User::factory()->admin()->create(['organization_id' => $this->org->id]),
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
        ] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson($this->url($this->child))->assertForbidden();
        }
    }

    public function test_sana_oraligi_validatsiyasi(): void
    {
        foreach ([
            '?from=2026-10-20&to=2026-10-10',    // from > to
            '?from=2026-01-01&to=2026-10-28',    // 92 kundan ko'p
            '?to=2026-10-29',                    // kelajak
            '?from=28.10.2026',                  // format
        ] as $query) {
            $this->actingAsParent($this->user)->getJson($this->url($this->child, $query))->assertStatus(422);
        }

        $this->actingAsParent($this->user)->getJson($this->url($this->child, '?from=2026-08-01&to=2026-10-28'))
             ->assertOk();
    }
}
