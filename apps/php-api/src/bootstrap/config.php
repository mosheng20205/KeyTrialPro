<?php

declare(strict_types=1);

namespace KeyTrialPro\bootstrap;

use KeyTrialPro\shared\Support\Env;

final class config
{
    public static function load(): array
    {
        return [
            'app' => [
                'env' => Env::get('APP_ENV', 'production'),
                'url' => Env::get('APP_URL', 'https://localhost'),
            ],
            'db' => [
                'host' => Env::get('DB_HOST', '127.0.0.1'),
                'port' => (int) Env::get('DB_PORT', '3306'),
                'name' => Env::get('DB_NAME', 'keytrialpro'),
                'user' => Env::get('DB_USER', 'root'),
                'password' => Env::get('DB_PASSWORD', ''),
                'charset' => Env::get('DB_CHARSET', 'utf8mb4'),
            ],
            'redis' => [
                'host' => Env::get('REDIS_HOST', '127.0.0.1'),
                'port' => (int) Env::get('REDIS_PORT', '6379'),
            ],
            'security' => [
                'apiHmacKey' => Env::get('API_HMAC_KEY', 'dev-key'),
                'dataEncryptionKey' => Env::get('DATA_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef'),
                'adminJwtSecret' => Env::get('ADMIN_JWT_SECRET', 'dev-jwt-secret'),
                'tlsPinsetSha256' => Env::get('TLS_PINSET_SHA256', ''),
            ],
            'presence' => [
                'windowSeconds' => (int) Env::get('PRESENCE_WINDOW_SECONDS', '300'),
            ],
            'trial' => [
                'heartbeatSeconds' => (int) Env::get('TRIAL_DEFAULT_HEARTBEAT_SECONDS', '180'),
                'offlineGraceMinutes' => (int) Env::get('TRIAL_DEFAULT_OFFLINE_GRACE_MINUTES', '5'),
            ],
        ];
    }
}

