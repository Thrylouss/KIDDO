<?php

namespace App\Services\Kids;

use App\Models\ActivityLog;
use App\Models\EducationalContent;
use App\Models\EducationalContentUsageLog;
use App\Models\Group;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * KIDDO Kids biznes mantiqi. Barcha amallar bitta bog'cha (organization_id) doirasida:
 * guruhlar faqat shu bog'chadan, yosh oralig'i guruh yoshiga mos bo'lishi shart.
 */
class EducationalContentService
{
    public function __construct(private YouTubeMetadataService $meta) {}

    /** @param array<string, mixed> $data validatsiyadan o'tgan maydonlar (youtube_url, title, ..., group_ids) */
    public function create(int $orgId, array $data, User $by, ?string $ip): EducationalContent
    {
        $videoId = $this->videoId($data['youtube_url']);
        $groups  = $this->groupsFor($orgId, $data['group_ids'] ?? [], (int) $data['min_age'], (int) $data['max_age']);
        $meta    = $this->safeMeta($videoId);

        return DB::transaction(function () use ($orgId, $data, $by, $ip, $videoId, $groups, $meta) {
            $content = EducationalContent::create([
                'organization_id'  => $orgId,
                'created_by'       => $by->id,
                'title'            => $data['title'],
                'description'      => $data['description'] ?? null,
                'source_type'      => EducationalContent::SOURCE_YOUTUBE,
                'youtube_video_id' => $videoId,
                'duration_seconds' => $meta['duration_seconds'] ?? null,
                'embeddable'       => $meta['embeddable'] ?? null,
                'language'         => $data['language'],
                'category'         => $data['category'],
                'min_age'          => (int) $data['min_age'],
                'max_age'          => (int) $data['max_age'],
                'status'           => $data['status'] ?? EducationalContent::STATUS_ACTIVE,
            ]);
            $content->groups()->sync($groups->pluck('id'));

            ActivityLog::record('kids_content.created', "KIDDO Kids: kontent qo'shildi — {$content->title}", $by->id, $orgId,
                ['educational_content_id' => $content->id], $ip);

            return $content;
        });
    }

    public function update(EducationalContent $content, array $data, User $by, ?string $ip): EducationalContent
    {
        $min = (int) ($data['min_age'] ?? $content->min_age);
        $max = (int) ($data['max_age'] ?? $content->max_age);
        $this->assertAgeOrder($min, $max);

        $changes = array_intersect_key($data, array_flip(['title', 'description', 'language', 'category', 'min_age', 'max_age', 'status']));
        if (array_key_exists('youtube_url', $data) && $data['youtube_url'] !== null) {
            $videoId = $this->videoId($data['youtube_url']);
            if ($videoId !== $content->youtube_video_id) {
                $meta = $this->safeMeta($videoId);
                $changes += ['youtube_video_id' => $videoId, 'duration_seconds' => $meta['duration_seconds'] ?? null, 'embeddable' => $meta['embeddable'] ?? null];
            }
        }
        $groupIds = array_key_exists('group_ids', $data)
            ? $data['group_ids']
            : $content->groups()->pluck('groups.id')->all();
        $groups = $this->groupsFor($content->organization_id, $groupIds ?? [], $min, $max);

        return DB::transaction(function () use ($content, $changes, $groups, $by, $ip) {
            $content->update($changes);
            $content->groups()->sync($groups->pluck('id'));

            ActivityLog::record('kids_content.updated', "KIDDO Kids: kontent yangilandi — {$content->title}", $by->id, $content->organization_id,
                ['educational_content_id' => $content->id, 'fields' => array_keys($changes)], $ip);

            return $content->fresh();
        });
    }

    public function setStatus(EducationalContent $content, string $status, User $by, ?string $ip): EducationalContent
    {
        $content->update(['status' => $status]);
        ActivityLog::record('kids_content.status', "KIDDO Kids: holat «{$status}» — {$content->title}", $by->id, $content->organization_id,
            ['educational_content_id' => $content->id, 'status' => $status], $ip);

        return $content;
    }

