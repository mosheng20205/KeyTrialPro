<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$productId = (int) $request->input('product_id', 0);
$licenseKey = (string) $request->input('license_key', '');

if ($productId <= 0 || $licenseKey === '') {
    api_error('product_id and license_key are required', 'VALIDATION_ERROR', 422);
}

$product = $app['productService']->byId($productId);
if ($product === null) {
    api_error('Product not found', 'NOT_FOUND', 404);
}

try {
    $license = $app['licenseService']->create([
        'product_id' => $productId,
        'license_key' => $licenseKey,
        'license_type' => (string) $request->input('license_type', 'standard'),
        'status' => (string) $request->input('status', 'active'),
        'max_bindings' => (int) $request->input('max_bindings', 1),
        'expires_at' => $request->input('expires_at') ?: null,
    ]);

    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? 'unknown'),
        'license.create',
        'license',
        (string) ($license['id'] ?? ''),
        $productId,
        $_SERVER['REMOTE_ADDR'] ?? null,
        [
            'licenseKey' => $license['license_key'] ?? $licenseKey,
            'status' => $license['status'] ?? 'active',
        ]
    );

    api_ok(['license' => $license]);
} catch (\InvalidArgumentException $e) {
    api_error($e->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\RuntimeException $e) {
    api_error($e->getMessage(), 'CONFLICT', 409);
}
