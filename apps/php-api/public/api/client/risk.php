<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

$app = api_bootstrap();
$request = api_request();
$productCode = (string) ($request->input('productId', '') ?: $request->input('productCode', ''));
$machineId = (string) ($request->input('machineId', '') ?: $request->input('machineHash', ''));
$machineFingerprint = (array) $request->input('machineFingerprint', []);
$riskSignals = (array) $request->input('riskSignals', []);

$product = $app['productService']->byCode($productCode);
if ($product === null) {
    api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
}

if ($machineId === '' && $machineFingerprint !== []) {
    $machineId = $app['fingerprintService']->summarize($machineFingerprint)['machineHash'];
}

if ($machineId === '') {
    $machineId = hash('sha256', implode('|', [
        (string) ($request->input('cardKey', '') ?: $request->input('card_key', '')),
        (string) ($request->input('shopId', '') ?: $request->input('shop_id', '')),
        $_SERVER['REMOTE_ADDR'] ?? '',
    ]));
}

$decision = $app['riskService']->evaluateClientRiskSignals($riskSignals);
$app['riskService']->recordClientRiskSignals((int) $product['id'], $machineId, $riskSignals, $decision);

api_ok([
    'status' => $decision['authorized'] ? 'ok' : 'risk_blocked',
    'authorized' => $decision['authorized'],
    'blockReason' => $decision['blockReason'],
    'riskLevel' => $decision['riskLevel'],
]);
