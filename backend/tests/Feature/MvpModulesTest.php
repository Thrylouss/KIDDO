<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Child;
use App\Models\ChildPayment;
use App\Models\Group;
use App\Models\GroupPhoto;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TestImages;
use Tests\TestCase;

/** MVP yakuni: bildirishnomalar (Super Admin → rahbar), oylik to'lov holati, guruh fotogalereyasi. */
class MvpModulesTest extends TestCase
{
    use RefreshDatabase, TestImages;

    private Organization $org;
    private Organization $other;
    private User $owner;
    private User $teacher;
    private Group $group;
    private Group $otherGroup;   // shu bog'cha, tarbiyachiga biriktirilmagan
    private Child $child;
    private Child $foreignChild;
    private User $parent;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->org   = Organization::factory()->create();
        $this->other = Organization::factory()->create();
        $this->owner = User::factory()->admin()->create(['organization_id' => $this->org->id]);

        $this->group      = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->otherGroup = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Oy']);
        $this->child      = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);

        $this->teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        TeacherProfile::factory()->create(['user_id' => $this->teacher->id, 'organization_id' => $this->org->id])
            ->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);

        $this->parent = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $this->org->id]);
        $this->child->linkParent($profile, 'ona', true);

        $this->foreignChild = Child::factory()->create(['organization_id' => $this->other->id,
            'group_id' => Group::factory()->create(['organization_id' => $this->other->id])->id]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    private function upload(User $user, string $prefix, int $groupId, string $caption = 'Bayram')
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum')->post("/api/v1/{$prefix}/photos", [
            'group_id' => $groupId, 'caption' => $caption, 'photo' => $this->pngUpload(300, 200),
        ], ['Accept' => 'application/json']);
    }

    // ── Bildirishnomalar ────────────────────────────────────────────

    public function test_super_admin_xabari_rahbarga_yetadi_boshqa_bogchaga_emas(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->as($sa)->postJson('/api/v1/super-admin/notifications', [
            'title' => 'Tekshiruv', 'message' => 'Ertaga yig\'ilish', 'type' => 'info', 'organization_id' => $this->org->id,
        ])->assertOk();

        $res = $this->as($this->owner)->getJson('/api/v1/admin/notifications')->assertOk()
            ->assertJsonPath('unread_count', 1)->assertJsonPath('data.0.title', 'Tekshiruv');
        $id = $res->json('data.0.id');

        $stranger = User::factory()->admin()->create(['organization_id' => $this->other->id]);
        $this->as($stranger)->getJson('/api/v1/admin/notifications')->assertOk()->assertJsonPath('unread_count', 0)->assertJsonCount(0, 'data');
        $this->as($stranger)->patchJson("/api/v1/admin/notifications/{$id}/read")->assertNotFound();

        $this->as($this->owner)->patchJson("/api/v1/admin/notifications/{$id}/read")->assertOk();
        $this->assertNotNull(AppNotification::find($id)->read_at);
        $this->as($this->owner)->getJson('/api/v1/admin/notifications')->assertJsonPath('unread_count', 0);

        $this->as($this->teacher)->getJson('/api/v1/admin/notifications')->assertForbidden();
    }

    // ── To'lovlar ───────────────────────────────────────────────────

    public function test_rahbar_oylik_tolovni_qayd_etadi_tahrirlaydi_va_bekor_qiladi(): void
    {
        $month = AttendanceService::today()->format('Y-m');
        $this->as($this->owner)->getJson("/api/v1/admin/payments?month={$month}")->assertOk()
            ->assertJsonPath('summary.jami', 1)->assertJsonPath('summary.tolagan', 0)->assertJsonPath('children.0.payment', null);

        $this->as($this->owner)->putJson('/api/v1/admin/payments', [
            'child_id' => $this->child->id, 'month' => $month, 'amount' => 450000, 'paid_at' => AttendanceService::today()->toDateString(),
        ])->assertOk();
        $this->as($this->owner)->putJson('/api/v1/admin/payments', [
            'child_id' => $this->child->id, 'month' => $month, 'amount' => 500000, 'paid_at' => AttendanceService::today()->toDateString(), 'note' => 'Naqd',
        ])->assertOk();
        $this->assertSame(1, ChildPayment::count());

        $this->as($this->owner)->getJson("/api/v1/admin/payments?month={$month}")
            ->assertJsonPath('summary.tolagan', 1)->assertJsonPath('summary.summa', 500000)->assertJsonPath('children.0.payment.note', 'Naqd');
        $this->as($this->owner)->getJson('/api/v1/admin/dashboard')->assertJsonPath('tolovlar.tolagan', 1)->assertJsonPath('tolovlar.summa', 500000);

        $this->as($this->owner)->deleteJson("/api/v1/admin/payments/{$this->child->id}/{$month}")->assertOk();
        $this->assertSame(0, ChildPayment::count());
    }

    public function test_tolov_validatsiya_va_tenant_izolyatsiyasi(): void
    {
        $month = AttendanceService::today()->format('Y-m');
        $this->as($this->owner)->putJson('/api/v1/admin/payments', ['child_id' => $this->child->id, 'month' => $month, 'amount' => 0, 'paid_at' => 'x'])
            ->assertJsonValidationErrors(['amount', 'paid_at']);
        $this->as($this->owner)->putJson('/api/v1/admin/payments', [
            'child_id' => $this->foreignChild->id, 'month' => $month, 'amount' => 1000, 'paid_at' => AttendanceService::today()->toDateString(),
        ])->assertNotFound();
        $this->as($this->teacher)->getJson('/api/v1/admin/payments')->assertForbidden();
        $this->assertSame(0, ChildPayment::count());
    }

    public function test_ota_ona_faqat_oz_farzandi_tolov_holatini_koradi(): void
    {
        $month = AttendanceService::today()->toImmutable()->startOfMonth();
        ChildPayment::create(['organization_id' => $this->org->id, 'child_id' => $this->child->id, 'month' => $month->toDateString(),
            'amount' => 450000, 'paid_at' => $month->toDateString()]);

        $this->actingAsParent($this->parent)->getJson("/api/v1/parent/children/{$this->child->id}/payments")->assertOk()
            ->assertJsonCount(6, 'data')->assertJsonPath('data.0.oy', $month->format('Y-m'))
            ->assertJsonPath('data.0.holat', 'paid')->assertJsonPath('data.1.holat', 'unpaid');
        $this->actingAsParent($this->parent)->getJson("/api/v1/parent/children/{$this->foreignChild->id}/payments")->assertNotFound();
    }

    // ── Fotogalereya ────────────────────────────────────────────────

    public function test_rahbar_rasm_yuklaydi_korsatadi_va_ochiradi(): void
    {
        $id = $this->upload($this->owner, 'admin', $this->group->id)->assertCreated()
            ->assertJsonPath('data.group.name', 'Quyosh')->assertJsonMissingPath('data.path')->json('data.id');
        $path = GroupPhoto::findOrFail($id)->path;
        Storage::disk('local')->assertExists($path);
        $this->assertMatchesRegularExpression('#^group-photos/\d+/[0-9a-f-]{36}\.png$#', $path);

        $this->as($this->owner)->getJson('/api/v1/admin/photos')->assertOk()->assertJsonPath('meta.total', 1);
        $this->as($this->owner)->get("/api/v1/admin/photos/{$id}/file")->assertOk();

        $stranger = User::factory()->admin()->create(['organization_id' => $this->other->id]);
        $this->as($stranger)->get("/api/v1/admin/photos/{$id}/file")->assertNotFound();
        $this->as($stranger)->deleteJson("/api/v1/admin/photos/{$id}")->assertNotFound();

        $this->as($this->owner)->deleteJson("/api/v1/admin/photos/{$id}")->assertOk();
        Storage::disk('local')->assertMissing($path);
    }

    public function test_rasm_validatsiyasi(): void
    {
        $this->as($this->owner)->post('/api/v1/admin/photos', ['group_id' => $this->group->id,
            'photo' => UploadedFile::fake()->create('virus.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('photo');
        $this->upload($this->owner, 'admin', Group::factory()->create(['organization_id' => $this->other->id])->id)->assertNotFound();
        $this->assertSame(0, GroupPhoto::count());
    }

    public function test_tarbiyachi_faqat_oz_guruhiga_yuklaydi_va_faqat_oz_rasmini_ochiradi(): void
    {
        $this->upload($this->teacher, 'teacher', $this->otherGroup->id)->assertNotFound();
        $mine   = $this->upload($this->teacher, 'teacher', $this->group->id)->assertCreated()->json('data.id');
        $owners = $this->upload($this->owner, 'admin', $this->group->id)->json('data.id');
        $hidden = $this->upload($this->owner, 'admin', $this->otherGroup->id)->json('data.id');

        $ids = collect($this->as($this->teacher)->getJson('/api/v1/teacher/photos')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$mine, $owners], $ids);
        $this->as($this->teacher)->get("/api/v1/teacher/photos/{$hidden}/file")->assertNotFound();
        $this->as($this->teacher)->deleteJson("/api/v1/teacher/photos/{$owners}")->assertForbidden();
        $this->as($this->teacher)->deleteJson("/api/v1/teacher/photos/{$mine}")->assertOk();
    }

    public function test_ota_ona_faqat_farzandi_guruhi_rasmlarini_koradi(): void
    {
        $visible = $this->upload($this->owner, 'admin', $this->group->id)->json('data.id');
        $hidden  = $this->upload($this->owner, 'admin', $this->otherGroup->id)->json('data.id');

        $ids = collect($this->actingAsParent($this->parent)->getJson("/api/v1/parent/children/{$this->child->id}/photos")->assertOk()->json('data'))->pluck('id')->all();
        $this->assertSame([$visible], $ids);
        $this->actingAsParent($this->parent)->get("/api/v1/parent/photos/{$visible}/file")->assertOk();
        $this->actingAsParent($this->parent)->get("/api/v1/parent/photos/{$hidden}/file")->assertNotFound();
        $this->actingAsParent($this->parent)->getJson("/api/v1/parent/children/{$this->foreignChild->id}/photos")->assertNotFound();
    }

    public function test_super_admin_impersonatsiyada_rasm_va_tolovni_ozgartira_olmaydi(): void
    {
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $headers = ['X-Impersonated-Org' => (string) $this->org->id, 'Accept' => 'application/json'];

        $this->as($sa)->withHeaders($headers)->getJson('/api/v1/admin/payments')->assertOk();
        $this->as($sa)->withHeaders($headers)->putJson('/api/v1/admin/payments', [
            'child_id' => $this->child->id, 'month' => AttendanceService::today()->format('Y-m'), 'amount' => 1000,
            'paid_at' => AttendanceService::today()->toDateString(),
        ])->assertForbidden();
        $this->as($sa)->withHeaders($headers)->post('/api/v1/admin/photos', ['group_id' => $this->group->id,
            'photo' => $this->pngUpload(100, 100)])->assertForbidden();
        $this->assertSame(0, ChildPayment::count() + GroupPhoto::count());
    }
}
