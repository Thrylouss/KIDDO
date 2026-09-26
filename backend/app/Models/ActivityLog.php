<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'organization_id',
        'action',
        'description',
        'meta',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public static function record(
        string $action,
        string $description,
        ?int $userId = null,
        ?int $orgId = null,
        array $meta = [],
        ?string $ip = null
    ): void {
        static::create([
            'action'          => $action,
            'description'     => $description,
            'user_id'         => $userId,
            'organization_id' => $orgId,
            'meta'            => $meta ?: null,
            'ip_address'      => $ip,
        ]);
    }
}
