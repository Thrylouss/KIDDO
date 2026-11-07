<?php

namespace App\Services\Import;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Davlat MTT reyestrini Excel'dan import qilish: o'qish → normallashtirish → tekshirish (preview) → yaratish.
 * Har bir qator alohida Organization (tenant) bo'ladi. Rahbar faqat ma'lumot sifatida saqlanadi —
 * foydalanuvchi, login yoki parol yaratilmaydi.
 *
 * Excel'dagi asl qiymatlar o'zgartirilmaydi: ular `source` da aynan saqlanadi (import_source ustuni),
 * tozalangan qiymatlar esa alohida maydonlarga yoziladi. Yetishmayotgan ma'lumot to'ldirilmaydi.
 */
class OrganizationImportService
{
    public const MAX_ROWS = 1000;

    public const FIELDS = ['name', 'type', 'official_code', 'number', 'address', 'mfy', 'capacity', 'director_name', 'director_phone'];

    /** Ustunlar: nomi (foydalanuvchiga) va majburiyligi. Faqat «Muassasa nomi» majburiy; tuman — import formasida. */
    public const COLUMNS = [
        'name'           => ['Muassasa nomi', true],
        'type'           => ['Turi (Davlat / Xususiy)', false],
        'official_code'  => ['Rasmiy kod', false],
        'number'         => ['Raqami', false],
        'address'        => ['Manzili', false],
        'mfy'            => ['MFY', false],
        'capacity'       => ['Quvvati', false],
        'director_name'  => ['Rahbar F.I.Sh.', false],
        'director_phone' => ['Rahbar telefon raqami', false],
    ];

    /** Oxirgi o'qilgan fayl: maydon → Excel'dagi haqiqiy sarlavha (xato qaysi ustunda ekanini ko'rsatish uchun). */
    private array $columnHeaders = [];

    /** Sarlavha (normallashtirilgan) → maydon. «№» / «T/r» — tartib raqami, bog'cha raqami emas. */
    private const HEADER_ALIASES = [
        'name'           => ['muassasanomi', 'muassasa', 'nomi', 'dmttnomi', 'mttnomi', 'tashkilotnomi', 'bogchanomi'],
        // Ixtiyoriy: «Davlat» / «Xususiy». Bo'sh bo'lsa — import formasida tanlangan tur qo'llanadi
        'type'           => ['turi', 'tur', 'tashkilotturi', 'mulkchilikshakli', 'mulkshakli', 'shakli'],
        'official_code'  => ['rasmiykod', 'rasmiykodi', 'tashkilotkodi', 'kod', 'kodi', 'reyestrkodi'],
        'number'         => ['raqami', 'raqam', 'dmttraqami', 'mttraqami', 'nomer'],
        'address'        => ['manzili', 'manzil', 'yuridikmanzil', 'yuridikmanzili'],
        'mfy'            => ['mfy', 'mfynomi', 'mahalla', 'mahallanomi', 'mahallafuqarolaryigini'],
        'capacity'       => ['quvvati', 'quvvat', 'loyihaviyquvvati', 'sigimi', 'sigim', 'orinlarsoni'],
        'director_name'  => ['rahbarfish', 'rahbarifish', 'rahbarfio', 'rahbarifio', 'rahbar', 'rahbari', 'rahbarismi',
                             'rahbarismisharifi', 'direktor', 'mudira', 'direktorfish'],
        // Telefon raqami — rahbarning aloqa raqami; muassasaning o'z telefoni (phone) bo'sh qoladi
        'director_phone' => ['rahbartelefonraqami', 'rahbartelefoni', 'rahbaritelefoni', 'rahbartel', 'telefonraqami',
                             'telefon', 'tel', 'direktortelefoni'],
    ];

    public function __construct(private SpreadsheetReader $reader) {}

