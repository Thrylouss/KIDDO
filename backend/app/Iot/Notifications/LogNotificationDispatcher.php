<?php

namespace App\Iot\Notifications;

use App\Models\SafetyIncident;
use Illuminate\Support\Facades\Log;

/** Standart dispatcher: faqat server jurnaliga yozadi (SMS/push/Telegram ulanmagan). Shaxsiy ma'lumot yozilmaydi. */
class LogNotificationDispatcher implements NotificationDispatcher
{
    public function incidentOpened(SafetyIncident $incident, bool $demo): void
    {
        try {
            Log::info('Smart Safety insident ochildi', [
                'incident_id' => $incident->id, 'organization_id' => $incident->organization_id,
                'type' => $incident->type, 'severity' => $incident->severity, 'demo' => $demo,
            ]);
        } catch (\Throwable) {
            // jurnal yozilmasa ham oqim to'xtamaydi
        }
    }
}
