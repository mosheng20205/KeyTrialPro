<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineId = (string) $request->input('machineId', '');
$machineFingerprint = (array) $request->input('machineFingerprint', []);

if ($machineId === '' && $machineFingerprint !== []) {
    $summary = $app['fingerprintService']->summarize($machineFingerprint);
    $machineId = $summary['machineHash'];
}

if ($machineId === '') {
    api_error('machineId or machineFingerprint is required', 'VALIDATION_ERROR', 422);
}

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

$signatureSubject = $machineId;
if ($machineFingerprint !== []) {
    $signatureSubject = $app['fingerprintService']->summarize($machineFingerprint)['signatureSubject'];
}

api_verify_client_signature($app, $request, $product, $signatureSubject);

$trialStatus = $app['licenseService']->trialStatus($productCode, $machineId);
if ($trialStatus === null) {
    api_error('Trial session not found', 'TRIAL_NOT_FOUND', 404);
}

api_ok($trialStatus);
