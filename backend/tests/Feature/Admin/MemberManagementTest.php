<?php

namespace Tests\Feature\Admin;

use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Tarbiyachi va ota-ona: PUT, PATCH activate/deactivate, POST reset-password.
 * Ikkala resurs bir xil qoidalarga ega — testlar data provider orqali ikkalasida ishlaydi.
 */
class MemberManagementTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
    }

    public static function resources(): array
    {
        return [
            'tarbiyachi' => ['teachers', TeacherProfile::class, User::ROLE_TEACHER],
            'ota-ona'    => ['parents', ParentProfile::class, User::ROLE_PARENT],
        ];
    }

    private function member(string $class, string $role, ?Organization $org = null, string $phone = '+998901230001'): TeacherProfile|ParentProfile
    {
        $org ??= $this->org;
        $user = User::factory()->create(['role' => $role, 'organization_id' => $org->id, 'phone' => $phone, 'name' => 'Eski Ism']);

        return $class::factory()->create([
            'user_id' => $user->id, 'organization_id' => $org->id,
            'first_name' => 'Eski', 'last_name' => 'Ism', 'phone' => $phone,
        ]);
    }

    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user, 'sanctum');
    }

    // ── Tahrirlash ────────────────────────────────────────────────

    #[DataProvider('resources')]
    public function test_tahrirlash_profil_va_foydalanuvchini_birga_yangilaydi(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);

        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", [
            'first_name' => 'Yangi', 'last_name' => 'Familiya', 'phone' => '+998901239999',
        ])->assertOk()->assertJsonPath('data.first_name', 'Yangi');

        $this->assertDatabaseHas($m->getTable(), ['id' => $m->id, 'first_name' => 'Yangi', 'phone' => '+998901239999']);
        $this->assertDatabaseHas('users', ['id' => $m->user_id, 'name' => 'Yangi Familiya', 'phone' => '+998901239999']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'member.updated', 'organization_id' => $this->org->id]);
    }

    #[DataProvider('resources')]
    public function test_yangi_telefon_bilan_login_ishlaydi(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", ['phone' => '+998901238888'])->assertOk();

        // Ota-ona — mobil ilova orqali, tarbiyachi — web orqali kiradi
        $login = $role === User::ROLE_PARENT ? '/api/v1/mobile/login' : '/api/v1/login';
        $this->app['auth']->forgetGuards();
        $this->postJson($login, ['phone' => '+998901238888', 'password' => 'password'])->assertOk();
        $this->postJson($login, ['phone' => '+998901230001', 'password' => 'password'])->assertStatus(422);
    }

    #[DataProvider('resources')]
    public function test_telefon_unikal_butun_tizim_boyicha(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $otherOrgUser = User::factory()->admin()->create(['organization_id' => Organization::factory()->create()->id, 'phone' => '+998901237777']);

        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", ['phone' => $otherOrgUser->phone])
             ->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", ['phone' => $this->admin->phone])
             ->assertUnprocessable()->assertJsonValidationErrors('phone');

        // O'z raqamini qayta yuborish xato emas
        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", ['phone' => '+998901230001'])->assertOk();
        $this->assertSame('+998901230001', $m->user->fresh()->phone);
    }

    #[DataProvider('resources')]
    public function test_tahrirlash_validatsiyasi_va_rol_tashkilot_maydonlari_etiborga_olinmaydi(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);

        foreach ([['first_name' => ''], ['last_name' => str_repeat('a', 101)], ['phone' => ''], ['phone' => str_repeat('1', 21)]] as $body) {
            $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", $body)->assertUnprocessable();
        }

        $other = Organization::factory()->create();
        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$m->id}", [
            'first_name' => 'Ok', 'role' => User::ROLE_SUPER_ADMIN, 'organization_id' => $other->id, 'is_active' => false, 'password' => 'buzish-uchun-parol',
        ])->assertOk();

        $user = $m->user->fresh();
        $this->assertSame($role, $user->role);
        $this->assertSame($this->org->id, $user->organization_id);
        $this->assertTrue($user->is_active);
        $this->assertTrue(Hash::check('password', $user->password));
        $this->assertSame($this->org->id, $m->fresh()->organization_id);
    }

    public function test_ota_ona_qarindoshligi_va_tarbiyachi_lavozimi(): void
    {
        $p = $this->member(ParentProfile::class, User::ROLE_PARENT);
        $t = $this->member(TeacherProfile::class, User::ROLE_TEACHER, null, '+998901230002');

        $this->as($this->admin)->putJson("/api/v1/admin/parents/{$p->id}", ['relation_type' => 'vasiy'])->assertOk();
        $this->as($this->admin)->putJson("/api/v1/admin/parents/{$p->id}", ['relation_type' => 'buvi'])->assertUnprocessable();
        $this->assertSame('vasiy', $p->fresh()->relation_type);

        $this->as($this->admin)->putJson("/api/v1/admin/teachers/{$t->id}", ['position' => 'Katta tarbiyachi'])->assertOk();
        $this->assertSame('Katta tarbiyachi', $t->fresh()->position);
        $this->as($this->admin)->putJson("/api/v1/admin/teachers/{$t->id}", ['position' => null])->assertOk();
        $this->assertSame('Tarbiyachi', $t->fresh()->position);
    }

    // ── Faollik ───────────────────────────────────────────────────

    #[DataProvider('resources')]
    public function test_faolsizlantirish_sessiyalarni_bekor_qiladi_va_login_yopiladi(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $web    = $m->user->createToken('kiddo-app', [$role])->plainTextToken;
        $mobile = $m->user->createToken('mobile-access|' . str_repeat('a', 32), [$role, 'mobile'])->plainTextToken;

        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertOk();

        $this->assertFalse($m->user->fresh()->is_active);
        $this->assertSame(0, $m->user->tokens()->count());
        foreach ([$web, $mobile] as $token) {
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
        }
        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => ''])
             ->postJson('/api/v1/login', ['phone' => '+998901230001', 'password' => 'password'])->assertStatus(422);
        $this->assertDatabaseHas('activity_logs', ['action' => 'member.deactivated']);
    }

    #[DataProvider('resources')]
    public function test_faollashtirish(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertOk();
        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$m->id}/activate")->assertOk();

        $this->assertTrue($m->user->fresh()->is_active);
        $this->app['auth']->forgetGuards();
        $login = $role === User::ROLE_PARENT ? '/api/v1/mobile/login' : '/api/v1/login';
        $this->postJson($login, ['phone' => '+998901230001', 'password' => 'password'])->assertOk();
    }

    public function test_tarbiyachi_profil_va_foydalanuvchi_faolligi_birga(): void
    {
        $t = $this->member(TeacherProfile::class, User::ROLE_TEACHER);

        $this->as($this->admin)->patchJson("/api/v1/admin/teachers/{$t->id}/deactivate")->assertOk();
        $this->assertFalse($t->fresh()->is_active);

        $this->as($this->admin)->patchJson("/api/v1/admin/teachers/{$t->id}/activate")->assertOk();
        $this->assertTrue($t->fresh()->is_active);
        $this->assertTrue($t->user->fresh()->is_active);
    }

    public function test_royxatlar_faollik_holatini_qaytaradi(): void
    {
        $p = $this->member(ParentProfile::class, User::ROLE_PARENT);
        $this->as($this->admin)->patchJson("/api/v1/admin/parents/{$p->id}/deactivate")->assertOk();

        $this->as($this->admin)->getJson('/api/v1/admin/parents')
             ->assertOk()
             ->assertJsonPath('data.0.user.is_active', false)
             ->assertJsonMissingPath('data.0.user.password');
    }

    // ── Parol ─────────────────────────────────────────────────────

    #[DataProvider('resources')]
    public function test_parolni_tiklash(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $old = $m->user->createToken('kiddo-app', [$role])->plainTextToken;

        $this->as($this->admin)->postJson("/api/v1/admin/{$path}/{$m->id}/reset-password", ['password' => 'qisqa'])
             ->assertUnprocessable()->assertJsonValidationErrors('password');
        // Parol berilmasa — tizim vaqtinchalik parol yaratadi (tarbiyachi ham, ota-ona ham), birinchi kirishda almashtiriladi
        $temp = $this->as($this->admin)->postJson("/api/v1/admin/{$path}/{$m->id}/reset-password", [])
             ->assertOk()->json('data.temporary_password');
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check($temp, $m->user->fresh()->password));
        $this->assertTrue($m->user->fresh()->must_change_password);

        $this->as($this->admin)->postJson("/api/v1/admin/{$path}/{$m->id}/reset-password", ['password' => 'YangiParol2026'])
             ->assertOk()->assertJsonMissing(['password' => 'YangiParol2026']);

        $this->assertTrue(Hash::check('YangiParol2026', $m->user->fresh()->password));
        $this->assertSame(0, $m->user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($old)->getJson('/api/v1/me')->assertUnauthorized();

        $log = \App\Models\ActivityLog::where('action', 'user.password_reset')->latest('id')->firstOrFail();
        $this->assertStringNotContainsString('YangiParol2026', json_encode($log->toArray()));
    }

    // ── Ruxsat va izolyatsiya ─────────────────────────────────────

    #[DataProvider('resources')]
    public function test_boshqa_bogcha_azosi_404_va_ozgarmaydi(string $path, string $class, string $role): void
    {
        $foreign = $this->member($class, $role, Organization::factory()->create(), '+998901230055');

        $this->as($this->admin)->putJson("/api/v1/admin/{$path}/{$foreign->id}", ['first_name' => 'X'])->assertNotFound();
        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$foreign->id}/deactivate")->assertNotFound();
        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$foreign->id}/activate")->assertNotFound();
        $this->as($this->admin)->postJson("/api/v1/admin/{$path}/{$foreign->id}/reset-password", ['password' => 'BuzishParol1'])->assertNotFound();

        $this->assertSame('Eski', $foreign->fresh()->first_name);
        $this->assertTrue($foreign->user->fresh()->is_active);
        $this->assertTrue(Hash::check('password', $foreign->user->fresh()->password));
    }

    #[DataProvider('resources')]
    public function test_tarbiyachi_va_ota_ona_admin_amallarini_bajara_olmaydi(string $path, string $class, string $role): void
    {
        $m = $this->member($class, $role);
        $actors = [
            User::factory()->teacher()->create(['organization_id' => $this->org->id]),
            User::factory()->parent()->create(['organization_id' => $this->org->id]),
            $m->user, // o'zini ham
        ];

        foreach ($actors as $actor) {
            $this->as($actor)->putJson("/api/v1/admin/{$path}/{$m->id}", ['first_name' => 'X'])->assertForbidden();
            $this->as($actor)->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertForbidden();
            $this->as($actor)->postJson("/api/v1/admin/{$path}/{$m->id}/reset-password", ['password' => 'BuzishParol1'])->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertUnauthorized();

        $this->assertTrue($m->user->fresh()->is_active);
    }

    #[DataProvider('resources')]
    public function test_profil_boshqa_rolli_foydalanuvchiga_bogliq_bolsa_404(string $path, string $class, string $role): void
    {
        // Noto'g'ri bog'langan profil orqali admin akkauntini o'zgartirib bo'lmaydi
        $otherAdmin = User::factory()->admin()->create(['organization_id' => $this->org->id, 'phone' => '+998901230077']);
        $m = $class::factory()->create(['user_id' => $otherAdmin->id, 'organization_id' => $this->org->id]);

        $this->as($this->admin)->postJson("/api/v1/admin/{$path}/{$m->id}/reset-password", ['password' => 'BuzishParol1'])->assertNotFound();
        $this->as($this->admin)->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertNotFound();
        $this->assertTrue($otherAdmin->fresh()->is_active);
    }

    #[DataProvider('resources')]
    public function test_super_admin_faqat_impersonatsiya_orqali(string $path, string $class, string $role): void
    {
        $m  = $this->member($class, $role);
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        $this->as($sa)->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertForbidden();
        $this->as($sa)->withHeaders(['X-Impersonated-Org' => (string) $this->org->id])
             ->getJson("/api/v1/admin/{$path}")->assertOk();
        // Impersonatsiyada — faqat ko'rish
        $this->as($sa)->withHeaders(['X-Impersonated-Org' => (string) $this->org->id])
             ->patchJson("/api/v1/admin/{$path}/{$m->id}/deactivate")->assertForbidden();
        $this->assertEquals($m->updated_at, $m->fresh()->updated_at);
    }
}
