<?php

declare(strict_types=1);

namespace KeyTrialPro\shared\Security;

use KeyTrialPro\shared\Persistence\Database;

final class ReplayGuard
{
    public function __construct(private readonly Database $db)
    {
    }

    public function assertUnique(int $productId, string $nonce, string $subjectHash, int $ttlSeconds = 300): void
    {
        $this->db->execute(
            'DELETE FROM client_request_nonces WHERE expires_at < UTC_TIMESTAMP()'
        );

        $existing = $this->db->selectOne(
            'SELECT id
             FROM client_request_nonces
             WHERE product_id = :productId AND nonce = :nonce
             LIMIT 1',
            [
                'productId' => $productId,
                'nonce' => $nonce,
            ]
        );

        if ($existing !== null) {
            throw new \RuntimeException('Replay nonce has already been used.');
        }

        $this->db->execute(
            'INSERT INTO client_request_nonces (product_id, nonce, subject_hash, created_at, expires_at)
             VALUES (:productId, :nonce, :subjectHash, UTC_TIMESTAMP(), :expiresAt)',
            [
                'productId' => $productId,
                'nonce' => $nonce,
                'subjectHash' => $subjectHash,
                'expiresAt' => gmdate('Y-m-d H:i:s', time() + $ttlSeconds),
            ]
        );
    }
}

