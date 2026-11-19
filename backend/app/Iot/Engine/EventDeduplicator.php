<?php

namespace App\Iot\Engine;

use App\Iot\Data\NormalizedEvent;
use App\Models\IotEvent;

/**
 * Bir hodisa bir necha gateway/anker orqali yoki qayta yuborilganda takror yozilmasin.
 * Kalit: provayder + qurilma + tur + vaqt oynasi (+ lokatsiya uchun 1 m aniqlikdagi joy).
 */
final class EventDeduplicator
{
    public function __construct(private int $windowSeconds) {}

    public function key(NormalizedEvent $e): string
    {
        $bucket = intdiv($e->occurredAt->getTimestamp(), max(1, $this->windowSeconds));
        $place  = $e->type === 'location' && $e->x !== null ? round($e->x) . ':' . round($e->y) : '';

        return hash('sha256', implode('|', [$e->provider, $e->deviceExternalId, $e->type, $bucket, $place]));
    }

    public function isDuplicate(string $key): bool
    {
        return IotEvent::where('dedup_key', $key)->exists();
    }
}
