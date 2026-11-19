<?php

namespace App\Iot\Notifications;

use App\Models\SafetyIncident;

/**
 * Insident bildirishnomasi. Real o'rnatishda mahalliy mustaqil ovozli signal (gateway/sirena) ham bo'lishi shart —
 * faqat brauzer bildirishnomasiga tayanilmaydi. Demo provayder hodisalari tashqariga (ota-onalarga) hech qachon yuborilmaydi.
 */
interface NotificationDispatcher
{
    public function incidentOpened(SafetyIncident $incident, bool $demo): void;
}
