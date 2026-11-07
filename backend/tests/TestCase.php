<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    /**
     * Ota-ona sifatida, haqiqiy web/mobil token kabi 'parent' ability bilan.
     * Oddiy actingAs() token yaratmaydi — 'abilities:parent' middleware uni 401 bilan rad etadi.
     */
    protected function actingAsParent(User $user): static
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, [User::ROLE_PARENT]);

        return $this;
    }
}