    /** Yangi ustunlar migratsiyasi bajarilmagan bazada import ishlamasligi kerak. */
    public function ensureSchema(): void
    {
        if (! Schema::hasColumns('organizations', ['district', 'number', 'mfy', 'capacity', 'director_name', 'director_phone', 'import_source', 'type', 'official_code', 'region'])) {
            throw new RuntimeException("Import uchun baza tayyor emas: migratsiya bajarilmagan.");
        }
    }

    /**
     * @return array<int, array{row:int, input:array<string,string>, source:array<string,string>}>
     *         row — Excel'dagi qator raqami; input — maydonga mos xom qiymatlar; source — sarlavha → asl katak qiymati
     */
    public function parse(string $path, string $extension): array
    {
        $rows = $this->reader->read($path, $extension);

        [$headerIndex, $map, $headers] = $this->detectHeader($rows);
        if ($headerIndex === null) {
            throw new RuntimeException("Sarlavha qatori topilmadi: kamida «Muassasa nomi» ustuni bo'lishi kerak.");
        }

        $this->columnHeaders = [];
        foreach ($map as $field => $col) {
            $this->columnHeaders[$field] = $headers[$col] ?? self::COLUMNS[$field][0];
        }

        $out = [];
        foreach (array_slice($rows, $headerIndex + 1, null, true) as $i => $cells) {
            $source = [];
            foreach ($headers as $col => $header) {
                $source[$header] = (string) ($cells[$col] ?? '');
            }
            // Bo'sh qatorlar o'tkazib yuboriladi
            if (trim(implode('', $source)) === '') {
                continue;
            }
            $input = [];
            foreach (self::FIELDS as $field) {
                $input[$field] = isset($map[$field]) ? (string) ($cells[$map[$field]] ?? '') : '';
            }
            $out[] = ['row' => $i + 1, 'input' => $input, 'source' => $source];
        }

        if (count($out) > self::MAX_ROWS) {
            throw new RuntimeException('Faylda ' . self::MAX_ROWS . ' tadan ortiq qator bor.');
        }

        return $out;
    }

