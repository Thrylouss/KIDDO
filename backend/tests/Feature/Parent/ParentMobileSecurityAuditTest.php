<?php

namespace Tests\Feature\Parent;

use App\Models\Attendance;
use App\Models\Child;
use App\Models\ChildPayment;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\GroupPhoto;
use App\Models\MealRecord;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\SleepRecord;
use App\Models\TeacherProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Ota-ona mobil API: autentifikatsiya oqimi, bir nechta farzand, IDOR / tenant izolyatsiyasi,
 * ruxsatsiz yozish urinishlari va xato javoblari formati.
 * (Faqat vaqtinchalik test bazasida — RefreshDatabase.)
 */
class ParentMobileSecurityAuditTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'BEGONA-MAXFIY';
    private const TODAY  = '2026-10-28';

    private Organization $org;
    private User $parent;
    private ParentProfile $profile;
    private Child $first;
    private Child $second;
    private array $X = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse(self::TODAY . ' 10:00', 'Asia/Tashkent'));

        $this->org = Organization::factory()->create(['name' => 'Quyoshcha']);
        $o = $this->org->id;
        $g1 = Group::factory()->create(['organization_id' => $o, 'name' => 'Kapalaklar']);
        $g2 = Group::factory()->create(['organization_id' => $o, 'name' => 'Yulduzlar']);

        // Bir ota-ona — ikki farzand, ikki guruhda
        $this->parent  = User::factory()->parent()->create(['organization_id' => $o]);
        $this->profile = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $o]);
        $this->first   = Child::factory()->create(['organization_id' => $o, 'group_id' => $g1->id, 'first_name' => 'Ali', 'last_name' => 'Aliyev']);
        $this->second  = Child::factory()->create(['organization_id' => $o, 'group_id' => $g2->id, 'first_name' => 'Laylo', 'last_name' => 'Aliyeva']);
        $this->profile->children()->attach($this->first->id, ['relation_type' => 'ota', 'is_primary' => true]);
        $this->profile->children()->attach($this->second->id, ['relation_type' => 'ota', 'is_primary' => true]);

        // Guruh tarbiyachilari: faol, faol emas va boshqa bog'chadan (pivot noto'g'ri bog'langan holat)
        $active = TeacherProfile::factory()->create(['organization_id' => $o, 'first_name' => 'Dilnoza', 'last_name' => 'Karimova', 'position' => 'Tarbiyachi', 'is_active' => true]);
        $off    = TeacherProfile::factory()->create(['organization_id' => $o, 'first_name' => self::SECRET, 'is_active' => false]);
        $active->groups()->attach($g1->id, ['assigned_at' => self::TODAY, 'is_primary' => true]);
        $off->groups()->attach($g1->id, ['assigned_at' => self::TODAY]);

        // Shu bog'chadagi boshqa oila (o'sha guruhda) va boshqa bog'cha
        $otherParentUser = User::factory()->parent()->create(['organization_id' => $o]);
        $otherProfile    = ParentProfile::factory()->create(['user_id' => $otherParentUser->id, 'organization_id' => $o]);
        $neighbour       = Child::factory()->create(['organization_id' => $o, 'group_id' => $g1->id, 'first_name' => self::SECRET]);
        $otherProfile->children()->attach($neighbour->id, ['relation_type' => 'ona', 'is_primary' => true]);
        $lonelyGroup     = Group::factory()->create(['organization_id' => $o, 'name' => self::SECRET . ' guruh']);
        $lonely          = Child::factory()->create(['organization_id' => $o, 'group_id' => $lonelyGroup->id, 'first_name' => self::SECRET]);

        $foreignOrg   = Organization::factory()->create(['name' => self::SECRET . ' bog\'cha']);
        $foreignGroup = Group::factory()->create(['organization_id' => $foreignOrg->id]);
        $foreignChild = Child::factory()->create(['organization_id' => $foreignOrg->id, 'group_id' => $foreignGroup->id, 'first_name' => self::SECRET]);
        // Noto'g'ri ma'lumot holati: begona bog'cha bolasi shu ota-ona profiliga bog'langan — baribir ko'rinmasin
        $this->profile->children()->attach($foreignChild->id, ['relation_type' => 'ota']);

        foreach ([$this->first, $neighbour, $lonely, $foreignChild] as $c) {
            Attendance::create(['organization_id' => $c->organization_id, 'group_id' => $c->group_id, 'child_id' => $c->id, 'date' => self::TODAY,
                'status' => Attendance::STATUS_EXCUSED, 'excuse_reason' => 'kasallik', 'note' => $c->is($this->first) ? 'Isitma' : self::SECRET, 'marked_at' => now()]);
            MealRecord::factory()->create(['organization_id' => $c->organization_id, 'group_id' => $c->group_id, 'child_id' => $c->id, 'date' => self::TODAY, 'note' => $c->is($this->first) ? null : self::SECRET]);
            SleepRecord::factory()->create(['organization_id' => $c->organization_id, 'group_id' => $c->group_id, 'child_id' => $c->id, 'date' => self::TODAY, 'note' => $c->is($this->first) ? null : self::SECRET]);
            ChildPayment::create(['organization_id' => $c->organization_id, 'child_id' => $c->id, 'month' => '2026-10-01', 'amount' => 350000, 'paid_at' => self::TODAY,
                'note' => $c->is($this->first) ? 'Naqd' : self::SECRET]);
        }

        // Mashg'ulot: farzand qatnashgan; ishtirokchilar ro'yxatidagi qo'shni bola ota-onaga ko'rinmasin
        $activity = GroupActivity::factory()->create(['organization_id' => $o, 'group_id' => $g1->id, 'date' => self::TODAY, 'title' => 'Ertak']);
        $activity->children()->attach([$this->first->id, $neighbour->id]);

        $this->X = [
            'neighbour'     => $neighbour,
            'lonely'        => $lonely,
            'foreign'       => $foreignChild,
            'own_photo'     => GroupPhoto::create(['organization_id' => $o, 'group_id' => $g1->id, 'path' => 'group-photos/a.png', 'caption' => 'Bayram', 'taken_on' => self::TODAY]),
            'lonely_photo'  => GroupPhoto::create(['organization_id' => $o, 'group_id' => $lonelyGroup->id, 'path' => 'group-photos/b.png', 'caption' => self::SECRET, 'taken_on' => self::TODAY]),
            'foreign_photo' => GroupPhoto::create(['organization_id' => $foreignOrg->id, 'group_id' => $foreignGroup->id, 'path' => 'group-photos/c.png', 'caption' => self::SECRET, 'taken_on' => self::TODAY]),
            'other_parent'  => $otherProfile,
        ];

        // Xabarlar: o'ziga bittasi, qo'shni oilaga maxfiy bittasi
        $mine   = Message::create(['organization_id' => $o, 'group_id' => $g1->id, 'audience' => Message::AUDIENCE_GROUP, 'body' => 'Ertaga bayram']);
        $theirs = Message::create(['organization_id' => $o, 'group_id' => $g1->id, 'audience' => Message::AUDIENCE_CHILD, 'child_id' => $neighbour->id, 'body' => self::SECRET]);
        $this->X['my_recipient']    = MessageRecipient::create(['message_id' => $mine->id, 'parent_profile_id' => $this->profile->id, 'child_id' => $this->first->id]);
        $this->X['their_recipient'] = MessageRecipient::create(['message_id' => $theirs->id, 'parent_profile_id' => $otherProfile->id, 'child_id' => $neighbour->id]);
    }

    /** Haqiqiy mobil login orqali access token. */
    private function login(): array
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/mobile/login', ['login' => $this->parent->phone, 'password' => 'password', 'device_name' => 'iPhone'])
            ->assertOk()->json();
    }

    private function bearer(string $token, string $method, string $uri, array $body = [])
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->json($method, $uri, $body);
    }

    // ── 1. Autentifikatsiya ───────────────────────────────────────

    public function test_login_refresh_logout_toliq_oqim(): void
    {
        $tokens = $this->login();
        $this->assertSame('Bearer', $tokens['token_type']);
        $this->assertArrayNotHasKey('password', $tokens['user']);
        $this->bearer($tokens['access_token'], 'GET', '/api/v1/parent/children')->assertOk();

        // Refresh token API so'rovini autentifikatsiya qila olmaydi
        $this->bearer($tokens['refresh_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();

        // Rotatsiya: yangi juftlik ishlaydi, eski refresh va eski access bekor
        $this->app['auth']->forgetGuards();
        $new = $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $tokens['refresh_token']])->assertOk()->json();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $tokens['refresh_token']])
            ->assertUnauthorized()->assertJsonPath('message', 'Sessiya muddati tugagan. Qaytadan kiring.');
        $this->bearer($tokens['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();
        $this->bearer($new['access_token'], 'GET', '/api/v1/parent/children')->assertOk();

        // Access token 15 daqiqadan keyin eskiradi
        $this->travel(16)->minutes();
        $this->bearer($new['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized()->assertJsonPath('message', 'Tizimga kirishingiz kerak.');
        $this->app['auth']->forgetGuards();
        $fresh = $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $new['refresh_token']])->assertOk()->json();

        // Logout — joriy qurilma sessiyasi butunlay bekor
        $this->bearer($fresh['access_token'], 'POST', '/api/v1/mobile/logout')->assertOk();
        $this->bearer($fresh['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $fresh['refresh_token']])->assertUnauthorized();
    }

    public function test_notogri_parol_va_boshqa_rollar_bir_xil_umumiy_xato_oladi(): void
    {
        $teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $wrong   = $this->postJson('/api/v1/mobile/login', ['login' => $this->parent->phone, 'password' => 'xato-parol'])->assertStatus(422);
        $role    = $this->postJson('/api/v1/mobile/login', ['login' => $teacher->phone, 'password' => 'password'])->assertStatus(422);
        $this->assertSame($wrong->json('errors'), $role->json('errors'));
        $this->assertArrayNotHasKey('access_token', $role->json());

        // Tokensiz va soxta token — 401, o'zbekcha xabar
        foreach (['/api/v1/parent/children', '/api/v1/parent/messages', "/api/v1/parent/children/{$this->first->id}/daily"] as $uri) {
            $this->app['auth']->forgetGuards();
            $this->getJson($uri)->assertUnauthorized()->assertJsonPath('message', 'Tizimga kirishingiz kerak.');
            $this->bearer('999|soxta-token', 'GET', $uri)->assertUnauthorized();
        }
    }

    public function test_faolsizlantirilgan_ota_ona_yoki_bogcha_tokeni_ishlamaydi(): void
    {
        $tokens = $this->login();
        $this->org->update(['status' => 'inactive']);
        $this->bearer($tokens['access_token'], 'GET', '/api/v1/parent/children')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => $tokens['refresh_token']])->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/mobile/login', ['login' => $this->parent->phone, 'password' => 'password'])->assertStatus(422);
    }

    // ── 2. Farzand ma'lumotlari ───────────────────────────────────

    public function test_bir_nechta_farzand_bogcha_guruh_va_tarbiyachi_bilan(): void
    {
        $token = $this->login()['access_token'];
        $res   = $this->bearer($token, 'GET', '/api/v1/parent/children')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.first_name', 'Ali')
            ->assertJsonPath('data.0.group.name', 'Kapalaklar')
            ->assertJsonPath('data.0.organization.name', 'Quyoshcha')
            ->assertJsonCount(1, 'data.0.teachers')
            ->assertJsonPath('data.0.teachers.0.first_name', 'Dilnoza')
            ->assertJsonPath('data.0.teachers.0.position', 'Tarbiyachi')
            ->assertJsonPath('data.0.teachers.0.is_primary', true)
            ->assertJsonPath('data.1.first_name', 'Laylo')
            ->assertJsonPath('data.1.group.name', 'Yulduzlar')
            ->assertJsonCount(0, 'data.1.teachers');
        // Faol bo'lmagan tarbiyachi va begona bog'cha bolasi ko'rinmaydi; tarbiyachi telefoni/logini yo'q
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());
        $this->assertArrayNotHasKey('phone', $res->json('data.0.teachers.0'));

        // Har bir farzand bo'yicha endpointlar ishlaydi
        foreach ([$this->first, $this->second] as $c) {
            $this->bearer($token, 'GET', "/api/v1/parent/children/{$c->id}/attendance")->assertOk()->assertJsonPath('child.id', $c->id);
            $this->bearer($token, 'GET', "/api/v1/parent/children/{$c->id}/daily")->assertOk()->assertJsonPath('child.id', $c->id);
            $this->bearer($token, 'GET', "/api/v1/parent/children/{$c->id}/photos")->assertOk()->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'total']]);
            $this->bearer($token, 'GET', "/api/v1/parent/children/{$c->id}/payments")->assertOk()->assertJsonCount(6, 'data');
        }
    }

    public function test_davomat_kundalik_foto_xabar_va_tolov_faqat_oz_farzandi(): void
    {
        $token = $this->login()['access_token'];
        $id    = $this->first->id;

        $att = $this->bearer($token, 'GET', "/api/v1/parent/children/{$id}/attendance")->assertOk()
            ->assertJsonPath('records.0.status', 'excused')->assertJsonPath('records.0.note', 'Isitma')->assertJsonPath('summary.excused', 1);
        $daily = $this->bearer($token, 'GET', "/api/v1/parent/children/{$id}/daily")->assertOk()
            ->assertJsonCount(1, 'meals')->assertJsonPath('activities.0.title', 'Ertak')->assertJsonPath('activities.0.participated', true);
        $this->assertArrayNotHasKey('participants', $daily->json('activities.0'));
        $photos = $this->bearer($token, 'GET', "/api/v1/parent/children/{$id}/photos")->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.caption', 'Bayram');
        $this->assertStringContainsString("/api/v1/parent/photos/{$this->X['own_photo']->id}/file", $photos->json('data.0.url'));
        $pay = $this->bearer($token, 'GET', "/api/v1/parent/children/{$id}/payments")->assertOk()
            ->assertJsonPath('data.0.oy', '2026-10')->assertJsonPath('data.0.holat', 'paid')->assertJsonPath('data.0.payment.note', 'Naqd');
        $msgs = $this->bearer($token, 'GET', '/api/v1/parent/messages')->assertOk()
            ->assertJsonPath('unread', 1)->assertJsonCount(1, 'data')->assertJsonPath('data.0.body', 'Ertaga bayram');

        foreach ([$att, $daily, $photos, $pay, $msgs] as $res) {
            $this->assertStringNotContainsString(self::SECRET, $res->getContent());
        }

        // O'qildi deb belgilash — unread kamayadi, takroriy so'rov idempotent
        $this->bearer($token, 'PATCH', "/api/v1/parent/messages/{$this->X['my_recipient']->id}/read")->assertOk();
        $this->bearer($token, 'PATCH', "/api/v1/parent/messages/{$this->X['my_recipient']->id}/read")->assertOk();
        $this->bearer($token, 'GET', '/api/v1/parent/messages')->assertJsonPath('unread', 0);
    }

    public function test_oqilmaganlar_soni_royxat_chegarasidan_qatiy_nazar_toliq(): void
    {
        for ($i = 0; $i < 105; $i++) {
            $message = Message::create(['organization_id' => $this->org->id, 'group_id' => $this->first->group_id, 'audience' => Message::AUDIENCE_GROUP, 'body' => "Eslatma {$i}"]);
            MessageRecipient::create(['message_id' => $message->id, 'parent_profile_id' => $this->profile->id, 'child_id' => $this->first->id]);
        }
        $this->bearer($this->login()['access_token'], 'GET', '/api/v1/parent/messages')->assertOk()
            ->assertJsonCount(100, 'data')->assertJsonPath('unread', 106);
    }

    public function test_guruhsiz_farzand_uchun_foto_bosh_royxat(): void
    {
        $this->second->update(['group_id' => null]);
        $this->bearer($this->login()['access_token'], 'GET', "/api/v1/parent/children/{$this->second->id}/photos")->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }

    // ── 3. IDOR va tenant izolyatsiyasi ───────────────────────────

    public function test_begona_bola_rasm_va_xabar_idlari_404_qaytaradi(): void
    {
        $token = $this->login()['access_token'];

        foreach (['neighbour', 'lonely', 'foreign'] as $key) {
            $c = $this->X[$key]->id;
            foreach (["/api/v1/parent/children/{$c}/attendance", "/api/v1/parent/children/{$c}/daily", "/api/v1/parent/children/{$c}/photo",
                      "/api/v1/parent/children/{$c}/photos", "/api/v1/parent/children/{$c}/payments"] as $uri) {
                $res = $this->bearer($token, 'GET', $uri)->assertNotFound()->assertJsonPath('message', "Ma'lumot topilmadi.");
                $this->assertStringNotContainsString(self::SECRET, $res->getContent(), "[{$key}] {$uri}");
            }
        }

        foreach (['lonely_photo', 'foreign_photo'] as $key) {
            $this->bearer($token, 'GET', "/api/v1/parent/photos/{$this->X[$key]->id}/file")->assertNotFound();
        }

        // Boshqa oilaning xabarini o'qildi deb belgilab bo'lmaydi
        $this->bearer($token, 'PATCH', "/api/v1/parent/messages/{$this->X['their_recipient']->id}/read")->assertNotFound();
        $this->assertNull($this->X['their_recipient']->fresh()->read_at);

        // So'rovdagi organization_id / sarlavha hech narsani o'zgartirmaydi
        $res = $this->withHeaders(['X-Impersonated-Org' => (string) $this->X['foreign']->organization_id])
            ->bearer($token, 'GET', '/api/v1/parent/children?organization_id=' . $this->X['foreign']->organization_id)->assertOk()->assertJsonCount(2, 'data');
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());
    }

    // ── 4. Ruxsatsiz yozish urinishlari ───────────────────────────

    public function test_ota_ona_hech_qanday_malumotni_ozgartira_olmaydi(): void
    {
        $token = $this->login()['access_token'];
        $c     = $this->first->id;
        $g     = $this->first->group_id;
        $today = self::TODAY;
        $before = [
            Child::orderBy('id')->get(['id', 'first_name', 'group_id', 'is_active'])->toArray(),
            Attendance::orderBy('id')->get(['id', 'status', 'note'])->toArray(),
            ChildPayment::orderBy('id')->get(['id', 'amount', 'note'])->toArray(),
            GroupPhoto::count(), Message::count(), MealRecord::count(), SleepRecord::count(), GroupActivity::count(),
        ];

        // Admin va tarbiyachi yozish endpointlari — 403
        $forbidden = [
            ['PUT',    "/api/v1/admin/children/{$c}", ['first_name' => 'X']],
            ['DELETE', "/api/v1/admin/children/{$c}"],
            ['PUT',    '/api/v1/admin/attendance', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'status' => 'present']]]],
            ['PUT',    '/api/v1/admin/payments', ['child_id' => $c, 'month' => '2026-10', 'amount' => 1]],
            ['DELETE', "/api/v1/admin/payments/{$c}/2026-10"],
            ['POST',   '/api/v1/admin/messages', ['group_id' => $g, 'audience' => 'group', 'body' => 'x']],
            ['PUT',    '/api/v1/teacher/attendance', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'status' => 'present']]]],
            ['PUT',    '/api/v1/teacher/daily/meals', ['date' => $today, 'group_id' => $g, 'meal_type' => 'tushlik', 'served_at' => '12:00', 'records' => [['child_id' => $c]]]],
            ['POST',   '/api/v1/teacher/daily/activities', ['date' => $today, 'group_id' => $g, 'title' => 'x']],
            ['POST',   '/api/v1/teacher/messages', ['group_id' => $g, 'audience' => 'group', 'body' => 'x']],
            ['DELETE', "/api/v1/teacher/photos/{$this->X['own_photo']->id}"],
            ['GET',    '/api/v1/admin/children'],
            ['GET',    '/api/v1/super-admin/organizations'],
        ];
        foreach ($forbidden as $a) {
            $res = $this->bearer($token, $a[0], $a[1], $a[2] ?? []);
            $this->assertSame(403, $res->status(), "{$a[0]} {$a[1]}");
            $this->assertStringNotContainsString(self::SECRET, $res->getContent());
        }

        // Ota-ona marshrutlarida yozish fe'llari mavjud emas — 405, o'zbekcha xabar, ichki tafsilotsiz
        foreach ([['PUT', "/api/v1/parent/children/{$c}/attendance"], ['DELETE', "/api/v1/parent/photos/{$this->X['own_photo']->id}/file"],
                  ['POST', '/api/v1/parent/messages'], ['POST', '/api/v1/parent/children']] as [$method, $uri]) {
            $res = $this->bearer($token, $method, $uri, ['status' => 'present']);
            $res->assertStatus(405)->assertJsonPath('message', "Bu amal qo'llab-quvvatlanmaydi.");
            $this->assertStringNotContainsString('Symfony', $res->getContent());
            $this->assertStringNotContainsString('supported', $res->getContent());
        }

        $after = [
            Child::orderBy('id')->get(['id', 'first_name', 'group_id', 'is_active'])->toArray(),
            Attendance::orderBy('id')->get(['id', 'status', 'note'])->toArray(),
            ChildPayment::orderBy('id')->get(['id', 'amount', 'note'])->toArray(),
            GroupPhoto::count(), Message::count(), MealRecord::count(), SleepRecord::count(), GroupActivity::count(),
        ];
        $this->assertSame($before, $after);
    }

    // ── 5. Xato javoblari ─────────────────────────────────────────

    public function test_429_va_validatsiya_xatolari_ozbekcha(): void
    {
        $token = $this->login()['access_token'];
        $this->bearer($token, 'GET', "/api/v1/parent/children/{$this->first->id}/daily?date=2026-13-45")
            ->assertStatus(422)->assertJsonPath('message', "Kiritilgan ma'lumotlar noto'g'ri.")->assertJsonStructure(['errors' => ['date']]);
        $this->bearer($token, 'GET', "/api/v1/parent/children/{$this->first->id}/attendance?from=2026-01-01&to=2026-10-28")
            ->assertStatus(422)->assertJsonStructure(['errors' => ['from']]);

        $this->app['auth']->forgetGuards();
        for ($i = 0; $i < \App\Providers\AppServiceProvider::MOBILE_REFRESH_PER_IP; $i++) {
            $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => 'yaroqsiz']);
        }
        $this->postJson('/api/v1/mobile/token/refresh', ['refresh_token' => 'yaroqsiz'])
            ->assertStatus(429)->assertHeader('Retry-After')
            ->assertJsonPath('message', "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.");
    }

    public function test_kutilmagan_xato_productionda_ichki_tafsilotsiz_500(): void
    {
        Route::middleware('api')->get('/api/v1/_audit-boom', fn () => throw new \RuntimeException('SQLSTATE maxfiy ichki tafsilot'));

        config(['app.debug' => false]);
        $res = $this->getJson('/api/v1/_audit-boom')->assertStatus(500)
            ->assertExactJson(['message' => "Serverda xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring."]);
        $this->assertStringNotContainsString('SQLSTATE', $res->getContent());

        // Debug rejimida Laravel standarti saqlanadi (dasturchi uchun)
        config(['app.debug' => true]);
        $this->getJson('/api/v1/_audit-boom')->assertStatus(500)->assertJsonPath('message', 'SQLSTATE maxfiy ichki tafsilot');
    }
}
