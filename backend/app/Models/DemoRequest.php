<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Landing'dan kelgan 14 kunlik bepul DEMO arizasi. */
class DemoRequest extends Model
{
    public const DEMO_DAYS = 14;

    public const STATUS_NEW       = 'new';
    public const STATUS_CONTACTED = 'contacted';
    public const STATUS_PREPARING = 'preparing';
    public const STATUS_ACTIVE    = 'active';
    public const STATUS_REJECTED  = 'rejected';

    public const STATUSES = [self::STATUS_NEW, self::STATUS_CONTACTED, self::STATUS_PREPARING, self::STATUS_ACTIVE, self::STATUS_REJECTED];

    public const STATUS_LABELS = [
        self::STATUS_NEW       => 'Yangi ariza',
        self::STATUS_CONTACTED => "Bog'lanildi",
        self::STATUS_PREPARING => 'Demo tayyorlanmoqda',
        self::STATUS_ACTIVE    => 'Demo faol',
        self::STATUS_REJECTED  => 'Rad etildi',
    ];

    public const TYPES = ['davlat', 'xususiy'];

    public const TELEGRAM_PENDING        = 'pending';
    public const TELEGRAM_SENT           = 'sent';
    public const TELEGRAM_FAILED         = 'failed';
    public const TELEGRAM_NOT_CONFIGURED = 'not_configured';

    protected $fillable = [
        'kindergarten_name', 'kindergarten_type', 'region', 'district', 'address', 'director_name', 'phone',
        'children_count', 'groups_count', 'comment', 'consent_at', 'status', 'internal_note', 'status_changed_at',
        'handled_by', 'organization_id', 'demo_starts_at', 'demo_ends_at', 'telegram_status', 'telegram_attempts',
        'telegram_sent_at', 'telegram_last_attempt_at', 'telegram_error', 'ip_hash',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return [
            'consent_at'               => 'datetime',
            'status_changed_at'        => 'datetime',
            'demo_starts_at'           => 'datetime',
            'demo_ends_at'             => 'datetime',
            'telegram_sent_at'         => 'datetime',
            'telegram_last_attempt_at' => 'datetime',
            'children_count'           => 'integer',
            'groups_count'             => 'integer',
            'telegram_attempts'        => 'integer',
        ];
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
