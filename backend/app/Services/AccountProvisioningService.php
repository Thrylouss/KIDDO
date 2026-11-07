<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Boshqa foydalanuvchi uchun akkaunt yaratish va parolni tiklash: tizim individual vaqtinchalik parol yaratadi,
 * u faqat bir marta (shu javobda) qaytariladi, bazada faqat bcrypt hash saqlanadi va
 * foydalanuvchi birinchi kirishda parolni almashtiradi (must_change_password).
 * Parol hech qachon log'ga yozilmaydi.
 */
class AccountProvisioningService
{
    /** Chalkash belgilarsiz (0/O, 1/l/I) — og'zaki yoki qog'ozda uzatish oson. */
    private const UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    private const LOWER  = 'abcdefghijkmnpqrstuvwxyz';
    private const DIGITS = '23456789';

    public static function temporaryPassword(int $length = 12): string
    {
        $all   = self::UPPER . self::LOWER . self::DIGITS;
        $chars = [self::pick(self::UPPER), self::pick(self::LOWER), self::pick(self::DIGITS)];
        while (count($chars) < $length) {
            $chars[] = self::pick($all);
        }
        // Fisher–Yates, kriptografik random
        for ($i = count($chars) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }

        return implode('', $chars);
    }

    private static function pick(string $alphabet): string
    {
        return $alphabet[random_int(0, strlen($alphabet) - 1)];
    }

    /** must_change_password ustuni mavjudmi (migratsiyasi bajarilmagan eski bazalar bilan moslik). */
    public static function supportsPasswordChange(): bool
    {
        static $has = null;

        return $has ??= Schema::hasColumn('users', 'must_change_password');
    }

    public static function supportsUsername(): bool
    {
        static $has = null;

        return $has ??= Schema::hasColumn('users', 'username');
    }

    /**
     * Bog'cha rahbari akkaunti — aynan shu bog'chaga biriktiriladi.
     *
     * @return array{user: User, temporary_password: string}
     */
    public function createOrganizationAdmin(Organization $org, string $username, string $name, User $by, ?string $ip): array
    {
        $password = self::temporaryPassword();

        $user = DB::transaction(function () use ($org, $username, $name, $password, $by, $ip) {
            $user = User::create([
                'name'            => $name,
                'username'        => $username,
                'phone'           => null,
                'password'        => $password,          // 'hashed' cast — bcrypt
                'role'            => User::ROLE_ADMIN,
                'organization_id' => $org->id,
                'is_active'       => true,
            ]);
            $this->requirePasswordChange($user);

            ActivityLog::record('admin.account_created', "Bog'cha rahbari akkaunti yaratildi: {$user->username}",
                $by->id, $org->id, ['target_user_id' => $user->id, 'username' => $user->username], $ip);

            return $user;
        });

        return ['user' => $user, 'temporary_password' => $password];
    }

    /**
     * Yangi vaqtinchalik parol: eski sessiyalar bekor qilinadi, birinchi kirishda almashtirish talab qilinadi.
     * $password berilsa — o'sha (masalan, eski klientlar), aks holda tizim yaratadi.
     *
     * @return string|null tizim yaratgan vaqtinchalik parol (faqat bir marta ko'rsatish uchun)
     */
    public function resetPassword(User $user, ?string $password, User $by, ?string $ip): ?string
    {
        $generated = $password === null ? self::temporaryPassword() : null;

        DB::transaction(function () use ($user, $password, $generated, $by, $ip) {
            $user->password = $password ?? $generated;
            $user->save();
            $this->requirePasswordChange($user);
            $user->tokens()->delete();

            ActivityLog::record('user.password_reset', "Foydalanuvchi paroli yangilandi: #{$user->id} {$user->name}",
                $by->id, $user->organization_id, ['target_user_id' => $user->id, 'temporary' => true], $ip);
        });

        return $generated;
    }

    public function requirePasswordChange(User $user): void
    {
        if (self::supportsPasswordChange()) {
            $user->forceFill(['must_change_password' => true])->save();
        }
    }
}
