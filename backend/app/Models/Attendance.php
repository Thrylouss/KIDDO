<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    const STATUS_PRESENT = 'present';
    const STATUS_ABSENT  = 'absent';
    const STATUS_EXCUSED = 'excused';

    const STATUSES = [self::STATUS_PRESENT, self::STATUS_ABSENT, self::STATUS_EXCUSED];

    /** «Sababli» uchun sabab kategoriyasi; izoh `note` da (sababli uchun majburiy). */
    const EXCUSE_REASONS = ['kasallik', 'oilaviy', 'boshqa'];

    protected $fillable = [
        'organization_id',
        'child_id',
        'group_id',
        'date',
        'status',
        'excuse_reason',
        'note',
        'marked_by',
        'marked_at',
    ];

    protected function casts(): array
    {
        return [
            'date'      => 'date',
            'marked_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Child::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }
}
