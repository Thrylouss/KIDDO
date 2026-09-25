<?php

namespace Database\Factories;

use App\Models\Child;
use App\Models\Group;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChildFactory extends Factory
{
    protected $model = Child::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'group_id'        => null,
            'first_name'      => fake()->firstName(),
            'last_name'       => fake()->lastName(),
            'birth_date'      => fake()->dateTimeBetween('-7 years', '-2 years')->format('Y-m-d'),
            'gender'          => fake()->randomElement(['erkak', 'ayol']),
            'profile_photo'   => null,
            'is_active'       => true,
        ];
    }

    public function inGroup(Group $group): static
    {
        return $this->state([
            'organization_id' => $group->organization_id,
            'group_id'        => $group->id,
        ]);
    }
}
