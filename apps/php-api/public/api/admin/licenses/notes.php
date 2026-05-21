<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$licenseId = (int) $request->input('licenseId', 0);
$notes = (string) $request->input('notes', '');

if ($licenseId <= 0) {
    api_error('licenseId is required', 'VALIDATION_ERROR', 422);
}

try {
    $license = $app['licenseService']->updateNotes($licenseId, $notes);
    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? 'unknown'),
        'license.notes_update',
        'license',
        (string) $licenseId,
        (int) $license['product_id'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['notes' => $license['notes']]
    );

    api_ok($license);
} catch (\InvalidArgumentException $exception) {
    api_error($exception->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'NOT_FOUND', 404);
}
