<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();

AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$productCode = (string) $request->input('product_code', '');
$name = (string) $request->input('name', '');

if ($productCode === '' || $name === '') {
    api_error('product_code and name are required', 'VALIDATION_ERROR', 422);
}

try {
    $product = $app['productService']->create([
        'product_code' => $productCode,
        'name' => $name,
        'client_app_key' => (string) $request->input('client_app_key', ''),
        'trial_enabled' => $request->input('trial_enabled', true),
        'trial_duration_minutes' => (int) $request->input('trial_duration_minutes', 60),
        'heartbeat_interval_seconds' => (int) $request->input('heartbeat_interval_seconds', 180),
        'offline_grace_minutes' => (int) $request->input('offline_grace_minutes', 5),
        'status' => (string) $request->input('status', 'active'),
    ]);

    $app['policyService']->save($product, [
        'trialEnabled' => $request->input('trial_enabled', true),
        'trialDurationMinutes' => (int) ($product['trial_duration_minutes'] ?? 60),
        'heartbeatIntervalSeconds' => (int) ($product['heartbeat_interval_seconds'] ?? 180),
        'offlineGraceMinutes' => (int) ($product['offline_grace_minutes'] ?? 5),
        'maxRebindCount' => 3,
        'degradeMode' => 'read_only',
        'policyCode' => 'default',
        'licenseType' => 'standard',
        'maxBindings' => 1,
        'rebindLimit' => 3,
        'requiresManualReviewAfterLimit' => true,
    ]);

    $app['securityProfileService']->save($product, [
        'machineBindingMode' => 'strict',
        'antiDebugEnabled' => true,
        'antiVmEnabled' => true,
        'hookDetectionEnabled' => true,
        'challengeFailTolerance' => 3,
    ]);

    api_ok(['product' => $product]);
} catch (\InvalidArgumentException $e) {
    api_error($e->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $e) {
    api_error($e->getMessage(), 'CONFLICT', 409);
}
