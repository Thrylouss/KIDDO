<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Running the seeder in production must never leave accounts with
 * credentials that are published in this repository.
 *
 * The seeder is invoked directly rather than via `db:seed`, because the
 * command asks for confirmation in production and would silently skip.
 */
class ProductionSeedingSecurityTest extends TestCase
{
    use RefreshDatabase;

    /** Passwords hard-coded in DatabaseSeeder. */
    private const KNOWN_PASSWORDS = ['superadmin123', 'password123', 'kiddo123'];

    private function seedAsProduction(): void
    {
        $this->app['env'] = 'production';

        $this->app->make(DatabaseSeeder::class)->run();
    }

    public function test_production_seed_does_not_create_default_super_admin(): void
    {
        $this->seedAsProduction();

        $this->assertDatabaseMissing('users', ['phone' => '+998901234567']);
        $this->assertSame(0, User::where('role', User::ROLE_SUPER_ADMIN)->count());
    }

    public function test_production_seed_does_not_create_test_accounts(): void
    {
        $this->seedAsProduction();

        foreach (['+998901234500', '+998901234568', '+998901234569'] as $phone) {
            $this->assertDatabaseMissing('users', ['phone' => $phone]);
        }
    }

    public function test_production_seed_leaves_no_user_with_a_known_password(): void
    {
        $this->seedAsProduction();

        $exposed = User::all()->filter(function (User $user) {
            foreach (self::KNOWN_PASSWORDS as $password) {
                if (Hash::check($password, $user->password)) {
                    return true;
                }
            }
            return false;
        })->pluck('phone')->all();

        $this->assertSame([], $exposed, 'Users seeded with repository passwords: ' . implode(', ', $exposed));
    }

    public function test_production_seed_does_not_create_demo_organizations(): void
    {
        $this->seedAsProduction();

        $this->assertSame(0, Organization::count());
    }
}
