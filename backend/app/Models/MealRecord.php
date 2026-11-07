<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MealRecord extends Model
{
    use HasFactory, SoftDeletes;

    const TYPE_NONUSHTA     = 'nonushta';
    const TYPE_IKKINCHI_NONUSHTA = 'ikkinchi_nonushta';
    const TYPE_TUSHLIK      = 'tushlik';
    const TYPE_PESHINLIK    = 'peshinlik';
    const TYPE_KECHKI_OVQAT = 'kechki_ovqat';

    // Kun tartibi bo'yicha; peshinlik interfeysda «Ikkinchi tushlik» deb ko'rsatiladi
    const TYPES = [self::TYPE_NONUSHTA, self::TYPE_IKKINCHI_NONUSHTA, self::TYPE_TUSHLIK, self::TYPE_PESHINLIK, self::TYPE_KECHKI_OVQAT];

    protected $fillable = [
        'organization_id',
        'child_id',
        'group_id',
        'date',
        'meal_type',
        'served_at',
        'ate',
        'note',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'ate'  => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function child(): BelongsTo
    {
        return $this->belongsTo(Child::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }
}
