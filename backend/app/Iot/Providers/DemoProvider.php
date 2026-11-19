<?php

namespace App\Iot\Providers;

use App\Iot\Contracts\DeviceProvider;
use App\Iot\Contracts\Transport;
use App\Iot\Data\NormalizedEvent;
use Carbon\CarbonImmutable;

/**
 * Demo/simulyator provayderi: KIDDO'ning o'z hujjatlashtirilgan formati
 * {device, type, at, x?, y?, battery?, rssi?{anchor: dBm}} — boshqa vendorlarni taqlid qilmaydi.
 */
class DemoProvider implements DeviceProvider
{
    public function key(): string
    {
        return 'demo';
    }

    public function label(): string
    {
        return 'KIDDO Demo Provider';
    }

    public function isAvailable(): bool
    {
        return (bool) config('kiddo.smart_safety.providers.demo.enabled', true);
    }

    public function supportedTransports(): array
    {
        return [Transport::HttpPush];
    }

    public function normalize(array $raw): array
    {
        $out = [];
        foreach ($raw as $e) {
            if (! is_array($e) || ! isset($e['device'], $e['type'], $e['at'])) {
                continue;
            }
            $type = (string) $e['type'];
            if (! in_array($type, NormalizedEvent::TYPES, true)) {
                continue;
            }
            try {
                // Ilova vaqt zonasiga o'tkaziladi (aks holda UTC «Z» vaqti zonasiz saqlanib, soatlar siljiydi)
                $at = CarbonImmutable::parse((string) $e['at'])->setTimezone(config('app.timezone'));
            } catch (\Throwable) {
                continue;
            }
            $rssi = [];
            foreach ((array) ($e['rssi'] ?? []) as $anchor => $dbm) {
                if (is_numeric($dbm) && is_string($anchor) && strlen($anchor) <= 64) {
                    $rssi[$anchor] = (float) $dbm;
                }
            }
            $out[] = new NormalizedEvent(
                provider: 'demo',
                deviceExternalId: mb_substr((string) $e['device'], 0, 64),
                type: $type,
                occurredAt: $at,
                x: isset($e['x']) && is_numeric($e['x']) ? (float) $e['x'] : null,
                y: isset($e['y']) && is_numeric($e['y']) ? (float) $e['y'] : null,
                battery: isset($e['battery']) && is_numeric($e['battery']) ? max(0, min(100, (int) $e['battery'])) : null,
                rssi: $rssi,
            );
        }

        return $out;
    }
}
