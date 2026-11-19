<?php

namespace App\Iot\Providers;

/** BlueIOT adapteri — interfeys tayyor, implementatsiya rasmiy hujjat va kalitlar olingach. */
class BlueIotProvider extends VendorProvider
{
    public function key(): string
    {
        return 'blueiot';
    }

    public function label(): string
    {
        return 'BlueIOT';
    }
}
