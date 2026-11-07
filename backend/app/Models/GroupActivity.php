<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class GroupActivity extends Model
{
    use HasFactory, SoftDeletes;

    /** Mashg'ulot yo'nalishlari (interfeysda o'zbekcha nomlar). */
    const DIRECTIONS = ['jismoniy', 'nutq', 'matematika', 'tasviriy', 'musiqa', 'atrof_olam', 'ijtimoiy', 'boshqa'];

    protected $fillable = [
        'organization_id',
        'group_id',
        'date',
        'title',
        'direction',
        'description',
        'result',
        'starts_at',
        'ends_at',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /** Mashg'ulotda ishtirok etgan bolalar. */
    public function children(): BelongsToMany
    {
        return $this->belongsToMany(Child::class, 'group_activity_child');
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }
}
