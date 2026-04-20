<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Policy;

use KeyTrialPro\shared\Persistence\Database;

final class PolicyService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function save(array $product, array $payload): array
    {
        $trialDurationMinutes = max(1, (int) ($payload['trialDurationMinutes'] ?? $product['trial_duration_minutes'] ?? 60));
        $heartbeatIntervalSeconds = max(30, (int) ($payload['heartbeatIntervalSeconds'] ?? $product['heartbeat_interval_seconds'] ?? 180));
        $offlineGraceMinutes = max(0, (int) ($payload['offlineGraceMinutes'] ?? $product['offline_grace_minutes'] ?? 5));
        $maxRebindCount = max(0, (int) ($payload['maxRebindCount'] ?? 3));
        $degradeMode = (string) ($payload['degradeMode'] ?? 'read_only');
        $policyCode = (string) ($payload['policyCode'] ?? 'default');
        $licenseType = (string) ($payload['licenseType'] ?? 'standard');
        $maxBindings = max(1, (int) ($payload['maxBindings'] ?? 1));
        $rebindLimit = max(0, (int) ($payload['rebindLimit'] ?? 3));

        $this->db->execute(
            'UPDATE products
             SET trial_duration_minutes = :trialDurationMinutes,
                 heartbeat_interval_seconds = :heartbeatIntervalSeconds,
                 offline_grace_minutes = :offlineGraceMinutes
             WHERE id = :productId',
            [
                'trialDurationMinutes' => $trialDurationMinutes,
                'heartbeatIntervalSeconds' => $heartbeatIntervalSeconds,
                'offlineGraceMinutes' => $offlineGraceMinutes,
                'productId' => $product['id'],
            ]
        );

        $this->db->execute(
            'INSERT INTO trial_policies (
                product_id, trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes, max_rebind_count, degrade_mode, created_at, updated_at
             ) VALUES (
                :productId, :trialDurationMinutes, :heartbeatIntervalSeconds, :offlineGraceMinutes, :maxRebindCount, :degradeMode, UTC_TIMESTAMP(), UTC_TIMESTAMP()
             )
             ON DUPLICATE KEY UPDATE
                trial_duration_minutes = VALUES(trial_duration_minutes),
                heartbeat_interval_seconds = VALUES(heartbeat_interval_seconds),
                offline_grace_minutes = VALUES(offline_grace_minutes),
                max_rebind_count = VALUES(max_rebind_count),
                degrade_mode = VALUES(degrade_mode),
                updated_at = UTC_TIMESTAMP()',
            [
                'productId' => $product['id'],
                'trialDurationMinutes' => $trialDurationMinutes,
                'heartbeatIntervalSeconds' => $heartbeatIntervalSeconds,
                'offlineGraceMinutes' => $offlineGraceMinutes,
                'maxRebindCount' => $maxRebindCount,
                'degradeMode' => $degradeMode,
            ]
        );

        $this->db->execute(
            'INSERT INTO license_policies (
                product_id, policy_code, license_type, max_bindings, rebind_limit, requires_manual_review_after_limit, created_at, updated_at
             ) VALUES (
                :productId, :policyCode, :licenseType, :maxBindings, :rebindLimit, :requiresManualReview, UTC_TIMESTAMP(), UTC_TIMESTAMP()
             )
             ON DUPLICATE KEY UPDATE
                license_type = VALUES(license_type),
                max_bindings = VALUES(max_bindings),
                rebind_limit = VALUES(rebind_limit),
                requires_manual_review_after_limit = VALUES(requires_manual_review_after_limit),
                updated_at = UTC_TIMESTAMP()',
            [
                'productId' => $product['id'],
                'policyCode' => $policyCode,
                'licenseType' => $licenseType,
                'maxBindings' => $maxBindings,
                'rebindLimit' => $rebindLimit,
                'requiresManualReview' => (int) ($payload['requiresManualReviewAfterLimit'] ?? 1),
            ]
        );

        return [
            'productId' => (int) $product['id'],
            'productCode' => $product['product_code'],
            'trialDurationMinutes' => $trialDurationMinutes,
            'heartbeatIntervalSeconds' => $heartbeatIntervalSeconds,
            'offlineGraceMinutes' => $offlineGraceMinutes,
            'maxRebindCount' => $maxRebindCount,
            'policyCode' => $policyCode,
            'licenseType' => $licenseType,
            'maxBindings' => $maxBindings,
            'rebindLimit' => $rebindLimit,
        ];
    }

    public function getForProduct(array $product): array
    {
        $trialPolicy = $this->db->selectOne(
            'SELECT trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes, max_rebind_count, degrade_mode
             FROM trial_policies
             WHERE product_id = :productId
             LIMIT 1',
            ['productId' => $product['id']]
        );

        $licensePolicies = $this->db->select(
            'SELECT policy_code, license_type, max_bindings, rebind_limit, requires_manual_review_after_limit
             FROM license_policies
             WHERE product_id = :productId
             ORDER BY policy_code ASC',
            ['productId' => $product['id']]
        );

        return [
            'productId' => (int) $product['id'],
            'productCode' => $product['product_code'],
            'productName' => $product['name'],
            'productDefaults' => [
                'trialDurationMinutes' => (int) $product['trial_duration_minutes'],
                'heartbeatIntervalSeconds' => (int) $product['heartbeat_interval_seconds'],
                'offlineGraceMinutes' => (int) $product['offline_grace_minutes'],
            ],
            'trialPolicy' => [
                'trialDurationMinutes' => (int) ($trialPolicy['trial_duration_minutes'] ?? $product['trial_duration_minutes']),
                'heartbeatIntervalSeconds' => (int) ($trialPolicy['heartbeat_interval_seconds'] ?? $product['heartbeat_interval_seconds']),
                'offlineGraceMinutes' => (int) ($trialPolicy['offline_grace_minutes'] ?? $product['offline_grace_minutes']),
                'maxRebindCount' => (int) ($trialPolicy['max_rebind_count'] ?? 3),
                'degradeMode' => (string) ($trialPolicy['degrade_mode'] ?? 'read_only'),
            ],
            'licensePolicies' => array_map(
                static fn (array $policy): array => [
                    'policyCode' => $policy['policy_code'],
                    'licenseType' => $policy['license_type'],
                    'maxBindings' => (int) $policy['max_bindings'],
                    'rebindLimit' => (int) $policy['rebind_limit'],
                    'requiresManualReviewAfterLimit' => (bool) $policy['requires_manual_review_after_limit'],
                ],
                $licensePolicies
            ),
        ];
    }
}
