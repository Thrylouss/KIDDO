<?php

namespace App\Http\Controllers\SmartSafety;

use App\Http\Controllers\Controller;
use App\Iot\Contracts\Transport;
use App\Iot\ProviderRegistry;
use Illuminate\Http\JsonResponse;

/** Smart Safety holati va integratsiya tayyorligi (maxfiy qiymatlarsiz). */
class StatusController extends Controller
{
    public function __invoke(ProviderRegistry $registry): JsonResponse
    {
        return response()->json([
            'enabled'    => true,   // middleware o'tkazgan bo'lsa — yoqilgan
            'providers'  => $registry->status(),
            'transports' => array_map(fn ($t) => $t->value, Transport::cases()),
            'settings'   => [
                'dedup_window_seconds'  => (int) config('kiddo.smart_safety.dedup_window_seconds'),
                'escalation_minutes'    => (int) config('kiddo.smart_safety.escalation_minutes'),
                'offline_after_minutes' => (int) config('kiddo.smart_safety.offline_after_minutes'),
                'battery_low_percent'   => (int) config('kiddo.smart_safety.battery_low_percent'),
            ],
        ]);
    }
}
