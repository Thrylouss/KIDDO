<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name'              => fake()->name(),
            'phone'             => '+998' . fake()->numerify('9#######'),
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => Hash::make('password'),
            'role'              => User::ROLE_PARENT,
            'organization_id'   => null,
            'is_active'         => true,
            'remember_token'    => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->state(['role' => User::ROLE_ADMIN]);
    }

    public function teacher(): static
    {
        return $this->state(['role' => User::ROLE_TEACHER]);
    }

    public function parent(): static
    {
        return $this->state(['role' => User::ROLE_PARENT]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
