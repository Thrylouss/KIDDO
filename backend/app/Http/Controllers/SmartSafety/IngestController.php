<?php

namespace App\Http\Controllers\SmartSafety;

use App\Http\Controllers\Controller;
use App\Iot\Exceptions\ProviderUnavailable;
use App\Iot\IotCore;
use App\Models\IotDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gateway → KIDDO (HTTP push). Autentifikatsiya: `Authorization: Bearer <gateway token>` (bazada faqat sha256 xeshi).
 * Foydalanuvchi sessiyasi ishlatilmaydi; gateway faqat o'z bog'chasi qurilmalari hodisalarini yubora oladi.
 */
class IngestController extends Controller
{
    public function __invoke(Request $request, IotCore $core): JsonResponse
    {
        $token = (string) $request->bearerToken();
        $gateway = strlen($token) >= 20
            ? IotDevice::where('type', 'gateway')->where('token_hash', hash('sha256', $token))->first()
            : null;
        if (! $gateway) {
            return response()->json(['message' => 'Gateway autentifikatsiyadan o\'tmadi.'], 401);
        }

        $data = $request->validate([
            'events'   => ['required', 'array', 'min:1', 'max:500'],
            'events.*' => ['array'],
        ]);

        try {
            $stats = $core->ingest($gateway, $data['events']);
        } catch (ProviderUnavailable) {
            return response()->json(['message' => 'Provayder hozircha yoqilmagan.'], 503);
        }

        return response()->json(['data' => $stats], 202);
    }
}
