<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * Web va mobil login uchun umumiy hisob ma'lumotlari tekshiruvi.
 */
class AuthService
{
    /**
     * Login (telefon yoki username) va parol to'g'ri, foydalanuvchi va uning bog'chasi faol bo'lsa — foydalanuvchi.
     * Aks holda null; chaqiruvchi har doim bir xil umumiy xato qaytaradi.
     *
     * Identifikator turi aniq ajratiladi: lotin harfi bilan boshlansa — username, aks holda — telefon.
     * Telefon raqamlari «+» yoki raqam bilan boshlanadi, shuning uchun ikkalasi hech qachon chalkashmaydi.
     */
    public function attempt(string $login, string $password): ?User
    {
        $user = $this->findByLogin(trim($login));

        // Foydalanuvchi topilmasa ham hash tekshiruvi bajariladi — javob vaqti
        // orqali login mavjudligi oshkor bo'lmasin.
        $passwordOk = Hash::check($password, $user?->password ?? self::dummyHash());

        if (! $user || ! $passwordOk || ! $user->canAuthenticate()) {
            return null;
        }

        return $user;
    }

    public static function isUsername(string $login): bool
    {
        return preg_match(User::USERNAME_PATTERN, mb_strtolower($login)) === 1;
    }

    private function findByLogin(string $login): ?User
    {
        if (! self::isUsername($login)) {
            return User::where('phone', $login)->first();
        }

        // username ustuni migratsiyasi bajarilmagan bazada (masalan, eski QA bazasi) — faqat telefon orqali kirish
        static $hasUsername = null;
        $hasUsername ??= Schema::hasColumn('users', 'username');

        return $hasUsername ? User::where('username', mb_strtolower($login))->first() : null;
    }

    /**
     * Yangi parol; must_change_password o'chiriladi, joriy sessiyadan boshqa barcha sessiyalar bekor qilinadi.
     * Mobil ilovadan chaqirilsa — shu qurilmaning access va refresh tokenlari saqlanadi (ilova chiqib ketmaydi).
     */
    public function changePassword(User $user, string $password, ?string $ip): void
    {
        $current = $user->currentAccessToken();
        $keep    = $current instanceof \Laravel\Sanctum\PersonalAccessToken
            ? (MobileSessionService::isAccessToken($current)
                ? app(MobileSessionService::class)->sessionTokenIds($user, MobileSessionService::sessionId($current))
                : [$current->id])
            : [];

        $user->password = $password;
        if (AccountProvisioningService::supportsPasswordChange()) {
            $user->must_change_password = false;
        }
        $user->save();

        $user->tokens()->when($keep, fn ($q) => $q->whereKeyNot($keep))->delete();

        \App\Models\ActivityLog::record('user.password_changed', "Foydalanuvchi parolini almashtirdi: {$user->name}",
            $user->id, $user->organization_id, [], $ip);
    }

    public function userResource(User $user): array
    {
        return [
            'id'              => $user->id,
            'name'            => $user->name,
            'username'        => $user->username,
            'phone'           => $user->phone,
            'email'           => $user->email,
            'role'            => $user->role,
            'organization_id' => $user->organization_id,
            'is_active'       => $user->is_active,
            // true — vaqtinchalik parol: avval parolni almashtirish kerak (boshqa API'lar 403 qaytaradi)
            'must_change_password' => (bool) $user->must_change_password,
        ];
    }

    /**
     * Noma'lum tasodifiy qiymatning bcrypt hash'i (cost 12, production standarti).
     * Hech qanday parolga mos kelmaydi; faqat vaqtni tenglashtirish uchun.
     */
    private static function dummyHash(): string
    {
        return '$2y$12$IVhy9TCp5GAUPpIiyCbpfebeWrh7i8AFIwbmAJhH5ExDO8dBzNj3.';
    }
}
