<?php

namespace Tests\Feature\SuperAdmin;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubscriptionExpiryCommandTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrg(): Organization
    {
        return Organization::create([
            'name'      => 'Test Bog\'cha',
            'is_active' => true,
        ]);
    }

    private function makePlan(): Plan
    {
        return Plan::create([
            'name'           => 'Test Plan',
            'price_monthly'  => 100000,
            'max_children'   => 50,
            'max_teachers'   => 10,
            'is_active'      => true,
        ]);
    }

    public function test_command_expires_active_subscriptions_past_end_date(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        Subscription::create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_ACTIVE,
            'starts_at'       => now()->subDays(30),
            'ends_at'         => now()->subDay(), // expired yesterday
        ]);

        $this->artisan('subscriptions:check-expiry')
             ->assertExitCode(0)
             ->expectsOutputToContain('Affected: 1');

        $this->assertDatabaseHas('subscriptions', [
            'organization_id' => $org->id,
            'status'          => Subscription::STATUS_EXPIRED,
        ]);
    }

    public function test_command_expires_trial_subscriptions_past_trial_end_date(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        Subscription::create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_TRIAL,
            'starts_at'       => now()->subDays(14),
            'trial_ends_at'   => now()->subDay(), // trial expired yesterday
        ]);

        $this->artisan('subscriptions:check-expiry')
             ->assertExitCode(0)
             ->expectsOutputToContain('Affected: 1');

        $this->assertDatabaseHas('subscriptions', [
            'organization_id' => $org->id,
            'status'          => Subscription::STATUS_EXPIRED,
        ]);
    }

    public function test_command_does_not_expire_active_subscriptions_with_future_end_date(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        Subscription::create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_ACTIVE,
            'starts_at'       => now()->subDays(5),
            'ends_at'         => now()->addDays(25), // still valid
        ]);

        $this->artisan('subscriptions:check-expiry')
             ->assertExitCode(0)
             ->expectsOutputToContain('Affected: 0');

        $this->assertDatabaseHas('subscriptions', [
            'organization_id' => $org->id,
            'status'          => Subscription::STATUS_ACTIVE,
        ]);
    }

    public function test_command_does_not_change_already_expired_subscriptions(): void
    {
        $org  = $this->makeOrg();
        $plan = $this->makePlan();

        $sub = Subscription::create([
            'organization_id' => $org->id,
            'plan_id'         => $plan->id,
            'status'          => Subscription::STATUS_EXPIRED,
            'starts_at'       => now()->subDays(60),
            'ends_at'         => now()->subDays(30),
        ]);

        $this->artisan('subscriptions:check-expiry')
             ->assertExitCode(0)
             ->expectsOutputToContain('Affected: 0');
    }

    public function test_command_is_registered_in_scheduler(): void
    {
        $this->artisan('schedule:list')
             ->expectsOutputToContain('subscriptions:check-expiry')
             ->assertExitCode(0);
    }
}
