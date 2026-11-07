<?php

namespace Tests\Feature\Admin;

use App\Models\Child;
use App\Models\Group;
use App\Models\Message;
use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Bog'cha rahbari → o'z bog'chasi guruhlari ota-onalariga xabar; boshqa bog'cha yopiq. */
class AdminMessagesTest extends TestCase
{
    use RefreshDatabase;

    private Organization $org;
    private User $admin;
    private Group $group;
    private Child $child;
    private User $parent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org   = Organization::factory()->create();
        $this->admin = User::factory()->admin()->create(['organization_id' => $this->org->id]);
        $this->group = Group::factory()->create(['organization_id' => $this->org->id]);
        $this->child = Child::factory()->create(['organization_id' => $this->org->id, 'group_id' => $this->group->id]);

        $this->parent = User::factory()->parent()->create(['organization_id' => $this->org->id]);
        $profile      = ParentProfile::factory()->create(['user_id' => $this->parent->id, 'organization_id' => $this->org->id]);
        $profile->children()->attach($this->child->id, ['relation_type' => 'ona']);
    }

    public function test_admin_guruhga_xabar_yuboradi_va_tarixni_koradi(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/admin/messages', ['audience' => 'group', 'group_id' => $this->group->id, 'body' => 'Ertaga bayram tadbiri.'])
            ->assertCreated()
            ->assertJsonPath('data.recipients_count', 1);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/v1/admin/messages')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('groups.0.id', $this->group->id);

        $this->app['auth']->forgetGuards();
        $this->actingAsParent($this->parent)->getJson('/api/v1/parent/messages')->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_boshqa_bogcha_guruhi_va_xabarlari_yopiq(): void
    {
        $other      = Organization::factory()->create();
        $otherGroup = Group::factory()->create(['organization_id' => $other->id]);
        $otherAdmin = User::factory()->admin()->create(['organization_id' => $other->id]);
        Message::create(['organization_id' => $other->id, 'group_id' => $otherGroup->id, 'sender_id' => $otherAdmin->id,
                         'audience' => 'group', 'body' => 'Maxfiy']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/v1/admin/messages', ['audience' => 'group', 'group_id' => $otherGroup->id, 'body' => 'Salom'])
            ->assertNotFound();

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/v1/admin/messages?group_id={$otherGroup->id}")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_tarbiyachi_admin_xabarlariga_kira_olmaydi(): void
    {
        $teacher = User::factory()->teacher()->create(['organization_id' => $this->org->id]);

        $this->actingAs($teacher, 'sanctum')->getJson('/api/v1/admin/messages')->assertForbidden();
        $this->actingAs($teacher, 'sanctum')
            ->postJson('/api/v1/admin/messages', ['audience' => 'group', 'group_id' => $this->group->id, 'body' => 'x'])
            ->assertForbidden();
    }
}
