<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Group extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'organization_id',
        'name',
        'age_category',
        'capacity',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'capacity'  => 'integer',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function children(): HasMany
    {
        return $this->hasMany(Child::class);
    }

    public function teacherProfiles(): BelongsToMany
    {
        return $this->belongsToMany(TeacherProfile::class, 'teacher_group')
                    ->withPivot(['is_primary', 'assigned_at']);
    }

    /**
     * Guruh yosh oralig'i `age_category` matnidan: «3-4 yosh» → [3, 4], «6–7 yosh (tayyorlov)» → [6, 7], «5 yosh» → [5, 5].
     * Aniqlab bo'lmasa — null (yosh bo'yicha avtomatik filtr qo'llanmaydi, faqat biriktirish hisobga olinadi).
     *
     * @return array{0:int,1:int}|null
     */
    public function ageRange(): ?array
    {
        $text = (string) $this->age_category;
        if (preg_match('/(\d{1,2})\s*[-–—]\s*(\d{1,2})/u', $text, $m)) {
            [$a, $b] = [(int) $m[1], (int) $m[2]];
            return $a <= $b ? [$a, $b] : [$b, $a];
        }
        if (preg_match('/(\d{1,2})/', $text, $m)) {
            return [(int) $m[1], (int) $m[1]];
        }

        return null;
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
