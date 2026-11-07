<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\AuthService;
use App\Services\MobileSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Ota-ona mobil ilovasi autentifikatsiyasi. Faqat parent roli; tokenlar javob tanasida, cookie'siz.
 * Javobdagi user.must_change_password=true bo'lsa, ilova avval PUT /v1/me/password (Bearer access token) chaqiradi —
 * shu paytgacha /v1/parent/* 403 (code: password_change_required) qaytaradi; joriy qurilma sessiyasi saqlanadi.
 */
class AuthController extends Controller
{
    public function __construct(private AuthService $auth, private MobileSessionService $sessions) {}

    /** POST /v1/mobile/login */
    public function login(Request $request): JsonResponse
    {
        // «login» — username yoki telefon; «phone» — eski mobil klientlar uchun (orqaga moslik)
        $data = $request->validate([
            'login'       => ['required_without:phone', 'nullable', 'string', 'max:64'],
            'phone'       => ['required_without:login', 'nullable', 'string', 'max:64'],
            'password'    => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);
        $field = ! empty($data['login']) ? 'login' : 'phone';

        // Boshqa rollar uchun ham bir xil umumiy xato — rol oshkor bo'lmasin
        $user = $this->auth->attempt((string) $data[$field], $data['password']);
        if (! $user || ! $user->isParent()) {
            throw ValidationException::withMessages([
                $field => [$field === 'login' ? 'Login yoki parol noto\'g\'ri.' : 'Telefon raqami yoki parol noto\'g\'ri.'],
            ]);
        }

        $tokens = $this->sessions->start($user, $data['device_name'] ?? null);
        $user->update(['last_login_at' => now()]);

        ActivityLog::record(
            'user.mobile_login',
            "Ota-ona mobil ilovaga kirdi: {$user->name}",
            $user->id,
            $user->organization_id,
            ['device_name' => $data['device_name'] ?? null],
            $request->ip()
        );

        return response()->json($tokens + ['user' => $this->auth->userResource($user)]);
    }

    /** POST /v1/mobile/token/refresh — autentifikatsiyasiz, faqat refresh token bilan. */
    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => ['required', 'string', 'max:255'],
        ]);

        $tokens = $this->sessions->refresh($data['refresh_token']);
        if (! $tokens) {
            return response()->json(['message' => 'Sessiya muddati tugagan. Qaytadan kiring.'], 401);
        }

        return response()->json($tokens);
    }

    /** POST /v1/mobile/logout — joriy qurilma sessiyasini bekor qiladi. */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->sessions->revoke($user, (string) $this->currentSid($request));

        ActivityLog::record(
            'user.mobile_logout',
            "Ota-ona mobil ilovadan chiqdi: {$user->name}",
            $user->id,
            $user->organization_id,
            [],
            $request->ip()
        );

        return response()->json(['message' => 'Tizimdan muvaffaqiyatli chiqdingiz.']);
    }

    /** GET /v1/mobile/sessions */
    public function sessions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->sessions->sessions($request->user(), $this->currentSid($request)),
        ]);
    }

    /** DELETE /v1/mobile/sessions/{sid} — faqat o'z qurilma sessiyasi. */
    public function destroySession(Request $request, string $sid): JsonResponse
    {
        abort_if(! MobileSessionService::isValidSessionId($sid), 404, "Ma'lumot topilmadi.");
        abort_if($this->sessions->revoke($request->user(), $sid) === 0, 404, "Ma'lumot topilmadi.");

        return response()->json(['message' => 'Qurilma sessiyasi bekor qilindi.']);
    }

    private function currentSid(Request $request): ?string
    {
        $token = $request->user()->currentAccessToken();

        return $token instanceof PersonalAccessToken && MobileSessionService::isAccessToken($token)
            ? MobileSessionService::sessionId($token)
            : null;
    }
}
