<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$email = (string) $request->input('email', '');
$password = (string) $request->input('password', '');

if ($email === '' || $password === '') {
    api_error('email and password are required', 'VALIDATION_ERROR', 422);
}

$result = $app['adminAuthService']->attempt($email, $password);
if (!($result['authenticated'] ?? false)) {
    api_error('账号或密码错误', 'AUTH_FAILED', 401);
}

api_ok($result);