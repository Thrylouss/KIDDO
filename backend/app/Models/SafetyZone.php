<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Geofence zonasi: bog'cha rejasi koordinatalarida ko'pburchak. */
class SafetyZone extends Model
{
    public const KINDS = ['safe', 'restricted', 'exit', 'entrance'];

    protected $fillable = ['organization_id', 'name', 'kind', 'polygon', 'is_active'];

    protected function casts(): array
    {
        return ['polygon' => 'array', 'is_active' => 'boolean'];
    }

    public function scopeForOrganization($query, int $orgId)
    {
        return $query->where('safety_zones.organization_id', $orgId);
    }
}
