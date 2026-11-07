<?php

namespace Tests\Feature;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Ota-ona akkaunti: rahbar uni bog'cha va bolaga biriktirib, login + vaqtinchalik parol bilan yaratadi.
 * Ota-ona mobil API orqali kiradi, birinchi kirishda parolni almashtiradi va faqat o'z farzandini ko'radi.
 */
class ParentAccountTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $owner;
    private Child $child;
    private Child $sibling;      // shu bog'chadagi boshqa bola
    private Child $foreignChild; // boshqa bog'cha bolasi

    protected function setUp(): void
    {
        parent::setUp();
        $this->org   = Organization::factory()->create();
        $this->owner = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $group       = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->child   = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $group->id, 'first_name' => 'Ali']);
        $this->sibling = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $group->id, 'first_name' => 'Vali']);

        $other = Organization::factory()->create();
        $this->foreignChild = Child::factory()->create(['organization_id' => $other->id,
            'group_id' => Group::factory()->create(['organization_id' => $other->id])->id]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    private function bearer(string $token)
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function createParent(array $extra = [])
    {
        return $this->as($this->owner)->postJson('/api/v1/admin/parents', [
            'first_name' => 'Malika', 'last_name' => 'Aliyeva', 'username' => 'Malika.Ona',
            'relation_type' => 'ona', 'child_id' => $this->child->id, 'is_primary' => true, ...$extra,
        ]);
    }

    public function test_rahbar_ota_onani_bolaga_biriktirib_vaqtinchalik_parol_bilan_yaratadi(): void
    {
        $res  = $this->createParent()->assertCreated()->assertJsonPath('account.username', 'malika.ona');
        $temp = $res->json('account.temporary_password');

        $profile = ParentProfile::findOrFail($res->json('data.id'));
        $user    = $profile->user;
        $this->assertSame([User::ROLE_PARENT, $this->org->id, true, null], [$user->role, $user->organization_id, $user->must_change_password, $user->phone]);
        $this->assertNull($profile->phone);
        $this->assertTrue(Hash::check($temp, $user->password));
        $this->assertSame([$this->child->id], $profile->children()->pluck('children.id')->all());
        $this->assertTrue((bool) $profile->children()->first()->pivot->is_primary);
        $res->assertJsonPath('data.children.0.id', $this->child->id);

        // Ro'yxatda login va holat ko'rinadi, parol esa yo'q
        $list = $this->as($this->owner)->getJson('/api/v1/admin/parents')->assertOk()
            ->assertJsonPath('data.0.user.username', 'malika.ona')->assertJsonPath('data.0.user.must_change_password', true);
        $this->assertStringNotContainsString($temp, $list->getContent());
    }

    public function test_boshqa_bogcha_bolasiga_biriktirib_bolmaydi_va_hech_narsa_yaratilmaydi(): void
    {
        $this->createParent(['child_id' => $this->foreignChild->id])->assertNotFound();
        $this->assertFalse(User::where('username', 'malika.ona')->exists());
        $this->assertSame(0, ParentProfile::count());

        $this->createParent(['username' => null, 'phone' => null])->assertJsonValidationErrors('phone');
        $this->createParent(['username' => '9abc'])->assertJsonValidationErrors('username');
    }

    public function test_mobil_login_parol_almashtirish_sessiyani_saqlaydi_va_faqat_oz_farzandi_korinadi(): void
    {
        $temp = $this->createParent()->json('account.temporary_password');

        $login = $this->postJson('/api/v1/mobile/login', ['login' => 'Malika.Ona', 'password' => $temp, 'device_name' => 'Test telefon'])
            ->assertOk()->assertJsonPath('user.role', 'parent')->assertJsonPath('user.must_change_password', true);
        [$access, $refresh] = [$login->json('access_token'), $login->json('refresh_token')];

        // Parol almashtirilmaguncha ma'lumotlar yopiq
        $this->bearer($access)->getJson('/api/v1/parent/children')->assertForbidden()->assertJsonPath('code', 'password_change_required');

        $this->bearer($access)->putJson('/api/v1/me/password', [
            'current_password' => $temp, 'password' => 'Ona-parol-2026', 'password_confirmation' => 'Ona-parol-2026',
        ])->assertOk()->assertJsonPath('user.must_change_password', false);

        // Joriy qurilma sessiyasi saqlangan: access ishlaydi, refresh ham yangilanadi
        $ids = collect($this->bearer($access)->getJson('/api/v1/parent/children')->assertOk()->json('data'))->pluck('id')->all();
        $this->assertSame([$this->child->id], $ids);
        $this->app['auth']->forgetGuards();
        // Refresh eski access tokenni almashtiradi — keyingi so'rovlar yangi access token bilan
        $access = $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $refresh])->assertOk()->json('access_token');

        // Boshqa bola (shu bog'cha va boshqa bog'cha) — yopiq
        foreach ([$this->sibling, $this->foreignChild] as $c) {
            $this->bearer($access)->getJson("/api/v1/parent/children/{$c->id}/attendance")->assertNotFound();
            $this->bearer($access)->getJson("/api/v1/parent/children/{$c->id}/daily")->assertNotFound();
            $this->bearer($access)->getJson("/api/v1/parent/children/{$c->id}/photo")->assertNotFound();
        }
        foreach (['/api/v1/admin/children', '/api/v1/teacher/dashboard', '/api/v1/super-admin/dashboard'] as $url) {
            $this->bearer($access)->getJson($url)->assertForbidden();
        }

        // Eski vaqtinchalik parol endi ishlamaydi
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/login', ['login' => 'malika.ona', 'password' => $temp])->assertStatus(422)
            ->assertJsonPath('errors.login.0', "Login yoki parol noto'g'ri.");
    }

    public function test_mobil_login_eski_phone_maydoni_bilan_ishlaydi_boshqa_rollar_kira_olmaydi(): void
    {
        $this->createParent(['username' => null, 'phone' => '+998901112233', 'password' => 'Ona-parol-2026'])->assertCreated();
        $this->postJson('/api/v1/mobile/login', ['phone' => '+998901112233', 'password' => 'Ona-parol-2026'])
            ->assertOk()->assertJsonPath('user.must_change_password', false);

        $this->owner->forceFill(['username' => 'rahbar1', 'password' => 'Rahbar-parol-1'])->save();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/login', ['login' => 'rahbar1', 'password' => 'Rahbar-parol-1'])->assertStatus(422);
    }

    public function test_parolni_tiklash_vaqtinchalik_parol_va_barcha_qurilmalardan_chiqarish(): void
    {
        $res     = $this->createParent(['password' => 'Ona-parol-2026'])->assertCreated();
        $profile = ParentProfile::findOrFail($res->json('data.id'));
        $access  = $this->postJson('/api/v1/mobile/login', ['login' => 'malika.ona', 'password' => 'Ona-parol-2026'])->json('access_token');

        $temp = $this->as($this->owner)->postJson("/api/v1/admin/parents/{$profile->id}/reset-password")
            ->assertOk()->json('data.temporary_password');

        $this->assertTrue(Hash::check($temp, $profile->user->fresh()->password));
        $this->assertTrue($profile->user->fresh()->must_change_password);
        $this->bearer($access)->getJson('/api/v1/parent/children')->assertUnauthorized();

        // Boshqa bog'cha rahbari tiklay olmaydi
        $stranger = User::factory()->admin()->create(['organization_id' => $this->foreignChild->organization_id]);
        $this->as($stranger)->postJson("/api/v1/admin/parents/{$profile->id}/reset-password")->assertNotFound();
    }

    public function test_ota_ona_web_ga_kira_olmaydi_faqat_mobil(): void
    {
        $this->createParent(['password' => 'Ona-parol-2026'])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/login', ['login' => 'malika.ona', 'password' => 'Ona-parol-2026'])
            ->assertForbidden()->assertJsonPath('code', 'parent_mobile_only')->assertCookieMissing('kiddo_token');
        $this->assertSame(0, User::where('username', 'malika.ona')->sole()->tokens()->count());
        // Noto'g'ri parol — oddiy umumiy xato (rol oshkor bo'lmaydi)
        $this->postJson('/api/v1/login', ['login' => 'malika.ona', 'password' => 'xato'])->assertStatus(422);
        $this->postJson('/api/v1/mobile/login', ['login' => 'malika.ona', 'password' => 'Ona-parol-2026'])->assertOk();
    }

    public function test_bir_qurilmadan_parol_almashtirish_boshqa_qurilmalarni_chiqaradi(): void
    {
        $this->createParent(['password' => 'Ona-parol-2026'])->assertCreated();
        $phoneA = $this->postJson('/api/v1/mobile/login', ['login' => 'malika.ona', 'password' => 'Ona-parol-2026', 'device_name' => 'A'])->json('access_token');
        $this->app['auth']->forgetGuards();
        $phoneB = $this->postJson('/api/v1/mobile/login', ['login' => 'malika.ona', 'password' => 'Ona-parol-2026', 'device_name' => 'B'])->json('access_token');

        $this->bearer($phoneA)->putJson('/api/v1/me/password', [
            'current_password' => 'Ona-parol-2026', 'password' => 'Yangi-parol-77', 'password_confirmation' => 'Yangi-parol-77',
        ])->assertOk();

        $this->bearer($phoneB)->getJson('/api/v1/parent/children')->assertUnauthorized();
        $this->bearer($phoneA)->getJson('/api/v1/parent/children')->assertOk();
    }
}
