<?php

namespace App\Http\Controllers;

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

        // Revoke previous tokens on new login (one session per user for MVP)
        $user->tokens()->delete();

        $token = $user->createToken('kiddo-app', [$user->role])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $this->userResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        // currentAccessToken() returns a transient object in tests (no DB token)
        if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

        return response()->json(['message' => 'Tizimdan muvaffaqiyatli chiqdingiz.']);
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
            'id'               => $user->id,
            'name'             => $user->name,
            'phone'            => $user->phone,
            'email'            => $user->email,
            'role'             => $user->role,
            'kindergarten_id'  => $user->kindergarten_id,
            'is_active'        => $user->is_active,
        ];
    }
}
