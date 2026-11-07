<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Territory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Viloyat / tuman / MFY tanlov ro'yxatlari.
 *
 * Manba tartibi:
 *  1) «directory» — territories jadvali (tasdiqlangan rasmiy manbadan yuklangan bo'lsa);
 *  2) «organizations» — aks holda bazadagi bog'chalarning mavjud matnli qiymatlari (avvalgi xatti-harakat).
 * Bog'chalarning o'z qiymatlari hech qachon avtomatik o'zgartirilmaydi (orqaga moslik).
 */
class TerritoryDirectory
{
    public function hasDirectory(): bool
    {
        return Schema::hasTable('territories') && Territory::where('is_active', true)->exists();
    }

    /** @return array{source: string, regions: array, districts: array, mfys: array} */
    public function options(): array
    {
        if ($this->hasDirectory()) {
            $names = fn (string $kind) => Territory::where('kind', $kind)->where('is_active', true)
                ->orderBy('name')->pluck('name')->unique()->values();

            return [
                'source'    => 'directory',
                'regions'   => $names(Territory::KIND_REGION),
                'districts' => $names(Territory::KIND_DISTRICT),
                'mfys'      => $names(Territory::KIND_MFY),
            ];
        }

        $distinct = fn (string $col) => Organization::query()->whereNotNull($col)->where($col, '!=', '')
            ->distinct()->orderBy($col)->pluck($col)->values();

        return [
            'source'    => 'organizations',
            'regions'   => $distinct('region'),
            'districts' => $distinct('district'),
            'mfys'      => $distinct('mfy'),
        ];
    }

    /**
     * Tasdiqlangan manba faylidan (ustunlar: Viloyat, Tuman, MFY, ixtiyoriy Kod) ma'lumotnomani tayyorlaydi.
     * $apply=false — faqat tekshiradi va hisobot beradi, bazaga yozmaydi.
     *
     * @param array<int, array<int, string>> $rows SpreadsheetReader natijasi (birinchi qator — sarlavha)
     * @return array{regions:int, districts:int, mfys:int, created:int, existing:int, errors: string[]}
     */
    public function importRows(array $rows, string $source, ?string $sourceRef, bool $apply): array
    {
        $header = array_map(fn ($h) => mb_strtolower(trim((string) $h)), array_values(array_shift($rows) ?? []));
        $col = fn (array $names) => collect($header)->search(fn ($h) => in_array(preg_replace('/[^a-zа-яё]/u', '', str_replace(["'", 'ʻ', '‘'], '', $h)), $names, true));
        $ri = $col(['viloyat', 'region']);
        $di = $col(['tuman', 'tumanshahar', 'district', 'shahar']);
        $mi = $col(['mfy', 'mahalla']);
        $ci = $col(['kod', 'code', 'rasmiykod']);
        if ($ri === false || $di === false) {
            throw new RuntimeException("Sarlavhada kamida «Viloyat» va «Tuman» ustunlari bo'lishi kerak.");
        }

        $clean = fn ($v) => ($v = trim(preg_replace('/\s+/u', ' ', (string) $v))) === '' ? null : $v;
        $errors = [];
        $tree = [];
        foreach ($rows as $i => $cells) {
            $cells = array_values($cells);
            [$r, $d, $m] = [$clean($cells[$ri] ?? null), $clean($cells[$di] ?? null), $mi !== false ? $clean($cells[$mi] ?? null) : null];
            if ($r === null && $d === null && $m === null) {
                continue;
            }
            if ($r === null || $d === null) {
                $errors[] = ($i + 2) . "-qator: viloyat va tuman majburiy.";
                continue;
            }
            $tree[$r][$d][$m ?? ''] = $ci !== false ? $clean($cells[$ci] ?? null) : null;
        }

        $counts = ['regions' => count($tree), 'districts' => 0, 'mfys' => 0, 'created' => 0, 'existing' => 0, 'errors' => $errors];
        foreach ($tree as $districts) {
            $counts['districts'] += count($districts);
            foreach ($districts as $mfys) {
                $counts['mfys'] += count(array_filter(array_keys($mfys), fn ($k) => $k !== ''));
            }
        }
        if (! $apply || $errors) {
            return $counts;
        }

        DB::transaction(function () use ($tree, $source, $sourceRef, &$counts) {
            $upsert = function (string $kind, string $name, ?int $parent, ?string $code) use ($source, $sourceRef, &$counts) {
                $t = Territory::firstOrNew(['kind' => $kind, 'parent_id' => $parent, 'name' => $name]);
                $t->exists ? $counts['existing']++ : $counts['created']++;
                $t->fill(['code' => $code ?? $t->code, 'source' => $source, 'source_ref' => $sourceRef, 'is_active' => true])->save();

                return $t->id;
            };
            foreach ($tree as $region => $districts) {
                $rid = $upsert(Territory::KIND_REGION, $region, null, null);
                foreach ($districts as $district => $mfys) {
                    $did = $upsert(Territory::KIND_DISTRICT, $district, $rid, null);
                    foreach ($mfys as $mfy => $code) {
                        if ($mfy !== '') {
                            $upsert(Territory::KIND_MFY, $mfy, $did, $code);
                        }
                    }
                }
            }
        });

        return $counts;
    }
}
