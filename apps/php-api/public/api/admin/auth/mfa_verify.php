<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$challengeToken = (string) $request->input('challengeToken', '');
$code = (string) $request->input('mfaCode', $request->input('code', ''));
$email = strtolower(trim((string) $request->input('email', '')));

if ($challengeToken !== '') {
    $challengePayload = \KeyTrialPro\shared\Security\AdminTokenGuard::validate(
        $challengeToken,
        $app['config']['security']['adminJwtSecret']
    );

    if ($challengePayload === null || ($challengePayload['scope'] ?? '') !== 'mfa_challenge') {
        api_error('MFA challenge token is invalid or expired.', 'AUTH_MFA_CHALLENGE_INVALID', 401);
    }

    $email = strtolower(trim((string) ($challengePayload['email'] ?? '')));
}

if ($email === '' || $code === '') {
    api_error('email and MFA code are required', 'VALIDATION_ERROR', 422);
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
