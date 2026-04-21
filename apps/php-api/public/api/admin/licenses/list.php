<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
$request = api_request();

AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$productCode = (string) $request->input('productId', '');
$productId = null;

if ($productCode !== '') {
    $product = $app['productService']->byCode($productCode);
    if ($product === null) {
        api_error('Unknown product', 'PRODUCT_NOT_FOUND', 404);
    }
    $productId = (int) $product['id'];
}

api_ok($app['licenseService']->listPage($productId, [
    'page' => (int) $request->input('page', 1),
    'pageSize' => (int) $request->input('pageSize', 20),
    'status' => (string) $request->input('status', 'all'),
    'usage' => (string) $request->input('usage', 'all'),
    'query' => (string) $request->input('query', ''),
]));
