<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Group;
use App\Models\GroupPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Guruh rasmlari yopiq (local) diskda: group-photos/{bog'cha}/{tasodifiy}.{ext}. Ochiq URL yo'q —
 * fayl faqat ruxsat tekshiruvidan o'tgan endpoint orqali uzatiladi; fayl nomi foydalanuvchidan olinmaydi.
 */
class GroupPhotoService
{
    private const EXT = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function store(Group $group, UploadedFile $file, ?string $caption, string $takenOn, User $by, ?string $ip): GroupPhoto
    {
        $path = "group-photos/{$group->organization_id}/" . Str::uuid() . '.' . self::EXT[$file->getMimeType()];
        Storage::disk('local')->put($path, $file->getContent());

        $photo = GroupPhoto::create([
            'organization_id' => $group->organization_id, 'group_id' => $group->id, 'path' => $path,
            'caption' => $caption, 'taken_on' => $takenOn, 'uploaded_by' => $by->id,
        ]);
        ActivityLog::record('photo.uploaded', "Guruhga rasm yuklandi: {$group->name}", $by->id, $group->organization_id,
            ['group_id' => $group->id, 'photo_id' => $photo->id], $ip);

        return $photo;
    }

    public function delete(GroupPhoto $photo, User $by, ?string $ip): void
    {
        $path = $photo->path;
        $photo->delete();
        ActivityLog::record('photo.deleted', "Guruh rasmi o'chirildi: #{$photo->id}", $by->id, $photo->organization_id,
            ['group_id' => $photo->group_id, 'photo_id' => $photo->id], $ip);
        if ($this->isStored($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    public function response(GroupPhoto $photo): BinaryFileResponse
    {
        abort_unless($this->isStored($photo->path) && Storage::disk('local')->exists($photo->path), 404, "Rasm topilmadi.");

        return response()->file(Storage::disk('local')->path($photo->path), [
            'Cache-Control'          => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** API javobi; `url` — rolga mos fayl endpointi (cookie/Bearer bilan himoyalangan). */
    public function resource(GroupPhoto $photo, string $prefix): array
    {
        return [
            'id'          => $photo->id,
            'group'       => $photo->group ? ['id' => $photo->group->id, 'name' => $photo->group->name] : null,
            'caption'     => $photo->caption,
            'taken_on'    => $photo->taken_on->toDateString(),
            'uploaded_by' => $photo->uploader?->name,
            'created_at'  => $photo->created_at,
            'url'         => url("/api/v1/{$prefix}/photos/{$photo->id}/file"),
        ];
    }

    private function isStored(?string $path): bool
    {
        return is_string($path) && preg_match('#^group-photos/\d+/[0-9a-f-]{36}\.(jpg|png|webp)$#', $path) === 1;
    }
}
