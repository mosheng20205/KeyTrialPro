<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap/autoload.php';

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'name' => 'KeyTrialPro PHP API',
    'status' => 'ok',
    'time' => gmdate(DATE_ATOM),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

