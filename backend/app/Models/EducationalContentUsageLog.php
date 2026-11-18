<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mashg'ulotda foydalanilgan material qaydi (KIDDO Kids). */
class EducationalContentUsageLog extends Model
{
    protected $fillable = ['organization_id', 'educational_content_id', 'group_id', 'user_id', 'used_on', 'note'];

    protected function casts(): array
    {
        return ['used_on' => 'date'];
    }

    public function content(): BelongsTo
    {
        return $this->belongsTo(EducationalContent::class, 'educational_content_id')->withTrashed();
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
