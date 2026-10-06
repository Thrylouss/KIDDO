<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Invoice extends Model
{
    use HasFactory;
    protected $fillable = [
        'organization_id',
        'subscription_id',
        'invoice_number',
        'amount',
        'currency',
        'status',
        'due_at',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'due_at'  => 'datetime',
            'paid_at' => 'datetime',
            'amount'  => 'decimal:2',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function ($invoice) {
            if (empty($invoice->invoice_number)) {
                $year   = now()->year;
                $result = DB::select(
                    'INSERT INTO invoice_counters (year, last_number) VALUES (?, 1)
                     ON CONFLICT (year) DO UPDATE
                     SET last_number = invoice_counters.last_number + 1
                     RETURNING last_number',
                    [$year]
                );
                $seq = $result[0]->last_number;
                $invoice->invoice_number = sprintf('KIDDO-%d-%06d', $year, $seq);
            }
        });
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
