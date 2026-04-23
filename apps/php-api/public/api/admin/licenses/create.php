<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

function generate_admin_license_key(): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $segments = [4, 4, 4, 4];
    $parts = [];

    foreach ($segments as $length) {
        $part = '';
        for ($index = 0; $index < $length; $index++) {
            $part .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $parts[] = $part;
    }

    return implode('-', $parts);
}

$app = api_bootstrap();
$request = api_request();
$payload = AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);

$productId = (int) $request->input('product_id', 0);
$licenseKey = strtoupper(trim((string) $request->input('license_key', '')));
$quantity = (int) $request->input('quantity', 1);

if ($productId <= 0) {
    api_error('product_id is required', 'VALIDATION_ERROR', 422);
}

if ($quantity < 1 || $quantity > 500) {
    api_error('quantity must be between 1 and 500', 'VALIDATION_ERROR', 422);
}

if ($quantity === 1 && $licenseKey === '') {
    $licenseKey = generate_admin_license_key();
}

$product = $app['productService']->byId($productId);
if ($product === null) {
    api_error('Product not found', 'NOT_FOUND', 404);
}

try {
    $licenses = [];
    $generatedKeys = [];
    $baseData = [
        'product_id' => $productId,
        'license_type' => (string) $request->input('license_type', 'standard'),
        'status' => (string) $request->input('status', 'active'),
        'max_bindings' => (int) $request->input('max_bindings', 1),
        'expires_at' => $request->input('expires_at') ?: null,
    ];

    for ($index = 0; $index < $quantity; $index++) {
        $attempts = 0;
        $created = false;

        do {
            $attempts++;
            $nextKey = $quantity === 1 ? $licenseKey : generate_admin_license_key();

            if (isset($generatedKeys[$nextKey])) {
                continue;
            }

            try {
                $license = $app['licenseService']->create([
                    ...$baseData,
                    'license_key' => $nextKey,
                ]);
                $licenses[] = $license;
                $generatedKeys[$nextKey] = true;
                $created = true;
                break;
            } catch (\PDOException $e) {
                if ($quantity === 1 || $attempts >= 10 || $e->getCode() !== '23000') {
                    throw $e;
                }
            }
        } while ($attempts < 10);

        if (!$created) {
            throw new \RuntimeException('Failed to generate a unique license key.');
        }
    }

    $app['auditService']->log(
        'admin',
        (string) ($payload['email'] ?? 'unknown'),
        $quantity === 1 ? 'license.create' : 'license.batch_create',
        'license',
        (string) ($licenses[0]['id'] ?? ''),
        $productId,
        $_SERVER['REMOTE_ADDR'] ?? null,
        [
            'createdCount' => count($licenses),
            'licenseKeys' => array_slice(array_column($licenses, 'license_key'), 0, 20),
            'status' => $baseData['status'],
        ]
    );

    api_ok([
        'license' => $licenses[0] ?? null,
        'licenses' => $licenses,
        'createdCount' => count($licenses),
    ]);
} catch (\InvalidArgumentException $e) {
    api_error($e->getMessage(), 'VALIDATION_ERROR', 422);
} catch (\PDOException $e) {
    if ($e->getCode() === '23000') {
        api_error('License key already exists', 'CONFLICT', 409);
    }

    api_error('Failed to create license', 'SERVER_ERROR', 500);
} catch (\RuntimeException $e) {
    api_error($e->getMessage(), 'CONFLICT', 409);
}
