<?php

namespace Tests\Feature\Admin;

use App\Models\AppNotification;
use App\Models\Attendance;
use App\Models\Child;
use App\Models\ChildPayment;
use App\Models\Group;
use App\Models\GroupActivity;
use App\Models\GroupPhoto;
use App\Models\MealRecord;
use App\Models\Message;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\SleepRecord;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Support\TestImages;
use Tests\TestCase;

/**
 * Bog'cha rahbari paneli: BARCHA /api/v1/admin/* endpointlari bo'yicha tenant izolyatsiyasi matritsasi.
 * A bog'cha rahbari B bog'cha resurslariga URL, so'rov tanasi yoki sarlavha orqali kira olmaydi va ularni o'zgartira olmaydi.
 * (Faqat vaqtinchalik test bazasida — RefreshDatabase.)
 */
class AdminPanelTenantIsolationTest extends TestCase
{
    use RefreshDatabase, TestImages;

    private const SECRET = 'BBB-MAXFIY';

    private Organization $a;
    private Organization $b;
    private User $adminA;
    private Group $groupA;
    private Child $childA;
    private TeacherProfile $teacherA;
    private array $B = [];

    protected function setUp(): void
    {
        parent::setUp();
        $today = now()->toDateString();

        $this->a = Organization::factory()->create(['name' => 'A bog\'cha']);
        $this->b = Organization::factory()->create(['name' => self::SECRET . ' bog\'cha']);
        $this->adminA = User::factory()->admin()->create(['organization_id' => $this->a->id]);
        $this->groupA = Group::factory()->create(['organization_id' => $this->a->id, 'name' => 'A guruh']);
        $this->childA = Child::factory()->create(['organization_id' => $this->a->id, 'group_id' => $this->groupA->id, 'is_active' => true]);
        $this->teacherA = TeacherProfile::factory()->create(['organization_id' => $this->a->id]);

        $b = $this->b->id;
        $groupB   = Group::factory()->create(['organization_id' => $b, 'name' => self::SECRET . ' guruh']);
        $childB   = Child::factory()->create(['organization_id' => $b, 'group_id' => $groupB->id, 'first_name' => self::SECRET, 'is_active' => true]);
        $teacherB = TeacherProfile::factory()->create(['organization_id' => $b, 'first_name' => self::SECRET]);
        $teacherB->groups()->attach($groupB->id, ['assigned_at' => now()]);
        $parentUserB = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $b]);
        $parentB  = ParentProfile::factory()->create(['organization_id' => $b, 'user_id' => $parentUserB->id, 'first_name' => self::SECRET]);
        $childB->parentProfiles()->attach($parentB->id, ['relation_type' => 'ona', 'is_primary' => true]);

        $this->B = [
            'group'    => $groupB,
            'child'    => $childB,
            'teacher'  => $teacherB,
            'parent'   => $parentB,
            'att'      => Attendance::create(['organization_id' => $b, 'group_id' => $groupB->id, 'child_id' => $childB->id, 'date' => $today, 'status' => Attendance::STATUS_PRESENT, 'marked_at' => now()]),
            'activity' => GroupActivity::factory()->create(['organization_id' => $b, 'group_id' => $groupB->id, 'date' => $today, 'title' => self::SECRET . ' mashg\'ulot']),
            'meal'     => MealRecord::factory()->create(['organization_id' => $b, 'child_id' => $childB->id, 'group_id' => $groupB->id, 'date' => $today]),
            'sleep'    => SleepRecord::factory()->create(['organization_id' => $b, 'child_id' => $childB->id, 'group_id' => $groupB->id, 'date' => $today]),
            'photo'    => GroupPhoto::create(['organization_id' => $b, 'group_id' => $groupB->id, 'path' => 'group-photos/x.png', 'caption' => self::SECRET, 'taken_on' => $today]),
            'payment'  => ChildPayment::create(['organization_id' => $b, 'child_id' => $childB->id, 'month' => now()->startOfMonth()->toDateString(), 'amount' => 350000, 'paid_at' => $today]),
            'message'  => Message::create(['organization_id' => $b, 'group_id' => $groupB->id, 'audience' => Message::AUDIENCE_GROUP, 'body' => self::SECRET . ' xabar']),
            'notif'    => AppNotification::create(['recipient_type' => 'admin', 'recipient_id' => $b, 'organization_id' => $b, 'title' => self::SECRET, 'message' => 'x', 'type' => 'info']),
        ];
    }

    private function asA()
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->adminA, 'sanctum');
    }

    /** B bog'cha ma'lumotlarining «surati» — so'rovlardan keyin o'zgarmaganini tekshirish uchun. */
    private function snapshotB(): array
    {
        $b = $this->b->id;

        return [
            'groups'     => Group::withTrashed()->where('organization_id', $b)->get(['id', 'name', 'is_active', 'deleted_at'])->toArray(),
            'children'   => Child::withTrashed()->where('organization_id', $b)->get(['id', 'group_id', 'first_name', 'is_active', 'deleted_at'])->toArray(),
            'teachers'   => TeacherProfile::where('organization_id', $b)->get(['id', 'first_name', 'is_active'])->toArray(),
            'teacher_groups' => $this->B['teacher']->groups()->pluck('groups.id')->all(),
            'parents'    => ParentProfile::where('organization_id', $b)->get(['id', 'first_name'])->toArray(),
            'child_parents' => $this->B['child']->parentProfiles()->pluck('parent_profiles.id')->all(),
            'users'      => User::where('organization_id', $b)->get(['id', 'is_active', 'password'])->toArray(),
            'attendance' => Attendance::where('organization_id', $b)->get(['id', 'status', 'child_id'])->toArray(),
            'activities' => GroupActivity::where('organization_id', $b)->get(['id', 'title'])->toArray(),
            'meals'      => MealRecord::where('organization_id', $b)->get(['id', 'ate'])->toArray(),
            'sleep'      => SleepRecord::where('organization_id', $b)->get(['id', 'started_at'])->toArray(),
            'photos'     => GroupPhoto::where('organization_id', $b)->get(['id', 'caption'])->toArray(),
            'payments'   => ChildPayment::where('organization_id', $b)->get(['id', 'amount'])->toArray(),
            'messages'   => Message::where('organization_id', $b)->count(),
            'notif_read' => AppNotification::whereKey($this->B['notif']->id)->value('read_at'),
            'child_photo' => Child::whereKey($this->B['child']->id)->value('profile_photo'),
        ];
    }

    public function test_b_resurslariga_barcha_endpointlar_orqali_murojaat_rad_etiladi_va_hech_narsa_ozgarmaydi(): void
    {
        $B = $this->B;
        [$g, $c, $t, $p] = [$B['group']->id, $B['child']->id, $B['teacher']->id, $B['parent']->id];
        $month = now()->format('Y-m');
        $today = now()->toDateString();
        $before = $this->snapshotB();

        $attempts = [
            // Bolalar
            ['GET',    "/api/v1/admin/children/{$c}"],
            ['PUT',    "/api/v1/admin/children/{$c}", ['first_name' => 'X', 'last_name' => 'Y', 'birth_date' => '2021-01-01', 'gender' => 'erkak']],
            ['DELETE', "/api/v1/admin/children/{$c}"],
            ['POST',   '/api/v1/admin/children', ['first_name' => 'X', 'last_name' => 'Y', 'birth_date' => '2021-01-01', 'gender' => 'erkak', 'group_id' => $g]],
            ['PUT',    "/api/v1/admin/children/{$this->childA->id}", ['first_name' => 'X', 'last_name' => 'Y', 'birth_date' => '2021-01-01', 'gender' => 'erkak', 'group_id' => $g]],
            ['POST',   "/api/v1/admin/children/{$c}/parents", ['parent_profile_id' => $p, 'relation_type' => 'ona']],
            ['POST',   "/api/v1/admin/children/{$this->childA->id}/parents", ['parent_profile_id' => $p, 'relation_type' => 'ona']],
            ['DELETE', "/api/v1/admin/children/{$c}/parents/{$p}"],
            ['GET',    "/api/v1/admin/children/{$c}/photo"],
            ['POST',   "/api/v1/admin/children/{$c}/photo", ['photo' => $this->pngUpload()]],
            ['DELETE', "/api/v1/admin/children/{$c}/photo"],
            // Guruhlar
            ['PUT',    "/api/v1/admin/groups/{$g}", ['name' => 'X', 'age_category' => '3-4 yosh', 'capacity' => 10]],
            ['DELETE', "/api/v1/admin/groups/{$g}"],
            // Tarbiyachilar
            ['PUT',    "/api/v1/admin/teachers/{$t}", ['first_name' => 'X', 'last_name' => 'Y', 'phone' => '+998901110099']],
            ['PATCH',  "/api/v1/admin/teachers/{$t}/deactivate"],
            ['PATCH',  "/api/v1/admin/teachers/{$t}/activate"],
            ['POST',   "/api/v1/admin/teachers/{$t}/reset-password"],
            ['PUT',    "/api/v1/admin/teachers/{$t}/groups", ['group_ids' => [$this->groupA->id]]],
            ['PUT',    "/api/v1/admin/teachers/{$this->teacherA->id}/groups", ['group_ids' => [$g]]],
            // Ota-onalar
            ['PUT',    "/api/v1/admin/parents/{$p}", ['first_name' => 'X', 'last_name' => 'Y', 'relation_type' => 'ota']],
            ['PATCH',  "/api/v1/admin/parents/{$p}/deactivate"],
            ['PATCH',  "/api/v1/admin/parents/{$p}/activate"],
            ['POST',   "/api/v1/admin/parents/{$p}/reset-password"],
            ['POST',   '/api/v1/admin/parents', ['first_name' => 'X', 'last_name' => 'Y', 'phone' => '+998901110098', 'username' => 'xparent1', 'relation_type' => 'ona', 'child_id' => $c]],
            // Davomat
            ['GET',    "/api/v1/admin/attendance?group_id={$g}&date={$today}"],
            ['PUT',    '/api/v1/admin/attendance', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'status' => 'absent']]]],
            ['PUT',    '/api/v1/admin/attendance', ['date' => $today, 'group_id' => $this->groupA->id, 'records' => [['child_id' => $c, 'status' => 'absent']]]],
            ['GET',    "/api/v1/admin/attendance/monthly?group_id={$g}&month={$month}"],
            ['GET',    "/api/v1/admin/attendance/monthly?child_id={$c}&month={$month}"],
            ['GET',    "/api/v1/admin/attendance/export?group_id={$g}&month={$month}&format=xlsx"],
            // Kundalik
            ['GET',    "/api/v1/admin/daily?group_id={$g}&date={$today}"],
            ['POST',   '/api/v1/admin/daily/activities', ['date' => $today, 'group_id' => $g, 'title' => 'X', 'starts_at' => '11:00']],
            ['PUT',    "/api/v1/admin/daily/activities/{$B['activity']->id}", ['title' => 'X', 'starts_at' => '11:00']],
            ['DELETE', "/api/v1/admin/daily/activities/{$B['activity']->id}"],
            ['PUT',    '/api/v1/admin/daily/meals', ['date' => $today, 'group_id' => $g, 'meal_type' => 'tushlik', 'served_at' => '12:00', 'records' => [['child_id' => $c, 'ate' => false]]]],
            ['PUT',    '/api/v1/admin/daily/meals', ['date' => $today, 'group_id' => $this->groupA->id, 'meal_type' => 'tushlik', 'served_at' => '12:00', 'records' => [['child_id' => $c, 'ate' => false]]]],
            ['DELETE', "/api/v1/admin/daily/meals/{$B['meal']->id}"],
            ['PUT',    '/api/v1/admin/daily/sleep', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'started_at' => '14:00']]]],
            ['DELETE', "/api/v1/admin/daily/sleep/{$B['sleep']->id}"],
            // Xabarlar
            ['POST',   '/api/v1/admin/messages', ['group_id' => $g, 'audience' => 'group', 'body' => 'X']],
            ['POST',   '/api/v1/admin/messages', ['group_id' => $this->groupA->id, 'audience' => 'child', 'child_id' => $c, 'body' => 'X']],
            // Bildirishnomalar
            ['PATCH',  "/api/v1/admin/notifications/{$B['notif']->id}/read"],
            // To'lovlar
            ['GET',    "/api/v1/admin/payments?group_id={$g}&month={$month}"],
            ['PUT',    '/api/v1/admin/payments', ['child_id' => $c, 'month' => $month, 'amount' => 1, 'paid_at' => $today]],
            ['DELETE', "/api/v1/admin/payments/{$c}/{$month}"],
            // Foto
            ['POST',   '/api/v1/admin/photos', ['group_id' => $g, 'photo' => $this->pngUpload(), 'taken_on' => $today]],
            ['DELETE', "/api/v1/admin/photos/{$B['photo']->id}"],
            ['GET',    "/api/v1/admin/photos/{$B['photo']->id}/file"],
        ];

        foreach ($attempts as $a) {
            [$method, $uri] = $a;
            $res = $this->asA()->json($method, $uri, $a[2] ?? []);
            $this->assertContains($res->status(), [403, 404, 422], "{$method} {$uri} — kutilmagan status {$res->status()}");
            $this->assertStringNotContainsString(self::SECRET, $res->getContent(), "{$method} {$uri} — B ma'lumoti javobda");
        }

        // Xabarlar va foto ro'yxati: begona group_id faqat filtr (bog'cha scope dan keyin) — bo'sh ro'yxat
        foreach (["/api/v1/admin/messages?group_id={$g}", "/api/v1/admin/photos?group_id={$g}"] as $uri) {
            $res = $this->asA()->getJson($uri)->assertOk()->assertJsonCount(0, 'data');
            $this->assertStringNotContainsString(self::SECRET, $res->getContent(), $uri);
        }

        // Notifikatsiyalar: «barchasini o'qildi» faqat o'z bog'chasiga ta'sir qiladi
        $this->asA()->patchJson('/api/v1/admin/notifications/read-all')->assertOk();

        $this->assertEquals($before, $this->snapshotB(), "B bog'cha ma'lumotlari o'zgarib qoldi");
    }

    public function test_royxat_va_dashboard_faqat_oz_bogcha_malumotini_qaytaradi(): void
    {
        $month = now()->format('Y-m');
        foreach (['/api/v1/admin/dashboard', '/api/v1/admin/children', '/api/v1/admin/groups', '/api/v1/admin/teachers', '/api/v1/admin/parents',
                  '/api/v1/admin/attendance', "/api/v1/admin/attendance/monthly?month={$month}", '/api/v1/admin/daily', '/api/v1/admin/messages',
                  '/api/v1/admin/notifications', "/api/v1/admin/payments?month={$month}", '/api/v1/admin/photos'] as $uri) {
            $res = $this->asA()->getJson($uri)->assertOk();
            $this->assertStringNotContainsString(self::SECRET, $res->getContent(), "{$uri} — B ma'lumoti chiqdi");
        }

        // X-Impersonated-Org rahbar uchun e'tiborsiz
        $res = $this->asA()->withHeaders(['X-Impersonated-Org' => (string) $this->b->id])->getJson('/api/v1/admin/children')->assertOk();
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());

        // Dashboard sonlari faqat A bog'chadan
        $this->asA()->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('bolalar_soni', 1)->assertJsonPath('guruhlar_soni', 1);
    }

    public function test_dashboard_songgi_faoliyatlar_va_davomat_faqat_oz_bogchadan(): void
    {
        $today = now()->toDateString();
        // A: bitta faolsiz bola, ikki mashg'ulot; bugungi davomat — 1 keldi
        Child::factory()->create(['organization_id' => $this->a->id, 'group_id' => $this->groupA->id, 'is_active' => false]);
        GroupActivity::factory()->create(['organization_id' => $this->a->id, 'group_id' => $this->groupA->id, 'date' => now()->subDay()->toDateString(), 'title' => 'Kechagi rasm']);
        GroupActivity::factory()->create(['organization_id' => $this->a->id, 'group_id' => $this->groupA->id, 'date' => $today, 'title' => 'Bugungi ertak']);
        Attendance::create(['organization_id' => $this->a->id, 'group_id' => $this->groupA->id, 'child_id' => $this->childA->id, 'date' => $today, 'status' => Attendance::STATUS_PRESENT, 'marked_at' => now()]);

        $res = $this->asA()->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('bolalar_soni', 2)
            ->assertJsonPath('faol_bolalar_soni', 1)
            ->assertJsonPath('bugungi_davomat.keldi', 1)
            ->assertJsonCount(2, 'songgi_faoliyatlar')
            ->assertJsonPath('songgi_faoliyatlar.0.title', 'Bugungi ertak')
            ->assertJsonPath('songgi_faoliyatlar.0.group.name', 'A guruh')
            ->assertJsonPath('songgi_faoliyatlar.1.title', 'Kechagi rasm');
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());
    }

    public function test_bola_guruhga_biriktirilsa_guruhlar_royxati_va_dashboardda_aks_etadi(): void
    {
        $group2 = Group::factory()->create(['organization_id' => $this->a->id, 'name' => 'A ikkinchi']);
        $payload = ['first_name' => 'Yangi', 'last_name' => 'Bola', 'birth_date' => '2021-05-01', 'gender' => 'erkak', 'group_id' => $group2->id];
        $id = $this->asA()->postJson('/api/v1/admin/children', $payload)->assertCreated()->json('data.id');
        $this->assertSame($this->a->id, Child::find($id)->organization_id);

        $counts = fn () => collect($this->asA()->getJson('/api/v1/admin/groups')->assertOk()->json('data'))->pluck('children_count', 'id');
        $this->assertSame(1, $counts()[$group2->id]);
        $this->assertSame(1, $counts()[$this->groupA->id]);

        // Boshqa guruhga o'tkazish — ikkala guruh soni yangilanadi
        $this->asA()->putJson("/api/v1/admin/children/{$id}", ['group_id' => $this->groupA->id] + $payload)->assertOk();
        $this->assertSame(0, $counts()[$group2->id]);
        $this->assertSame(2, $counts()[$this->groupA->id]);
        $this->asA()->getJson('/api/v1/admin/dashboard')->assertJsonPath('bolalar_soni', 2)->assertJsonPath('guruhlar_soni', 2);
    }

    public function test_tarbiyachi_va_ota_ona_admin_paneliga_kira_olmaydi(): void
    {
        $teacherUser = $this->teacherA->user;
        $parentUser  = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->a->id]);

        foreach (['/api/v1/admin/dashboard', '/api/v1/admin/children', '/api/v1/admin/payments'] as $uri) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($teacherUser, 'sanctum')->getJson($uri)->assertForbidden();
            $this->actingAsParent($parentUser)->getJson($uri)->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/children')->assertUnauthorized();
    }
}
