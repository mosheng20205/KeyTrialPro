<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$adminId = (int) ($payload['sub'] ?? 0);

try {
    $app['adminAccountService']->changePassword(
        $adminId,
        (string) $request->input('currentPassword', ''),
        (string) $request->input('newPassword', '')
    );

    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? 'unknown'),
        'admin.account.change_password',
        'admin',
        (string) $adminId,
        null,
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['status' => 'updated']
    );

    api_ok(['status' => 'updated']);
} catch (\InvalidArgumentException $exception) {
    api_error($exception->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'PASSWORD_CHANGE_FAILED', 409);
}
