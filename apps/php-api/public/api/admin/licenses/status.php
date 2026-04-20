<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$licenseId = (int) $request->input('licenseId', 0);
$status = (string) $request->input('status', '');

if ($licenseId <= 0 || $status === '') {
    api_error('licenseId and status are required', 'VALIDATION_ERROR', 422);
}

try {
    $license = $app['licenseService']->updateStatus($licenseId, $status);
    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? 'unknown'),
        'license.status_update',
        'license',
        (string) $licenseId,
        (int) $license['product_id'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['status' => $license['status']]
    );

    api_ok($license);
} catch (\InvalidArgumentException $exception) {
    api_error($exception->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'NOT_FOUND', 404);
}
