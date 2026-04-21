<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Product;

use KeyTrialPro\shared\Persistence\Database;

final class ProductService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function all(): array
    {
        return $this->db->select(
            'SELECT id, product_code, name, client_app_key, status, trial_duration_minutes, heartbeat_interval_seconds
             FROM products
             ORDER BY name ASC'
        );
    }

    public function byCode(string $productCode): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM products WHERE product_code = :productCode LIMIT 1',
            ['productCode' => $productCode]
        );
    }

    public function byId(int $productId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM products WHERE id = :productId LIMIT 1',
            ['productId' => $productId]
        );
    }

    public function create(array $data): array
    {
        $required = ['product_code', 'name'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new \InvalidArgumentException("{$field} is required");
            }
        }

        $existing = $this->db->selectOne(
            'SELECT id FROM products WHERE product_code = :productCode LIMIT 1',
            ['productCode' => $data['product_code']]
        );

        if ($existing !== null) {
            throw new \RuntimeException('Product code already exists');
        }

        $trialEnabled = $this->coerceBoolean($data['trial_enabled'] ?? true, true);
        $trialDuration = array_key_exists('trial_duration_minutes', $data)
            ? (int) $data['trial_duration_minutes']
            : 60;
        $heartbeatInterval = array_key_exists('heartbeat_interval_seconds', $data)
            ? (int) $data['heartbeat_interval_seconds']
            : 180;
        $offlineGrace = array_key_exists('offline_grace_minutes', $data)
            ? (int) $data['offline_grace_minutes']
            : 5;

        if ($trialEnabled && $trialDuration < 1) {
            throw new \InvalidArgumentException('trial_duration_minutes must be at least 1 when trial is enabled');
        }

        if (!$trialEnabled) {
            $trialDuration = 0;
        }

        if ($heartbeatInterval < 30) {
            throw new \InvalidArgumentException('heartbeat_interval_seconds must be at least 30');
        }

        if ($offlineGrace < 0) {
            throw new \InvalidArgumentException('offline_grace_minutes must be at least 0');
        }

        $this->db->execute(
            'INSERT INTO products (product_code, name, client_app_key, trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes, status, created_at)
             VALUES (:productCode, :name, :clientAppKey, :trialDuration, :heartbeatInterval, :offlineGrace, :status, UTC_TIMESTAMP())',
            [
                'productCode' => $data['product_code'],
                'name' => $data['name'],
                'clientAppKey' => $data['client_app_key'] ?: bin2hex(random_bytes(16)),
                'trialDuration' => $trialDuration,
                'heartbeatInterval' => $heartbeatInterval,
                'offlineGrace' => $offlineGrace,
                'status' => $data['status'] ?: 'active',
            ]
        );

        return $this->byId((int) $this->db->lastInsertId());
    }

    private function coerceBoolean(mixed $value, bool $default): bool
    {
        if ($value === null || $value === '') {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $normalized ?? $default;
    }
}
