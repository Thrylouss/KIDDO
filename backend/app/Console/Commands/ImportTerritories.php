<?php

namespace App\Console\Commands;

use App\Services\Import\SpreadsheetReader;
use App\Services\TerritoryDirectory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Hududiy ma'lumotnomani TASDIQLANGAN rasmiy manba faylidan yuklash (Viloyat, Tuman, MFY, ixtiyoriy Kod).
 * Standart holatda faqat tekshiradi; bazaga yozish uchun --apply kerak. Bog'chalar ma'lumotlari o'zgartirilmaydi.
 */
class ImportTerritories extends Command
{
    protected $signature = 'kiddo:territories:import
        {file : .xlsx yoki .csv fayl yo\'li}
        {--source= : Manba nomi (majburiy, masalan: rasmiy hujjat nomi va sanasi)}
        {--apply : Bazaga yozish (aks holda faqat tekshiruv)}';

    protected $description = "Hududiy ma'lumotnomani (viloyat/tuman/MFY) tasdiqlangan manbadan yuklaydi";

    public function handle(SpreadsheetReader $reader, TerritoryDirectory $directory): int
    {
        $source = trim((string) $this->option('source'));
        if ($source === '') {
            $this->error("--source majburiy: ma'lumotlar qaysi tasdiqlangan manbadan olinganini ko'rsating.");

            return self::FAILURE;
        }
        if (! Schema::hasTable('territories')) {
            $this->error("territories jadvali yo'q: avval migratsiyani bajaring.");

            return self::FAILURE;
        }

        $file = (string) $this->argument('file');
        if (! is_file($file)) {
            $this->error("Fayl topilmadi: {$file}");

            return self::FAILURE;
        }

        try {
            $rows = $reader->read($file, pathinfo($file, PATHINFO_EXTENSION));
            $result = $directory->importRows($rows, $source, basename($file), (bool) $this->option('apply'));
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        foreach ($result['errors'] as $e) {
            $this->warn($e);
        }
        $this->info("Viloyatlar: {$result['regions']}, tumanlar: {$result['districts']}, MFY: {$result['mfys']}");
        if (! $this->option('apply')) {
            $this->line("Tekshiruv rejimi — bazaga hech narsa yozilmadi. Yozish uchun --apply qo'shing.");
        } elseif ($result['errors']) {
            $this->error("Xatolar bor — hech narsa yozilmadi.");

            return self::FAILURE;
        } else {
            $this->info("Yozildi: yangi {$result['created']}, yangilangan {$result['existing']}.");
        }

        return self::SUCCESS;
    }
}
