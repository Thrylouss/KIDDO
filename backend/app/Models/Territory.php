<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Hududiy ma'lumotnoma yozuvi (viloyat / tuman / MFY). Faqat tasdiqlangan manbadan yuklanadi. */
class Territory extends Model
{
    public const KIND_REGION   = 'region';
    public const KIND_DISTRICT = 'district';
    public const KIND_MFY      = 'mfy';

    protected $fillable = ['kind', 'name', 'parent_id', 'code', 'source', 'source_ref', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
