<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SleepRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'organization_id',
        'child_id',
        'group_id',
        'date',
        'started_at',
        'ended_at',
        'note',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
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

    // ── Helpers ────────────────────────────────────────────────────

    /** Tugash vaqti yo'q — bola hali uxlayapti. */
    public function isSleeping(): bool
    {
        return $this->ended_at === null;
    }
}
