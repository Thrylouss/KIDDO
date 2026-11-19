<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Xavfsizlik insidenti: open → acknowledged → resolved (qabul qilish insidentni yopmaydi). */
class SafetyIncident extends Model
{
    public const TYPES      = ['restricted_zone', 'sos', 'battery_low', 'device_removed', 'device_offline', 'missing'];
    public const SEVERITIES = ['critical', 'high', 'warning'];

    public const STATUS_OPEN         = 'open';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_RESOLVED     = 'resolved';

    protected $fillable = [
        'organization_id', 'child_id', 'iot_device_id', 'safety_zone_id', 'iot_event_id', 'type', 'severity', 'status',
        'opened_at', 'escalated_at', 'acknowledged_at', 'acknowledged_by', 'resolved_at', 'resolved_by', 'resolution_note',
    ];

    protected function casts(): array
    {
        return ['opened_at' => 'datetime', 'escalated_at' => 'datetime', 'acknowledged_at' => 'datetime', 'resolved_at' => 'datetime'];
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Child::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(IotDevice::class, 'iot_device_id')->withTrashed();
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(SafetyZone::class, 'safety_zone_id');
    }

    public function scopeForOrganization($query, int $orgId)
    {
        return $query->where('safety_incidents.organization_id', $orgId);
    }

    public function scopeUnresolved($query)
    {
        return $query->where('safety_incidents.status', '!=', self::STATUS_RESOLVED);
    }
}
