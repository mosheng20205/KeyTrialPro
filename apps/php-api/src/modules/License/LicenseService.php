<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\License;

use KeyTrialPro\shared\Persistence\Database;
use KeyTrialPro\shared\Security\Crypto;

final class LicenseService
{
    public function __construct(
        private readonly Database $db,
        private readonly Crypto $crypto,
    ) {
    }

    public function list(?int $productId = null): array
    {
        $sql = 'SELECT l.id, l.product_id, l.license_key, l.status, l.expires_at, l.max_bindings, p.name AS product_name
                FROM licenses l
                INNER JOIN products p ON p.id = l.product_id';
        $params = [];

        if ($productId !== null) {
            $sql .= ' WHERE l.product_id = :productId';
            $params['productId'] = $productId;
        }

        return $this->db->select($sql . ' ORDER BY l.id DESC LIMIT 200', $params);
    }

    public function issueChallenge(string $productCode, string $machineHash, string $signatureSubject, int $ttlSeconds = 300): array
    {
        $challenge = bin2hex(random_bytes(16));
        $challengeId = bin2hex(random_bytes(8));
        $expiresAt = time() + $ttlSeconds;

        $this->db->execute(
            'INSERT INTO challenge_sessions (challenge_id, product_code, machine_hash, signature_subject, challenge_value, expires_at, created_at)
             VALUES (:challengeId, :productCode, :machineHash, :signatureSubject, :challengeValue, FROM_UNIXTIME(:expiresAt), UTC_TIMESTAMP())',
            [
                'challengeId' => $challengeId,
                'productCode' => $productCode,
                'machineHash' => $machineHash,
                'signatureSubject' => $signatureSubject,
                'challengeValue' => $challenge,
                'expiresAt' => $expiresAt,
            ]
        );

        return [
            'challengeId' => $challengeId,
            'challenge' => $challenge,
            'expiresAt' => gmdate('Y-m-d H:i:s', $expiresAt),
        ];
    }

    public function consumeChallenge(string $productCode, string $challengeId, string $machineHash, string $signatureSubject, string $challengeSignature): void
    {
        $challenge = $this->db->selectOne(
            'SELECT challenge_id, machine_hash, signature_subject, challenge_value, UNIX_TIMESTAMP(expires_at) AS expires_ts, consumed_at
             FROM challenge_sessions
             WHERE challenge_id = :challengeId AND product_code = :productCode
             LIMIT 1',
            [
                'challengeId' => $challengeId,
                'productCode' => $productCode,
            ]
        );

        if ($challenge === null) {
            throw new \RuntimeException('Challenge session was not found.');
        }

        if ($challenge['consumed_at'] !== null) {
            throw new \RuntimeException('Challenge session has already been consumed.');
        }

        if ((int) ($challenge['expires_ts'] ?? 0) < time()) {
            throw new \RuntimeException('Challenge session has expired.');
        }

        if (!hash_equals((string) $challenge['machine_hash'], $machineHash)) {
            throw new \RuntimeException('Challenge machine binding mismatch.');
        }

        if (!hash_equals((string) $challenge['signature_subject'], $signatureSubject)) {
            throw new \RuntimeException('Challenge signature subject mismatch.');
        }

        $expectedSignature = hash('sha256', $challenge['challenge_value'] . '|' . $signatureSubject);
        if (!hash_equals($expectedSignature, $challengeSignature)) {
            throw new \RuntimeException('Challenge signature is invalid.');
        }

        $this->db->execute(
            'UPDATE challenge_sessions
             SET consumed_at = UTC_TIMESTAMP()
             WHERE challenge_id = :challengeId',
            ['challengeId' => $challengeId]
        );
    }

