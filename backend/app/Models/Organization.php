<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'organizations';

    protected $fillable = [
        'name',
        'phone',
        'address',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }

    public function children(): HasMany
    {
        return $this->hasMany(Child::class);
    }

    public function parentProfiles(): HasMany
    {
        return $this->hasMany(ParentProfile::class);
    }

    public function teacherProfiles(): HasMany
    {
        return $this->hasMany(TeacherProfile::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    // ── Plan limit enforcement ─────────────────────────────────────

    /**
     * Returns true when the org has an active/trial subscription whose plan
     * caps the given resource and the current count meets or exceeds that cap.
     *
     * Expired, cancelled, or past_due subscriptions are intentionally skipped —
     * billing lapses should not lock out users during the MVP grace period.
     *
     * $limitField must be one of: 'max_children', 'max_teachers', 'max_groups'
     */
    public function hasReachedPlanLimit(string $limitField): bool
    {
        $sub = $this->subscriptions()
            ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIAL])
            ->with('plan')
            ->latest()
            ->first();

        if (! $sub || ! $sub->plan) {
            return false;
        }

        $limit = $sub->plan->$limitField ?? null;
        if ($limit === null) {
            return false;
        }

        $count = match ($limitField) {
            'max_children' => $this->children()->count(),
            'max_teachers' => $this->teacherProfiles()->count(),
            'max_groups'   => $this->groups()->count(),
            default        => 0,
        };

        return $count >= $limit;
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