    /**
     * Qatorlarni normallashtiradi, xatolar va takroriyliklarni aniqlaydi.
     * status: ok — tayyor; warning — ehtimoliy takror (tasdiq bilan import qilinadi); error — import qilinmaydi.
     *
     * @param array<int, array{row:int, input:array<string,mixed>, source?:array<string,string>}> $rows
     * @return array{rows: array<int, array<string, mixed>>, summary: array<string, int>}
     */
    public function analyze(array $rows, string $district): array
    {
        $district = $this->clean($district);

        $normalized = array_map(fn ($r) => $this->normalizeRow($r), $rows);

        // Bazadagi mavjud bog'chalar (o'chirilganlar ham — qayta yaratib yubormaslik uchun)
        $existing = Organization::withTrashed()
            ->select('id', 'name', 'district', 'number', 'official_code', 'director_name', 'director_phone', 'deleted_at')
            ->get();
        $byNumber   = $existing->filter(fn ($o) => $o->number !== null && $this->key($o->district) === $this->key($district))
            ->keyBy(fn ($o) => $this->key($o->number));
        $byName     = $existing->keyBy(fn ($o) => $this->key($o->name));
        $byPhone    = $existing->filter(fn ($o) => $o->director_phone)->keyBy('director_phone');
        $byDirector = $existing->filter(fn ($o) => $o->director_name)->keyBy(fn ($o) => $this->key($o->director_name));
        $userPhones = User::whereIn('phone', array_filter(array_column($normalized, 'director_phone')))->pluck('phone')->flip();

        // Fayl ichidagi rahbar F.I.Sh. va telefon takrorlari — har ikki (barcha) qatorda ko'rsatiladi
        $rowsBy = fn (string $field) => collect($normalized)->filter(fn ($r) => $r[$field] !== null)
            ->groupBy(fn ($r) => $this->key($r[$field]))->map(fn ($g) => $g->pluck('row')->all());
        $directorRows = $rowsBy('director_name');
        $phoneRows    = $rowsBy('director_phone');

        $seenNumber = [];
        $seenName   = [];

        // Rasmiy kod: fayl ichida va bazada (o'chirilmagan) yagona bo'lishi kerak — forma validatsiyasi bilan bir xil
        $codeRows = $rowsBy('official_code');
        $byCode   = $existing->filter(fn ($o) => $o->official_code && ! $o->deleted_at)->keyBy(fn ($o) => $this->key($o->official_code));

        foreach ($normalized as &$r) {
            $errors   = $r['errors'];
            $warnings = $r['warnings'];
            $issues   = $r['issues'];

            if (($r['official_code'] ?? null) !== null) {
                $codeKey = $this->key($r['official_code']);
                $others  = array_diff($codeRows[$codeKey] ?? [], [$r['row']]);
                if ($others) {
                    $this->note($errors, $warnings, $issues, 'error', 'official_code', "Fayl ichida takroriy rasmiy kod (" . implode(', ', $others) . "-qator bilan bir xil).");
                }
                if ($org = $byCode->get($codeKey)) {
                    $this->note($errors, $warnings, $issues, 'error', 'official_code', "Bu rasmiy kod bazadagi bog'chaga biriktirilgan (#{$org->id}: {$org->name}).");
                }
            }

            $numberKey   = $r['number'] !== null ? $this->key($r['number']) : null;
            $nameKey     = $r['name'] !== null ? $this->key($r['name']) : null;
            $numberMatch = null;

            if ($numberKey !== null) {
                if (isset($seenNumber[$numberKey])) {
                    $this->note($errors, $warnings, $issues, 'error', 'number', "Fayl ichida takroriy raqam ({$seenNumber[$numberKey]}-qator bilan bir xil).");
                } else {
                    $seenNumber[$numberKey] = $r['row'];
                }
                if ($org = $numberMatch = $byNumber->get($numberKey)) {
                    $this->note($errors, $warnings, $issues, 'error', 'number', $org->deleted_at
                        ? "Bu raqamli bog'cha avval o'chirilgan (#{$org->id}: {$org->name})."
                        : "Bu raqamli bog'cha allaqachon mavjud (#{$org->id}: {$org->name}).");
                }
            } else {
                $this->note($errors, $warnings, $issues, 'warning', 'number', "Raqami aniqlanmadi — takroriylikni faqat nom bo'yicha tekshirib bo'ladi.");
            }

            if ($nameKey !== null) {
                if (isset($seenName[$nameKey])) {
                    $this->note($errors, $warnings, $issues, 'warning', 'name', "Fayl ichida bir xil nom ({$seenName[$nameKey]}-qator bilan).");
                } else {
                    $seenName[$nameKey] = $r['row'];
                }
                if (($org = $byName->get($nameKey)) && $org->id !== $numberMatch?->id) {
                    $this->note($errors, $warnings, $issues, 'warning', 'name', "Shu nomli bog'cha bazada bor (#{$org->id}).");
                }
            }

            if ($r['director_name'] !== null) {
                $others = array_diff($directorRows[$this->key($r['director_name'])] ?? [], [$r['row']]);
                if ($others) {
                    $this->note($errors, $warnings, $issues, 'warning', 'director_name', "Rahbar F.I.Sh. " . implode(', ', $others) . "-qatordagi bilan bir xil — bitta shaxs ekanligi tasdiqlanmagan, bog'chalar alohida saqlanadi.");
                }
                if ($org = $byDirector->get($this->key($r['director_name']))) {
                    $this->note($errors, $warnings, $issues, 'warning', 'director_name', "Rahbar F.I.Sh. bazadagi bog'cha rahbari bilan bir xil (#{$org->id}: {$org->name}).");
                }
            }

            if ($r['director_phone'] !== null) {
                $others = array_diff($phoneRows[$this->key($r['director_phone'])] ?? [], [$r['row']]);
                if ($others) {
                    $this->note($errors, $warnings, $issues, 'warning', 'director_phone', "Rahbar telefoni " . implode(', ', $others) . "-qatordagi bilan bir xil.");
                }
                if ($org = $byPhone->get($r['director_phone'])) {
                    $this->note($errors, $warnings, $issues, 'warning', 'director_phone', "Rahbar telefoni boshqa bog'chada ham ko'rsatilgan (#{$org->id}: {$org->name}).");
                }
                if ($userPhones->has($r['director_phone'])) {
                    $this->note($errors, $warnings, $issues, 'warning', 'director_phone', "Bu telefon raqami tizimdagi foydalanuvchiga tegishli.");
                }
            }

            $r['errors']   = $errors;
            $r['warnings'] = $warnings;
            $r['issues']   = $issues;
            $r['status']   = $errors ? 'error' : ($warnings ? 'warning' : 'ok');
        }
        unset($r);

        $counts = array_count_values(array_column($normalized, 'status'));

        return [
            'rows'    => $normalized,
            'summary' => [
                'total'   => count($normalized),
                'ok'      => $counts['ok'] ?? 0,
                'warning' => $counts['warning'] ?? 0,
                'error'   => $counts['error'] ?? 0,
            ],
            'columns'    => $this->columnsReport(),
            // Faylda bitta xatoli qator bo'lsa ham import bloklanadi — faylni tuzatib qayta yuklash kerak
            'can_import' => ($counts['error'] ?? 0) === 0 && count($normalized) > 0,
        ];
    }

