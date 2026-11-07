<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Child;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Bola rasmlari yopiq (local) diskda: child-photos/{bog'cha}/{tasodifiy}.{ext}.
 * Ochiq URL yo'q — rasm faqat ruxsat tekshiruvidan o'tgan endpoint orqali uzatiladi.
 * Fayl nomi foydalanuvchidan olinmaydi; kengaytma aniqlangan MIME turidan.
 */
class ChildPhotoService
{
    private const EXT = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function store(Child $child, UploadedFile $file, User $by, ?string $ip = null): void
    {
        $mime = $file->getMimeType();
        $path = "child-photos/{$child->organization_id}/" . Str::uuid() . '.' . self::EXT[$mime];

        Storage::disk('local')->put($path, $file->getContent());

        $old = DB::transaction(function () use ($child, $path, $by, $ip) {
            $old = $child->profile_photo;
            $child->update(['profile_photo' => $path]);
            ActivityLog::record('child.photo_updated', "Bola rasmi yangilandi: #{$child->id}", $by->id, $child->organization_id, ['child_id' => $child->id], $ip);

            return $old;
        });

        $this->deleteFile($old);
    }

    public function delete(Child $child, User $by, ?string $ip = null): bool
    {
        $old = $child->profile_photo;
        if (! $old) {
            return false;
        }

        $child->update(['profile_photo' => null]);
        ActivityLog::record('child.photo_deleted', "Bola rasmi o'chirildi: #{$child->id}", $by->id, $child->organization_id, ['child_id' => $child->id], $ip);
        $this->deleteFile($old);

        return true;
    }

    public function exists(Child $child): bool
    {
        return $this->isStored($child->profile_photo) && Storage::disk('local')->exists($child->profile_photo);
    }

    public function response(Child $child): BinaryFileResponse
    {
        abort_unless($this->exists($child), 404, "Rasm topilmadi.");

        return response()->file(Storage::disk('local')->path($child->profile_photo), [
            'Cache-Control'          => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Rasm versiyasi — URL keshini yangilash uchun (yo'lning o'zini oshkor qilmaydi). */
    public function version(Child $child): ?string
    {
        return $this->isStored($child->profile_photo) ? substr(sha1($child->profile_photo), 0, 10) : null;
    }

    /** Faqat bizning papkadagi yo'llar (tashqi URL yoki boshqa qiymat emas). */
    private function isStored(?string $path): bool
    {
        return is_string($path) && preg_match('#^child-photos/\d+/[0-9a-f-]{36}\.(jpg|png|webp)$#', $path) === 1;
    }

    private function deleteFile(?string $path): void
    {
        if ($this->isStored($path)) {
            Storage::disk('local')->delete($path);
        }
    }
}
