<?php

namespace Database\Factories;

use App\Models\Child;
use App\Models\MealRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

class MealRecordFactory extends Factory
{
    protected $model = MealRecord::class;

    public function definition(): array
    {
        // child_id birinchi — qolgan maydonlar shu boladan olinadi
        return [
            'child_id'        => Child::factory(),
            'organization_id' => fn (array $attrs) => Child::find($attrs['child_id'])->organization_id,
            'group_id'        => fn (array $attrs) => Child::find($attrs['child_id'])->group_id,
            'date'            => now()->toDateString(),
            'meal_type'       => MealRecord::TYPE_TUSHLIK,
            'served_at'       => '12:30',
            'note'            => null,
            'recorded_by'     => null,
        ];
    }
}