    /**
     * Faylni qayta o'qiydi (asl qiymatlar mijozdan emas, fayldan olinadi), tanlangan qatorlarni tekshiradi
     * va har birini alohida bog'cha (tenant) sifatida yaratadi — hammasi yoki hech biri.
     * Ogohlantirishli qator faqat $confirmedRows da bo'lsa qabul qilinadi.
     *
     * @param int[] $selectedRows Excel qator raqamlari
     * @param int[] $confirmedRows
     * @return array{created: array<int, array{id:int, name:string, row:int}>}|array{rejected: array<int, array<string, mixed>>}
     */
    public function import(string $path, string $extension, string $district, array $selectedRows, array $confirmedRows,
                           ?string $sourceFile, int $userId, ?string $ip, string $type = Organization::TYPE_DAVLAT, ?string $region = null): array
    {
        $selected  = array_flip($selectedRows);
        $all       = $this->parse($path, $extension);
        $totalRows = count($all);
        if (count(array_filter($all, fn ($r) => isset($selected[$r['row']]))) !== count($selected)) {
            throw new RuntimeException("Tanlangan qatorlar fayldagi qatorlarga mos kelmadi. Faylni qayta ko'rib chiqing.");
        }

        // Butun fayl preview'dagi kabi tekshiriladi (fayl ichidagi takrorlar ham). Bitta xatoli qator bo'lsa —
        // import to'liq bloklanadi: fayl tuzatilib qayta yuklanishi kerak.
        $full = $this->analyze($all, $district);
        $errorRows = array_values(array_filter($full['rows'], fn ($r) => $r['status'] === 'error'));
        if ($errorRows) {
            return ['rejected' => $errorRows, 'reason' => 'errors', 'summary' => $full['summary']];
        }

        $confirmed = array_flip($confirmedRows);
        $analysis  = ['rows' => array_values(array_filter($full['rows'], fn ($r) => isset($selected[$r['row']])))];

        $rejected = array_values(array_filter($analysis['rows'], fn ($r) => $r['status'] === 'warning' && ! isset($confirmed[$r['row']])));
        if ($rejected) {
            return ['rejected' => $rejected, 'reason' => 'unconfirmed', 'summary' => $full['summary']];
        }

        $district = $this->clean($district);

        $region  = $this->clean($region);
        $created = DB::transaction(function () use ($analysis, $district, $sourceFile, $userId, $ip, $type, $region) {
            $out = [];
            foreach ($analysis['rows'] as $r) {
                $org = Organization::create([
                    'name'           => $r['name'],
                    'type'           => $r['type'] ?? $type,
                    'official_code'  => $r['official_code'] ?? null,
                    'phone'          => null,
                    'address'        => $r['address'],
                    'region'         => $region,
                    'district'       => $district,
                    'number'         => $r['number'],
                    'mfy'            => $r['mfy'],
                    'capacity'       => $r['capacity'],
                    'director_name'  => $r['director_name'],
                    'director_phone' => $r['director_phone'],
                    // Excel'dagi asl qiymatlar — o'zgartirilmagan holda
                    'import_source'  => [
                        'file'     => $sourceFile,
                        'row'      => $r['row'],
                        'values'   => $r['source'],
                        'derived'  => $r['derived'],
                        'missing'  => $r['missing'],
                    ],
                    'is_active'      => true,
                ]);

                ActivityLog::record(
                    'organization.created',
                    "Yangi bog'cha yaratildi (Excel import): {$org->name}",
                    $userId,
                    $org->id,
                    ['org_name' => $org->name, 'type' => $org->type, 'source' => 'excel_import', 'file' => $sourceFile, 'row' => $r['row']],
                    $ip
                );

                $out[] = ['id' => $org->id, 'name' => $org->name, 'row' => $r['row']];
            }

            return $out;
        });

        return ['created' => $created, 'total_rows' => $totalRows];
    }

