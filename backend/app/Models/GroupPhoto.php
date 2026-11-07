<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Guruh fotogalereyasidagi rasm (fayl yopiq diskda, `path` tashqariga chiqarilmaydi). */
class GroupPhoto extends Model
{
    protected $fillable = ['organization_id', 'group_id', 'path', 'caption', 'taken_on', 'uploaded_by'];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return ['taken_on' => 'date'];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
