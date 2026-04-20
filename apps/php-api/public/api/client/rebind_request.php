<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) $request->input('productId', '');
$machineId = (string) $request->input('machineId', '');
$machineFingerprint = (array) $request->input('machineFingerprint', []);

if ($productCode === '') {
    api_error('productId is required', 'VALIDATION_ERROR', 422);
}

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

api_verify_client_signature($app, $request, $product, $signatureSubject);

if ($machineFingerprint !== []) {
    $app['fingerprintService']->storeSnapshot((int) $product['id'], $machineId, $machineFingerprint);
    $app['riskService']->captureEnvironmentSignals((int) $product['id'], $machineId, $machineFingerprint);
}

$ticket = $app['approvalService']->createTicket(
    (int) $product['id'],
    'rebind_request',
    $machineId,
    (string) $request->input('requestedBy', 'client'),
    (string) $request->input('reason', '')
);

$app['auditService']->log(
    'client',
    $machineId,
    'license.rebind_request',
    'approval_ticket',
    (string) ($ticket['id'] ?? ''),
    (int) $product['id'],
    $_SERVER['REMOTE_ADDR'] ?? null,
    ['productCode' => $productCode]
);

api_ok([
    'status' => 'pending_review',
    'ticket' => $ticket,
], 202);
