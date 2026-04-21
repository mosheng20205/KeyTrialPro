<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Stats;

use KeyTrialPro\shared\Persistence\Database;

final class StatsService
{
    public function __construct(
        private readonly Database $db,
        private readonly int $presenceWindowSeconds,
    ) {
    }

    public function platformOverview(): array
    {
        $onlineThreshold = gmdate('Y-m-d H:i:s', time() - $this->presenceWindowSeconds);
        $activated = $this->db->selectOne('SELECT COUNT(DISTINCT machine_id) AS count FROM license_bindings WHERE status = \'active\'');
        $online = $this->db->selectOne(
            'SELECT COUNT(DISTINCT machine_id) AS count
             FROM presence_sessions
             WHERE status = :status
               AND last_seen_at >= :onlineThreshold',
            ['status' => 'online', 'onlineThreshold' => $onlineThreshold]
        );
        $trialActive = $this->db->selectOne('SELECT COUNT(*) AS count FROM trial_sessions WHERE status = \'active\' AND expires_at > UTC_TIMESTAMP()');
        $approvals = $this->db->selectOne('SELECT COUNT(*) AS count FROM approval_tickets WHERE status IN (\'pending\', \'under_review\')');

        return [
            'totalActivatedCount' => (int) ($activated['count'] ?? 0),
            'onlineCount' => (int) ($online['count'] ?? 0),
            'trialActiveCount' => (int) ($trialActive['count'] ?? 0),
            'approvalBacklogCount' => (int) ($approvals['count'] ?? 0),
            'topProducts' => $this->topProducts(),
            'trend' => $this->trends(),
        ];
    }

    public function productOverview(string $productCode): array
    {
        $onlineThreshold = gmdate('Y-m-d H:i:s', time() - $this->presenceWindowSeconds);
        $product = $this->db->selectOne('SELECT id, product_code, name FROM products WHERE product_code = :productCode LIMIT 1', [
            'productCode' => $productCode,
        ]);

        if ($product === null) {
            return [];
        }

        $productId = (int) $product['id'];
        $activated = $this->db->selectOne('SELECT COUNT(DISTINCT machine_id) AS count FROM license_bindings WHERE product_id = :productId AND status = \'active\'', [
            'productId' => $productId,
        ]);
        $online = $this->db->selectOne(
            'SELECT COUNT(DISTINCT machine_id) AS count
             FROM presence_sessions
             WHERE product_id = :productId
               AND status = :status
               AND last_seen_at >= :onlineThreshold',
            ['productId' => $productId, 'status' => 'online', 'onlineThreshold' => $onlineThreshold]
        );
        $trialStarted = $this->db->selectOne(
            'SELECT COUNT(*) AS count FROM trial_sessions WHERE product_id = :productId AND DATE(created_at) = UTC_DATE()',
            ['productId' => $productId]
        );
        $riskEventCount = $this->db->selectOne(
            'SELECT COUNT(*) AS count FROM risk_events WHERE product_id = :productId AND DATE(created_at) = UTC_DATE()',
            ['productId' => $productId]
        );

        return [
            'productId' => $productId,
            'productCode' => $product['product_code'],
            'productName' => $product['name'],
            'totalActivatedCount' => (int) ($activated['count'] ?? 0),
            'onlineCount' => (int) ($online['count'] ?? 0),
            'trialStartedToday' => (int) ($trialStarted['count'] ?? 0),
            'riskEventCount' => (int) ($riskEventCount['count'] ?? 0),
            'trend' => $this->trends($productId),
        ];
    }

    public function topProducts(): array
    {
        return $this->db->select(
            'SELECT p.product_code, p.name, COUNT(DISTINCT lb.machine_id) AS total_activated_count
             FROM products p
             LEFT JOIN license_bindings lb ON lb.product_id = p.id AND lb.status = \'active\'
             GROUP BY p.id, p.product_code, p.name
             ORDER BY total_activated_count DESC, p.name ASC
             LIMIT 6'
        );
    }

    public function trends(?int $productId = null, int $days = 14): array
    {
        $sinceDate = gmdate('Y-m-d', strtotime(sprintf('-%d days', $days)));
        $sql = 'SELECT stats_date, product_id, total_activated_count, daily_new_activated_count, daily_active_count, daily_trial_started_count, daily_trial_expired_count, daily_risk_event_count
                FROM daily_product_stats';
        $params = ['sinceDate' => $sinceDate];

        if ($productId !== null) {
            $sql .= ' WHERE product_id = :productId AND stats_date >= :sinceDate';
            $params['productId'] = $productId;
        } else {
            $sql = 'SELECT stats_date, NULL AS product_id, SUM(total_activated_count) AS total_activated_count,
                        SUM(daily_new_activated_count) AS daily_new_activated_count,
                        SUM(daily_active_count) AS daily_active_count,
                        SUM(daily_trial_started_count) AS daily_trial_started_count,
                        SUM(daily_trial_expired_count) AS daily_trial_expired_count,
                        SUM(daily_risk_event_count) AS daily_risk_event_count
                    FROM daily_product_stats
                    WHERE stats_date >= :sinceDate
                    GROUP BY stats_date';
        }

        return $this->db->select($sql . ' ORDER BY stats_date ASC', $params);
    }