    /** @param array{row:int, input:array<string,mixed>, source?:array<string,string>} $r */
    private function normalizeRow(array $r): array
    {
        $in       = $r['input'] ?? [];
        $errors   = [];
        $warnings = [];
        $issues   = [];
        $derived  = [];

        $name = $this->clean($in['name'] ?? null);
        if ($name === null) {
            $this->note($errors, $warnings, $issues, 'error', 'name', "Muassasa nomi kiritilmagan.");
        } elseif (mb_strlen($name) > 255) {
            $this->note($errors, $warnings, $issues, 'error', 'name', "Muassasa nomi juda uzun (255 belgidan oshmasin).");
        }

        // Raqam: «Raqami» ustunidan, bo'lmasa nomdan («12-sonli DMTT» → 12)
        $columnNumber = $this->normalizeNumber($in['number'] ?? null);
        $nameNumber   = $name !== null ? $this->numberFromName($name) : null;
        $number       = $columnNumber ?? $nameNumber;
        if ($columnNumber === null && $nameNumber !== null) {
            $derived['number'] = 'name';
        }
        if ($columnNumber !== null && $nameNumber !== null && $columnNumber !== $nameNumber) {
            $this->note($errors, $warnings, $issues, 'warning', 'number', "«Raqami» ustunidagi qiymat ({$columnNumber}) nomdagi raqamdan ({$nameNumber}) farq qiladi.");
        }
        if ($number !== null && mb_strlen($number) > 20) {
            $this->note($errors, $warnings, $issues, 'error', 'number', "Raqam juda uzun.");
        }

        $address = $this->clean($in['address'] ?? null);

        // MFY: alohida ustundan, bo'lmasa manzildan («Kichiksoy MFY Obod ko'chasi» → «Kichiksoy MFY»)
        $mfy = $this->clean($in['mfy'] ?? null);
        if ($mfy === null && $address !== null && ($mfy = $this->mfyFromAddress($address)) !== null) {
            $derived['mfy'] = 'address';
        }

        $capacityRaw = $this->clean($in['capacity'] ?? null);
        $capacity    = null;
        if ($capacityRaw !== null) {
            $digits = preg_replace('/[\s\x{00A0}]/u', '', $capacityRaw);
            if (! preg_match('/^\d{1,5}$/', $digits) || (int) $digits < 1 || (int) $digits > 10000) {
                $this->note($errors, $warnings, $issues, 'error', 'capacity', "Quvvati musbat butun son bo'lishi kerak.");
            } else {
                $capacity = (int) $digits;
            }
        }

        $phoneRaw = $this->clean($in['director_phone'] ?? null);
        $phone    = null;
        if ($phoneRaw !== null) {
            $phone = $this->normalizePhone($phoneRaw);
            if ($phone === null) {
                $this->note($errors, $warnings, $issues, 'error', 'director_phone', "Rahbar telefon raqami noto'g'ri: +998XXXXXXXXX ko'rinishida bo'lsin.");
            }
        }

        $dirName = $this->clean($in['director_name'] ?? null);
        foreach ([['address', $address, 500, 'Manzil'], ['mfy', $mfy, 150, 'MFY nomi'], ['director_name', $dirName, 255, 'Rahbar F.I.Sh.']] as [$field, $v, $max, $label]) {
            if ($v !== null && mb_strlen($v) > $max) {
                $this->note($errors, $warnings, $issues, 'error', $field, "{$label} juda uzun ({$max} belgidan oshmasin).");
            }
        }

        // Rasmiy kod (ixtiyoriy ustun) — takrorlanishi analyze() da tekshiriladi
        $code = $this->clean($in['official_code'] ?? null);
        if ($code !== null && (mb_strlen($code) > 50 || ! preg_match('/^[\pL\pN\-\/. ]+$/u', $code))) {
            $this->note($errors, $warnings, $issues, 'error', 'official_code', "Rasmiy kod noto'g'ri: 50 belgigacha, faqat harf, raqam, «-», «/», «.» bo'lishi mumkin.");
        }

        // Tashkilot turi (ixtiyoriy ustun)
        $typeRaw = $this->clean($in['type'] ?? null);
        $type    = null;
        if ($typeRaw !== null) {
            $type = $this->normalizeType($typeRaw);
            if ($type === null) {
                $this->note($errors, $warnings, $issues, 'error', 'type', "Tashkilot turi noto'g'ri («{$typeRaw}»): «Davlat» yoki «Xususiy» bo'lsin.");
            }
        }

        $values = [
            'name'           => $name,
            'number'         => $number,
            'address'        => $address,
            'mfy'            => $mfy,
            'capacity'       => $capacity,
            'director_name'  => $dirName,
            'director_phone' => $phone,
        ];

        return [
            'row'      => (int) ($r['row'] ?? 0),
            ...$values,
            'input'    => array_map(fn ($v) => (string) ($v ?? ''), array_intersect_key($in, array_flip(self::FIELDS))),
            'source'   => array_map(fn ($v) => (string) ($v ?? ''), $r['source'] ?? []),
            'derived'  => $derived,
            // Faylda bo'lmagan ma'lumotlar — to'ldirilmaydi, faqat belgilanadi
            'type'     => $type,
            'official_code' => $code,
            'missing'  => array_keys(array_filter($values, fn ($v) => $v === null)),
            'errors'   => $errors,
            'warnings' => $warnings,
            'issues'   => $issues,
        ];
    }

