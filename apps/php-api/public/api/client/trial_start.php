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
    api_verify_client_signature($app, $request, $product, $summary['signatureSubject']);
    $app['licenseService']->consumeChallenge($productCode, $challengeId, $summary['machineHash'], $summary['signatureSubject'], $challengeSignature);
    $app['fingerprintService']->storeSnapshot((int) $product['id'], $summary['machineHash'], $machineFingerprint);
    $app['riskService']->captureEnvironmentSignals((int) $product['id'], $summary['machineHash'], $machineFingerprint);
    $trial = $app['licenseService']->createTrialSession($product, $summary['machineHash']);
    $app['auditService']->log(
        'client',
        $summary['machineHash'],
        'trial.start',
        'trial_session',
        $trial['trialSessionId'],
        (int) $product['id'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        ['productCode' => $productCode, 'reused' => $trial['reused']]
    );
    api_ok($trial, 201);
} catch (\RuntimeException $exception) {
    $app['riskService']->recordEvent(
        (int) $product['id'],
        $summary['machineHash'],
        'trial_start_failed',
        'medium',
        $exception->getMessage(),
        ['productCode' => $productCode]
    );
    api_error($exception->getMessage(), 'TRIAL_NOT_AVAILABLE', 409);
}
