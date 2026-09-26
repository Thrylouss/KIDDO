<?php

namespace Database\Factories;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'subscription_id' => null,
            'invoice_number'  => 'KIDDO-' . now()->year . '-' . str_pad(fake()->unique()->randomNumber(5), 6, '0', STR_PAD_LEFT),
            'amount'          => fake()->randomElement([299000, 499000, 599000]),
            'currency'        => 'UZS',
            'status'          => 'pending',
            'due_at'          => now()->addDays(7),
            'paid_at'         => null,
            'notes'           => null,
        ];
    }

    public function paid(): static
    {
        return $this->state([
            'status'  => 'paid',
            'paid_at' => now(),
        ]);
    }
}
