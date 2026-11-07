<?php

namespace App\Services\Import;

use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

/**
 * Minimal XLSX/CSV o'quvchi — tashqi kutubxonasiz (XlsxWriter juftligi).
 * Faqat birinchi varaqning qiymatlari o'qiladi: formulalar, uslublar va rasmlar e'tiborsiz.
 * Katak qiymatlari o'zgartirilmasdan (probellari bilan) qaytariladi.
 */
class SpreadsheetReader
{
    /** Siqilmagan XML uchun yuqori chegara (zip-bomba himoyasi). */
    private const MAX_XML_BYTES = 20 * 1024 * 1024;

    /** @return array<int, array<int, string>> qatorlar, har biri 0 dan indekslangan kataklar */
    public function read(string $path, string $extension): array
    {
        return match (strtolower($extension)) {
            'xlsx'        => $this->readXlsx($path),
            'csv', 'txt'  => $this->readCsv($path),
            default       => throw new RuntimeException("Fayl turi qo'llab-quvvatlanmaydi."),
        };
    }

    private function readXlsx(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException("Excel faylini ochib bo'lmadi.");
        }

        try {
            $shared = [];
            if (($xml = $this->entry($zip, 'xl/sharedStrings.xml')) !== null) {
                foreach ($xml->si as $si) {
                    $shared[] = $this->text($si);
                }
            }

            $sheet = $this->entry($zip, $this->firstSheetPath($zip))
                ?? throw new RuntimeException("Excel faylida varaq topilmadi.");

            $rows = [];
            foreach ($sheet->sheetData->row ?? [] as $row) {
                // Excel bo'sh qatorlarni yozmaydi — qator raqami (r) bo'yicha joylashtiriladi,
                // shunda xabarlardagi qator raqamlari Excel'dagi bilan bir xil bo'ladi
                $r = (int) $row['r'];
                while ($r > 0 && count($rows) < $r - 1) {
                    $rows[] = [];
                }
                $cells = [];
                $next  = 0;
                foreach ($row->c as $c) {
                    $ref = (string) $c['r'];
                    $col = $ref !== '' ? $this->columnIndex($ref) : $next;
                    $next = $col + 1;

                    $type  = (string) $c['t'];
                    $value = match ($type) {
                        's'         => $shared[(int) $c->v] ?? '',
                        'inlineStr' => $this->text($c->is),
                        'b'         => ((string) $c->v) === '1' ? '1' : '0',
                        default     => $this->number((string) $c->v),
                    };
                    $cells[$col] = $value; // asl qiymat — tozalash servisda
                }
                if ($cells) {
                    $max  = max(array_keys($cells));
                    $rows[] = array_replace(array_fill(0, $max + 1, ''), $cells);
                } else {
                    $rows[] = [];
                }
            }

            return $rows;
        } finally {
            $zip->close();
        }
    }

    /** workbook.xml dagi birinchi varaq fayli (odatda xl/worksheets/sheet1.xml). */
    private function firstSheetPath(ZipArchive $zip): string
    {
        $workbook = $this->entry($zip, 'xl/workbook.xml');
        $rels     = $this->entry($zip, 'xl/_rels/workbook.xml.rels');
        if ($workbook && $rels && isset($workbook->sheets->sheet[0])) {
            $rid = (string) $workbook->sheets->sheet[0]->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
            foreach ($rels->Relationship as $rel) {
                if ((string) $rel['Id'] === $rid) {
                    $target = ltrim((string) $rel['Target'], '/');
                    return str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
                }
            }
        }

        return 'xl/worksheets/sheet1.xml';
    }

    private function entry(ZipArchive $zip, string $name): ?SimpleXMLElement
    {
        $stat = $zip->statName($name);
        if ($stat === false) {
            return null;
        }
        if ($stat['size'] > self::MAX_XML_BYTES) {
            throw new RuntimeException("Excel fayli juda katta.");
        }

        $content = $zip->getFromName($name);
        // LIBXML_NONET — tashqi resurslar yuklanmaydi; entity almashtirish yoqilmagan (XXE yo'q)
        $xml = $content === false ? false : simplexml_load_string($content, SimpleXMLElement::class, LIBXML_NONET);
        if ($xml === false) {
            throw new RuntimeException("Excel fayli buzilgan.");
        }

        return $xml;
    }

    /** <si>/<is> ichidagi oddiy (<t>) yoki boyitilgan (<r><t>) matn. */
    private function text(?SimpleXMLElement $node): string
    {
        if ($node === null) {
            return '';
        }
        if (isset($node->t)) {
            return (string) $node->t;
        }
        $out = '';
        foreach ($node->r as $r) {
            $out .= (string) $r->t;
        }

        return $out;
    }

    /** Excel telefon/raqamlarni 9.98901234567E+11 ko'rinishida saqlashi mumkin. */
    private function number(string $v): string
    {
        if (preg_match('/^-?\d+(\.\d+)?E[+-]?\d+$/i', $v)) {
            return sprintf('%.0f', (float) $v);
        }
        if (preg_match('/^-?\d+\.0+$/', $v)) {
            return explode('.', $v)[0];
        }

        return $v;
    }

    private function columnIndex(string $ref): int
    {
        $letters = preg_replace('/\d+/', '', strtoupper($ref));
        $n = 0;
        foreach (str_split($letters) as $ch) {
            $n = $n * 26 + (ord($ch) - 64);
        }

        return $n - 1;
    }

    private function readCsv(string $path): array
    {
        $content = file_get_contents($path);
        if ($content === false) {
            throw new RuntimeException("Faylni o'qib bo'lmadi.");
        }
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        if (! mb_check_encoding($content, 'UTF-8')) {
            // Excel'dan "CSV" sifatida saqlangan Windows-1251/1252 fayllar
            $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1251');
        }

        $first     = strtok($content, "\n") ?: '';
        $delimiter = collect([';', ',', "\t"])->sortByDesc(fn ($d) => substr_count($first, $d))->first();

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $content);
        rewind($stream);
        $rows = [];
        while (($row = fgetcsv($stream, 0, $delimiter, '"', '')) !== false) {
            $rows[] = array_map(fn ($v) => (string) $v, $row);
        }
        fclose($stream);

        return $rows;
    }
}
