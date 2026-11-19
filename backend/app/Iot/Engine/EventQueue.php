<?php

namespace App\Iot\Engine;

use App\Iot\Data\NormalizedEvent;

/**
 * Hodisalar navbati: gateway internet uzilganda to'plangan (buffered) hodisalarni keyin bir paketda yuboradi —
 * ular yuz bergan vaqt bo'yicha tartiblanib qayta ishlanadi (holat to'g'ri ketma-ketlikda tiklanadi).
 */
final class EventQueue
{
    /** @var NormalizedEvent[] */
    private array $items = [];

    public function push(NormalizedEvent ...$events): void
    {
        array_push($this->items, ...$events);
    }

    /** @return NormalizedEvent[] occurred_at bo'yicha barqaror tartibda */
    public function drain(): array
    {
        $indexed = array_map(null, array_keys($this->items), $this->items);
        usort($indexed, fn ($a, $b) => [$a[1]->occurredAt->getTimestampMs(), $a[0]] <=> [$b[1]->occurredAt->getTimestampMs(), $b[0]]);
        $this->items = [];

        return array_column($indexed, 1);
    }
}
