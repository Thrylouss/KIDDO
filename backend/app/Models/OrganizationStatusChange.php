<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Bog'cha faollik holati o'zgarishi (tarix). Faqat qo'shiladi, tahrirlanmaydi. */
class OrganizationStatusChange extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'organization_id',
        'from_status',
        'to_status',
        'reason',
        'suspended_until',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'suspended_until' => 'datetime',
            'created_at'      => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
