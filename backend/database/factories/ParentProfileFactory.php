<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\ParentProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ParentProfileFactory extends Factory
{
    protected $model = ParentProfile::class;

    public function definition(): array
    {
        return [
            'user_id'         => User::factory()->state(['role' => 'parent']),
            'organization_id' => Organization::factory(),
            'first_name'      => fake()->firstName(),
            'last_name'       => fake()->lastName(),
            'phone'           => '+998' . fake()->numerify('9#######'),
            'relation_type'   => fake()->randomElement(['ona', 'ota', 'vasiy']),
        ];
    }
}
