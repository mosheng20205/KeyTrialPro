<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$date = $argv[1] ?? null;

$result = $app['statsService']->aggregateDailyStats($date);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

