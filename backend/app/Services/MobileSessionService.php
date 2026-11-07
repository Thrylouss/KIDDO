<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Ota-ona mobil ilovasi qurilma sessiyalari — Sanctum personal_access_tokens ustida, migratsiyasiz.
 *
 * Har bir qurilma sessiyasi (sid) ikki tokendan iborat:
 *   - access token:  nomi "mobile-access|<sid>",           abilities [parent, mobile], 15 daqiqa;
 *   - refresh token: nomi "mobile-refresh|<sid>|<qurilma>", abilities [mobile-refresh],
 *                    expires_at = sessiya boshlanganidan 30 kun (rotatsiyada uzaytirilmaydi).
 *
 * Refresh token API so'rovlarini autentifikatsiya qila olmaydi (AppServiceProvider), faqat
 * /v1/mobile/token/refresh orqali bir marta ishlatiladi va yangi juftlikka almashtiriladi.
 */
class MobileSessionService
{
    public const ACCESS_PREFIX      = 'mobile-access|';
    public const REFRESH_PREFIX     = 'mobile-refresh|';
    public const ACCESS_ABILITIES   = [User::ROLE_PARENT, 'mobile'];
    public const REFRESH_ABILITY    = 'mobile-refresh';
    public const ACCESS_TTL_MINUTES = 15;
    public const SESSION_TTL_DAYS   = 30;
    public const MAX_SESSIONS       = 5;

    /** Yangi qurilma sessiyasi. Limitdan oshsa eng eski (birinchi boshlangan) sessiya bekor qilinadi. */
    public function start(User $user, ?string $deviceName): array
    {
        return DB::transaction(function () use ($user, $deviceName) {
            // Foydalanuvchi qatori qulflanadi — parallel loginlar limitni oshira olmaydi
            User::whereKey($user->id)->lockForUpdate()->first();

            $this->mobileTokens($user)->where('expires_at', '<=', now())->delete();

            $active = $this->refreshTokens($user)->orderBy('expires_at')->orderBy('id')->get();
            foreach ($active->take(max(0, $active->count() - self::MAX_SESSIONS + 1)) as $oldest) {
                $this->revoke($user, self::sessionId($oldest));
            }

            return $this->issue(
                $user,
                bin2hex(random_bytes(16)),
                self::cleanDeviceName($deviceName),
                now()->addDays(self::SESSION_TTL_DAYS)
            );
        });
    }

    /**
     * Refresh tokenni yangi access+refresh juftligiga almashtiradi; eski refresh token bekor bo'ladi.
     * Token noto'g'ri, ishlatilgan, muddati o'tgan yoki foydalanuvchi faol bo'lmasa — null.
     */
    public function refresh(string $plainRefreshToken): ?array
    {
        // Format "<id>|<qiymat>" — aks holda findToken() raqam bo'lmagan ID bilan SQL xatosi beradi
        if (! preg_match('/^\d+\|[A-Za-z0-9]+$/', $plainRefreshToken)) {
            return null;
        }

        $found = PersonalAccessToken::findToken($plainRefreshToken);
        if (! $found || ! self::isRefreshToken($found)) {
            return null;
        }

        return DB::transaction(function () use ($found) {
            // Qulf: bir xil refresh token bilan parallel so'rovlardan faqat bittasi muvaffaqiyatli
            $token = PersonalAccessToken::whereKey($found->id)->lockForUpdate()->first();
            if (! $token) {
                return null;
            }

            $user = $token->tokenable;
            if (! $user instanceof User) {
                $token->delete();
                return null;
            }

            $sid = self::sessionId($token);
            if (! $token->expires_at || $token->expires_at->isPast()
                || ! $user->isParent() || ! $user->canAuthenticate()) {
                $this->revoke($user, $sid);
                return null;
            }

            $device    = self::deviceName($token);
            $expiresAt = $token->expires_at;
            $this->revoke($user, $sid);

            return $this->issue($user, $sid, $device, $expiresAt);
        });
    }

