<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\ParentProfile;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Bog'cha admini tomonidan tarbiyachi va ota-ona akkauntlarini boshqarish.
 * Profil (teacher_profiles / parent_profiles) va users jadvali birga yangilanadi —
 * ism va telefon ikki joyda bir xil qoladi.
 */
class MemberAccountService
{
    public function update(TeacherProfile|ParentProfile $profile, array $data, User $by, ?string $ip): void
    {
        DB::transaction(function () use ($profile, $data, $by, $ip) {
            $profile->update($data);

            $user = $profile->user;
            $user->update([
                'name'  => "{$profile->first_name} {$profile->last_name}",
                'phone' => $profile->phone ?: null, // telefonsiz (username bilan kiradigan) akkaunt
            ]);

            ActivityLog::record(
                'member.updated',
                "Foydalanuvchi ma'lumotlari yangilandi: {$user->name}",
                $by->id,
                $profile->organization_id,
                ['target_user_id' => $user->id, 'fields' => array_keys($data)],
                $ip
            );
        });
    }

    /** Faolsizlantirishda barcha web va mobil sessiyalar darhol bekor qilinadi. */
    public function setActive(TeacherProfile|ParentProfile $profile, bool $active, User $by, ?string $ip): void
    {
        DB::transaction(function () use ($profile, $active, $by, $ip) {
            $user = $profile->user;
            $user->update(['is_active' => $active]);

            if ($profile instanceof TeacherProfile) {
                $profile->update(['is_active' => $active]);
            }

            if (! $active) {
                $user->tokens()->delete();
            }

            ActivityLog::record(
                $active ? 'member.activated' : 'member.deactivated',
                ($active ? 'Foydalanuvchi faollashtirildi: ' : 'Foydalanuvchi faolsizlantirildi: ') . $user->name,
                $by->id,
                $profile->organization_id,
                ['target_user_id' => $user->id],
                $ip
            );
        });
    }

    /** Yangi parol o'rnatiladi va barcha sessiyalar bekor qilinadi (parol log'ga yozilmaydi). */
    public function resetPassword(TeacherProfile|ParentProfile $profile, string $password, User $by, ?string $ip): void
    {
        DB::transaction(function () use ($profile, $password, $by, $ip) {
            $user = $profile->user;
            $user->update(['password' => Hash::make($password)]);
            $user->tokens()->delete();

            ActivityLog::record(
                'user.password_reset',
                "Foydalanuvchi paroli yangilandi: #{$user->id} {$user->name}",
                $by->id,
                $profile->organization_id,
                ['target_user_id' => $user->id],
                $ip
            );
        });
    }
}
