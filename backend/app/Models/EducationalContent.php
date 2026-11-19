<?php

namespace App\Models;

use App\Services\Kids\YouTubeVideo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** KIDDO Kids: bog'cha kutubxonasidagi ta'limiy video (YouTube embed). */
class EducationalContent extends Model
{
    use SoftDeletes;

    public const SOURCE_YOUTUBE = 'youtube';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_HIDDEN = 'hidden';
    public const STATUSES      = [self::STATUS_ACTIVE, self::STATUS_HIDDEN];

    public const LANGUAGES = ['uz', 'ru', 'en'];

    public const CATEGORIES = ['lessons', 'cartoons', 'languages', 'music', 'activities'];

    /** Maktabgacha yosh chegaralari (yil). */
    public const MIN_AGE = 1;
    public const MAX_AGE = 7;

    protected $fillable = [
        'organization_id', 'created_by', 'title', 'description', 'source_type', 'youtube_video_id',
        'duration_seconds', 'embeddable', 'language', 'category', 'min_age', 'max_age', 'status',
    ];

    protected function casts(): array
    {
        return [
            'min_age'          => 'integer',
            'max_age'          => 'integer',
            'duration_seconds' => 'integer',
            'embeddable'       => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'educational_content_groups')->withTimestamps();
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'educational_content_favorites')->withTimestamps();
    }

    public function usageLogs(): HasMany
    {
        return $this->hasMany(EducationalContentUsageLog::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeForOrganization(Builder $query, int $organizationId): Builder
    {
        return $query->where('educational_contents.organization_id', $organizationId);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('educational_contents.status', self::STATUS_ACTIVE);
    }

    /** Yosh oralig'i [min, max] bilan kesishadigan kontent (backend'dagi yosh tekshiruvi). */
    public function scopeOverlappingAge(Builder $query, int $min, int $max): Builder
    {
        return $query->where('educational_contents.min_age', '<=', $max)->where('educational_contents.max_age', '>=', $min);
    }

    /** Guruhga biriktirilgan va (yoshi ma'lum bo'lsa) guruh yoshiga mos kontent. */
    public function scopeVisibleForGroup(Builder $query, Group $group): Builder
    {
        $query->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id));
        if ($range = $group->ageRange()) {
            $query->overlappingAge($range[0], $range[1]);
        }

        return $query;
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function overlapsAge(?array $range): bool
    {
        return $range === null || ($this->min_age <= $range[1] && $this->max_age >= $range[0]);
    }

    public function thumbnailUrl(): string
    {
        return YouTubeVideo::thumbnailUrl($this->youtube_video_id);
    }

    public function embedUrl(): string
    {
        return YouTubeVideo::embedUrl($this->youtube_video_id);
    }

    public function watchUrl(): string
    {
        return YouTubeVideo::watchUrl($this->youtube_video_id);
    }
}
