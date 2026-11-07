<?php

namespace Tests\Feature\Teacher;

use App\Models\Attendance;
use App\Models\Child;
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
use Tests\Support\TestImages;
use Tests\TestCase;

/**
 * Tarbiyachi paneli: BARCHA /api/v1/teacher/* endpointlari bo'yicha izolyatsiya matritsasi.
 * Tarbiyachi faqat o'ziga biriktirilgan guruh(lar) bilan ishlaydi: shu bog'chadagi boshqa tarbiyachining
 * guruhi ham, boshqa bog'cha ham URL, query yoki so'rov tanasi orqali ochilmaydi va o'zgarmaydi.
 * (Faqat vaqtinchalik test bazasida — RefreshDatabase.)
 */
class TeacherPanelIsolationTest extends TestCase
{
    use RefreshDatabase, TestImages;

    private const SECRET = 'MAXFIY-GURUH';

    private Organization $org;
    private User $teacher;
    private User $colleague;
    private TeacherProfile $profile;
    private Group $myGroup;
    private Child $myChild;
    /** @var array<string, array<string, mixed>> «other» — shu bog'chadagi boshqa tarbiyachi guruhi, «foreign» — boshqa bog'cha */
    private array $T = [];

    protected function setUp(): void
    {
        parent::setUp();
        $today = now()->toDateString();

        $this->org       = Organization::factory()->create();
        $this->teacher   = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $this->profile   = TeacherProfile::factory()->create(['user_id' => $this->teacher->id, 'organization_id' => $this->org->id]);
        $this->myGroup   = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Mening guruhim']);
        $this->profile->groups()->attach($this->myGroup->id, ['assigned_at' => $today]);
        $this->myChild   = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id, 'is_active' => true]);
        Attendance::create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id, 'child_id' => $this->myChild->id,
                            'date' => $today, 'status' => Attendance::STATUS_PRESENT, 'marked_at' => now()]);

        // Shu bog'chadagi hamkasb va uning guruhi
        $this->colleague = User::factory()->teacher()->create(['organization_id' => $this->org->id]);
        $colleagueProfile = TeacherProfile::factory()->create(['user_id' => $this->colleague->id, 'organization_id' => $this->org->id]);
        $otherGroup = Group::factory()->create(['organization_id' => $this->org->id, 'name' => self::SECRET . ' hamkasb']);
        $colleagueProfile->groups()->attach($otherGroup->id, ['assigned_at' => $today]);
        $this->T['other'] = $this->seedGroupData($this->org, $otherGroup, $this->colleague);

        // Boshqa bog'cha
        $foreignOrg     = Organization::factory()->create(['name' => self::SECRET . ' bog\'cha']);
        $foreignTeacher = User::factory()->teacher()->create(['organization_id' => $foreignOrg->id]);
        $foreignProfile = TeacherProfile::factory()->create(['user_id' => $foreignTeacher->id, 'organization_id' => $foreignOrg->id]);
        $foreignGroup   = Group::factory()->create(['organization_id' => $foreignOrg->id, 'name' => self::SECRET . ' begona']);
        $foreignProfile->groups()->attach($foreignGroup->id, ['assigned_at' => $today]);
        $this->T['foreign'] = $this->seedGroupData($foreignOrg, $foreignGroup, $foreignTeacher);
    }

    /** Guruhga to'liq ma'lumot: bola, davomat, mashg'ulot, ovqat, uyqu, rasm, xabar — barchasi SECRET belgili. */
    private function seedGroupData(Organization $org, Group $group, User $by): array
    {
        $today = now()->toDateString();
        $child = Child::factory()->create(['organization_id' => $org->id, 'group_id' => $group->id, 'first_name' => self::SECRET, 'is_active' => true]);

        return [
            'group'    => $group,
            'child'    => $child,
            'att'      => Attendance::create(['organization_id' => $org->id, 'group_id' => $group->id, 'child_id' => $child->id, 'date' => $today, 'status' => Attendance::STATUS_PRESENT, 'marked_at' => now()]),
            'activity' => GroupActivity::factory()->create(['organization_id' => $org->id, 'group_id' => $group->id, 'date' => $today, 'title' => self::SECRET . ' mashg\'ulot']),
            'meal'     => MealRecord::factory()->create(['organization_id' => $org->id, 'child_id' => $child->id, 'group_id' => $group->id, 'date' => $today]),
            'sleep'    => SleepRecord::factory()->create(['organization_id' => $org->id, 'child_id' => $child->id, 'group_id' => $group->id, 'date' => $today]),
            'photo'    => GroupPhoto::create(['organization_id' => $org->id, 'group_id' => $group->id, 'path' => 'group-photos/x.png', 'caption' => self::SECRET, 'taken_on' => $today, 'uploaded_by' => $by->id]),
            'message'  => Message::create(['organization_id' => $org->id, 'group_id' => $group->id, 'audience' => Message::AUDIENCE_GROUP, 'body' => self::SECRET . ' xabar']),
        ];
    }

    private function asTeacher(?User $user = null)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user ?? $this->teacher, 'sanctum');
    }

    /** Boshqa guruhlar ma'lumotlarining «surati» — so'rovlardan keyin o'zgarmaganini tekshirish uchun. */
    private function snapshot(): array
    {
        $ids = collect($this->T)->map(fn ($d) => $d['group']->id)->values()->all();

        return [
            'children'   => Child::withTrashed()->whereIn('group_id', $ids)->get(['id', 'group_id', 'first_name', 'is_active', 'profile_photo', 'deleted_at'])->toArray(),
            'attendance' => Attendance::whereIn('group_id', $ids)->get(['id', 'status', 'note'])->toArray(),
            'activities' => GroupActivity::withTrashed()->whereIn('group_id', $ids)->get(['id', 'title', 'deleted_at'])->toArray(),
            'meals'      => MealRecord::withTrashed()->whereIn('group_id', $ids)->get(['id', 'ate', 'deleted_at'])->toArray(),
            'sleep'      => SleepRecord::withTrashed()->whereIn('group_id', $ids)->get(['id', 'started_at', 'deleted_at'])->toArray(),
            'photos'     => GroupPhoto::whereIn('group_id', $ids)->get(['id', 'caption'])->toArray(),
            'messages'   => Message::whereIn('group_id', $ids)->count(),
        ];
    }

    public function test_boshqa_guruh_va_boshqa_bogcha_resurslari_barcha_endpointlarda_rad_etiladi(): void
    {
        $before = $this->snapshot();
        $today  = now()->toDateString();
        $month  = now()->format('Y-m');
        $mine   = $this->myGroup->id;

        foreach ($this->T as $label => $d) {
            [$g, $c] = [$d['group']->id, $d['child']->id];
            $attempts = [
                ['GET',    "/api/v1/teacher/dashboard?group_id={$g}"],
                ['PUT',    '/api/v1/teacher/attendance', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'status' => 'absent']]]],
                // O'z guruhi orqali begona bolani yozish
                ['PUT',    '/api/v1/teacher/attendance', ['date' => $today, 'group_id' => $mine, 'records' => [['child_id' => $c, 'status' => 'absent']]]],
                ['GET',    "/api/v1/teacher/attendance/monthly?group_id={$g}&month={$month}"],
                ['GET',    "/api/v1/teacher/attendance/export?group_id={$g}&month={$month}&format=xlsx"],
                ['GET',    "/api/v1/teacher/children?group_id={$g}"],
                ['GET',    "/api/v1/teacher/children/{$c}"],
                ['GET',    "/api/v1/teacher/children/{$c}/history"],
                ['GET',    "/api/v1/teacher/children/{$c}/photo"],
                ['POST',   "/api/v1/teacher/children/{$c}/photo", ['photo' => $this->pngUpload()]],
                ['DELETE', "/api/v1/teacher/children/{$c}/photo"],
                ['GET',    "/api/v1/teacher/photos?group_id={$g}"],
                ['POST',   '/api/v1/teacher/photos', ['group_id' => $g, 'photo' => $this->pngUpload(), 'caption' => 'x']],
                ['GET',    "/api/v1/teacher/photos/{$d['photo']->id}/file"],
                ['DELETE', "/api/v1/teacher/photos/{$d['photo']->id}"],
                ['GET',    "/api/v1/teacher/messages?group_id={$g}"],
                ['POST',   '/api/v1/teacher/messages', ['group_id' => $g, 'audience' => 'group', 'body' => 'Salom']],
                ['POST',   '/api/v1/teacher/messages', ['group_id' => $mine, 'audience' => 'child', 'child_id' => $c, 'body' => 'Salom']],
                ['GET',    "/api/v1/teacher/daily?group_id={$g}&date={$today}"],
                ['PUT',    '/api/v1/teacher/daily/meals', ['date' => $today, 'group_id' => $g, 'meal_type' => 'tushlik', 'served_at' => '12:00', 'records' => [['child_id' => $c, 'ate' => false]]]],
                ['PUT',    '/api/v1/teacher/daily/meals', ['date' => $today, 'group_id' => $mine, 'meal_type' => 'tushlik', 'served_at' => '12:00', 'records' => [['child_id' => $c, 'ate' => false]]]],
                ['DELETE', "/api/v1/teacher/daily/meals/{$d['meal']->id}"],
                ['PUT',    '/api/v1/teacher/daily/sleep', ['date' => $today, 'group_id' => $g, 'records' => [['child_id' => $c, 'started_at' => '13:00']]]],
                ['PUT',    '/api/v1/teacher/daily/sleep', ['date' => $today, 'group_id' => $mine, 'records' => [['child_id' => $c, 'started_at' => '13:00']]]],
                ['DELETE', "/api/v1/teacher/daily/sleep/{$d['sleep']->id}"],
                ['POST',   '/api/v1/teacher/daily/activities', ['date' => $today, 'group_id' => $g, 'title' => 'Buzish']],
                ['POST',   '/api/v1/teacher/daily/activities', ['date' => $today, 'group_id' => $mine, 'title' => 'Buzish', 'child_ids' => [$c]]],
                ['PUT',    "/api/v1/teacher/daily/activities/{$d['activity']->id}", ['title' => 'Buzildi']],
                ['DELETE', "/api/v1/teacher/daily/activities/{$d['activity']->id}"],
            ];

            foreach ($attempts as $a) {
                [$method, $uri] = $a;
                $res = $this->asTeacher()->json($method, $uri, $a[2] ?? []);
                $this->assertContains($res->status(), [403, 404, 422], "[{$label}] {$method} {$uri} — kutilmagan status {$res->status()}");
                $this->assertStringNotContainsString(self::SECRET, $res->getContent(), "[{$label}] {$method} {$uri} — begona ma'lumot javobda");
            }
        }

        $this->assertSame($before, $this->snapshot(), "Boshqa guruh/bog'cha ma'lumotlari o'zgardi");
        // Rad etilgan urinishlardan keyin o'z guruhida ham ortiqcha yozuv paydo bo'lmagan
        $this->assertSame(0, GroupActivity::where('group_id', $this->myGroup->id)->count());
        $this->assertSame(0, Message::where('group_id', $this->myGroup->id)->count());
    }

    public function test_royxatlar_faqat_biriktirilgan_guruhni_qaytaradi(): void
    {
        $month = now()->format('Y-m');
        foreach (['/api/v1/teacher/dashboard', '/api/v1/teacher/children', '/api/v1/teacher/photos', '/api/v1/teacher/messages',
                  '/api/v1/teacher/daily', "/api/v1/teacher/attendance/monthly?month={$month}"] as $uri) {
            $res = $this->asTeacher()->getJson($uri)->assertOk();
            $this->assertStringNotContainsString(self::SECRET, $res->getContent(), "{$uri} — begona guruh ma'lumoti chiqdi");
        }

        $this->asTeacher()->getJson('/api/v1/teacher/children')
            ->assertJsonCount(1, 'groups')->assertJsonPath('groups.0.id', $this->myGroup->id)
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->myChild->id);

        // O'z guruhi oylik hisobotida begona bola filtri — begona ma'lumot chiqmaydi
        foreach ($this->T as $d) {
            $res = $this->asTeacher()->getJson("/api/v1/teacher/attendance/monthly?month={$month}&group_id={$this->myGroup->id}&child_id={$d['child']->id}");
            $this->assertContains($res->status(), [200, 404, 422]);
            $this->assertStringNotContainsString(self::SECRET, $res->getContent());
        }

        // Rahbar o'z guruhiga yuborgan xabar tarbiyachining xabarlar tarixida ko'rinadi («kelgan» xabarlar)
        $admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $parentUser = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->org->id]);
        $parent = ParentProfile::factory()->create(['organization_id' => $this->org->id, 'user_id' => $parentUser->id]);
        $this->myChild->parentProfiles()->attach($parent->id, ['relation_type' => 'ona', 'is_primary' => true]);
        $this->asTeacher($admin)->postJson('/api/v1/admin/messages', ['group_id' => $this->myGroup->id, 'audience' => 'group', 'body' => 'Ertaga bayram'])->assertCreated();
        $this->asTeacher()->getJson('/api/v1/teacher/messages')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.body', 'Ertaga bayram')->assertJsonPath('data.0.sender', $admin->name);

        // Rahbar sarlavhasi tarbiyachi uchun hech narsani o'zgartirmaydi
        $res = $this->asTeacher()->withHeaders(['X-Impersonated-Org' => (string) $this->T['foreign']['group']->organization_id])
            ->getJson('/api/v1/teacher/children')->assertOk();
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());
    }

    public function test_oz_guruhida_hamkasb_yuklagan_rasmni_ochira_olmaydi_ozinikini_ochiradi(): void
    {
        $theirs = GroupPhoto::create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id, 'path' => 'group-photos/a.png', 'taken_on' => now()->toDateString(), 'uploaded_by' => $this->colleague->id]);
        $mine   = GroupPhoto::create(['organization_id' => $this->org->id, 'group_id' => $this->myGroup->id, 'path' => 'group-photos/b.png', 'taken_on' => now()->toDateString(), 'uploaded_by' => $this->teacher->id]);

        $list = collect($this->asTeacher()->getJson('/api/v1/teacher/photos')->assertOk()->json('data'))->keyBy('id');
        $this->assertFalse($list[$theirs->id]['can_delete']);
        $this->assertTrue($list[$mine->id]['can_delete']);

        $this->asTeacher()->deleteJson("/api/v1/teacher/photos/{$theirs->id}")->assertForbidden();
        $this->assertModelExists($theirs);
        $this->asTeacher()->deleteJson("/api/v1/teacher/photos/{$mine->id}")->assertOk();
    }

    public function test_guruhdan_ajratilgan_yoki_faolsizlantirilgan_tarbiyachi_kira_olmaydi(): void
    {
        // Guruhdan ajratildi — endi bolalar ham, davomat ham ochilmaydi
        $this->profile->groups()->detach($this->myGroup->id);
        $this->asTeacher()->getJson("/api/v1/teacher/children/{$this->myChild->id}")->assertNotFound();
        $this->asTeacher()->putJson('/api/v1/teacher/attendance', ['date' => now()->toDateString(), 'group_id' => $this->myGroup->id,
            'records' => [['child_id' => $this->myChild->id, 'status' => 'absent']]])->assertNotFound();
        $this->asTeacher()->getJson('/api/v1/teacher/dashboard')->assertOk()->assertJsonCount(0, 'groups');

        // Rahbar o'chirgan (soft delete) guruh ham tarbiyachiga ko'rinmaydi
        $extra = Group::factory()->create(['organization_id' => $this->org->id, 'name' => self::SECRET . ' ochirilgan']);
        $this->profile->groups()->attach($extra->id, ['assigned_at' => now()->toDateString()]);
        $this->asTeacher()->getJson('/api/v1/teacher/dashboard')->assertOk()->assertJsonCount(1, 'groups');
        $extra->delete();
        $res = $this->asTeacher()->getJson('/api/v1/teacher/children')->assertOk()->assertJsonCount(0, 'groups');
        $this->assertStringNotContainsString(self::SECRET, $res->getContent());
        $this->asTeacher()->getJson("/api/v1/teacher/daily?group_id={$extra->id}")->assertNotFound();

        // Profil faolsizlantirildi — barcha endpointlar 403
        $this->profile->groups()->attach($this->myGroup->id, ['assigned_at' => now()->toDateString()]);
        $this->profile->update(['is_active' => false]);
        foreach (['/api/v1/teacher/dashboard', '/api/v1/teacher/children', '/api/v1/teacher/photos', '/api/v1/teacher/messages', '/api/v1/teacher/daily'] as $uri) {
            $this->asTeacher()->getJson($uri)->assertForbidden();
        }
    }

    public function test_boshqa_rollar_tarbiyachi_endpointlariga_kira_olmaydi(): void
    {
        $admin  = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $parent = User::factory()->create(['role' => User::ROLE_PARENT, 'organization_id' => $this->org->id]);
        $super  = User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);

        foreach (['/api/v1/teacher/dashboard', '/api/v1/teacher/children', '/api/v1/teacher/photos'] as $uri) {
            $this->asTeacher($admin)->getJson($uri)->assertForbidden();
            $this->asTeacher($super)->getJson($uri)->assertForbidden();
            $this->actingAsParent($parent)->getJson($uri)->assertForbidden();
        }
        // Tarbiyachi rahbar paneliga ham kira olmaydi
        $this->asTeacher()->getJson('/api/v1/admin/children')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/teacher/dashboard')->assertUnauthorized();
    }
}
