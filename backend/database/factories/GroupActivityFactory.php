<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\GroupActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

class GroupActivityFactory extends Factory
{
    protected $model = GroupActivity::class;

    public function definition(): array
    {
        return [
            'group_id'        => Group::factory(),
            'organization_id' => fn (array $attrs) => Group::find($attrs['group_id'])->organization_id,
            'date'            => now()->toDateString(),
            'title'           => 'Rasm chizish',
            'description'     => null,
            'starts_at'       => '10:00',
            'recorded_by'     => null,
        ];
    }
}
