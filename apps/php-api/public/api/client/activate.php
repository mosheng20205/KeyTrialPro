<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineFingerprint = (array) ($request->input('machineContext') ?: $request->input('machineFingerprint', []));

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

$summary = $app['fingerprintService']->summarize($machineFingerprint);
$cardKey = (string) $request->input('cardKey', '');
$challengeId = (string) $request->input('challengeId', '');
$challengeSignature = (string) $request->input('challengeSignature', '');

if ($cardKey === '') {
    api_error('cardKey is required', 'VALIDATION_ERROR', 422);
}

try {
    api_verify_client_signature($app, $request, $product, '');

    $app['licenseService']->consumeChallenge($productCode, $challengeId, $summary['machineHash'], $summary['signatureSubject'], $challengeSignature);
    $app['fingerprintService']->storeSnapshot((int) $product['id'], $summary['machineHash'], $machineFingerprint);
    $app['riskService']->captureEnvironmentSignals((int) $product['id'], $summary['machineHash'], $machineFingerprint);
    $activation = $app['licenseService']->activateLicense($product, $cardKey, $summary['machineHash']);
    $app['licenseService']->registerPresence(
        (int) $product['id'],
        $summary['machineHash'],
        (string) $request->input('sdkVersion', 'unknown'),
        $_SERVER['REMOTE_ADDR'] ?? null
    );
    $app['auditService']->log(
        'client',
        $summary['machineHash'],
        'license.activate',
        'license',
        (string) $activation['licenseId'],
        (int) $product['id'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['productCode' => $productCode]
    );
    $activation['onlineWindowSeconds'] = $app['config']['presence']['windowSeconds'];
    api_ok($activation);
} catch (\RuntimeException $exception) {
    $app['riskService']->recordEvent(
        (int) $product['id'],
        $summary['machineHash'],
        'activation_failed',
        'medium',
        $exception->getMessage(),
        ['productCode' => $productCode, 'cardKeyProvided' => $cardKey !== '']
    );
    api_error($exception->getMessage(), 'LICENSE_ACTIVATION_FAILED', 409);
}