    /** Bitta qurilma sessiyasini (access va refresh) bekor qiladi. O'chirilgan tokenlar soni. */
    public function revoke(User $user, string $sid): int
    {
        return $user->tokens()
            ->where(fn ($q) => $q->where('name', self::ACCESS_PREFIX . $sid)
                                 ->orWhere('name', 'like', self::REFRESH_PREFIX . $sid . '|%'))
            ->delete();
    }

    /** Bitta qurilma sessiyasining (access va refresh) token ID'lari. */
    public function sessionTokenIds(User $user, string $sid): array
    {
        return $user->tokens()
            ->where(fn ($q) => $q->where('name', self::ACCESS_PREFIX . $sid)
                                 ->orWhere('name', 'like', self::REFRESH_PREFIX . $sid . '|%'))
            ->pluck('id')->all();
    }

    /** Foydalanuvchining faol mobil sessiyalari (token qiymatlarisiz). */
    public function sessions(User $user, ?string $currentSid): array
    {
        return $this->refreshTokens($user)
            ->orderByDesc('expires_at')
            ->get()
            ->map(fn (PersonalAccessToken $t) => [
                'id'          => self::sessionId($t),
                'device_name' => self::deviceName($t),
                'started_at'  => $t->expires_at->copy()->subDays(self::SESSION_TTL_DAYS)->toIso8601String(),
                'expires_at'  => $t->expires_at->toIso8601String(),
                'current'     => self::sessionId($t) === $currentSid,
            ])
            ->values()
            ->all();
    }

    /** Web (mobil bo'lmagan) tokenlar — web login faqat shularni almashtiradi. */
    public function webTokens(User $user): MorphMany
    {
        return $user->tokens()->where('name', 'not like', 'mobile-%');
    }

    public static function isAccessToken(PersonalAccessToken $token): bool
    {
        return str_starts_with($token->name, self::ACCESS_PREFIX);
    }

    public static function isRefreshToken(PersonalAccessToken $token): bool
    {
        return str_starts_with($token->name, self::REFRESH_PREFIX) && $token->can(self::REFRESH_ABILITY);
    }

    public static function sessionId(PersonalAccessToken $token): string
    {
        return explode('|', $token->name, 3)[1] ?? '';
    }

    public static function isValidSessionId(string $sid): bool
    {
        return (bool) preg_match('/^[0-9a-f]{32}$/', $sid);
    }

    private function issue(User $user, string $sid, string $device, CarbonInterface $sessionExpiresAt): array
    {
        $accessExpiresAt = now()->addMinutes(self::ACCESS_TTL_MINUTES);
        if ($accessExpiresAt->greaterThan($sessionExpiresAt)) {
            $accessExpiresAt = $sessionExpiresAt;
        }

        $access  = $user->createToken(self::ACCESS_PREFIX . $sid, self::ACCESS_ABILITIES, $accessExpiresAt);
        $refresh = $user->createToken(self::REFRESH_PREFIX . $sid . '|' . $device, [self::REFRESH_ABILITY], $sessionExpiresAt);

        return [
            'token_type'               => 'Bearer',
            'access_token'             => $access->plainTextToken,
            'access_token_expires_at'  => $accessExpiresAt->toIso8601String(),
            'refresh_token'            => $refresh->plainTextToken,
            'refresh_token_expires_at' => $sessionExpiresAt->toIso8601String(),
        ];
    }

    private function mobileTokens(User $user): MorphMany
    {
        return $user->tokens()->where(fn ($q) => $q->where('name', 'like', self::ACCESS_PREFIX . '%')
                                                   ->orWhere('name', 'like', self::REFRESH_PREFIX . '%'));
    }

    private function refreshTokens(User $user): MorphMany
    {
        return $user->tokens()
            ->where('name', 'like', self::REFRESH_PREFIX . '%')
            ->where('expires_at', '>', now());
    }

    private static function deviceName(PersonalAccessToken $token): string
    {
        return explode('|', $token->name, 3)[2] ?? '';
    }

    private static function cleanDeviceName(?string $name): string
    {
        $name = trim(preg_replace('/[\p{C}|]+/u', ' ', (string) $name));

        return mb_substr($name, 0, 100) ?: 'Mobil qurilma';
    }
}