    /** «Davlat», «DMTT», «давлат» → davlat; «Xususiy», «nodavlat», «хусусий» → xususiy; boshqasi — null. */
    private function normalizeType(string $v): ?string
    {
        $k = $this->key($v);
        return match (true) {
            in_array($k, ['davlat', 'давлат', 'государственный', 'dmtt', 'дмтт', 'davlat mtt'], true) => Organization::TYPE_DAVLAT,
            in_array($k, ['xususiy', 'хусусий', 'nodavlat', 'нодавлат', 'частный', 'xususiy mtt', 'nodavlat mtt'], true) => Organization::TYPE_XUSUSIY,
            default => null,
        };
    }

    /**
     * Xato/ogohlantirish: eski matnli ro'yxat (errors/warnings) va tuzilgan ro'yxat (issues) birga yuritiladi.
     * issues: daraja, maydon, Excel'dagi ustun nomi (faylda bo'lmasa — standart nom) va sabab.
     */
    private function note(array &$errors, array &$warnings, array &$issues, string $level, string $field, string $message): void
    {
        if ($level === 'error') {
            $errors[] = $message;
        } else {
            $warnings[] = $message;
        }
        $issues[] = [
            'level'   => $level,
            'field'   => $field,
            'column'  => $this->columnHeaders[$field] ?? (self::COLUMNS[$field][0] ?? $field),
            'message' => $message,
        ];
    }