    /** Soft delete: faqat shu yozuv; foydalanish tarixi saqlanadi, boshqa bog'chalarga ta'sir qilmaydi. */
    public function delete(EducationalContent $content, User $by, ?string $ip): void
    {
        DB::transaction(function () use ($content, $by, $ip) {
            $content->delete();
            ActivityLog::record('kids_content.deleted', "KIDDO Kids: kontent o'chirildi — {$content->title}", $by->id, $content->organization_id,
                ['educational_content_id' => $content->id], $ip);
        });
    }

    public function toggleFavorite(EducationalContent $content, User $user, bool $on): bool
    {
        $on ? $content->favoritedBy()->syncWithoutDetaching([$user->id]) : $content->favoritedBy()->detach($user->id);

        return $on;
    }

    public function logUsage(EducationalContent $content, Group $group, User $by, string $usedOn, ?string $note): EducationalContentUsageLog
    {
        return EducationalContentUsageLog::create([
            'organization_id'        => $content->organization_id,
            'educational_content_id' => $content->id,
            'group_id'               => $group->id,
            'user_id'                => $by->id,
            'used_on'                => $usedOn,
            'note'                   => $note !== null && trim($note) !== '' ? trim($note) : null,
        ]);
    }

    /** API javobi: faqat oddiy matnlar va backend qurgan xavfsiz URL'lar (iframe kodi yo'q). */
    public function resource(EducationalContent $c, array $extra = []): array
    {
        return [
            'id'               => $c->id,
            'title'            => $c->title,
            'description'      => $c->description,
            'source_type'      => $c->source_type,
            'youtube_video_id' => $c->youtube_video_id,
            'thumbnail_url'    => $c->thumbnailUrl(),
            'embed_url'        => $c->embedUrl(),
            'watch_url'        => $c->watchUrl(),
            'duration_seconds' => $c->duration_seconds,
            'embeddable'       => $c->embeddable,
            'language'         => $c->language,
            'category'         => $c->category,
            'min_age'          => $c->min_age,
            'max_age'          => $c->max_age,
            'status'           => $c->status,
            'created_at'       => $c->created_at,
            'updated_at'       => $c->updated_at,
        ] + $extra;
    }

    public function videoId(?string $url): string
    {
        $id = YouTubeVideo::parseId($url);
        if ($id === null) {
            throw ValidationException::withMessages(['youtube_url' => "Faqat YouTube video havolasi qabul qilinadi (masalan: https://www.youtube.com/watch?v=… yoki https://youtu.be/…)."]);
        }

        return $id;
    }

    private function safeMeta(string $videoId): array
    {
        try {
            return $this->meta->fetch($videoId);
        } catch (\Throwable) {
            return [];
        }
    }

    private function assertAgeOrder(int $min, int $max): void
    {
        if ($min > $max) {
            throw ValidationException::withMessages(['max_age' => "Maksimal yosh minimal yoshdan kichik bo'lmasligi kerak."]);
        }
    }

    /**
     * Guruhlar shu bog'chaga tegishli va faol bo'lishi, yoshi ma'lum bo'lsa — kontent yoshiga mos kelishi shart.
     *
     * @param  array<int, int|string>  $ids
     * @return Collection<int, Group>
     */
    private function groupsFor(int $orgId, array $ids, int $min, int $max): Collection
    {
        $this->assertAgeOrder($min, $max);
        $ids = collect($ids)->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return collect();
        }

        $groups = Group::forOrganization($orgId)->whereIn('id', $ids)->get();
        if ($groups->count() !== $ids->count()) {
            throw ValidationException::withMessages(['group_ids' => "Guruh topilmadi yoki bu bog'chaga tegishli emas."]);
        }

        $mismatch = $groups->filter(function (Group $g) use ($min, $max) {
            $range = $g->ageRange();
            return $range !== null && ($min > $range[1] || $max < $range[0]);
        });
        if ($mismatch->isNotEmpty()) {
            throw ValidationException::withMessages(['group_ids' => "Kontent yoshi quyidagi guruh(lar) yoshiga mos emas: " . $mismatch->pluck('name')->join(', ') . '.']);
        }

        return $groups;
    }
}
