<?php

namespace Tests\Feature\Teacher;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TestImages;
use Tests\TestCase;

/**
 * Bola rasmi: yuklash, almashtirish, o'chirish, yopiq uzatish va ruxsatlar.
 */
class ChildPhotoTest extends TestCase
{
    use RefreshDatabase, TestImages;

    private Organization $org;
    private User $teacher;
    private Group $group;
    private Child $child;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->org     = Organization::factory()->create();
        $this->teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $profile       = TeacherProfile::factory()->create(['user_id' => $this->teacher->id, 'organization_id' => $this->org->id]);
        $this->group   = Group::factory()->create(['organization_id' => $this->org->id]);
        $profile->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);
        $this->child   = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
    }

    private function as(?User $user = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user ?? $this->teacher, 'sanctum');
    }

    private function upload(UploadedFile $file, ?Child $child = null, string $prefix = '/api/v1/teacher')
    {
        return $this->as()->post("{$prefix}/children/" . ($child ?? $this->child)->id . '/photo', ['photo' => $file], ['Accept' => 'application/json']);
    }

    public function test_yuklash_yopiq_diskka_saqlanadi_va_uzatiladi(): void
    {
        $res = $this->upload($this->pngUpload())->assertOk()->assertJsonPath('message', 'Rasm saqlandi.');

        $path = $this->child->fresh()->profile_photo;
        $this->assertMatchesRegularExpression('#^child-photos/' . $this->org->id . '/[0-9a-f-]{36}\.png$#', $path);
        Storage::disk('local')->assertExists($path);
        $this->assertStringContainsString("/api/v1/teacher/children/{$this->child->id}/photo?v=", $res->json('photo_url'));
        $this->assertStringNotContainsString('child-photos', $res->json('photo_url'));   // ichki yo'l oshkor qilinmaydi

        $this->as()->get("/api/v1/teacher/children/{$this->child->id}/photo")
             ->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->as()->getJson("/api/v1/teacher/children/{$this->child->id}")->assertJsonPath('data.photo_url', $res->json('photo_url'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'child.photo_updated', 'organization_id' => $this->org->id]);
    }

    public function test_almashtirishda_eski_fayl_ochiriladi(): void
    {
        $this->upload($this->pngUpload())->assertOk();
        $old = $this->child->fresh()->profile_photo;

        $this->upload($this->pngUpload(200, 200))->assertOk();
        $new = $this->child->fresh()->profile_photo;

        $this->assertNotSame($old, $new);
        Storage::disk('local')->assertMissing($old);
        Storage::disk('local')->assertExists($new);
    }

    public function test_ochirish(): void
    {
        $this->upload($this->pngUpload())->assertOk();
        $path = $this->child->fresh()->profile_photo;

        $this->as()->deleteJson("/api/v1/teacher/children/{$this->child->id}/photo")->assertOk()->assertJsonPath('photo_url', null);
        Storage::disk('local')->assertMissing($path);
        $this->assertNull($this->child->fresh()->profile_photo);
        $this->as()->get("/api/v1/teacher/children/{$this->child->id}/photo", ['Accept' => 'application/json'])->assertNotFound();
        $this->as()->deleteJson("/api/v1/teacher/children/{$this->child->id}/photo")->assertNotFound();
    }

    public function test_notogri_fayllar_rad_etiladi(): void
    {
        $this->upload($this->fakeJpgText())->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->upload(UploadedFile::fake()->create('hujjat.pdf', 10, 'application/pdf'))->assertUnprocessable();
        $this->upload($this->pngUpload(32, 32))->assertUnprocessable()->assertJsonValidationErrors('photo');          // juda kichik
        $this->upload(UploadedFile::fake()->create('katta.png', 3000, 'image/png'))->assertUnprocessable();            // 2 MB dan katta
        $this->as()->post("/api/v1/teacher/children/{$this->child->id}/photo", [], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->assertNull($this->child->fresh()->profile_photo);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_xato_xabari_ozbekcha(): void
    {
        $res = $this->upload($this->fakeJpgText())->assertUnprocessable();
        $this->assertStringContainsString('Rasm', $res->json('errors.photo.0'));
    }

    public function test_boshqa_guruh_va_bogcha_bolasi_404(): void
    {
        $otherGroupChild = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => Group::factory()->create(['organization_id' => $this->org->id])->id]);
        $foreign = Child::factory()->create();

        foreach ([$otherGroupChild, $foreign] as $child) {
            $this->upload($this->pngUpload(), $child)->assertNotFound();
            $this->as()->get("/api/v1/teacher/children/{$child->id}/photo", ['Accept' => 'application/json'])->assertNotFound();
            $this->as()->deleteJson("/api/v1/teacher/children/{$child->id}/photo")->assertNotFound();
        }
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_ota_ona_faqat_oz_farzandi_rasmini_oladi(): void
    {
        $this->upload($this->pngUpload())->assertOk();
        $other = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);

        $parent  = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $profile = ParentProfile::factory()->create(['user_id' => $parent->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach($this->child->id, ['relation_type' => 'ona']);

        $this->app['auth']->forgetGuards();
        $list = $this->actingAsParent($parent)->getJson('/api/v1/parent/children')->assertOk();
        $this->assertStringContainsString("/api/v1/parent/children/{$this->child->id}/photo?v=", $list->json('data.0.photo_url'));

        $this->actingAsParent($parent)->get("/api/v1/parent/children/{$this->child->id}/photo")->assertOk();
        $this->actingAsParent($parent)->get("/api/v1/parent/children/{$other->id}/photo", ['Accept' => 'application/json'])->assertNotFound();
        $this->actingAsParent($parent)->post("/api/v1/teacher/children/{$this->child->id}/photo", ['photo' => $this->pngUpload()], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_admin_yuklaydi_va_boshqa_bogchaga_ruxsat_yoq(): void
    {
        $admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin, 'sanctum')->post("/api/v1/admin/children/{$this->child->id}/photo", ['photo' => $this->pngUpload()], ['Accept' => 'application/json'])->assertOk();
        $this->actingAs($admin, 'sanctum')->get("/api/v1/admin/children/{$this->child->id}/photo")->assertOk();

        $foreign = Child::factory()->create();
        $this->actingAs($admin, 'sanctum')->post("/api/v1/admin/children/{$foreign->id}/photo", ['photo' => $this->pngUpload()], ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_autentifikatsiyasiz_401(): void
    {
        $this->post("/api/v1/teacher/children/{$this->child->id}/photo", ['photo' => $this->pngUpload()], ['Accept' => 'application/json'])->assertUnauthorized();
        $this->get("/api/v1/teacher/children/{$this->child->id}/photo")->assertUnauthorized();
    }
}
