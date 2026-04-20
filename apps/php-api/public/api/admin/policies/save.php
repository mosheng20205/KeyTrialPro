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

$saved = $app['policyService']->save($product, $request->body);
$app['auditService']->log(
    'admin',
    (string) $request->input('adminId', 'system'),
    'policy.save',
    'product',
    (string) $product['id'],
    (int) $product['id'],
    $_SERVER['REMOTE_ADDR'] ?? null,
    $saved
);

api_ok([
    'status' => 'saved',
    'policy' => $saved,
]);
