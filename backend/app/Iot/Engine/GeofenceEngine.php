<?php

namespace App\Iot\Engine;

use App\Models\SafetyZone;
use Illuminate\Support\Collection;

/** Nuqta qaysi zonada: ko'pburchak ichida (ray casting). Cheklangan zona ustuvor. */
final class GeofenceEngine
{
    /** @param Collection<int, SafetyZone> $zones */
    public function zoneAt(float $x, float $y, Collection $zones): ?SafetyZone
    {
        $hits = $zones->filter(fn (SafetyZone $z) => $z->is_active && self::contains($z->polygon ?? [], $x, $y));

        return $hits->firstWhere('kind', 'restricted') ?? $hits->first();
    }

    /** @param array<int, array{0: float|int, 1: float|int}> $polygon */
    public static function contains(array $polygon, float $x, float $y): bool
    {
        $n = count($polygon);
        if ($n < 3) {
            return false;
        }
        $inside = false;
        for ($i = 0, $j = $n - 1; $i < $n; $j = $i++) {
            [$xi, $yi] = [(float) $polygon[$i][0], (float) $polygon[$i][1]];
            [$xj, $yj] = [(float) $polygon[$j][0], (float) $polygon[$j][1]];
            if ((($yi > $y) !== ($yj > $y)) && ($x < ($xj - $xi) * ($y - $yi) / (($yj - $yi) ?: 1e-9) + $xi)) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }
}
