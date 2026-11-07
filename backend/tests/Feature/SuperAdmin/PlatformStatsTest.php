<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Super-admin platforma statistikasi: barcha bog'chalar bo'yicha agregat sonlar
 * (bola darajasidagi yozuvlarsiz) va har bir bog'cha uchun sonlar.
 */
class PlatformStatsTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private Organization $a;
    private Organization $b;

    protected function setUp(): void
    {
        parent::setUp();
        $this->superAdmin = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->a = Organization::factory()->create(['name' => 'Quyoshcha', 'is_active' => true]);
        $this->b = Organization::factory()->create(['name' => 'Lolajon', 'is_active' => false]);

        $groupA = Group::factory()->create(['organization_id' => $this->a->id]);
        Group::factory()->create(['organization_id' => $this->a->id, 'is_active' => false]);
        Group::factory()->create(['organization_id' => $this->b->id]);

        $kids = Child::factory()->count(3)->create(['organization_id' => $this->a->id, 'group_id' => $groupA->id]);
        Child::factory()->create(['organization_id' => $this->b->id]);

        TeacherProfile::factory()->create(['organization_id' => $this->a->id]);
        TeacherProfile::factory()->create(['organization_id' => $this->a->id, 'is_active' => false]);

        $today = AttendanceService::today()->toDateString();
        Attendance::factory()->create(['child_id' => $kids[0]->id, 'date' => $today, 'status' => Attendance::STATUS_PRESENT]);
        Attendance::factory()->create(['child_id' => $kids[1]->id, 'date' => $today, 'status' => Attendance::STATUS_EXCUSED]);

        // O'chirilgan bog'cha ma'lumotlari hisobga olinmaydi
        $deleted = Organization::factory()->create();
        Child::factory()->count(5)->create(['organization_id' => $deleted->id]);
        $deleted->delete();
    }

    public function test_summary_platforma_agregatlari(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/v1/super-admin/dashboard')
            ->assertOk()
            ->assertJsonPath('jami_bogchalar', 2)
            ->assertJsonPath('faol_bogchalar', 1)
            ->assertJsonPath('nofaol_bogchalar', 1)
            ->assertJsonPath('platforma.jami_bolalar', 4)
            ->assertJsonPath('platforma.jami_guruhlar', 2)
            ->assertJsonPath('platforma.jami_tarbiyachilar', 1)
            ->assertJsonPath('platforma.bugungi_davomat.keldi', 1)
            ->assertJsonPath('platforma.bugungi_davomat.sababli', 1)
            ->assertJsonPath('platforma.bugungi_davomat.belgilanmagan', 2);
    }

    public function test_bogchalar_royxati_sonlar_bilan(): void
    {
        $res = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/v1/super-admin/organizations?sort=name')
            ->assertOk();

        $a = collect($res->json('data'))->firstWhere('id', $this->a->id);
        $this->assertSame(3, $a['children_count']);
        $this->assertSame(1, $a['groups_count']);
        $this->assertSame(1, $a['teachers_count']);
    }

    public function test_bogcha_tafsiloti_bugungi_davomat_agregati(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson("/api/v1/super-admin/organizations/{$this->a->id}")
            ->assertOk()
            ->assertJsonPath('data.children_count', 3)
            ->assertJsonPath('data.teacher_profiles_count', 1)
            ->assertJsonPath('data.bugungi_davomat.jami', 3)
            ->assertJsonPath('data.bugungi_davomat.keldi', 1)
            ->assertJsonMissingPath('data.children');
    }

    public function test_bogcha_admini_va_tarbiyachi_platforma_statistikasini_ololmaydi(): void
    {
        $admin   = User::factory()->admin()->create(['organization_id' => $this->a->id]);
        $teacher = User::factory()->teacher()->create(['organization_id' => $this->a->id]);

        foreach ([$admin, $teacher] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson('/api/v1/super-admin/dashboard')->assertForbidden();
            $this->actingAs($user, 'sanctum')->getJson("/api/v1/super-admin/organizations/{$this->b->id}")->assertForbidden();
        }
    }
}
