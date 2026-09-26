<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'plan_id'         => Plan::factory(),
            'status'          => Subscription::STATUS_ACTIVE,
            'starts_at'       => now(),
            'ends_at'         => now()->addDays(30),
            'trial_ends_at'   => null,
            'auto_renew'      => false,
            'cancelled_at'    => null,
            'cancelled_reason'=> null,
        ];
    }

    public function trial(): static
    {
        return $this->state([
            'status'       => Subscription::STATUS_TRIAL,
            'ends_at'      => null,
            'trial_ends_at'=> now()->addDays(7),
        ]);
    }

    public function expired(): static
    {
        return $this->state([
            'status'  => Subscription::STATUS_EXPIRED,
            'ends_at' => now()->subDays(5),
        ]);
    }
}
