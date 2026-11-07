<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'organizations';

    // Tashkilot turi — faollik holatidan alohida tushuncha
    public const TYPE_DAVLAT  = 'davlat';
    public const TYPE_XUSUSIY = 'xususiy';
    public const TYPES = [self::TYPE_DAVLAT, self::TYPE_XUSUSIY];

    // Faollik holati (SaaS obuna holati — subscriptions jadvalida, bu yerda emas)
    public const STATUS_ACTIVE    = 'active';
    public const STATUS_INACTIVE  = 'inactive';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_ARCHIVED  = 'archived';
    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_SUSPENDED, self::STATUS_ARCHIVED];

    public const STATUS_LABELS = [
        self::STATUS_ACTIVE    => 'Faol',
        self::STATUS_INACTIVE  => 'Faol emas',
        self::STATUS_SUSPENDED => "Vaqtincha to'xtatilgan",
        self::STATUS_ARCHIVED  => 'Arxivlangan',
    ];

    public const TYPE_LABELS = [
        self::TYPE_DAVLAT  => 'Davlat',
        self::TYPE_XUSUSIY => 'Xususiy',
    ];

    protected $fillable = [
        'name',
        'type',
        'official_code',
        'phone',
        'email',
        'website',
        'region',
        'address',
        'district',
        'number',
        'mfy',
        'street',
        'capacity',
        'director_name',
        'director_phone',
        'director_email',
        'notes',
        'import_source',
        'is_active',
        'is_demo',
        'status',
        'status_reason',
        'suspended_until',
        'status_changed_at',
        'status_changed_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_demo'   => 'boolean',
            'capacity'      => 'integer',
            'import_source' => 'array',
            'suspended_until'   => 'datetime',
            'status_changed_at' => 'datetime',
        ];
    }

    /**
     * is_active (login/API tekshiruvlari: User::canAuthenticate) va status doim mos:
     * is_active = (status === active). Eski kod faqat is_active ni o'zgartirsa — status ham yangilanadi.
     */
    protected static function booted(): void
    {
        static::saving(function (Organization $org) {
            if (! $org->status) {
                $org->status = $org->is_active === false ? self::STATUS_INACTIVE : self::STATUS_ACTIVE;
            }

            if ($org->isDirty('status')) {
                $org->is_active = $org->status === self::STATUS_ACTIVE;
            } elseif ($org->isDirty('is_active')) {
                if ($org->is_active) {
                    $org->status = self::STATUS_ACTIVE;
                } elseif ($org->status === self::STATUS_ACTIVE) {
                    $org->status = self::STATUS_INACTIVE;
                }
            }
        });
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

    public function statusChanges(): HasMany
    {
        return $this->hasMany(OrganizationStatusChange::class)->latest('id');
    }

    public function statusChanger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'status_changed_by');
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

    /** Arxivlanmagan tashkilotlar — standart ro'yxat. */
    public function scopeNotArchived($query)
    {
        return $query->where('status', '!=', self::STATUS_ARCHIVED);
    }

    /**
     * Platforma statistikasida hisobga olinadigan tashkilotlar — barcha sahifalar uchun yagona qoida:
     * haqiqiy (demo emas) va arxivlanmagan (faol + faol emas + vaqtincha to'xtatilgan).
     * Arxivlanganlar umumiy sonlarga (bog'chalar, bolalar, guruhlar, tarbiyachilar, foydalanuvchilar, davomat)
     * kirmaydi va alohida «Arxivlangan» soni bilan ko'rsatiladi.
     */
    public function scopeCounted($query)
    {
        return $query->real()->notArchived();
    }

    /** Haqiqiy tashkilotlar — platforma statistikasi faqat shulardan hisoblanadi. */
    public function scopeReal($query)
    {
        return $query->where('is_demo', false);
    }

    /** Test/demo tashkilotlar (DEV TEST MODE, namoyish). */
    public function scopeDemo($query)
    {
        return $query->where('is_demo', true);
    }
}
