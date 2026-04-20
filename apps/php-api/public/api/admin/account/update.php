<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$adminId = (int) ($payload['sub'] ?? 0);

try {
    $profile = $app['adminAccountService']->updateProfile(
        $adminId,
        (string) $request->input('email', ''),
        (string) $request->input('displayName', ''),
        (bool) $request->input('mfaEnabled', false)
    );

    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? $profile['email']),
        'admin.account.update',
        'admin',
        (string) $adminId,
        null,
        $_SERVER['REMOTE_ADDR'] ?? null,
        [
            'email' => $profile['email'],
            'displayName' => $profile['displayName'],
            'mfaEnabled' => $profile['mfaEnabled'],
        ]
    );

    api_ok($profile);
} catch (\InvalidArgumentException $exception) {
    api_error($exception->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'ACCOUNT_UPDATE_FAILED', 409);
}
