<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Normalizatsiyalangan qurilma hodisasi (IoT audit jurnali). */
class IotEvent extends Model
{
    protected $fillable = [
        'organization_id', 'iot_device_id', 'child_id', 'safety_zone_id', 'type', 'x', 'y', 'payload',
        'dedup_key', 'occurred_at', 'received_at',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array', 'occurred_at' => 'datetime', 'received_at' => 'datetime', 'x' => 'float', 'y' => 'float'];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(IotDevice::class, 'iot_device_id')->withTrashed();
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(SafetyZone::class, 'safety_zone_id');
    }
}
