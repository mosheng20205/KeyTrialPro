<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();

AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$licenseId = (int) $request->input('licenseId', 0);
if ($licenseId <= 0) {
    api_error('licenseId is required', 'VALIDATION_ERROR', 422);
}

$page = (int) $request->input('page', 1);
$pageSize = (int) $request->input('pageSize', 20);

api_ok($app['licenseService']->logs($licenseId, $page, $pageSize));
