<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    use HasFactory;
    const STATUS_ACTIVE    = 'active';
    const STATUS_TRIAL     = 'trial';
    const STATUS_PAST_DUE  = 'past_due';
    const STATUS_EXPIRED   = 'expired';
    const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'organization_id',
        'plan_id',
        'status',
        'starts_at',
        'ends_at',
        'trial_ends_at',
        'auto_renew',
        'cancelled_at',
        'cancelled_reason',
    ];

    protected function casts(): array
    {
        return [
            'starts_at'    => 'datetime',
            'ends_at'      => 'datetime',
            'trial_ends_at'=> 'datetime',
            'cancelled_at' => 'datetime',
            'auto_renew'   => 'boolean',
        ];
    }

    public function daysRemaining(): int
    {
        $endDate = $this->status === self::STATUS_TRIAL ? $this->trial_ends_at : $this->ends_at;
        if (!$endDate) return 0;
        return max(0, (int) now()->diffInDays($endDate, false));
    }

    public function isExpiringSoon(): bool
    {
        return in_array($this->status, [self::STATUS_ACTIVE, self::STATUS_TRIAL])
            && $this->daysRemaining() <= 14;
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
