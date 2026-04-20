<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$email = (string) $request->input('email', '');
$code = (string) $request->input('code', '');

if ($email === '' || $code === '') {
    api_error('email and code are required', 'VALIDATION_ERROR', 422);
}

try {
    $result = $app['adminAuthService']->verifyMfa($email, $code);
    $app['auditService']->log(
        'admin',
        $email,
        'admin.mfa_verify',
        'admin_session',
        $email,
        null,
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['status' => 'verified']
    );
    api_ok($result);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'AUTH_MFA_FAILED', 401);
}
