<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\Child;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    public function definition(): array
    {
        // child_id birinchi — qolgan maydonlar shu boladan olinadi
        return [
            'child_id'        => Child::factory(),
            'organization_id' => fn (array $attrs) => Child::find($attrs['child_id'])->organization_id,
            'group_id'        => fn (array $attrs) => Child::find($attrs['child_id'])->group_id,
            'date'            => now()->toDateString(),
            'status'          => Attendance::STATUS_PRESENT,
            'note'            => null,
            'marked_by'       => null,
            'marked_at'       => now(),
        ];
    }
}
