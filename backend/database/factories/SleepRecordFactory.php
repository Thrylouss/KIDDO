<?php

namespace Database\Factories;

use App\Models\Child;
use App\Models\SleepRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

class SleepRecordFactory extends Factory
{
    protected $model = SleepRecord::class;

    public function definition(): array
    {
        return [
            'child_id'        => Child::factory(),
            'organization_id' => fn (array $attrs) => Child::find($attrs['child_id'])->organization_id,
            'group_id'        => fn (array $attrs) => Child::find($attrs['child_id'])->group_id,
            'date'            => now()->toDateString(),
            'started_at'      => '13:00',
            'ended_at'        => '15:00',
            'note'            => null,
            'recorded_by'     => null,
        ];
    }
}
