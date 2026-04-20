<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();

AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

api_ok($app['productService']->all());

