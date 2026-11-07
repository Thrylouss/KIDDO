<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Bolaning bir oylik to'lovi qayd etilgani (yozuv bo'lmasa — to'lanmagan). */
class ChildPayment extends Model
{
    protected $fillable = ['organization_id', 'child_id', 'month', 'amount', 'paid_at', 'note', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'month'   => 'date',
            'paid_at' => 'date',
            'amount'  => 'integer',
        ];
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Child::class);
    }
}
