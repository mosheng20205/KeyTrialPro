<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$profile = $app['adminAccountService']->getProfile((int) ($payload['sub'] ?? 0));

if ($profile === null) {
    api_error('Administrator account not found.', 'ADMIN_NOT_FOUND', 404);
}

api_ok($profile);
