<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Child extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'organization_id',
        'group_id',
        'first_name',
        'last_name',
        'middle_name',
        'birth_date',
        'admitted_at',
        'gender',
        'medical_notes',
        'profile_photo',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            // Sana vaqt zonasiz (Y-m-d) — ISO datetime UTC siljishi bilan bir kun oldingi sanani ko'rsatardi
            'birth_date' => 'date:Y-m-d',
            'admitted_at' => 'date:Y-m-d',
            'is_active'  => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function parentProfiles(): BelongsToMany
    {
        return $this->belongsToMany(ParentProfile::class, 'child_parent')
                    ->withPivot(['relation_type', 'is_primary']);
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

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Ota-onani bolaga bog'laydi yoki bog'lanishni yangilaydi.
     * Bolada faqat bitta asosiy vakil (is_primary) bo'ladi: yangisi belgilansa,
     * qolganlari avtomatik bekor qilinadi. Bola qatori qulflanadi — parallel
     * so'rovlar ikki asosiy vakil yarata olmaydi.
     */
    public function linkParent(ParentProfile $parent, string $relationType, bool $isPrimary): void
    {
        DB::transaction(function () use ($parent, $relationType, $isPrimary) {
            static::whereKey($this->id)->lockForUpdate()->first();

            if ($isPrimary) {
                DB::table('child_parent')
                    ->where('child_id', $this->id)
                    ->where('parent_profile_id', '!=', $parent->id)
                    ->update(['is_primary' => false]);
            }

            $this->parentProfiles()->syncWithoutDetaching([
                $parent->id => ['relation_type' => $relationType, 'is_primary' => $isPrimary],
            ]);
        });
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
