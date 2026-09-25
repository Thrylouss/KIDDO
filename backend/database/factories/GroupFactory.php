<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

class GroupFactory extends Factory
{
    protected $model = Group::class;

    public function definition(): array
    {
        $ageCategories = ['2-3 yosh', '3-4 yosh', '4-5 yosh', '5-6 yosh', '6-7 yosh'];

        return [
            'organization_id' => Organization::factory(),
            'name'            => fake()->randomElement(['Nilufar', 'Rayhon', 'Bahor', 'Yulduz', 'Sarvinoz']) . ' guruhi',
            'age_category'    => fake()->randomElement($ageCategories),
            'capacity'        => fake()->numberBetween(15, 30),
            'is_active'       => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
