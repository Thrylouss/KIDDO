<?php

namespace App\Services\Export;

use RuntimeException;
use ZipArchive;

/**
 * Minimal XLSX (Office Open XML) yozuvchi — tashqi kutubxonasiz, PHP zip kengaytmasi orqali.
 * Faqat matn/son kataklari, qalin sarlavha uslubi, ustun kengligi va bir nechta varaq.
 */
class XlsxWriter
{
    /** @var array<int, array{name:string, rows:array<int, array<int, string|int|null>>, bold_rows:array<int,bool>, widths:array<int,float>}> */
    private array $sheets = [];

    /**
     * @param array<int, array<int, string|int|null>> $rows
     * @param int[]   $boldRows 0 dan boshlanadigan qator raqamlari
     * @param float[] $widths   ustun kengliklari (belgilarda)
     */
    public function addSheet(string $name, array $rows, array $boldRows = [], array $widths = []): self
    {
        $this->sheets[] = [
            'name'      => mb_substr(preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $name), 0, 31),
            'rows'      => $rows,
            'bold_rows' => array_fill_keys($boldRows, true),
            'widths'    => $widths,
        ];

        return $this;
    }

    /** XLSX faylini vaqtinchalik joyga yozadi va yo'lini qaytaradi. */
    public function save(): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('PHP zip kengaytmasi topilmadi.');
        }

        $path = tempnam(sys_get_temp_dir(), 'kiddo-xlsx-');
        $zip  = new ZipArchive();
        if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('XLSX faylini yaratib bo\'lmadi.');
        }

        $sheetCount = count($this->sheets);
        $zip->addFromString('[Content_Types].xml', $this->contentTypes($sheetCount));
        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>');
        $zip->addFromString('xl/workbook.xml', $this->workbook());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRels($sheetCount));
        $zip->addFromString('xl/styles.xml', $this->styles());
        foreach ($this->sheets as $i => $sheet) {
            $zip->addFromString('xl/worksheets/sheet' . ($i + 1) . '.xml', $this->sheet($sheet));
        }
        $zip->close();

        return $path;
    }

    private function contentTypes(int $count): string
    {
        $sheets = '';
        for ($i = 1; $i <= $count; $i++) {
            $sheets .= '<Override PartName="/xl/worksheets/sheet' . $i . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . $sheets . '</Types>';
    }

    private function workbook(): string
    {
        $sheets = '';
        foreach ($this->sheets as $i => $sheet) {
            $sheets .= '<sheet name="' . $this->esc($sheet['name']) . '" sheetId="' . ($i + 1) . '" r:id="rId' . ($i + 1) . '"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets>' . $sheets . '</sheets></workbook>';
    }

    private function workbookRels(int $count): string
    {
        $rels = '';
        for ($i = 1; $i <= $count; $i++) {
            $rels .= '<Relationship Id="rId' . $i . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $i . '.xml"/>';
        }
        $rels .= '<Relationship Id="rId' . ($count + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $rels . '</Relationships>';
    }

    /** 0 — oddiy, 1 — qalin. */
    private function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            . '</styleSheet>';
    }

    private function sheet(array $sheet): string
    {
        $cols = '';
        foreach ($sheet['widths'] as $i => $w) {
            $n = $i + 1;
            $cols .= '<col min="' . $n . '" max="' . $n . '" width="' . $w . '" customWidth="1"/>';
        }

        $rows = '';
        foreach ($sheet['rows'] as $r => $row) {
            $style = isset($sheet['bold_rows'][$r]) ? ' s="1"' : '';
            $cells = '';
            foreach (array_values($row) as $c => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $ref = $this->column($c) . ($r + 1);
                $cells .= is_int($value)
                    ? '<c r="' . $ref . '"' . $style . '><v>' . $value . '</v></c>'
                    : '<c r="' . $ref . '"' . $style . ' t="inlineStr"><is><t xml:space="preserve">' . $this->esc((string) $value) . '</t></is></c>';
            }
            $rows .= '<row r="' . ($r + 1) . '">' . $cells . '</row>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . ($cols ? '<cols>' . $cols . '</cols>' : '')
            . '<sheetData>' . $rows . '</sheetData></worksheet>';
    }

    /** 0 → A, 25 → Z, 26 → AA */
    private function column(int $index): string
    {
        $name = '';
        for ($n = $index + 1; $n > 0; $n = intdiv($n - 1, 26)) {
            $name = chr(65 + ($n - 1) % 26) . $name;
        }

        return $name;
    }

    private function esc(string $value): string
    {
        // XML 1.0 da ruxsat etilmagan boshqaruv belgilari olib tashlanadi
        $value = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $value) ?? '';

        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
