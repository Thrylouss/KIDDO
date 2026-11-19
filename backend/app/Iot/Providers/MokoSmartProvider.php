<?php

namespace App\Iot\Providers;

/** MOKOSmart adapteri — interfeys tayyor, implementatsiya rasmiy hujjat va kalitlar olingach. */
class MokoSmartProvider extends VendorProvider
{
    public function key(): string
    {
        return 'mokosmart';
    }

    public function label(): string
    {
        return 'MOKOSmart';
    }
}
