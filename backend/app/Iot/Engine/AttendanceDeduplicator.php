<?php

namespace App\Iot\Engine;

use App\Models\IotEvent;
use Carbon\CarbonInterface;

/**
 * Smart Attendance: bolaning kundagi BIRINCHI kirishi «arrival» sifatida bir marta qayd etiladi.
 * Muhim: rasmiy `attendances` jadvaliga yozilmaydi — bu faqat tarbiyachi uchun tavsiya (alohida tasdiqdan keyin ulanadi).
 */
final class AttendanceDeduplicator
{
    public function isFirstArrival(int $orgId, int $childId, CarbonInterface $at): bool
    {
        return ! IotEvent::where('organization_id', $orgId)->where('child_id', $childId)->where('type', 'arrival')
            ->whereBetween('occurred_at', [$at->copy()->startOfDay(), $at->copy()->endOfDay()])
            ->exists();
    }
}
