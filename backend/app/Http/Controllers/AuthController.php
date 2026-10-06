<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'phone'    => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('phone', $request->phone)
                    ->where('is_active', true)
                    ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'phone' => ['Telefon raqami yoki parol noto\'g\'ri.'],
            ]);
        }

        // Reject login for users belonging to a deactivated organization.
        // Generic error prevents org-status enumeration by attackers.
        if ($user->organization_id !== null) {
            $orgActive = Organization::where('id', $user->organization_id)
                                     ->where('is_active', true)
                                     ->exists();
            if (! $orgActive) {
                throw ValidationException::withMessages([
                    'phone' => ['Telefon raqami yoki parol noto\'g\'ri.'],
                ]);
            }
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

        // Revoke previous tokens on new login (one session per user for MVP)
        $user->tokens()->delete();

        $token = $user->createToken('kiddo-app', [$user->role])->plainTextToken;

        return response()->json([
            'user' => $this->userResource($user),
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

        // currentAccessToken() returns a transient object in tests (no DB token)
        if ($token && method_exists($token, 'delete')) {
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

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userResource($request->user()),
        ]);
    }

    private function userResource(User $user): array
    {
        return [
            'id'              => $user->id,
            'name'            => $user->name,
            'phone'           => $user->phone,
            'email'           => $user->email,
            'role'            => $user->role,
            'organization_id' => $user->organization_id,
            'is_active'       => $user->is_active,
        ];
    }
}
