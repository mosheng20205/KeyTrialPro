<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineFingerprint = (array) $request->input('machineContext', []);

if ($productCode === '') {
    api_error('productId is required', 'VALIDATION_ERROR', 422);
}

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

$summary = $app['fingerprintService']->summarize($machineFingerprint);
api_verify_client_signature($app, $request, $product, $summary['signatureSubject']);
$challenge = $app['licenseService']->issueChallenge($productCode, $summary['machineHash'], $summary['signatureSubject']);

api_ok($challenge);
