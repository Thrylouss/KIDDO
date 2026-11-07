<?php

namespace Tests\Support;

use Illuminate\Http\UploadedFile;

/**
 * GD kengaytmasisiz haqiqiy PNG fayllari (test konteynerida gd yo'q).
 * Fayl mazmuni to'g'ri PNG — finfo uni image/png deb aniqlaydi, getimagesize o'lchamini o'qiydi.
 */
trait TestImages
{
    protected function pngUpload(int $width = 128, int $height = 128, string $name = 'rasm.png'): UploadedFile
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));

        $raw = '';
        for ($y = 0; $y < $height; $y++) {
            $raw .= "\0" . str_repeat("\x8E\x31\x5D", $width); // Berry Pink, filtr yo'q
        }

        $png = "\x89PNG\r\n\x1a\n"
            . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
            . $chunk('IDAT', gzcompress($raw))
            . $chunk('IEND', '');

        $path = tempnam(sys_get_temp_dir(), 'png');
        file_put_contents($path, $png);

        return new UploadedFile($path, $name, 'image/png', null, true);
    }

    /** Kengaytmasi .jpg, lekin mazmuni oddiy matn. */
    protected function fakeJpgText(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'txt');
        file_put_contents($path, "<?php echo 'bu rasm emas'; ?>");

        return new UploadedFile($path, 'rasm.jpg', 'image/jpeg', null, true);
    }
}
