<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Services\AccountProvisioningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * 2-bosqich: bog'chalarni boshqarish, rahbar va tarbiyachi akkauntlari (username + bir martalik vaqtinchalik parol),
 * birinchi kirishda parolni almashtirish va tenant izolyatsiyasi.
 */
class AccountManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $sa;
    private Organization $org;
    private Organization $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sa    = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
        $this->org   = Organization::factory()->create(['name' => '5-sonli DMTT', 'number' => '5', 'director_name' => 'Rahbar Test']);
        $this->other = Organization::factory()->create(['name' => '6-sonli DMTT']);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'sanctum');
    }

    /** Haqiqiy login (cookie token) — must_change_password middleware'i token orqali tekshiriladi. */
    private function loginAs(string $login, string $password)
    {
        $this->app['auth']->forgetGuards();
        $res = $this->postJson('/api/v1/login', ['login' => $login, 'password' => $password]);
        $this->app['auth']->forgetGuards();

        return $res;
    }

    // ── Bog'chalar ───────────────────────────────────────────────────

    public function test_bogcha_reyestr_maydonlari_bilan_yaratiladi_va_tahrirlanadi(): void
    {
        $id = $this->as($this->sa)->postJson('/api/v1/super-admin/organizations', [
            'name' => 'Quyosh DMTT', 'type' => 'davlat', 'address' => "Markaz ko'chasi 1", 'district' => "Bo'stonliq tumani",
            'number' => '30', 'mfy' => 'Markaz MFY', 'capacity' => 120, 'director_name' => 'Aliyeva Malika', 'director_phone' => '+998901234567',
        ])->assertCreated()->json('data.id');

        $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$id}")->assertOk()
            ->assertJsonPath('data.number', '30')->assertJsonPath('data.capacity', 120)
            ->assertJsonPath('data.director_name', 'Aliyeva Malika')->assertJsonPath('data.is_demo', false)
            ->assertJsonPath('data.children_count', 0)->assertJsonPath('data.groups_count', 0)->assertJsonPath('data.teacher_profiles_count', 0);

        $this->as($this->sa)->putJson("/api/v1/super-admin/organizations/{$id}", ['capacity' => 150, 'director_phone' => '+998907654321', 'mfy' => 'Yangi MFY'])
            ->assertOk();
        $org = Organization::find($id);
        $this->assertSame([150, '+998907654321', 'Yangi MFY', 'Quyosh DMTT'], [$org->capacity, $org->director_phone, $org->mfy, $org->name]);

        $this->as($this->sa)->putJson("/api/v1/super-admin/organizations/{$id}", ['director_phone' => '90 123'])->assertJsonValidationErrors('director_phone');
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$id}/deactivate")->assertOk();
        $this->assertFalse($org->fresh()->is_active);
        $this->as($this->sa)->patchJson("/api/v1/super-admin/organizations/{$id}/activate")->assertOk();
        $this->assertTrue($org->fresh()->is_active);
    }

    public function test_bogliq_malumotli_bogcha_ochirilmaydi_bosh_bogcha_soft_delete_bilan_ochiriladi(): void
    {
        $group = Group::factory()->create(['organization_id' => $this->org->id]);
        Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $group->id]);

        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$this->org->id}")
            ->assertStatus(422)->assertJsonPath('data.linked.bolalar', 1)->assertJsonPath('data.linked.guruhlar', 1);
        $this->assertNotSoftDeleted($this->org);
        $this->assertSame(1, Child::where('organization_id', $this->org->id)->count());

        // Kuchli tasdiq: nomi aynan kiritilmasa o'chirilmaydi
        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$this->other->id}", ['confirm_name' => 'boshqa nom'])
            ->assertStatus(422)->assertJsonValidationErrors('confirm_name');
        $this->assertNotSoftDeleted($this->other);
        $this->as($this->sa)->deleteJson("/api/v1/super-admin/organizations/{$this->other->id}", ['confirm_name' => $this->other->name])->assertOk();
        $this->assertSoftDeleted($this->other);
    }

    // ── Rahbar akkaunti ──────────────────────────────────────────────

    public function test_rahbar_akkaunti_vaqtinchalik_parol_bilan_yaratiladi_va_parol_bir_marta_korsatiladi(): void
    {
        $res = $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/admin-account", ['username' => 'Quyosh123'])
            ->assertCreated()->assertJsonPath('data.username', 'quyosh123')->assertJsonPath('data.name', 'Rahbar Test');
        $temp = $res->json('data.temporary_password');

        $this->assertMatchesRegularExpression('/^[A-Za-z2-9]{12}$/', $temp);
        $user = User::where('username', 'quyosh123')->sole();
        $this->assertSame([User::ROLE_ADMIN, $this->org->id, true], [$user->role, $user->organization_id, $user->must_change_password]);
        $this->assertTrue(Hash::check($temp, $user->password));
        $this->assertStringNotContainsString($temp, $user->getRawOriginal('password'));

        // Keyingi javoblarda va jurnalda parol yo'q
        $show = $this->as($this->sa)->getJson("/api/v1/super-admin/organizations/{$this->org->id}")->assertOk()
            ->assertJsonPath('data.admins.0.username', 'quyosh123')->assertJsonPath('data.admins.0.must_change_password', true);
        $this->assertStringNotContainsString($temp, $show->getContent());
        $this->assertStringNotContainsString('password":"', $show->getContent());
        $this->assertStringNotContainsString($temp, ActivityLog::all()->toJson());

        // Ikkinchi rahbar va band login rad etiladi
        $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/admin-account", ['username' => 'boshqa1'])
            ->assertStatus(422);
        $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->other->id}/admin-account", ['username' => 'quyosh123'])
            ->assertJsonValidationErrors('username');
        $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->other->id}/admin-account", ['username' => '1abc'])
            ->assertJsonValidationErrors('username');
    }

    public function test_rahbar_birinchi_kirishda_parolni_almashtiradi_keyin_faqat_oz_bogchasini_koradi(): void
    {
        $temp = $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/admin-account", ['username' => 'quyosh123'])
            ->json('data.temporary_password');
        $foreignGroup = Group::factory()->create(['organization_id' => $this->other->id]);
        $foreignChild = Child::factory()->create(['organization_id' => $this->other->id, 'group_id' => $foreignGroup->id]);

        $login = $this->loginAs('quyosh123', $temp)->assertOk()->assertJsonPath('user.must_change_password', true);
        $cookie = $login->getCookie('kiddo_token', false)->getValue();
        $api = fn () => $this->withToken($cookie);

        // Parol almashtirilmaguncha boshqa API'lar yopiq
        $this->app['auth']->forgetGuards();
        $api()->getJson('/api/v1/admin/dashboard')->assertForbidden()->assertJsonPath('code', 'password_change_required');
        $this->app['auth']->forgetGuards();
        $api()->getJson('/api/v1/me')->assertOk();

        // Noto'g'ri joriy parol / mos kelmaydigan takror / eski parolning o'zi
        $this->app['auth']->forgetGuards();
        $api()->putJson('/api/v1/me/password', ['current_password' => 'xato', 'password' => 'Yangi-parol-1', 'password_confirmation' => 'Yangi-parol-1'])
            ->assertJsonValidationErrors('current_password');
        $this->app['auth']->forgetGuards();
        $api()->putJson('/api/v1/me/password', ['current_password' => $temp, 'password' => 'Yangi-parol-1', 'password_confirmation' => 'boshqa'])
            ->assertJsonValidationErrors('password');
        $this->app['auth']->forgetGuards();
        $api()->putJson('/api/v1/me/password', ['current_password' => $temp, 'password' => $temp, 'password_confirmation' => $temp])
            ->assertJsonValidationErrors('password');

        $this->app['auth']->forgetGuards();
        $api()->putJson('/api/v1/me/password', ['current_password' => $temp, 'password' => 'Yangi-parol-1', 'password_confirmation' => 'Yangi-parol-1'])
            ->assertOk()->assertJsonPath('user.must_change_password', false);

        $this->app['auth']->forgetGuards();
        $api()->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('bogcha.id', $this->org->id);
        $this->app['auth']->forgetGuards();
        $api()->getJson("/api/v1/admin/children/{$foreignChild->id}")->assertNotFound();
        $this->app['auth']->forgetGuards();
        $api()->getJson('/api/v1/super-admin/organizations')->assertForbidden();

        // Eski (vaqtinchalik) parol endi ishlamaydi, yangisi ishlaydi
        $this->loginAs('quyosh123', $temp)->assertStatus(422);
        $this->loginAs('quyosh123', 'Yangi-parol-1')->assertOk()->assertJsonPath('user.must_change_password', false);
    }

    public function test_rahbar_parolini_tiklash_yangi_vaqtinchalik_parol_va_sessiyalarni_bekor_qiladi(): void
    {
        $first = $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/admin-account", ['username' => 'quyosh123'])
            ->json('data.temporary_password');
        $user = User::where('username', 'quyosh123')->sole();
        $user->forceFill(['must_change_password' => false])->save();
        $user->createToken('web');

        $temp = $this->as($this->sa)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/reset-password")
            ->assertOk()->assertJsonPath('data.username', 'quyosh123')->json('data.temporary_password');

        $this->assertNotSame($first, $temp);
        $user->refresh();
        $this->assertTrue($user->must_change_password);
        $this->assertTrue(Hash::check($temp, $user->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_faqat_super_admin_rahbar_akkauntini_yarata_oladi(): void
    {
        $owner = User::factory()->admin()->create(['organization_id' => $this->other->id]);
        $this->as($owner)->postJson("/api/v1/super-admin/organizations/{$this->org->id}/admin-account", ['username' => 'buzgunchi'])->assertForbidden();
        $this->assertFalse(User::where('username', 'buzgunchi')->exists());
    }

    // ── Tarbiyachilar ───────────────────────────────────────────────

    public function test_rahbar_tarbiyachini_username_bilan_qoshadi_tarbiyachi_faqat_oz_guruhini_koradi(): void
    {
        $owner  = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $mine   = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Mening guruhim']);
        $notMine = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Boshqa guruh']);
        Child::factory()->count(2)->create(['organization_id' => $this->org->id, 'group_id' => $mine->id]);
        $otherChild = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $notMine->id]);

        $res = $this->as($owner)->postJson('/api/v1/admin/teachers', ['first_name' => 'Dilnoza', 'last_name' => 'Karimova', 'username' => 'Dilnoza.K'])
            ->assertCreated()->assertJsonPath('account.username', 'dilnoza.k');
        $temp    = $res->json('account.temporary_password');
        $teacher = TeacherProfile::findOrFail($res->json('data.id'));
        $this->assertNull($teacher->phone);
        $this->assertSame([User::ROLE_TEACHER, $this->org->id, true, null], [$teacher->user->role, $teacher->user->organization_id, $teacher->user->must_change_password, $teacher->user->phone]);

        $this->as($owner)->putJson("/api/v1/admin/teachers/{$teacher->id}/groups", ['group_ids' => [$mine->id]])->assertOk();
        $this->as($owner)->getJson('/api/v1/admin/teachers')->assertOk()->assertJsonPath('data.0.user.username', 'dilnoza.k');

        $cookie = $this->loginAs('dilnoza.k', $temp)->assertOk()->getCookie('kiddo_token', false)->getValue();
        $this->app['auth']->forgetGuards();
        $this->withToken($cookie)->getJson('/api/v1/teacher/dashboard')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($cookie)->putJson('/api/v1/me/password',
            ['current_password' => $temp, 'password' => 'Tarbiyachi-1', 'password_confirmation' => 'Tarbiyachi-1'])->assertOk();

        $this->app['auth']->forgetGuards();
        $dash = $this->withToken($cookie)->getJson('/api/v1/teacher/dashboard')->assertOk();
        $this->assertSame([$mine->id], collect($dash->json('groups'))->pluck('id')->all());
        $this->assertSame(2, $dash->json('summary.total'));
        $this->app['auth']->forgetGuards();
        $this->withToken($cookie)->getJson("/api/v1/teacher/dashboard?group_id={$notMine->id}")->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->withToken($cookie)->getJson("/api/v1/teacher/children/{$otherChild->id}")->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->withToken($cookie)->getJson('/api/v1/admin/teachers')->assertForbidden();
    }

    public function test_tarbiyachi_eski_usulda_telefon_va_parol_bilan_ham_qoshiladi(): void
    {
        $owner = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $res = $this->as($owner)->postJson('/api/v1/admin/teachers', [
            'first_name' => 'Ali', 'last_name' => 'Valiyev', 'phone' => '+998901112233', 'password' => 'Parol-12345',
        ])->assertCreated();
        $this->assertArrayNotHasKey('temporary_password', $res->json('account'));
        $this->assertFalse((bool) User::where('phone', '+998901112233')->value('must_change_password'));
        $this->loginAs('+998901112233', 'Parol-12345')->assertOk();

        $this->as($owner)->postJson('/api/v1/admin/teachers', ['first_name' => 'X', 'last_name' => 'Y'])
            ->assertJsonValidationErrors('phone');
    }

    public function test_rahbar_tarbiyachi_parolini_vaqtinchalik_parol_bilan_tiklaydi_boshqa_bogcha_rahbari_tiklay_olmaydi(): void
    {
        $owner   = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $res     = $this->as($owner)->postJson('/api/v1/admin/teachers', ['first_name' => 'A', 'last_name' => 'B', 'username' => 'tarb.a'])->assertCreated();
        $teacher = TeacherProfile::findOrFail($res->json('data.id'));

        $temp = $this->as($owner)->postJson("/api/v1/admin/teachers/{$teacher->id}/reset-password")->assertOk()->json('data.temporary_password');
        $this->assertTrue(Hash::check($temp, $teacher->user->fresh()->password));
        $this->assertTrue($teacher->user->fresh()->must_change_password);

        $stranger = User::factory()->admin()->create(['organization_id' => $this->other->id]);
        $this->as($stranger)->postJson("/api/v1/admin/teachers/{$teacher->id}/reset-password")->assertNotFound();
        $this->assertTrue(Hash::check($temp, $teacher->user->fresh()->password));
    }

    public function test_super_admin_foydalanuvchi_parolini_vaqtinchalik_parol_bilan_tiklaydi(): void
    {
        $teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id, 'username' => 'tarb.x']);
        $teacher->createToken('web');

        $res = $this->as($this->sa)->postJson("/api/v1/super-admin/users/{$teacher->id}/reset-password")
            ->assertOk()->assertJsonPath('data.login', 'tarb.x');
        $temp = $res->json('data.temporary_password');

        $teacher->refresh();
        $this->assertTrue(Hash::check($temp, $teacher->password));
        $this->assertTrue($teacher->must_change_password);
        $this->assertSame(0, $teacher->tokens()->count());

        // Eski klient: parol berilsa — o'sha, vaqtinchalik parol qaytmaydi
        $this->as($this->sa)->postJson("/api/v1/super-admin/users/{$teacher->id}/reset-password", ['password' => 'Berilgan-parol-1'])
            ->assertOk()->assertJsonMissingPath('data.temporary_password');
        $this->assertTrue(Hash::check('Berilgan-parol-1', $teacher->fresh()->password));
    }

    public function test_vaqtinchalik_parol_kuchli_va_takrorlanmaydi(): void
    {
        $set = collect(range(1, 200))->map(fn () => AccountProvisioningService::temporaryPassword());
        $this->assertSame(200, $set->unique()->count());
        $set->each(function ($p) {
            $this->assertSame(12, strlen($p));
            $this->assertMatchesRegularExpression('/[A-Z]/', $p);
            $this->assertMatchesRegularExpression('/[a-z]/', $p);
            $this->assertMatchesRegularExpression('/[2-9]/', $p);
            $this->assertDoesNotMatchRegularExpression('/[0O1lI]/', $p);
        });
    }
}
