<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'subscription_id' => null,
            'invoice_id'      => null,
            'amount'          => fake()->randomElement([299000, 499000, 599000]),
            'currency'        => 'UZS',
            'status'          => 'paid',
            'payment_method'  => 'manual',
            'transaction_id'  => null,
            'paid_at'         => now(),
            'due_at'          => null,
            'notes'           => null,
            'metadata'        => null,
        ];
    }

    public function pending(): static
    {
        return $this->state([
            'status'  => 'pending',
            'paid_at' => null,
        ]);
    }
}
