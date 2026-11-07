<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An admin with organization_id = null (e.g. the seeded test admin) must not
 * see or create data in any kindergarten.
 */
class UnassignedKindergartenUserTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create(['organization_id' => null]);

        // Data in a real kindergarten that must stay invisible.
        $org = Organization::factory()->create();
        Group::factory()->create(['organization_id' => $org->id]);
        Child::factory()->count(2)->create(['organization_id' => $org->id]);
        TeacherProfile::factory()->create(['organization_id' => $org->id]);
        ParentProfile::factory()->create(['organization_id' => $org->id]);
    }

    private function assertClientError(int $status, string $action): void
    {
        $this->assertTrue($status >= 400 && $status < 500, "{$action} returned {$status}, expected a 4xx rejection");
    }

    // ── Reads ──────────────────────────────────────────────────────

    public function test_lists_are_empty(): void
    {
        foreach (['children', 'groups', 'teachers', 'parents'] as $resource) {
            $this->app['auth']->forgetGuards();
            $res = $this->actingAs($this->admin, 'sanctum')
                        ->getJson("/api/v1/admin/{$resource}")
                        ->assertOk();
            $this->assertCount(0, $res->json('data'), "Unassigned admin saw {$resource}");
        }
    }

    public function test_dashboard_counts_are_zero(): void
    {
        $this->actingAs($this->admin, 'sanctum')
             ->getJson('/api/v1/admin/dashboard')
             ->assertOk()
             ->assertExactJson([
                 'bogcha'             => null,
                 'bolalar_soni'       => 0,
                 'faol_bolalar_soni'  => 0,
                 'guruhlar_soni'      => 0,
                 'tarbiyachilar_soni' => 0,
                 'ota_onalar_soni'    => 0,
                 'bugungi_davomat'    => [
                     'sana' => AttendanceService::today()->toDateString(),
                     'jami' => 0, 'keldi' => 0, 'kelmadi' => 0, 'sababli' => 0, 'belgilanmagan' => 0,
                 ],
                 'tolovlar'           => [
                     'oy' => AttendanceService::today()->format('Y-m'), 'jami' => 0, 'tolagan' => 0, 'tolanmagan' => 0, 'summa' => 0,
                 ],
                 'songgi_faoliyatlar' => [],
             ]);
    }

    public function test_cannot_view_update_or_delete_existing_child(): void
    {
        $child = Child::first();

        $this->actingAs($this->admin, 'sanctum')->getJson("/api/v1/admin/children/{$child->id}")->assertNotFound();
        $this->actingAs($this->admin, 'sanctum')->putJson("/api/v1/admin/children/{$child->id}", ['first_name' => 'X'])->assertNotFound();
        $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/v1/admin/children/{$child->id}")->assertNotFound();

        $this->assertDatabaseHas('children', ['id' => $child->id, 'deleted_at' => null]);
        $this->assertDatabaseMissing('children', ['first_name' => 'X']);
    }

    // ── Writes ─────────────────────────────────────────────────────

    public function test_cannot_create_child(): void
    {
        $status = $this->actingAs($this->admin, 'sanctum')
             ->postJson('/api/v1/admin/children', [
                 'first_name' => 'Kamola',
                 'last_name'  => 'Yusupova',
                 'birth_date' => '2022-03-15',
                 'gender'     => 'ayol',
             ])->status();

        $this->assertClientError($status, 'Creating a child');
        $this->assertSame(2, Child::count());
    }

    public function test_cannot_create_group(): void
    {
        $status = $this->actingAs($this->admin, 'sanctum')
             ->postJson('/api/v1/admin/groups', ['name' => 'Yetim guruh'])
             ->status();

        $this->assertClientError($status, 'Creating a group');
        $this->assertSame(1, Group::count());
    }

    public function test_cannot_create_teacher_account(): void
    {
        $usersBefore = User::count();

        $status = $this->actingAs($this->admin, 'sanctum')
             ->postJson('/api/v1/admin/teachers', [
                 'first_name' => 'Dilnoza',
                 'last_name'  => 'Karimova',
                 'phone'      => '+998907776655',
                 'password'   => 'password123',
             ])->status();

        $this->assertClientError($status, 'Creating a teacher');
        $this->assertSame($usersBefore, User::count());
        $this->assertDatabaseMissing('users', ['phone' => '+998907776655']);
    }

    // ── Other roles ────────────────────────────────────────────────

    public function test_unassigned_teacher_and_parent_cannot_reach_admin_routes(): void
    {
        foreach ([User::factory()->teacher()->create(), User::factory()->parent()->create()] as $user) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($user, 'sanctum')->getJson('/api/v1/admin/children')->assertForbidden();
        }
    }
}
