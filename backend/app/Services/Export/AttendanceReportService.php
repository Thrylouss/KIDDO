<?php

namespace App\Services\Export;

use Carbon\CarbonImmutable;

/**
 * Oylik davomat hisoboti (AttendanceService::month() natijasidan) — Excel (.xlsx) va PDF.
 * Belgilar: + keldi, - kelmadi, S sababli, bo'sh — belgilanmagan; dam olish kunlari "·".
 */
class AttendanceReportService
{
    public const MARKS = ['present' => '+', 'absent' => '-', 'excused' => 'S'];

    public const REASONS = ['kasallik' => 'Kasallik', 'oilaviy' => 'Oilaviy sabab', 'boshqa' => 'Boshqa'];

    private const MONTHS = [1 => 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

    public function filename(array $month, string $ext): string
    {
        $group = preg_replace('/[^A-Za-z0-9_-]+/', '-', $this->ascii($month['group']['name'])) ?: 'guruh';

        return "davomat-{$group}-{$month['month']}.{$ext}";
    }

    /** XLSX faylining vaqtinchalik yo'li. */
    public function xlsx(array $month): string
    {
        $days = $month['days'];
        $header = array_merge(['№', 'F.I.Sh.'], array_map(fn ($d) => (string) $d['day'], $days), ['Keldi', 'Kelmadi', 'Sababli', 'Belgilanmagan']);

        $rows = [
            ["Bog'cha: " . ($month['organization']['name'] ?? '')],
            ['Guruh: ' . $month['group']['name']],
            ['Tarbiyachi: ' . $this->teachers($month)],
            ['Hisobot oyi: ' . $this->monthLabel($month['month']) . ' (' . $month['from'] . ' — ' . $month['to'] . ')'],
            ['Belgilar: + keldi, - kelmadi, S sababli, bo\'sh — belgilanmagan, · dam olish kuni'],
            [],
            $header,
        ];

        foreach ($month['children'] as $i => $child) {
            $rows[] = array_merge(
                [$i + 1, $this->name($child)],
                $this->marks($child, $days),
                [$child['totals']['present'], $child['totals']['absent'], $child['totals']['excused'], $child['totals']['unmarked']]
            );
        }

        $t = $month['totals'];
        $rows[] = array_merge(['', 'Guruh bo\'yicha jami'], array_fill(0, count($days), ''), [$t['present'], $t['absent'], $t['excused'], $t['unmarked']]);
        $rows[] = [];
        $rows[] = ['Ish kunlari: ' . $t['working_days']];

        $widths = array_merge([5, 28], array_fill(0, count($days), 4), [8, 9, 9, 14]);

        $notes = [['Sana', 'Bola', 'Sabab', 'Izoh']];
        foreach ($month['excused_notes'] as $n) {
            $notes[] = [$n['date'], $n['child_name'], self::REASONS[$n['reason']] ?? '', $n['note'] ?? ''];
        }

        return (new XlsxWriter())
            ->addSheet('Davomat', $rows, [0, 6, count($rows) - 3], $widths)
            ->addSheet('Sababli izohlar', $notes, [0], [12, 28, 16, 60])
            ->save();
    }

    public function pdf(array $month): string
    {
        $days  = $month['days'];
        $nameW = 130.0;
        $totW  = 34.0;
        $dayW  = min(18.0, (842 - 48 - 22 - $nameW - $totW * 4) / max(count($days), 1));

        $pdf = new PdfTableWriter('KIDDO — ' . ($month['organization']['name'] ?? '') . ', ' . $month['group']['name'] . ', ' . $this->monthLabel($month['month']));
        $pdf->title('Oylik davomat hisoboti')
            ->line("Bog'cha: " . ($month['organization']['name'] ?? ''))
            ->line('Guruh: ' . $month['group']['name'])
            ->line('Tarbiyachi: ' . $this->teachers($month))
            ->line('Hisobot oyi: ' . $this->monthLabel($month['month']) . ' (' . $month['from'] . ' — ' . $month['to'] . ')')
            ->line('Belgilar: + keldi, - kelmadi, S sababli, bo\'sh — belgilanmagan, · dam olish kuni', 8)
            ->gap();

        $header = array_merge(['№', 'F.I.Sh.'], array_map(fn ($d) => (string) $d['day'], $days), ['Keldi', 'Kelmadi', 'Sababli', 'Belg.']);
        $rows = [];
        foreach ($month['children'] as $i => $child) {
            $rows[] = array_merge(
                [(string) ($i + 1), $this->name($child)],
                $this->marks($child, $days),
                array_map('strval', [$child['totals']['present'], $child['totals']['absent'], $child['totals']['excused'], $child['totals']['unmarked']])
            );
        }
        $t = $month['totals'];
        $rows[] = array_merge(['', 'Jami'], array_fill(0, count($days), ''), array_map('strval', [$t['present'], $t['absent'], $t['excused'], $t['unmarked']]));

        $widths = array_merge([22.0, $nameW], array_fill(0, count($days), $dayW), array_fill(0, 4, $totW));
        $align  = array_merge(['C', 'L'], array_fill(0, count($days) + 4, 'C'));
        $pdf->table($header, $rows, $widths, $align);

        $pdf->gap(10)->line('Ish kunlari: ' . $t['working_days'] . '. Guruh bo\'yicha: keldi ' . $t['present'] . ', kelmadi ' . $t['absent'] . ', sababli ' . $t['excused'] . ', belgilanmagan ' . $t['unmarked'] . '.');

        if ($month['excused_notes'] !== []) {
            $pdf->gap(8)->title('Sababli kelmaganlik izohlari', 11);
            $noteRows = array_map(fn ($n) => [$n['date'], $n['child_name'], self::REASONS[$n['reason']] ?? '', (string) ($n['note'] ?? '')], $month['excused_notes']);
            $pdf->table(['Sana', 'Bola', 'Sabab', 'Izoh'], $noteRows, [70, 150, 90, 484], ['C', 'L', 'L', 'L'], 8, 14);
        }

        return $pdf->output();
    }

    private function teachers(array $month): string
    {
        return ($month['teachers'] ?? []) === [] ? '—' : implode(', ', $month['teachers']);
    }

    /** @return string[] */
    private function marks(array $child, array $days): array
    {
        $cells = (array) $child['days'];

        return array_map(function ($d) use ($cells) {
            $status = $cells[$d['date']]['status'] ?? null;

            return $status ? self::MARKS[$status] : ($d['weekend'] ? '·' : '');
        }, $days);
    }

    private function name(array $child): string
    {
        return trim($child['last_name'] . ' ' . $child['first_name'] . ' ' . ($child['middle_name'] ?? ''));
    }

    private function monthLabel(string $ym): string
    {
        $d = CarbonImmutable::createFromFormat('!Y-m', $ym);

        return self::MONTHS[$d->month] . ' ' . $d->year;
    }

    private function ascii(string $s): string
    {
        return (string) (@iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s);
    }
}
