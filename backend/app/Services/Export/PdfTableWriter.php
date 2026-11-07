<?php

namespace App\Services\Export;

/**
 * Minimal PDF yozuvchi — tashqi kutubxonasiz. Landshaft A4, standart Helvetica shrifti (WinAnsi),
 * sarlavha qatorlari va avtomatik sahifalarga bo'linadigan jadval(lar).
 * Lotin o'zbek matni uchun yetarli; ʻ/ʼ kabi belgilar oddiy apostrofga almashtiriladi.
 */
class PdfTableWriter
{
    private const W = 842.0;   // A4 landshaft, pt
    private const H = 595.0;
    private const M = 24.0;    // chet

    /** @var string[] har bir sahifaning kontent oqimi */
    private array $pages = [];
    private string $page = '';
    private float $y = 0.0;

    public function __construct(private string $footer = '')
    {
        $this->newPage();
    }

    public function title(string $text, float $size = 14): self
    {
        $this->ensure($size + 6);
        $this->text(self::M, $this->y - $size, $text, $size, true);
        $this->y -= $size + 6;

        return $this;
    }

    public function line(string $text, float $size = 9): self
    {
        $this->ensure($size + 4);
        $this->text(self::M, $this->y - $size, $text, $size);
        $this->y -= $size + 4;

        return $this;
    }

    public function gap(float $h = 6): self
    {
        $this->y -= $h;

        return $this;
    }

    /**
     * @param string[]                     $header
     * @param array<int, array<int,string>> $rows
     * @param float[]                      $widths ustun kengliklari, pt (yig'indisi sahifa kengligidan oshmasin)
     * @param string[]                     $align  'L' | 'C' har bir ustun uchun
     */
    public function table(array $header, array $rows, array $widths, array $align = [], float $size = 7, float $rowH = 13): self
    {
        $drawHeader = function () use ($header, $widths, $align, $size, $rowH) {
            $x = self::M;
            $this->page .= sprintf("0.96 0.92 0.94 rg %.2F %.2F %.2F %.2F re f 0 g\n", $x, $this->y - $rowH, array_sum($widths), $rowH);
            foreach ($header as $i => $h) {
                $this->cell($x, $this->y, $widths[$i], $rowH, $h, $align[$i] ?? 'L', $size, true);
                $x += $widths[$i];
            }
            $this->y -= $rowH;
        };

        $this->ensure($rowH * 2);
        $drawHeader();
        foreach ($rows as $row) {
            if ($this->y - $rowH < self::M + 14) {
                $this->newPage();
                $drawHeader();
            }
            $x = self::M;
            foreach ($row as $i => $value) {
                $this->cell($x, $this->y, $widths[$i], $rowH, (string) $value, $align[$i] ?? 'L', $size, false);
                $x += $widths[$i];
            }
            $this->y -= $rowH;
        }

        return $this;
    }

    public function output(): string
    {
        $this->pages[] = $this->page;
        $count = count($this->pages);

        // 1 katalog, 2 sahifalar, 3-4 shriftlar, keyin har bir sahifa uchun (sahifa, kontent)
        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];
        for ($i = 0; $i < $count; $i++) {
            $kids[] = (5 + $i * 2) . ' 0 R';
        }
        $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $count . ' >>';
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

        foreach ($this->pages as $i => $content) {
            if ($this->footer !== '') {
                $content .= $this->textOp(self::M, 12, $this->footer . '   ' . ($i + 1) . '/' . $count, 7, false);
            }
            $pageObj = 5 + $i * 2;
            $objects[$pageObj] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0F %.0F] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>',
                self::W, self::H, $pageObj + 1
            );
            $objects[$pageObj + 1] = '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
        }

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        ksort($objects);
        foreach ($objects as $n => $body) {
            $offsets[$n] = strlen($pdf);
            $pdf .= $n . " 0 obj\n" . $body . "\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        foreach ($offsets as $off) {
            $pdf .= sprintf("%010d 00000 n \n", $off);
        }
        $pdf .= 'trailer << /Size ' . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF";

        return $pdf;
    }

    // ── Ichki ──────────────────────────────────────────────────────

    private function newPage(): void
    {
        if ($this->page !== '') {
            $this->pages[] = $this->page;
        }
        $this->page = "0.5 w 0.85 0.8 0.83 RG\n";
        $this->y = self::H - self::M;
    }

    private function ensure(float $h): void
    {
        if ($this->y - $h < self::M + 14) {
            $this->newPage();
        }
    }

    private function cell(float $x, float $top, float $w, float $h, string $text, string $align, float $size, bool $bold): void
    {
        $this->page .= sprintf("%.2F %.2F %.2F %.2F re S\n", $x, $top - $h, $w, $h);
        $text = $this->fit($text, $w - 4, $size);
        $tw = $this->width($text, $size);
        $tx = $align === 'C' ? $x + ($w - $tw) / 2 : $x + 2;
        $this->text($tx, $top - $h + ($h - $size) / 2 + 1.5, $text, $size, $bold);
    }

    private function text(float $x, float $y, string $text, float $size, bool $bold = false): void
    {
        $this->page .= $this->textOp($x, $y, $text, $size, $bold);
    }

    private function textOp(float $x, float $y, string $text, float $size, bool $bold): string
    {
        return sprintf("BT /%s %.1F Tf %.2F %.2F Td (%s) Tj ET\n", $bold ? 'F2' : 'F1', $size, $x, $y, $this->encode($text));
    }

    /** Matnni katakka sig'adigan qilib qisqartiradi. */
    private function fit(string $text, float $max, float $size): string
    {
        if ($this->width($text, $size) <= $max) {
            return $text;
        }
        while (mb_strlen($text) > 1 && $this->width($text . '…', $size) > $max) {
            $text = mb_substr($text, 0, -1);
        }

        return $text . '…';
    }

    /** Helvetica uchun taxminiy kenglik (o'rtacha 0.5 em, katta harflar kengroq). */
    private function width(string $text, float $size): float
    {
        $w = 0.0;
        foreach (mb_str_split($text) as $ch) {
            $w += match (true) {
                ctype_upper($ch), in_array($ch, ['m', 'w', 'M', 'W'], true) => 0.68,
                in_array($ch, ['i', 'l', 'j', '\'', '.', ',', ' ', 't', 'f', 'r'], true) => 0.3,
                default => 0.53,
            };
        }

        return $w * $size;
    }

    private function encode(string $text): string
    {
        $text = strtr($text, ['ʻ' => "'", 'ʼ' => "'", '‘' => "'", '’' => "'", '«' => '"', '»' => '"', '—' => '-', '–' => '-']);
        $win  = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        if ($win === false) {
            $win = preg_replace('/[^\x20-\x7E]/', '?', $text) ?? '';
        }

        return strtr($win, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)', "\r" => ' ', "\n" => ' ']);
    }
}
