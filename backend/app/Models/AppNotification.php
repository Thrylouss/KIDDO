<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppNotification extends Model
{
    protected $table = 'notifications';

    protected $fillable = [
        'recipient_type',
        'recipient_id',
        'organization_id',
        'title',
        'message',
        'type',
        'read_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }
}
