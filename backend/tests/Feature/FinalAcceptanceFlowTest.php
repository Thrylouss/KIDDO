<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Yakuniy qabul testi — butun zanjir faqat haqiqiy login va API orqali (actingAs yo'q):
 * Super Admin bog'cha va rahbar yaratadi → rahbar parolini almashtiradi, guruh, bola, tarbiyachi, ota-ona qo'shadi →
 * tarbiyachi davomat va kundalik yozadi, xabar yuboradi → ota-ona mobil ilova orqali faqat o'z farzandini ko'radi.
 * (Faqat vaqtinchalik test bazasida — RefreshDatabase.)
 */
class FinalAcceptanceFlowTest extends TestCase
{
    use RefreshDatabase;

    private const TODAY = '2026-10-28';

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 16:00', 'Asia/Tashkent'));
    }

    /** Web login → cookie token (keyingi so'rovlar Bearer bilan). */
    private function webLogin(string $login, string $password): string
    {
        $this->app['auth']->forgetGuards();
        $res = $this->postJson('/api/v1/login', ['login' => $login, 'password' => $password])->assertOk();
        $this->assertArrayNotHasKey('password', $res->json('user'));

        return $res->getCookie('kiddo_token', false)->getValue();
    }

    private function api(string $token, string $method, string $uri, array $body = [])
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->json($method, $uri, $body);
    }

    /** Vaqtinchalik parol bilan kirish va birinchi kirishda parolni almashtirish. */
    private function firstLogin(string $login, string $temp, string $new): string
    {
        $token = $this->webLogin($login, $temp);
        $this->api($token, 'GET', '/api/v1/me')->assertOk()->assertJsonPath('user.must_change_password', true);
        $this->api($token, 'PUT', '/api/v1/me/password', ['current_password' => $temp, 'password' => $new, 'password_confirmation' => $new])
            ->assertOk()->assertJsonPath('user.must_change_password', false);

        return $token;
    }

    public function test_bogchadan_ota_ona_mobil_ilovasigacha_toliq_zanjir(): void
    {
        $saPassword = 'Super-admin-2026';
        $sa = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null, 'password' => $saPassword]);
        $saToken = $this->webLogin($sa->phone, $saPassword);

        // 1. Super Admin: bog'cha va rahbar akkaunti
        $orgId = $this->api($saToken, 'POST', '/api/v1/super-admin/organizations', [
            'name' => '7-sonli DMTT', 'type' => 'davlat', 'address' => "Navro'z ko'chasi 7", 'district' => "Bo'stonliq tumani",
            'number' => '7', 'capacity' => 120, 'director_name' => 'Karimova Nodira', 'director_phone' => '+998901234567',
        ])->assertCreated()->json('data.id');
        $adminTemp = $this->api($saToken, 'POST', "/api/v1/super-admin/organizations/{$orgId}/admin-account", ['username' => 'nodira7'])
            ->assertCreated()->json('data.temporary_password');

        // Boshqa bog'cha (izolyatsiya tekshiruvi uchun)
        $otherId = $this->api($saToken, 'POST', '/api/v1/super-admin/organizations', ['name' => 'Begona DMTT', 'type' => 'xususiy'])
            ->assertCreated()->json('data.id');

        // 2. Rahbar: parol almashtirilmaguncha panel yopiq
        $adminToken = $this->webLogin('nodira7', $adminTemp);
        $this->api($adminToken, 'GET', '/api/v1/admin/dashboard')->assertForbidden()->assertJsonPath('code', 'password_change_required');
        $adminToken = $this->firstLogin('nodira7', $adminTemp, 'Rahbar-parol-7');
        $this->api($adminToken, 'GET', '/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('bogcha.id', $orgId)->assertJsonPath('bolalar_soni', 0);

        // 3. Guruh, bola, tarbiyachi, ota-ona
        $groupId = $this->api($adminToken, 'POST', '/api/v1/admin/groups', ['name' => 'Quyoshcha', 'age_category' => '3-4 yosh', 'capacity' => 20])
            ->assertCreated()->json('data.id');
        $childId = $this->api($adminToken, 'POST', '/api/v1/admin/children', [
            'first_name' => 'Ali', 'last_name' => 'Valiyev', 'birth_date' => '2022-03-15', 'gender' => 'erkak', 'group_id' => $groupId,
        ])->assertCreated()->json('data.id');
        $siblingId = $this->api($adminToken, 'POST', '/api/v1/admin/children', [
            'first_name' => 'Vali', 'last_name' => 'Valiyev', 'birth_date' => '2022-03-15', 'gender' => 'erkak', 'group_id' => $groupId,
        ])->assertCreated()->json('data.id');

        $teacher = $this->api($adminToken, 'POST', '/api/v1/admin/teachers', ['first_name' => 'Dilnoza', 'last_name' => 'Rahimova', 'username' => 'dilnoza7', 'position' => 'Tarbiyachi'])
            ->assertCreated();
        $teacherTemp = $teacher->json('account.temporary_password');
        $this->assertNotEmpty($teacherTemp);
        $this->api($adminToken, 'PUT', "/api/v1/admin/teachers/{$teacher->json('data.id')}/groups", ['group_ids' => [$groupId]])->assertOk();

        $parent = $this->api($adminToken, 'POST', '/api/v1/admin/parents', ['first_name' => 'Malika', 'last_name' => 'Valiyeva', 'username' => 'malika7', 'relation_type' => 'ona'])
            ->assertCreated();
        $parentTemp = $parent->json('account.temporary_password');
        $this->api($adminToken, 'POST', "/api/v1/admin/children/{$childId}/parents", ['parent_profile_id' => $parent->json('data.id'), 'relation_type' => 'ona', 'is_primary' => true])
            ->assertSuccessful();

        $this->api($adminToken, 'GET', '/api/v1/admin/groups')->assertOk()->assertJsonPath('data.0.children_count', 2)->assertJsonPath('data.0.teacher_profiles_count', 1);

        // Rahbar boshqa bog'chaga kira olmaydi
        $this->api($adminToken, 'GET', "/api/v1/super-admin/organizations/{$otherId}")->assertForbidden();

        // 4. Tarbiyachi: birinchi kirish, davomat, kundalik, xabar
        $teacherToken = $this->firstLogin('dilnoza7', $teacherTemp, 'Tarbiyachi-parol-7');
        $this->api($teacherToken, 'GET', '/api/v1/teacher/dashboard')->assertOk()
            ->assertJsonPath('group.id', $groupId)->assertJsonCount(2, 'children');
        $this->api($teacherToken, 'PUT', '/api/v1/teacher/attendance', ['date' => self::TODAY, 'group_id' => $groupId, 'records' => [
            ['child_id' => $childId, 'status' => 'present'],
            ['child_id' => $siblingId, 'status' => 'excused', 'excuse_reason' => 'kasallik', 'note' => 'Isitma'],
        ]])->assertOk()->assertJsonPath('summary.present', 1)->assertJsonPath('summary.excused', 1);
        $this->api($teacherToken, 'PUT', '/api/v1/teacher/daily/meals', ['date' => self::TODAY, 'group_id' => $groupId, 'meal_type' => 'tushlik', 'served_at' => '12:30',
            'records' => [['child_id' => $childId, 'ate' => true]]])->assertOk();
        $this->api($teacherToken, 'PUT', '/api/v1/teacher/daily/sleep', ['date' => self::TODAY, 'group_id' => $groupId,
            'records' => [['child_id' => $childId, 'started_at' => '13:00', 'ended_at' => '15:00']]])->assertOk();
        $this->api($teacherToken, 'POST', '/api/v1/teacher/daily/activities', ['date' => self::TODAY, 'group_id' => $groupId, 'title' => 'Ertak tinglash',
            'direction' => 'nutq', 'starts_at' => '10:00', 'ends_at' => '10:30', 'child_ids' => [$childId]])->assertCreated();
        $this->api($teacherToken, 'POST', '/api/v1/teacher/messages', ['group_id' => $groupId, 'audience' => 'group', 'body' => 'Ertaga bayram ertaligi'])->assertCreated();

        // 5. Rahbar va tarbiyachi davomati bir xil
        $this->api($adminToken, 'GET', "/api/v1/admin/attendance?group_id={$groupId}&date=" . self::TODAY)->assertOk()
            ->assertJsonPath('summary.present', 1)->assertJsonPath('summary.excused', 1);
        $this->api($adminToken, 'GET', '/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('bolalar_soni', 2)->assertJsonPath('bugungi_davomat.keldi', 1)->assertJsonPath('bugungi_davomat.sababli', 1)
            ->assertJsonPath('songgi_faoliyatlar.0.title', 'Ertak tinglash');

        // 6. Ota-ona: web panel yo'q, mobil ilova orqali
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/login', ['login' => 'malika7', 'password' => $parentTemp])->assertForbidden()->assertJsonPath('code', 'parent_mobile_only');

        $this->app['auth']->forgetGuards();
        $mobile = $this->postJson('/api/v1/mobile/login', ['login' => 'malika7', 'password' => $parentTemp, 'device_name' => 'Android'])
            ->assertOk()->assertJsonPath('user.must_change_password', true);
        $access = $mobile->json('access_token');
        $this->api($access, 'GET', '/api/v1/parent/children')->assertForbidden()->assertJsonPath('code', 'password_change_required');
        $this->api($access, 'PUT', '/api/v1/me/password', ['current_password' => $parentTemp, 'password' => 'Ota-ona-parol-7', 'password_confirmation' => 'Ota-ona-parol-7'])->assertOk();

        $this->api($access, 'GET', '/api/v1/parent/children')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $childId)
            ->assertJsonPath('data.0.group.name', 'Quyoshcha')->assertJsonPath('data.0.organization.name', '7-sonli DMTT')
            ->assertJsonPath('data.0.teachers.0.first_name', 'Dilnoza');
        $this->api($access, 'GET', "/api/v1/parent/children/{$childId}/attendance")->assertOk()->assertJsonPath('records.0.status', 'present');
        $this->api($access, 'GET', "/api/v1/parent/children/{$childId}/daily")->assertOk()
            ->assertJsonPath('attendance', 'present')->assertJsonPath('meals.0.ate', true)
            ->assertJsonPath('sleep.started_at', '13:00')->assertJsonPath('activities.0.participated', true);
        $this->api($access, 'GET', '/api/v1/parent/messages')->assertOk()->assertJsonPath('unread', 1)->assertJsonPath('data.0.body', 'Ertaga bayram ertaligi');
        $this->api($access, 'GET', "/api/v1/parent/children/{$childId}/payments")->assertOk()->assertJsonPath('data.0.holat', 'unpaid');

        // Aka-ukasi (ota-onaga bog'lanmagan) ko'rinmaydi
        $this->api($access, 'GET', "/api/v1/parent/children/{$siblingId}/attendance")->assertNotFound();

        // Rahbar to'lovni qayd etadi — ota-onada ko'rinadi
        $this->api($adminToken, 'PUT', '/api/v1/admin/payments', ['child_id' => $childId, 'month' => '2026-10', 'amount' => 350000, 'paid_at' => self::TODAY])->assertSuccessful();
        $this->api($access, 'GET', "/api/v1/parent/children/{$childId}/payments")->assertOk()->assertJsonPath('data.0.holat', 'paid');

        // 7. Super Admin statistikasi yangi bog'chani hisoblaydi
        $this->api($saToken, 'GET', "/api/v1/super-admin/organizations/{$orgId}")->assertOk()
            ->assertJsonPath('data.children_count', 2)->assertJsonPath('data.groups_count', 1)->assertJsonPath('data.teacher_profiles_count', 1);

        // Jurnalda vaqtinchalik va yangi parollar yo'q
        $log = ActivityLog::all()->toJson();
        foreach ([$adminTemp, $teacherTemp, $parentTemp, 'Rahbar-parol-7', 'Tarbiyachi-parol-7', 'Ota-ona-parol-7', $saPassword] as $secret) {
            $this->assertStringNotContainsString($secret, $log);
        }
    }
}
