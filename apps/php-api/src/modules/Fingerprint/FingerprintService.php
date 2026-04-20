<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Fingerprint;

use KeyTrialPro\shared\Persistence\Database;
use KeyTrialPro\shared\Security\Crypto;

final class FingerprintService
{
    public function __construct(
        private readonly Database $db,
        private readonly Crypto $crypto,
    ) {
    }

    public function summarize(array $snapshot): array
    {
        $stableFields = [
            $snapshot['cpuSerial'] ?? '',
            $snapshot['systemDiskId'] ?? '',
            $snapshot['baseboardSerial'] ?? '',
            $snapshot['biosVersion'] ?? '',
            $snapshot['gpuUuid'] ?? '',
            $snapshot['primaryMac'] ?? '',
        ];

        $normalized = implode('|', array_map(static fn ($value) => strtolower(trim((string) $value)), $stableFields));
        $machineHash = hash('sha3-256', $normalized);
        $signatureSubject = hash('sha256', $normalized);

        return [
            'normalizedFingerprint' => $normalized,
            'machineHash' => $machineHash,
            'signatureSubject' => $signatureSubject,
        ];
    }

    public function encryptSnapshot(array $snapshot): array
    {
        return $this->crypto->encrypt(json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}');
    }

    public function storeSnapshot(int $productId, string $machineId, array $snapshot): void
    {
        $encrypted = $this->encryptSnapshot($snapshot);
        $riskFlags = [
            'antiDebug' => (bool) ($snapshot['antiDebug'] ?? false),
            'antiVm' => (bool) ($snapshot['antiVm'] ?? false),
            'antiHook' => (bool) ($snapshot['antiHook'] ?? false),
            'codeIntegrityOk' => (bool) ($snapshot['codeIntegrityOk'] ?? true),
            'suspiciousModules' => (bool) ($snapshot['suspiciousModules'] ?? false),
        ];

        $this->db->execute(
            'INSERT INTO machine_snapshots (
                product_id, machine_id, fingerprint_hash, encrypted_payload, iv, auth_tag, risk_flags_json, created_at
             ) VALUES (
                :productId, :machineId, :fingerprintHash, :encryptedPayload, :iv, :authTag, :riskFlagsJson, UTC_TIMESTAMP()
             )',
            [
                'productId' => $productId,
                'machineId' => $machineId,
                'fingerprintHash' => hash('sha3-256', json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}'),
                'encryptedPayload' => $encrypted['ciphertext'],
                'iv' => $encrypted['iv'],
                'authTag' => $encrypted['tag'],
                'riskFlagsJson' => json_encode($riskFlags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]
        );
    }
}
