<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineFingerprint = (array) $request->input('machineFingerprint', []);
$challengeId = (string) $request->input('challengeId', '');
$challengeSignature = (string) $request->input('challengeSignature', '');

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

$summary = $app['fingerprintService']->summarize($machineFingerprint);
try {
    api_verify_client_signature($app, $request, $product, '');
    $app['fingerprintService']->storeSnapshot((int) $product['id'], $summary['machineHash'], $machineFingerprint);
    $app['riskService']->captureEnvironmentSignals((int) $product['id'], $summary['machineHash'], $machineFingerprint);
} catch (\RuntimeException $exception) {
    $app['riskService']->recordEvent(
        (int) $product['id'],
        $summary['machineHash'],
        'verify_failed',
        'high',
        $exception->getMessage(),
        ['productCode' => $productCode]
    );
    api_error($exception->getMessage(), 'VERIFY_FAILED', 409);
}

$licenseStatus = $app['licenseService']->activeLicenseStatus((int) $product['id'], $summary['machineHash']);
$trialStatus = $app['licenseService']->trialStatus($productCode, $summary['machineHash']);
$remainingTrialSeconds = 0;
$status = 'not_licensed';
$authorized = false;
$expiresAt = $licenseStatus['expiresAt'] ?? null;

if ($licenseStatus !== null) {
    $status = 'active';
    $authorized = true;
}

if ($trialStatus !== null) {
    $remainingTrialSeconds = (int) ($trialStatus['remainingSeconds'] ?? 0);

    if ($expiresAt === null) {
        $expiresAt = $trialStatus['expires_at'] ?? null;
    }

    if ($licenseStatus === null) {
        if ($remainingTrialSeconds > 0) {
            $status = 'trial_active';
            $authorized = true;
        } else {
            $status = 'trial_expired';
        }
    }
}

if ($authorized) {
    $app['licenseService']->registerPresence(
        (int) $product['id'],
        $summary['machineHash'],
        (string) $request->input('sdkVersion', 'unknown'),
        $_SERVER['REMOTE_ADDR'] ?? null
    );
}

api_ok([
    'status' => $status,
    'authorized' => $authorized,
    'online' => $authorized,
    'remainingTrialSeconds' => $remainingTrialSeconds,
    'expiresAt' => $expiresAt,
    'riskLevel' => 'low',
]);