    /** Preview uchun: har bir ustun — majburiy/ixtiyoriy va faylda topilgan sarlavha. */
    private function columnsReport(): array
    {
        return collect(self::COLUMNS)->map(fn ($c, $field) => [
            'field'    => $field,
            'label'    => $c[0],
            'required' => $c[1],
            'header'   => $this->columnHeaders[$field] ?? null,
        ])->values()->all();
    }

    /** «№ 12», «12-son», «12-sonli DMTT» → «12»; boshqa ko'rinishlar (12A) katta harfda saqlanadi. */
    private function normalizeNumber(mixed $v): ?string
    {
        $v = $this->clean($v);
        if ($v === null) {
            return null;
        }
        $v = preg_replace('/(№|#|-?\s*sonli|-?\s*son|dmtt|mtt)/iu', '', $v);
        $v = mb_strtoupper(preg_replace('/\s+/u', '', $v));

        return $v === '' ? null : (ltrim($v, '0') ?: '0');
    }

    /** «12-sonli DMTT», «12 sonli MTT», «DMTT № 12» → «12». */
    private function numberFromName(string $name): ?string
    {
        if (preg_match('/(?:^|\s)(\d+[A-Za-z]?)\s*-?\s*son/iu', $name, $m)
            || preg_match('/№\s*(\d+[A-Za-z]?)/u', $name, $m)) {
            return $this->normalizeNumber($m[1]);
        }

        return null;
    }

    /** Manzil boshidagi yoki verguldan keyingi «… MFY» qismi. */
    private function mfyFromAddress(string $address): ?string
    {
        return preg_match('/(?:^|,)\s*([^,]*?\S\s+MFY)(?=\s|,|$)/u', $address, $m) ? trim($m[1]) : null;
    }

    /** O'zbekiston raqamlari: 901234567, 99/050-56-24, 998901234567, +998 (90) 123-45-67 → +998901234567. */
    private function normalizePhone(string $v): ?string
    {
        $digits = preg_replace('/\D/', '', $v);
        if (strlen($digits) === 9) {
            $digits = '998' . $digits;
        }

        return preg_match('/^998\d{9}$/', $digits) ? '+' . $digits : null;
    }

    private function clean(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $v = trim(preg_replace('/[\s\x{00A0}]+/u', ' ', (string) $v));

        return $v === '' ? null : $v;
    }

    /** Solishtirish kaliti: kichik harf, apostrof turlari va ortiqcha bo'shliqlarsiz. */
    private function key(?string $v): string
    {
        $v = mb_strtolower((string) $v);
        $v = str_replace(['ʻ', 'ʼ', '‘', '’', '`', '´', "'"], '', $v);
        $v = preg_replace('/["«»“”]/u', '', $v);

        return trim(preg_replace('/\s+/u', ' ', $v));
    }

    /** @return array{0: ?int, 1: array<string, int>, 2: array<int, string>} sarlavha qatori, maydon → ustun, ustun → sarlavha */
    private function detectHeader(array $rows): array
    {
        foreach (array_slice($rows, 0, 10, true) as $i => $cells) {
            $map = [];
            foreach ($cells as $col => $cell) {
                $norm = preg_replace('/[^a-z0-9]/', '', str_replace(['ʻ', 'ʼ', '‘', '’', '`', "'"], '', mb_strtolower(trim((string) $cell))));
                foreach (self::HEADER_ALIASES as $field => $aliases) {
                    if (! isset($map[$field]) && in_array($norm, $aliases, true)) {
                        $map[$field] = $col;
                        break;
                    }
                }
            }
            if (isset($map['name'])) {
                $headers = [];
                foreach ($cells as $col => $cell) {
                    $h = $this->clean($cell);
                    if ($h === null) {
                        continue;
                    }
                    $headers[$col] = in_array($h, $headers, true) ? "{$h} (" . ($col + 1) . ")" : $h;
                }

                return [$i, $map, $headers];
            }
        }

        return [null, [], []];
    }
}
