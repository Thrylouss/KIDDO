<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IotDeviceAssignment extends Model
{
    protected $fillable = ['organization_id', 'iot_device_id', 'child_id', 'user_id', 'assigned_by', 'assigned_at', 'unassigned_at'];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime', 'unassigned_at' => 'datetime'];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(IotDevice::class, 'iot_device_id');
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Child::class);
    }
}
