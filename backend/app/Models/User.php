<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    const ROLE_SUPER_ADMIN = 'super_admin';
    const ROLE_ADMIN       = 'admin';
    const ROLE_TEACHER     = 'teacher';
    const ROLE_PARENT      = 'parent';

    /** Username: lotin harfi bilan boshlanadi — telefon raqami bilan hech qachon chalkashmaydi. */
    public const USERNAME_PATTERN = '/^[a-z][a-z0-9._-]{1,31}$/';

    protected $fillable = [
        'name',
        'username',
        'phone',
        'email',
        'password',
        'must_change_password',
        'role',
        'organization_id',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password'          => 'hashed',
            'must_change_password' => 'boolean',
            'is_active'         => 'boolean',
        ];
    }

    /** Username kichik harflarda saqlanadi (kirishda katta-kichik harf farqi yo'q). */
    protected function username(): Attribute
    {
        return Attribute::make(set: fn (?string $v) => $v === null ? null : mb_strtolower(trim($v)));
    }

    // ── Relationships ──────────────────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function parentProfile(): HasOne
    {
        return $this->hasOne(ParentProfile::class);
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isTeacher(): bool
    {
        return $this->role === self::ROLE_TEACHER;
    }

    public function isParent(): bool
    {
        return $this->role === self::ROLE_PARENT;
    }

    /** Foydalanuvchi va (bo'lsa) uning bog'chasi faol — login va har bir token so'rovida tekshiriladi. */
    public function canAuthenticate(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        return $this->organization_id === null
            || Organization::whereKey($this->organization_id)->where('is_active', true)->exists();
    }
}
