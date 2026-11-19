<?php

namespace App\Services\SmartSafety;

use App\Models\ActivityLog;
use App\Models\SafetyIncident;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Insident hayot sikli. Qoidalar: qabul qilish (acknowledge) insidentni YOPMAYDI; yechish (resolve) alohida amal,
 * faqat qabul qilingan insident uchun va izoh bilan. Har bir amal audit jurnaliga yoziladi.
 */
class IncidentService
{
    public function acknowledge(SafetyIncident $incident, User $by, ?string $ip): SafetyIncident
    {
        if ($incident->status !== SafetyIncident::STATUS_OPEN) {
            throw ValidationException::withMessages(['status' => "Faqat ochiq insidentni qabul qilish mumkin."]);
        }
        $incident->update(['status' => SafetyIncident::STATUS_ACKNOWLEDGED, 'acknowledged_at' => now(), 'acknowledged_by' => $by->id]);
        ActivityLog::record('safety_incident.acknowledged', "Smart Safety: insident qabul qilindi #{$incident->id}", $by->id, $incident->organization_id,
            ['incident_id' => $incident->id, 'type' => $incident->type], $ip);

        return $incident;
    }

    public function resolve(SafetyIncident $incident, User $by, string $note, ?string $ip): SafetyIncident
    {
        if ($incident->status !== SafetyIncident::STATUS_ACKNOWLEDGED) {
            throw ValidationException::withMessages(['status' => "Insidentni yechishdan oldin uni qabul qiling."]);
        }
        $incident->update(['status' => SafetyIncident::STATUS_RESOLVED, 'resolved_at' => now(), 'resolved_by' => $by->id, 'resolution_note' => $note]);
        ActivityLog::record('safety_incident.resolved', "Smart Safety: insident yechildi #{$incident->id}", $by->id, $incident->organization_id,
            ['incident_id' => $incident->id, 'type' => $incident->type], $ip);

        return $incident;
    }

    /** Belgilangan vaqtda qabul qilinmagan ochiq insidentlar eskalatsiya qilinadi (rahbarga ko'tariladi). */
    public function escalateOverdue(): int
    {
        $minutes = (int) config('kiddo.smart_safety.escalation_minutes', 3);

        return SafetyIncident::where('status', SafetyIncident::STATUS_OPEN)->whereNull('escalated_at')
            ->where('opened_at', '<=', now()->subMinutes($minutes))
            ->update(['escalated_at' => now()]);
    }

    public function resource(SafetyIncident $i, bool $withChild = true): array
    {
        return [
            'id' => $i->id, 'type' => $i->type, 'severity' => $i->severity, 'status' => $i->status,
            'opened_at' => $i->opened_at, 'escalated_at' => $i->escalated_at,
            'acknowledged_at' => $i->acknowledged_at, 'resolved_at' => $i->resolved_at, 'resolution_note' => $i->resolution_note,
            'zone' => $i->zone ? ['id' => $i->zone->id, 'name' => $i->zone->name, 'kind' => $i->zone->kind] : null,
            'device' => $i->device ? ['id' => $i->device->id, 'external_id' => $i->device->external_id, 'battery_level' => $i->device->battery_level] : null,
            'child' => $withChild && $i->child ? ['id' => $i->child->id, 'name' => trim("{$i->child->first_name} {$i->child->last_name}"), 'group_id' => $i->child->group_id] : null,
        ];
    }
}
