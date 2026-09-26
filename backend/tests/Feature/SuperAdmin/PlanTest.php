<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPER_ADMIN, 'organization_id' => null]);
    }

    // List plans
    public function test_can_list_all_plans(): void
    {
        Plan::factory()->count(5)->create();

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson('/api/v1/super-admin/plans');

        $res->assertOk()
            ->assertJsonCount(5, 'data');
    }

    // Create plan
    public function test_can_create_plan_with_auto_slug(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/plans', [
                'name'          => 'Premium Plus',
                'price_monthly' => 999000,
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.slug', 'premium-plus');
    }

    public function test_can_create_plan_with_custom_slug(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/plans', [
                'name'          => 'Test Plan',
                'slug'          => 'my-custom-slug',
                'price_monthly' => 199000,
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.slug', 'my-custom-slug');
    }

    public function test_create_plan_requires_name_and_price(): void
    {
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/plans', []);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'price_monthly']);
    }

    public function test_slug_must_be_unique(): void
    {
        Plan::factory()->create(['slug' => 'existing-slug']);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->postJson('/api/v1/super-admin/plans', [
                'name'          => 'Another Plan',
                'slug'          => 'existing-slug',
                'price_monthly' => 299000,
            ]);

        $res->assertStatus(422)->assertJsonValidationErrors(['slug']);
    }

    // Show plan
    public function test_can_show_plan_detail(): void
    {
        $plan = Plan::factory()->create();

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson("/api/v1/super-admin/plans/{$plan->id}");

        $res->assertOk()
            ->assertJsonPath('data.id', $plan->id)
            ->assertJsonPath('data.subscriptions_count', 0);
    }

    // Update plan
    public function test_can_update_plan(): void
    {
        $plan = Plan::factory()->create(['price_monthly' => 299000]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->putJson("/api/v1/super-admin/plans/{$plan->id}", [
                'price_monthly' => 399000,
                'trial_days'    => 14,
            ]);

        $res->assertOk();
        $this->assertDatabaseHas('plans', ['id' => $plan->id, 'trial_days' => 14]);
    }

    public function test_can_update_plan_slug_while_keeping_own_slug(): void
    {
        $plan = Plan::factory()->create(['slug' => 'my-plan']);

        // Updating with same slug should be fine
        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->putJson("/api/v1/super-admin/plans/{$plan->id}", [
                'slug'          => 'my-plan',
                'price_monthly' => 399000,
            ]);

        $res->assertOk();
    }

    // Deactivate
    public function test_can_deactivate_plan_without_active_subscriptions(): void
    {
        $plan = Plan::factory()->create(['is_active' => true]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/plans/{$plan->id}/deactivate");

        $res->assertOk();
        $this->assertDatabaseHas('plans', ['id' => $plan->id, 'is_active' => false]);
    }

    public function test_cannot_deactivate_plan_with_active_subscriptions(): void
    {
        $plan = Plan::factory()->create(['is_active' => true]);
        $org  = Organization::factory()->create();
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_ACTIVE,
        ]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->patchJson("/api/v1/super-admin/plans/{$plan->id}/deactivate");

        $res->assertStatus(422);
        $this->assertDatabaseHas('plans', ['id' => $plan->id, 'is_active' => true]);
    }

    // Response structure
    public function test_plan_response_includes_all_fields(): void
    {
        $plan = Plan::factory()->create([
            'features'   => ['feature1', 'feature2'],
            'sort_order' => 5,
        ]);

        $res = $this->actingAs($this->superAdmin(), 'sanctum')
            ->getJson("/api/v1/super-admin/plans/{$plan->id}");

        $res->assertOk()
            ->assertJsonStructure(['data' => [
                'id', 'name', 'slug', 'description',
                'price_monthly', 'price_yearly', 'currency', 'trial_days',
                'max_children', 'max_teachers', 'max_groups',
                'features', 'is_active', 'sort_order', 'subscriptions_count',
            ]]);
    }

    // Access control
    public function test_non_super_admin_cannot_manage_plans(): void
    {
        $org   = Organization::factory()->create();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'organization_id' => $org->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/super-admin/plans', ['name' => 'Test', 'price_monthly' => 100])
            ->assertForbidden();
    }
}