    public function aggregateDailyStats(?string $date = null): array
    {
        $targetDate = $date ?: gmdate('Y-m-d');
        $start = $targetDate . ' 00:00:00';
        $end = $targetDate . ' 23:59:59';

        $products = $this->db->select('SELECT id, product_code, name FROM products ORDER BY id ASC');
        $result = [];

        foreach ($products as $product) {
            $productId = (int) $product['id'];

            $totals = $this->db->selectOne(
                'SELECT COUNT(DISTINCT machine_id) AS count
                 FROM license_bindings
                 WHERE product_id = :productId AND status = :status',
                ['productId' => $productId, 'status' => 'active']
            );
            $newActivated = $this->db->selectOne(
                'SELECT COUNT(DISTINCT machine_id) AS count
                 FROM license_bindings
                 WHERE product_id = :productId AND bound_at BETWEEN :startAt AND :endAt',
                ['productId' => $productId, 'startAt' => $start, 'endAt' => $end]
            );
            $dailyActive = $this->db->selectOne(
                'SELECT COUNT(DISTINCT machine_id) AS count
                 FROM presence_sessions
                 WHERE product_id = :productId AND last_seen_at BETWEEN :startAt AND :endAt',
                ['productId' => $productId, 'startAt' => $start, 'endAt' => $end]
            );
            $trialStarted = $this->db->selectOne(
                'SELECT COUNT(*) AS count
                 FROM trial_sessions
                 WHERE product_id = :productId AND created_at BETWEEN :startAt AND :endAt',
                ['productId' => $productId, 'startAt' => $start, 'endAt' => $end]
            );
            $trialExpired = $this->db->selectOne(
                'SELECT COUNT(*) AS count
                 FROM trial_sessions
                 WHERE product_id = :productId AND expires_at BETWEEN :startAt AND :endAt',
                ['productId' => $productId, 'startAt' => $start, 'endAt' => $end]
            );
            $riskEvents = $this->db->selectOne(
                'SELECT COUNT(*) AS count
                 FROM risk_events
                 WHERE product_id = :productId AND created_at BETWEEN :startAt AND :endAt',
                ['productId' => $productId, 'startAt' => $start, 'endAt' => $end]
            );

            $record = [
                'statsDate' => $targetDate,
                'productId' => $productId,
                'totalActivatedCount' => (int) ($totals['count'] ?? 0),
                'dailyNewActivatedCount' => (int) ($newActivated['count'] ?? 0),
                'dailyActiveCount' => (int) ($dailyActive['count'] ?? 0),
                'dailyTrialStartedCount' => (int) ($trialStarted['count'] ?? 0),
                'dailyTrialExpiredCount' => (int) ($trialExpired['count'] ?? 0),
                'dailyRiskEventCount' => (int) ($riskEvents['count'] ?? 0),
            ];

            $this->db->execute(
                'INSERT INTO daily_product_stats (
                    stats_date, product_id, total_activated_count, daily_new_activated_count, daily_active_count, daily_trial_started_count, daily_trial_expired_count, daily_risk_event_count
                 ) VALUES (
                    :statsDate, :productId, :totalActivatedCount, :dailyNewActivatedCount, :dailyActiveCount, :dailyTrialStartedCount, :dailyTrialExpiredCount, :dailyRiskEventCount
                 )
                 ON DUPLICATE KEY UPDATE
                    total_activated_count = VALUES(total_activated_count),
                    daily_new_activated_count = VALUES(daily_new_activated_count),
                    daily_active_count = VALUES(daily_active_count),
                    daily_trial_started_count = VALUES(daily_trial_started_count),
                    daily_trial_expired_count = VALUES(daily_trial_expired_count),
                    daily_risk_event_count = VALUES(daily_risk_event_count)',
                $record
            );

            $result[] = $record;
        }

        $platform = [
            'statsDate' => $targetDate,
            'totalActivatedCount' => array_sum(array_column($result, 'totalActivatedCount')),
            'dailyNewActivatedCount' => array_sum(array_column($result, 'dailyNewActivatedCount')),
            'dailyActiveCount' => array_sum(array_column($result, 'dailyActiveCount')),
            'dailyTrialStartedCount' => array_sum(array_column($result, 'dailyTrialStartedCount')),
            'dailyTrialExpiredCount' => array_sum(array_column($result, 'dailyTrialExpiredCount')),
            'dailyRiskEventCount' => array_sum(array_column($result, 'dailyRiskEventCount')),
        ];

        $this->db->execute(
            'INSERT INTO daily_platform_stats (
                stats_date, total_activated_count, daily_new_activated_count, daily_active_count, daily_trial_started_count, daily_trial_expired_count, daily_risk_event_count
             ) VALUES (
                :statsDate, :totalActivatedCount, :dailyNewActivatedCount, :dailyActiveCount, :dailyTrialStartedCount, :dailyTrialExpiredCount, :dailyRiskEventCount
             )
             ON DUPLICATE KEY UPDATE
                total_activated_count = VALUES(total_activated_count),
                daily_new_activated_count = VALUES(daily_new_activated_count),
                daily_active_count = VALUES(daily_active_count),
                daily_trial_started_count = VALUES(daily_trial_started_count),
                daily_trial_expired_count = VALUES(daily_trial_expired_count),
                daily_risk_event_count = VALUES(daily_risk_event_count)',
            $platform
        );

        return [
            'date' => $targetDate,
            'products' => $result,
            'platform' => $platform,
        ];
    }
}
