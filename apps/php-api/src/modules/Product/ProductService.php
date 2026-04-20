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

        $this->db->execute(
            'INSERT INTO products (product_code, name, client_app_key, trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes, status, created_at)
             VALUES (:productCode, :name, :clientAppKey, :trialDuration, :heartbeatInterval, :offlineGrace, :status, UTC_TIMESTAMP())',
            [
                'productCode' => $data['product_code'],
                'name' => $data['name'],
                'clientAppKey' => $data['client_app_key'] ?: bin2hex(random_bytes(16)),
                'trialDuration' => (int) ($data['trial_duration_minutes'] ?: 60),
                'heartbeatInterval' => (int) ($data['heartbeat_interval_seconds'] ?: 180),
                'offlineGrace' => (int) ($data['offline_grace_minutes'] ?: 5),
                'status' => $data['status'] ?: 'active',
            ]
        );

        return $this->byId((int) $this->db->lastInsertId());
    }
}
