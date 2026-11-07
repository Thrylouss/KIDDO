<?php

namespace Tests\Feature\Teacher;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\Group;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Xabarlar: tarbiyachi → bitta bola ota-onalari yoki butun guruh; ota-ona faqat o'ziga kelganini ko'radi.
 */
class MessagesTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $teacher;
    private TeacherProfile $profile;
    private Group $group;
    private Child $ali;
    private Child $vali;
    private User $aliMom;
    private User $valiDad;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org     = Organization::factory()->create();
        $this->teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id, 'name' => 'Dilnoza Karimova']);
        $this->profile = TeacherProfile::factory()->create(['user_id' => $this->teacher->id, 'organization_id' => $this->org->id]);
        $this->group   = Group::factory()->create(['organization_id' => $this->org->id, 'name' => 'Quyosh']);
        $this->profile->groups()->attach($this->group->id, ['assigned_at' => '2026-09-01']);

        $this->ali  = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Ali', 'last_name' => 'Valiyev']);
        $this->vali = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id, 'first_name' => 'Vali', 'last_name' => 'Aliyev']);
        $this->aliMom  = $this->parentOf($this->ali, 'Mohira');
        $this->valiDad = $this->parentOf($this->vali, 'Sardor');
    }

    private function parentOf(Child $child, string $name, bool $active = true): User
    {
        $user    = User::factory()->parent()->create(['organization_id' => $this->org->id, 'is_active' => $active]);
        $profile = ParentProfile::factory()->create(['user_id' => $user->id, 'organization_id' => $this->org->id, 'first_name' => $name]);
        $profile->children()->attach($child->id, ['relation_type' => 'ona']);

        return $user;
    }

    private function send(array $body, ?User $as = null)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAs($as ?? $this->teacher, 'sanctum')->postJson('/api/v1/teacher/messages', $body + ['group_id' => $this->group->id]);
    }

    private function inbox(User $parent)
    {
        $this->app['auth']->forgetGuards();
        return $this->actingAsParent($parent)->getJson('/api/v1/parent/messages');
    }

    public function test_bitta_bola_ota_onalariga(): void
    {
        $this->send(['audience' => 'child', 'child_id' => $this->ali->id, 'subject' => 'Kiyim', 'body' => '  Ertaga zaxira kiyim olib keling.  '])
             ->assertCreated()
             ->assertJsonPath('data.recipients_count', 1)
             ->assertJsonPath('data.read_count', 0)
             ->assertJsonPath('data.body', 'Ertaga zaxira kiyim olib keling.')
             ->assertJsonPath('data.child.first_name', 'Ali')
             ->assertJsonPath('message', 'Xabar yuborildi.');

        $this->inbox($this->aliMom)->assertOk()->assertJsonPath('unread', 1)->assertJsonPath('data.0.subject', 'Kiyim');
        $this->inbox($this->valiDad)->assertOk()->assertJsonPath('data', []);
    }

    public function test_butun_guruh_ota_onalariga_va_holat(): void
    {
        $this->parentOf($this->ali, 'Faol emas', false);
        $res = $this->send(['audience' => 'group', 'body' => 'Juma kuni bayram.'])->assertCreated()
                    ->assertJsonPath('data.recipients_count', 2);   // faol bo'lmagan ota-ona qabul qilmaydi

        $recipientId = $this->inbox($this->aliMom)->json('data.0.id');
        $this->app['auth']->forgetGuards();
        $this->actingAsParent($this->aliMom)->patchJson("/api/v1/parent/messages/{$recipientId}/read")->assertOk();
        $this->inbox($this->aliMom)->assertJsonPath('unread', 0);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->teacher, 'sanctum')->getJson('/api/v1/teacher/messages')->assertOk()
             ->assertJsonPath('data.0.id', $res->json('data.id'))
             ->assertJsonPath('data.0.read_count', 1)
             ->assertJsonPath('data.0.recipients_count', 2);
    }

    public function test_ota_ona_bolmasa_422(): void
    {
        $lonely = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);
        $this->send(['audience' => 'child', 'child_id' => $lonely->id, 'body' => 'Salom'])
             ->assertUnprocessable()->assertJsonValidationErrors('audience');
        $this->assertSame(0, Message::count());
    }

    public function test_validatsiya(): void
    {
        foreach ([
            ['audience' => 'hammaga', 'body' => 'X'],
            ['audience' => 'child', 'body' => 'X'],
            ['audience' => 'group', 'body' => '   '],
            ['audience' => 'group', 'body' => str_repeat('a', 2001)],
            ['audience' => 'group', 'body' => 'X', 'subject' => str_repeat('a', 151)],
        ] as $body) {
            $this->send($body)->assertUnprocessable();
        }
        $this->assertSame(0, Message::count());
    }

    public function test_boshqa_guruh_va_bogcha_bloklanadi(): void
    {
        $otherGroup = Group::factory()->create(['organization_id' => $this->org->id]);
        $otherChild = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $otherGroup->id]);
        $this->parentOf($otherChild, 'Begona');

        $this->send(['audience' => 'group', 'body' => 'X', 'group_id' => $otherGroup->id])->assertNotFound();
        $this->send(['audience' => 'child', 'child_id' => $otherChild->id, 'body' => 'X'])->assertNotFound();
        $this->send(['audience' => 'child', 'child_id' => Child::factory()->create()->id, 'body' => 'X'])->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->teacher, 'sanctum')->getJson("/api/v1/teacher/messages?group_id={$otherGroup->id}")->assertNotFound();
        $this->assertSame(0, Message::count());
    }

    public function test_rollar_va_nofaol_tarbiyachi(): void
    {
        $this->send(['audience' => 'group', 'body' => 'X'], $this->aliMom)->assertForbidden();
        $this->send(['audience' => 'group', 'body' => 'X'], User::factory()->admin()->create(['organization_id' => $this->org->id]))->assertForbidden();

        $this->profile->update(['is_active' => false]);
        $this->send(['audience' => 'group', 'body' => 'X'])->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/teacher/messages', [])->assertUnauthorized();
        $this->getJson('/api/v1/parent/messages')->assertUnauthorized();
    }

    public function test_ota_ona_boshqa_qabul_yozuvini_ozgartira_olmaydi(): void
    {
        $this->send(['audience' => 'group', 'body' => 'X'])->assertCreated();
        $valiRecipient = MessageRecipient::whereHas('parentProfile', fn ($q) => $q->where('user_id', $this->valiDad->id))->sole();

        $this->app['auth']->forgetGuards();
        $this->actingAsParent($this->aliMom)->patchJson("/api/v1/parent/messages/{$valiRecipient->id}/read")->assertNotFound();
        $this->assertNull($valiRecipient->fresh()->read_at);
    }

    public function test_audit_logda_matn_yoq(): void
    {
        $this->send(['audience' => 'group', 'body' => 'Maxfiy matn 123'])->assertCreated();
        $log = ActivityLog::where('action', 'message.sent')->sole();
        $this->assertSame(2, $log->meta['recipients']);
        $this->assertStringNotContainsString('Maxfiy matn', json_encode($log->toArray()));
    }
}
