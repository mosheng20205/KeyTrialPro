<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineId = (string) $request->input('machineId', '');
$machineFingerprint = (array) $request->input('machineFingerprint', []);

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

if ($machineId === '') {
    if ($machineFingerprint === []) {
        api_error('machineId or machineFingerprint is required', 'VALIDATION_ERROR', 422);
    }

    $summary = $app['fingerprintService']->summarize($machineFingerprint);
    $machineId = $summary['machineHash'];
}

api_verify_client_signature($app, $request, $product, '');

$app['licenseService']->unregisterPresence(
    (int) $product['id'],
    $machineId,
    $_SERVER['REMOTE_ADDR'] ?? null
);

api_ok([
    'status' => 'offline',
    'online' => false,
]);