    public function createTrialSession(array $product, string $machineHash): array
    {
        $existing = $this->db->selectOne(
            'SELECT trial_session_id, started_at, expires_at, offline_grace_expires_at, status
             FROM trial_sessions
             WHERE product_id = :productId AND machine_id = :machineId
             ORDER BY id DESC
             LIMIT 1',
            [
                'productId' => $product['id'],
                'machineId' => $machineHash,
            ]
        );

        if ($existing !== null) {
            $remainingSeconds = max(0, strtotime($existing['expires_at']) - time());
            if ($remainingSeconds > 0 && $existing['status'] === 'active') {
                return [
                    'trialSessionId' => $existing['trial_session_id'],
                    'startedAt' => $existing['started_at'],
                    'expiresAt' => $existing['expires_at'],
                    'offlineGraceExpiresAt' => $existing['offline_grace_expires_at'],
                    'status' => $existing['status'],
                    'remainingSeconds' => $remainingSeconds,
                    'reused' => true,
                ];
            }

            throw new \RuntimeException('Trial has already been used on this device.');
        }

        $trialSessionId = bin2hex(random_bytes(8));
        $durationMinutes = (int) ($product['trial_duration_minutes'] ?? 60);
        $offlineGraceMinutes = (int) ($product['offline_grace_minutes'] ?? 5);
        $startedAt = gmdate('Y-m-d H:i:s');
        $expiresAt = gmdate('Y-m-d H:i:s', time() + ($durationMinutes * 60));
        $offlineGraceExpiresAt = gmdate('Y-m-d H:i:s', time() + ($offlineGraceMinutes * 60));

        $this->db->execute(
            'INSERT INTO trial_sessions (
                trial_session_id, product_id, machine_id, started_at, expires_at, last_verify_at, offline_grace_expires_at, status, created_at
             ) VALUES (
                :trialSessionId, :productId, :machineId, :startedAt, :expiresAt, UTC_TIMESTAMP(), :offlineGraceExpiresAt, :status, UTC_TIMESTAMP()
             )',
            [
                'trialSessionId' => $trialSessionId,
                'productId' => $product['id'],
                'machineId' => $machineHash,
                'startedAt' => $startedAt,
                'expiresAt' => $expiresAt,
                'offlineGraceExpiresAt' => $offlineGraceExpiresAt,
                'status' => 'active',
            ]
        );

