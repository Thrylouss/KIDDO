<?php

namespace App\Iot\Engine;

/**
 * Joylashuvni aniqlash: qurilma koordinata yuborgan bo'lsa — o'zi; aks holda ankerlar RSSI bo'yicha og'irlikli markaz
 * (yaqinroq anker — kattaroq og'irlik). Bu taxminiy usul: real aniqlik uskuna va o'rnatishga bog'liq.
 */
final class LocationEngine
{
    /**
     * @param  array<string, float>  $rssi     anker external_id => dBm
     * @param  array<string, array{0: float, 1: float}>  $anchors  external_id => [x, y]
     * @return array{0: float, 1: float}|null
     */
    public function resolve(?float $x, ?float $y, array $rssi, array $anchors): ?array
    {
        if ($x !== null && $y !== null) {
            return [$x, $y];
        }
        $sumW = 0.0; $sx = 0.0; $sy = 0.0;
        foreach ($rssi as $id => $dbm) {
            if (! isset($anchors[$id])) {
                continue;
            }
            $w = 10 ** ($dbm / 20);       // dBm → nisbiy kuch (manfiy RSSI kichikroq og'irlik)
            $sumW += $w;
            $sx += $anchors[$id][0] * $w;
            $sy += $anchors[$id][1] * $w;
        }

        return $sumW > 0 ? [round($sx / $sumW, 2), round($sy / $sumW, 2)] : null;
    }
}
