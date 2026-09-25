<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TeacherProfileFactory extends Factory
{
    protected $model = TeacherProfile::class;

    public function definition(): array
    {
        return [
            'user_id'         => User::factory()->state(['role' => 'teacher']),
            'organization_id' => Organization::factory(),
            'first_name'      => fake()->firstName(),
            'last_name'       => fake()->lastName(),
            'phone'           => '+998' . fake()->numerify('9#######'),
            'position'        => 'Tarbiyachi',
            'is_active'       => true,
        ];
    }
}
