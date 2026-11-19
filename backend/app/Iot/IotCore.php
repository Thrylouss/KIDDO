<?php

namespace App\Iot;

use App\Iot\Data\NormalizedEvent;
use App\Iot\Engine\AttendanceDeduplicator;
use App\Iot\Engine\EventDeduplicator;
use App\Iot\Engine\EventQueue;
use App\Iot\Engine\GeofenceEngine;
use App\Iot\Engine\LocationEngine;
use App\Iot\Exceptions\ProviderUnavailable;
use App\Iot\Notifications\NotificationDispatcher;
use App\Models\IotDevice;
use App\Models\IotEvent;
use App\Models\SafetyIncident;
use App\Models\SafetyZone;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * IoT konveyeri: provayder normalizatsiyasi → navbat (vaqt tartibi) → deduplikatsiya → qurilma holati →
 * lokatsiya → geofence → hodisa jurnali → insident → bildirishnoma. Hammasi gateway tegishli bog'cha doirasida:
 * boshqa bog'cha qurilmasining hodisasi e'tiborsiz qoldiriladi.
 */
class IotCore
{
    public function __construct(
        private ProviderRegistry $providers,
        private LocationEngine $location,
        private GeofenceEngine $geofence,
        private AttendanceDeduplicator $attendance,
        private NotificationDispatcher $notify,
    ) {}

    /**
     * @param  array<int, array<string, mixed>>  $raw
     * @return array{received: int, accepted: int, duplicates: int, ignored: int, incidents: int}
     */
    public function ingest(IotDevice $gateway, array $raw): array
    {
        $provider = $this->providers->available($gateway->provider)
            ?? throw new ProviderUnavailable("Provayder yoqilmagan: {$gateway->provider}");

        $queue = new EventQueue();
        $queue->push(...$provider->normalize($raw));
        $events = $queue->drain();

        $orgId   = $gateway->organization_id;
        $dedup   = new EventDeduplicator((int) config('kiddo.smart_safety.dedup_window_seconds', 30));
        $devices = IotDevice::forOrganization($orgId)->where('provider', $gateway->provider)
            ->whereIn('external_id', array_unique(array_map(fn ($e) => $e->deviceExternalId, $events)))
            ->with('activeAssignment')->get()->keyBy('external_id');
        $anchors = IotDevice::forOrganization($orgId)->where('type', 'anchor')->get()
            ->filter(fn ($a) => isset($a->meta['x'], $a->meta['y']))
            ->mapWithKeys(fn ($a) => [$a->external_id => [(float) $a->meta['x'], (float) $a->meta['y']]])->all();
        $zones = SafetyZone::forOrganization($orgId)->where('is_active', true)->get();

        $stats = ['received' => count($raw), 'accepted' => 0, 'duplicates' => 0, 'ignored' => count($raw) - count($events), 'incidents' => 0];
        $now   = CarbonImmutable::now();

        $gateway->forceFill(['status' => 'online', 'last_seen_at' => $now])->save();

        foreach ($events as $e) {
            $device = $devices->get($e->deviceExternalId);
            if (! $device) {
                $stats['ignored']++;   // noma'lum yoki boshqa bog'cha qurilmasi
                continue;
            }
            $key = $dedup->key($e);
            if ($dedup->isDuplicate($key)) {
                $stats['duplicates']++;
                continue;
            }

            $stats['incidents'] += DB::transaction(fn () => $this->apply($device, $e, $key, $anchors, $zones, $now));
            $stats['accepted']++;
        }

        return $stats;
    }

    private function apply(IotDevice $device, NormalizedEvent $e, string $key, array $anchors, $zones, CarbonImmutable $now): int
    {
        $childId = $device->activeAssignment?->child_id;
        $pos     = $this->location->resolve($e->x, $e->y, $e->rssi, $anchors);
        $zone    = $pos ? $this->geofence->zoneAt($pos[0], $pos[1], $zones) : null;

        $device->forceFill([
            'last_seen_at'  => $e->occurredAt,
            'battery_level' => $e->battery ?? $device->battery_level,
            'status'        => match ($e->type) { 'offline' => 'offline', 'removed' => 'removed', default => 'online' },
        ])->save();

        $event = IotEvent::create([
            'organization_id' => $device->organization_id, 'iot_device_id' => $device->id, 'child_id' => $childId,
            'safety_zone_id' => $zone?->id, 'type' => $e->type, 'x' => $pos[0] ?? null, 'y' => $pos[1] ?? null,
            'payload' => array_filter(['battery' => $e->battery, 'rssi' => $e->rssi ?: null]), 'dedup_key' => $key,
            'occurred_at' => $e->occurredAt, 'received_at' => $now,
        ]);

        // Smart Attendance (tavsiya): kirish zonasidagi kunlik birinchi hodisa — arrival (rasmiy davomatga yozilmaydi)
        if ($childId && $zone?->kind === 'entrance' && $this->attendance->isFirstArrival($device->organization_id, $childId, $e->occurredAt)) {
            IotEvent::create([
                'organization_id' => $device->organization_id, 'iot_device_id' => $device->id, 'child_id' => $childId,
                'safety_zone_id' => $zone->id, 'type' => 'arrival', 'dedup_key' => hash('sha256', "arrival|{$childId}|" . $e->occurredAt->toDateString()),
                'occurred_at' => $e->occurredAt, 'received_at' => $now,
            ]);
        }

        $incident = match (true) {
            $e->type === 'sos'                                     => ['sos', 'critical'],
            $e->type === 'removed'                                 => ['device_removed', 'high'],
            $e->type === 'offline'                                 => ['device_offline', 'warning'],
            $zone?->kind === 'restricted'                          => ['restricted_zone', 'critical'],
            $e->battery !== null && $e->battery <= (int) config('kiddo.smart_safety.battery_low_percent', 15) => ['battery_low', 'warning'],
            default                                                => null,
        };
        if (! $incident) {
            return 0;
        }

        // Bir qurilmada bir xil turdagi ochiq insident takrorlanmaydi
        $exists = SafetyIncident::where('iot_device_id', $device->id)->where('type', $incident[0])->unresolved()->exists();
        if ($exists) {
            return 0;
        }

        $created = SafetyIncident::create([
            'organization_id' => $device->organization_id, 'child_id' => $childId, 'iot_device_id' => $device->id,
            'safety_zone_id' => $zone?->id, 'iot_event_id' => $event->id, 'type' => $incident[0], 'severity' => $incident[1],
            'status' => SafetyIncident::STATUS_OPEN, 'opened_at' => $e->occurredAt,
        ]);
        $this->notify->incidentOpened($created, $device->provider === 'demo');

        return 1;
    }
}
