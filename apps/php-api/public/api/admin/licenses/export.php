<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';

use KeyTrialPro\shared\Security\AdminTokenGuard;

function license_export_status_label(string $status): string
{
    return match ($status) {
        'active' => '正常',
        'blocked' => '已封禁',
        'inactive' => '已停用',
        default => $status,
    };
}

function license_export_usage_label(int $activeBindingCount): string
{
    return $activeBindingCount > 0 ? '已使用' : '未使用';
}

function license_export_activation_mode_label(?string $mode): string
{
    return match ($mode) {
        'permanent' => '永久',
        'activation_duration' => '首次激活后计时',
        default => '固定到期',
    };
}

function license_export_expiry_label(array $row): string
{
    if (($row['activation_mode'] ?? '') === 'activation_duration' && empty($row['activated_at']) && empty($row['expires_at'])) {
        $unit = ($row['activation_duration_unit'] ?? '') === 'hour' ? '小时' : '天';
        return sprintf('首次激活后 %s %s', (string) ($row['activation_duration_value'] ?? '-'), $unit);
    }

    return $row['expires_at'] ?? '永久有效';
}

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

$rows = $app['licenseService']->exportRows($productId, [
    'status' => (string) $request->input('status', 'all'),
    'usage' => (string) $request->input('usage', 'all'),
    'query' => (string) $request->input('query', ''),
]);

$filenameProductPart = $productCode !== '' ? $productCode : 'all-products';
$filename = sprintf(
    'licenses-%s-%s.csv',
    preg_replace('/[^a-zA-Z0-9_-]+/', '-', $filenameProductPart) ?: 'all-products',
    gmdate('Ymd-His')
);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$output = fopen('php://output', 'wb');
if ($output === false) {
    throw new RuntimeException('Failed to open export stream.');
}

fwrite($output, "\xEF\xBB\xBF");
fputcsv($output, ['卡密', '状态', '使用情况', '已绑数量', '绑定上限', '有效期模式', '到期时间', '首次激活时间', '创建时间']);

foreach ($rows as $row) {
    fputcsv($output, [
        (string) ($row['license_key'] ?? ''),
        license_export_status_label((string) ($row['status'] ?? '')),
        license_export_usage_label((int) ($row['active_binding_count'] ?? 0)),
        (int) ($row['active_binding_count'] ?? 0),
        (int) ($row['max_bindings'] ?? 0),
        license_export_activation_mode_label($row['activation_mode'] ?? null),
        license_export_expiry_label($row),
        $row['activated_at'] ?? '',
        $row['created_at'] ?? '',
    ]);
}

fclose($output);
exit;
