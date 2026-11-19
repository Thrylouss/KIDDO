<?php

namespace App\Iot\Data;

use Carbon\CarbonImmutable;

/** Provayderdan mustaqil hodisa. Koordinatalar — bog'cha rejasi (metr) tizimida. */
final class NormalizedEvent
{
    public const TYPES = ['location', 'sos', 'battery', 'removed', 'offline', 'online', 'heartbeat'];

    /** @param array<string, float> $rssi anker external_id => RSSI (dBm) */
    public function __construct(
        public readonly string $provider,
        public readonly string $deviceExternalId,
        public readonly string $type,
        public readonly CarbonImmutable $occurredAt,
        public readonly ?float $x = null,
        public readonly ?float $y = null,
        public readonly ?int $battery = null,
        public readonly array $rssi = [],
        public readonly array $payload = [],
    ) {}

    public function withPosition(?float $x, ?float $y): self
    {
        return new self($this->provider, $this->deviceExternalId, $this->type, $this->occurredAt, $x, $y, $this->battery, $this->rssi, $this->payload);
    }
}
