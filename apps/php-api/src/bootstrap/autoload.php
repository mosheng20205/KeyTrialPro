<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/Support/Env.php';

KeyTrialPro\shared\Support\Env::loadFile(dirname(__DIR__, 2) . '/.env');

spl_autoload_register(static function (string $class): void {
    $prefix = 'KeyTrialPro\\';
    $baseDir = __DIR__ . '/../';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = $baseDir . str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';

    if (is_file($path)) {
        require_once $path;
    }
});
