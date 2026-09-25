<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Test uchun admin foydalanuvchi
        User::firstOrCreate(
            ['phone' => '+998901234567'],
            [
                'name'       => 'Admin Foydalanuvchi',
                'email'      => 'admin@kiddo.uz',
                'password'   => Hash::make('password123'),
                'role'       => User::ROLE_ADMIN,
                'is_active'  => true,
            ]
        );

        // Test uchun tarbiyachi
        User::firstOrCreate(
            ['phone' => '+998901234568'],
            [
                'name'       => 'Test Tarbiyachi',
                'email'      => 'teacher@kiddo.uz',
                'password'   => Hash::make('password123'),
                'role'       => User::ROLE_TEACHER,
                'is_active'  => true,
            ]
        );

        // Test uchun ota-ona
        User::firstOrCreate(
            ['phone' => '+998901234569'],
            [
                'name'       => 'Test Ota-ona',
                'email'      => 'parent@kiddo.uz',
                'password'   => Hash::make('password123'),
                'role'       => User::ROLE_PARENT,
                'is_active'  => true,
            ]
        );
    }
}
