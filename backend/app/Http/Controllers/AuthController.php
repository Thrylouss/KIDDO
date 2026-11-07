<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Services\AuthService;
use App\Services\MobileSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(private AuthService $auth, private MobileSessionService $mobile) {}

    public function login(Request $request): JsonResponse
    {
        // «login» — telefon yoki username (web). «phone» — eski klientlar uchun (orqaga moslik).
        $request->validate([
            'login'    => ['required_without:phone', 'nullable', 'string', 'max:64'],
            'phone'    => ['required_without:login', 'nullable', 'string', 'max:64'],
            'password' => ['required', 'string'],
        ]);
        $field = $request->filled('login') ? 'login' : 'phone';

        // Faol bo'lmagan foydalanuvchi yoki bog'cha uchun ham bir xil umumiy xato
        $user = $this->auth->attempt((string) $request->input($field), $request->password);
        if (! $user) {
            throw ValidationException::withMessages([
                $field => [$field === 'login' ? 'Login yoki parol noto\'g\'ri.' : 'Telefon raqami yoki parol noto\'g\'ri.'],
            ]);
        }

        // Ota-onalar uchun web panel yo'q — ular KIDDO mobil ilovasidan (/v1/mobile/login) foydalanadi.
        // Parol to'g'ri bo'lsa ham web sessiya (cookie token) yaratilmaydi.
        if ($user->isParent()) {
            return response()->json([
                'message' => "Ota-onalar KIDDO mobil ilovasidan foydalanadi. Ilovaga shu login va parol bilan kiring.",
                'code'    => 'parent_mobile_only',
            ], 403);
        }

        $user->update(['last_login_at' => now()]);

        ActivityLog::record(
            'user.login',
            "Foydalanuvchi tizimga kirdi: {$user->name}",
            $user->id,
            $user->organization_id,
            ['role' => $user->role],
            $request->ip()
        );

        // Web: bitta faol sessiya. Mobil qurilma sessiyalari mustaqil — ularga tegilmaydi.
        $this->mobile->webTokens($user)->delete();

        $token = $user->createToken('kiddo-app', [$user->role])->plainTextToken;

        return response()->json([
            'user' => $this->auth->userResource($user),
        ])->cookie(
            'kiddo_token',
            $token,
            60 * 24 * 7,                              // 7 days in minutes
            '/',
            null,
            config('app.env') === 'production',        // Secure flag only in production
            true,                                       // httpOnly
            false,                                      // raw
            'Strict'                                    // SameSite
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $user  = $request->user();
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken && MobileSessionService::isAccessToken($token)) {
            // Mobil access token bilan chiqish butun qurilma sessiyasini (refresh token bilan) bekor qiladi
            $this->mobile->revoke($user, MobileSessionService::sessionId($token));
        } elseif ($token && method_exists($token, 'delete')) {
            // currentAccessToken() returns a transient object in tests (no DB token)
            $token->delete();
        }

        ActivityLog::record(
            'user.logout',
            "Foydalanuvchi tizimdan chiqdi: {$user->name}",
            $user->id,
            $user->organization_id,
            [],
            $request->ip()
        );

        return response()->json(['message' => 'Tizimdan muvaffaqiyatli chiqdingiz.'])
            ->withoutCookie('kiddo_token');
    }

    /**
     * O'z parolini almashtirish (vaqtinchalik paroldan keyin majburiy). Joriy sessiya saqlanadi,
     * boshqa qurilmalardagi sessiyalar bekor qilinadi.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'min:8', 'max:128', 'confirmed', 'different:current_password'],
        ], [
            'password.min'       => "Yangi parol kamida 8 belgidan iborat bo'lsin.",
            'password.confirmed' => "Yangi parol va uning takrori mos kelmadi.",
            'password.different' => "Yangi parol joriy paroldan farq qilishi kerak.",
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ["Joriy parol noto'g'ri."]]);
        }

        $this->auth->changePassword($user, $data['password'], $request->ip());

        return response()->json([
            'message' => "Parol muvaffaqiyatli almashtirildi.",
            'user'    => $this->auth->userResource($user->fresh()),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->auth->userResource($request->user()),
        ]);
    }
}
