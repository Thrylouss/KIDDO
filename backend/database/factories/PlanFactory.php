<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PlanFactory extends Factory
{
    protected $model = Plan::class;

    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);
        return [
            'name'          => ucfirst($name),
            'slug'          => Str::slug($name) . '-' . fake()->unique()->randomNumber(4),
            'description'   => fake()->sentence(),
            'price_monthly' => fake()->randomElement([299000, 499000, 599000, 999000]),
            'price_yearly'  => null,
            'currency'      => 'UZS',
            'trial_days'    => 7,
            'max_children'  => fake()->randomElement([50, 100, 150, null]),
            'max_teachers'  => fake()->randomElement([10, 20, null]),
            'max_groups'    => fake()->randomElement([5, 10, 15, null]),
            'features'      => null,
            'is_active'     => true,
            'sort_order'    => 0,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
