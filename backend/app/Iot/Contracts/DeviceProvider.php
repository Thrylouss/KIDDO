<?php

namespace App\Iot\Contracts;

use App\Iot\Data\NormalizedEvent;

/**
 * Universal qurilma adapteri: har bir vendor o'z xom formatini KIDDO'ning yagona NormalizedEvent shakliga o'tkazadi.
 * Yangi vendor qo'shish — faqat shu interfeysni amalga oshirish (rasmiy hujjat asosida).
 */
interface DeviceProvider
{
    public function key(): string;

    public function label(): string;

    /** Konfiguratsiyada yoqilgan va rasmiy integratsiya mavjud bo'lsa — true. */
    public function isAvailable(): bool;

    /** @return Transport[] */
    public function supportedTransports(): array;

    /**
     * @param  array<int, array<string, mixed>>  $raw  provayder formatidagi hodisalar
     * @return NormalizedEvent[]
     */
    public function normalize(array $raw): array;
}
