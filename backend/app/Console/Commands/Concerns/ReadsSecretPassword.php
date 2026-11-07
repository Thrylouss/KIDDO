<?php

namespace App\Console\Commands\Concerns;

/** Parolni xavfsiz o'qish: stdin (--password-stdin) yoki yashirin so'rov. Qiymat hech qachon chiqarilmaydi. */
trait ReadsSecretPassword
{
    private const MIN_PASSWORD_LENGTH = 12;

    private function readPassword(): ?string
    {
        if ($this->option('password-stdin')) {
            $line     = fgets(STDIN);
            $password = $line === false ? '' : rtrim($line, "\r\n");
        } else {
            $password = (string) $this->secret('Parol (kamida ' . self::MIN_PASSWORD_LENGTH . ' belgi)');
            if ($password !== (string) $this->secret('Parolni takrorlang')) {
                $this->error('Parollar mos kelmadi.');
                return null;
            }
        }

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $this->error('Parol kamida ' . self::MIN_PASSWORD_LENGTH . ' belgidan iborat bo\'lishi kerak.');
            return null;
        }

        return $password;
    }

    private function validPhone(string $phone): bool
    {
        if (! preg_match('/^\+998\d{9}$/', $phone)) {
            $this->error('Telefon raqami +998XXXXXXXXX ko\'rinishida bo\'lsin.');
            return false;
        }

        return true;
    }
}
