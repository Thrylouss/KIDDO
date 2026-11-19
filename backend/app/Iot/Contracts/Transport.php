<?php

namespace App\Iot\Contracts;

/** Qurilma ma'lumotini qabul qilish usullari (provayder qo'llaganlari). */
enum Transport: string
{
    case HttpPush  = 'http_push';   // gateway → KIDDO autentifikatsiyalangan HTTP POST (hozir ishlaydi: /v1/iot/ingest)
    case RestPull  = 'rest_pull';   // KIDDO → vendor REST API (rasmiy hujjat kerak)
    case WebSocket = 'websocket';   // vendor real-time oqimi (rasmiy hujjat kerak)
    case Mqtt      = 'mqtt';        // broker orqali (rasmiy hujjat kerak)
}