        return [
            'trialSessionId' => $trialSessionId,
            'startedAt' => $startedAt,
            'expiresAt' => $expiresAt,
            'offlineGraceExpiresAt' => $offlineGraceExpiresAt,
            'status' => 'active',
            'remainingSeconds' => $durationMinutes * 60,
            'reused' => false,
        ];
    }

    public function trialStatus(string $productCode, string $machineId): ?array
    {
        $trial = $this->db->selectOne(
            'SELECT ts.trial_session_id, ts.started_at, ts.expires_at, ts.offline_grace_expires_at, ts.status, p.name AS product_name
             FROM trial_sessions ts
             INNER JOIN products p ON p.id = ts.product_id
             WHERE p.product_code = :productCode AND ts.machine_id = :machineId
             ORDER BY ts.id DESC
             LIMIT 1',
            ['productCode' => $productCode, 'machineId' => $machineId]
        );

        if ($trial === null) {
            return null;
        }

        $remainingSeconds = max(0, strtotime($trial['expires_at']) - time());
        if ($remainingSeconds === 0 && $trial['status'] === 'active') {
            $this->db->execute(
                'UPDATE trial_sessions
                 SET status = :status, last_verify_at = UTC_TIMESTAMP(), last_server_time_at = UTC_TIMESTAMP()
                 WHERE trial_session_id = :trialSessionId',
                [
                    'status' => 'expired',
                    'trialSessionId' => $trial['trial_session_id'],
                ]
            );
            $trial['status'] = 'expired';
        } else {
            $this->db->execute(
                'UPDATE trial_sessions
                 SET last_verify_at = UTC_TIMESTAMP(), last_server_time_at = UTC_TIMESTAMP()
                 WHERE trial_session_id = :trialSessionId',
                ['trialSessionId' => $trial['trial_session_id']]
            );
        }

        $trial['remainingSeconds'] = $remainingSeconds;
        $trial['expired'] = $remainingSeconds === 0;

        return $trial;
    }

    public function registerPresence(int $productId, string $machineId, string $sdkVersion, ?string $ipAddress): void
    {
        $this->db->execute(
            'INSERT INTO presence_sessions (product_id, machine_id, sdk_version, last_ip, last_seen_at, status)
             VALUES (:productId, :machineId, :sdkVersion, :lastIp, UTC_TIMESTAMP(), :status)
             ON DUPLICATE KEY UPDATE
                sdk_version = VALUES(sdk_version),
                last_ip = VALUES(last_ip),
                last_seen_at = UTC_TIMESTAMP(),
                status = VALUES(status)',
            [
                'productId' => $productId,
                'machineId' => $machineId,
                'sdkVersion' => $sdkVersion,
                'lastIp' => $ipAddress,
                'status' => 'online',
            ]
        );
    }

    public function create(array $data): array
    {
        $required = ['product_id', 'license_key'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new \InvalidArgumentException("{$field} is required");
            }
        }

        $this->db->execute(
            'INSERT INTO licenses (product_id, license_key, license_type, status, max_bindings, expires_at, created_at)
             VALUES (:productId, :licenseKey, :licenseType, :status, :maxBindings, :expiresAt, UTC_TIMESTAMP())',
            [
                'productId' => (int) $data['product_id'],
                'licenseKey' => (string) $data['license_key'],
                'licenseType' => (string) ($data['license_type'] ?? 'standard'),
                'status' => (string) ($data['status'] ?? 'active'),
                'maxBindings' => (int) ($data['max_bindings'] ?? 1),
                'expiresAt' => $data['expires_at'] ?? null,
            ]
        );

        $id = (int) $this->db->lastInsertId();
        return $this->db->selectOne('SELECT * FROM licenses WHERE id = :id LIMIT 1', ['id' => $id]) ?? [];
    }

    public function activateLicense(array $product, string $cardKey, string $machineHash): array
    {
        $license = $this->db->selectOne(
            'SELECT id, product_id, license_key, status, expires_at, max_bindings
             FROM licenses
             WHERE product_id = :productId AND license_key = :licenseKey
             LIMIT 1',
            [
                'productId' => $product['id'],
                'licenseKey' => $cardKey,
            ]
        );

        if ($license === null) {
            throw new \RuntimeException('License key not found for product.');
        }

        if ($license['status'] !== 'active') {
            throw new \RuntimeException('License is not active.');
        }

        $bindingCount = $this->db->selectOne(
            'SELECT COUNT(*) AS count FROM license_bindings WHERE license_id = :licenseId AND status = :status',
            [
                'licenseId' => $license['id'],
                'status' => 'active',
            ]
        );

        $existingBinding = $this->db->selectOne(
            'SELECT id, machine_id
             FROM license_bindings
             WHERE product_id = :productId AND license_id = :licenseId AND machine_id = :machineId
             LIMIT 1',
            [
                'productId' => $product['id'],
                'licenseId' => $license['id'],
                'machineId' => $machineHash,
            ]
        );

        if ($existingBinding === null && (int) ($bindingCount['count'] ?? 0) >= (int) $license['max_bindings']) {
            throw new \RuntimeException('License has reached the maximum binding count.');
        }

        $this->db->execute(
            'INSERT INTO license_bindings (product_id, license_id, machine_id, machine_hash, status, bound_at, last_verified_at)
             VALUES (:productId, :licenseId, :machineId, :machineHash, :status, UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                last_verified_at = UTC_TIMESTAMP()',
            [
                'productId' => $product['id'],
                'licenseId' => $license['id'],
                'machineId' => $machineHash,
                'machineHash' => $machineHash,
                'status' => 'active',
            ]
        );

        return [
            'licenseId' => (int) $license['id'],
            'status' => 'active',
            'machineId' => $machineHash,
            'expiresAt' => $license['expires_at'],
            'onlineWindowSeconds' => 300,
        ];
    }
}
