<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\SecurityProfile;

use KeyTrialPro\shared\Persistence\Database;

final class SecurityProfileService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function getForProduct(array $product): array
    {
        $profile = $this->db->selectOne(
            'SELECT machine_binding_mode, anti_debug_enabled, anti_vm_enabled, hook_detection_enabled, challenge_fail_tolerance
             FROM product_security_profiles
             WHERE product_id = :productId
             LIMIT 1',
            ['productId' => $product['id']]
        );

        return [
            'productId' => (int) $product['id'],
            'productCode' => $product['product_code'],
            'machineBindingMode' => (string) ($profile['machine_binding_mode'] ?? 'strict'),
            'antiDebugEnabled' => (bool) ($profile['anti_debug_enabled'] ?? true),
            'antiVmEnabled' => (bool) ($profile['anti_vm_enabled'] ?? true),
            'hookDetectionEnabled' => (bool) ($profile['hook_detection_enabled'] ?? true),
            'challengeFailTolerance' => (int) ($profile['challenge_fail_tolerance'] ?? 3),
        ];
    }

    public function save(array $product, array $payload): array
    {
        $machineBindingMode = (string) ($payload['machineBindingMode'] ?? 'strict');
        $antiDebugEnabled = (int) (($payload['antiDebugEnabled'] ?? true) ? 1 : 0);
        $antiVmEnabled = (int) (($payload['antiVmEnabled'] ?? true) ? 1 : 0);
        $hookDetectionEnabled = (int) (($payload['hookDetectionEnabled'] ?? true) ? 1 : 0);
        $challengeFailTolerance = max(1, (int) ($payload['challengeFailTolerance'] ?? 3));

        $this->db->execute(
            'INSERT INTO product_security_profiles (
                product_id, machine_binding_mode, anti_debug_enabled, anti_vm_enabled, hook_detection_enabled, challenge_fail_tolerance, created_at, updated_at
             ) VALUES (
                :productId, :machineBindingMode, :antiDebugEnabled, :antiVmEnabled, :hookDetectionEnabled, :challengeFailTolerance, UTC_TIMESTAMP(), UTC_TIMESTAMP()
             )
             ON DUPLICATE KEY UPDATE
                machine_binding_mode = VALUES(machine_binding_mode),
                anti_debug_enabled = VALUES(anti_debug_enabled),
                anti_vm_enabled = VALUES(anti_vm_enabled),
                hook_detection_enabled = VALUES(hook_detection_enabled),
                challenge_fail_tolerance = VALUES(challenge_fail_tolerance),
                updated_at = UTC_TIMESTAMP()',
            [
                'productId' => $product['id'],
                'machineBindingMode' => $machineBindingMode,
                'antiDebugEnabled' => $antiDebugEnabled,
                'antiVmEnabled' => $antiVmEnabled,
                'hookDetectionEnabled' => $hookDetectionEnabled,
                'challengeFailTolerance' => $challengeFailTolerance,
            ]
        );

        return $this->getForProduct($product);
    }
}
