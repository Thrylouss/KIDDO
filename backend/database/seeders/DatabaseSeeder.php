<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Super admin for initial setup
        User::firstOrCreate(
            ['email' => 'admin@kiddo.uz'],
            [
                'name'     => 'Super Admin',
                'password' => Hash::make('password'),
                'role'     => User::ROLE_ADMIN,
                'is_active' => true,
            ]
        );
    }
}
