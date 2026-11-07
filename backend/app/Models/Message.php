<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    const AUDIENCE_CHILD = 'child';
    const AUDIENCE_GROUP = 'group';

    protected $fillable = [
        'organization_id',
        'group_id',
        'child_id',
        'sender_id',
        'audience',
        'subject',
        'body',
    ];

    // ── Relationships ──────────────────────────────────────────────

    public function recipients(): HasMany
    {
        return $this->hasMany(MessageRecipient::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

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
