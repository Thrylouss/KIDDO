<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Smart Safety qurilmasi. Gateway tokeni faqat sha256 xeshi ko'rinishida saqlanadi va hech qachon qaytarilmaydi. */
class IotDevice extends Model
{
    use SoftDeletes;

    public const TYPES     = ['wristband', 'gateway', 'anchor', 'camera', 'bus_tracker', 'staff_badge'];
    public const PROVIDERS = ['demo', 'blueiot', 'mokosmart', 'minew'];
    public const STATUSES  = ['online', 'offline', 'removed'];

    protected $fillable = [
        'organization_id', 'type', 'provider', 'external_id', 'label', 'battery_level', 'status',
        'firmware_version', 'meta', 'token_hash', 'last_seen_at',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'battery_level' => 'integer', 'last_seen_at' => 'datetime'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(IotDeviceAssignment::class);
    }

    public function activeAssignment(): HasOne
    {
        return $this->hasOne(IotDeviceAssignment::class)->whereNull('unassigned_at')->latestOfMany('assigned_at');
    }

    public function scopeForOrganization($query, int $orgId)
    {
        return $query->where('iot_devices.organization_id', $orgId);
    }
}
