<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$request = api_request();
$productCode = (string) $request->input('productId', '');

if ($productCode === '') {
    api_error('productId is required', 'VALIDATION_ERROR', 422);
}

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

$serverUrl = (string) ($app['config']['app']['url'] ?? '');
$certPins = (string) ($app['config']['security']['tlsPinsetSha256'] ?? '');

api_ok([
    'productId' => (int) $product['id'],
    'productCode' => (string) $product['product_code'],
    'productName' => (string) $product['name'],
    'clientAppKey' => (string) $product['client_app_key'],
    'serverUrl' => $serverUrl,
    'certPins' => $certPins,
    'trialEnabled' => (int) ($product['trial_duration_minutes'] ?? 0) > 0,
    'sdkParameters' => [
        'product_code' => (string) $product['product_code'],
        'server_url' => $serverUrl,
        'client_app_key' => (string) $product['client_app_key'],
        'cert_pins' => $certPins,
    ],
]);
