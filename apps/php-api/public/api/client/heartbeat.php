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

$signatureSubject = $machineId;
if ($machineFingerprint !== []) {
    $signatureSubject = $app['fingerprintService']->summarize($machineFingerprint)['signatureSubject'];
}

api_verify_client_signature($app, $request, $product, '');

if ($machineFingerprint !== []) {
    $app['fingerprintService']->storeSnapshot((int) $product['id'], $machineId, $machineFingerprint);
    $app['riskService']->captureEnvironmentSignals((int) $product['id'], $machineId, $machineFingerprint);
}

$app['licenseService']->registerPresence(
    (int) $product['id'],
    $machineId,
    (string) $request->input('sdkVersion', 'unknown'),
    $_SERVER['REMOTE_ADDR'] ?? null
);

$trialStatus = $app['licenseService']->trialStatus($productCode, $machineId);
$remainingTrialSeconds = (int) ($trialStatus['remainingSeconds'] ?? 0);

api_ok([
    'status' => $remainingTrialSeconds === 0 && $trialStatus !== null ? 'trial_expired' : 'ok',
    'onlineWindowSeconds' => $app['config']['presence']['windowSeconds'],
    'remainingTrialSeconds' => $remainingTrialSeconds,
]);
