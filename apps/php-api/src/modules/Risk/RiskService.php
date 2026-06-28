<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Risk;

use KeyTrialPro\shared\Persistence\Database;

final class RiskService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function latestEvents(?int $productId = null): array
    {
        $sql = 'SELECT re.id, re.product_id, re.machine_id, re.event_type, re.risk_level, re.summary, re.created_at, p.name AS product_name
                FROM risk_events re
                INNER JOIN products p ON p.id = re.product_id';
        $params = [];

        if ($productId !== null) {
            $sql .= ' WHERE re.product_id = :productId';
            $params['productId'] = $productId;
        }

        $sql .= ' ORDER BY re.created_at DESC LIMIT 50';

        return $this->db->select($sql, $params);
    }

    public function rules(?int $productId = null): array
    {
        $sql = 'SELECT id, product_id, rule_code, threshold_value, action_code, enabled
                FROM risk_rules';
        $params = [];

        if ($productId !== null) {
            $sql .= ' WHERE product_id = :productId';
            $params['productId'] = $productId;
        }

        return $this->db->select($sql . ' ORDER BY rule_code ASC', $params);
    }

    public function saveRule(int $productId, array $payload): array
    {
        $ruleCode = trim((string) ($payload['ruleCode'] ?? ''));
        $thresholdValue = trim((string) ($payload['thresholdValue'] ?? ''));
        $actionCode = trim((string) ($payload['actionCode'] ?? ''));
        $enabled = (int) (($payload['enabled'] ?? true) ? 1 : 0);

        if ($ruleCode === '' || $thresholdValue === '' || $actionCode === '') {
            throw new \InvalidArgumentException('ruleCode, thresholdValue, and actionCode are required.');
        }

        $this->db->execute(
            'INSERT INTO risk_rules (
                product_id, rule_code, threshold_value, action_code, enabled, created_at, updated_at
             ) VALUES (
                :productId, :ruleCode, :thresholdValue, :actionCode, :enabled, UTC_TIMESTAMP(), UTC_TIMESTAMP()
             )
             ON DUPLICATE KEY UPDATE
                threshold_value = VALUES(threshold_value),
                action_code = VALUES(action_code),
                enabled = VALUES(enabled),
                updated_at = UTC_TIMESTAMP()',
            [
                'productId' => $productId,
                'ruleCode' => $ruleCode,
                'thresholdValue' => $thresholdValue,
                'actionCode' => $actionCode,
                'enabled' => $enabled,
            ]
        );

        return [
            'productId' => $productId,
            'ruleCode' => $ruleCode,
            'thresholdValue' => $thresholdValue,
            'actionCode' => $actionCode,
            'enabled' => (bool) $enabled,
        ];
    }

    public function recordEvent(int $productId, string $machineId, string $eventType, string $riskLevel, string $summary, ?array $payload = null): void
    {
        $existing = $this->db->selectOne(
            'SELECT id
             FROM risk_events
             WHERE product_id = :productId
               AND machine_id = :machineId
               AND event_type = :eventType
               AND created_at >= (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)
             ORDER BY id DESC
             LIMIT 1',
            [
                'productId' => $productId,
                'machineId' => $machineId,
                'eventType' => $eventType,
            ]
        );

        if ($existing !== null) {
            return;
        }

        $this->db->execute(
            'INSERT INTO risk_events (product_id, machine_id, event_type, risk_level, summary, payload_json, created_at)
             VALUES (:productId, :machineId, :eventType, :riskLevel, :summary, :payloadJson, UTC_TIMESTAMP())',
            [
                'productId' => $productId,
                'machineId' => $machineId,
                'eventType' => $eventType,
                'riskLevel' => $riskLevel,
                'summary' => $summary,
                'payloadJson' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]
        );
    }

    public function captureEnvironmentSignals(int $productId, string $machineId, array $snapshot): void
    {
        if ((bool) ($snapshot['antiDebug'] ?? false)) {
            $this->recordEvent(
                $productId,
                $machineId,
                'debugger_detected',
                'critical',
                'Debugger flag detected during client attestation.',
                ['snapshot' => $snapshot]
            );
        }

        if ((bool) ($snapshot['antiHook'] ?? false)) {
            $this->recordEvent(
                $productId,
                $machineId,
                'api_hook_detected',
                'critical',
                'Inline hook traits detected on monitored Win32 APIs.',
                ['snapshot' => $snapshot]
            );
        }

        if (!(bool) ($snapshot['codeIntegrityOk'] ?? true)) {
            $this->recordEvent(
                $productId,
                $machineId,
                'code_integrity_failed',
                'critical',
                'Native DLL code section integrity check failed.',
                ['snapshot' => $snapshot]
            );
        }

        if ((bool) ($snapshot['antiVm'] ?? false)) {
            $this->recordEvent(
                $productId,
                $machineId,
                'vm_detected',
                'high',
                'Virtual machine traits detected during client attestation.',
                ['snapshot' => $snapshot]
            );
        }

        if ((bool) ($snapshot['suspiciousModules'] ?? false)) {
            $this->recordEvent(
                $productId,
                $machineId,
                'suspicious_module_detected',
                'high',
                'Suspicious module names were found in the current process.',
                [
                    'suspiciousModuleNames' => (string) ($snapshot['suspiciousModuleNames'] ?? ''),
                ]
            );
        }
    }

    public function evaluateClientRiskSignals(?array $riskSignals): array
    {
        if ($riskSignals === null || $riskSignals === []) {
            return [
                'authorized' => true,
                'riskLevel' => 'low',
                'blockReason' => '',
                'events' => [],
            ];
        }

        $events = [];
        $blockReasons = [];

        if ((bool) ($riskSignals['debuggerAttached'] ?? false)) {
            $events[] = ['debugger_detected', 'critical', 'Debugger attached flag reported by client.'];
            $blockReasons[] = '检测到调试器';
        }

        if ((bool) ($riskSignals['apiHookDetected'] ?? false)) {
            $events[] = ['api_hook_detected', 'critical', 'API hook flag reported by client.'];
            $blockReasons[] = '检测到 Hook 或注入环境';
        }

        if (array_key_exists('codeIntegrityOk', $riskSignals) && !(bool) $riskSignals['codeIntegrityOk']) {
            $events[] = ['code_integrity_failed', 'critical', 'Client code integrity check failed.'];
            $blockReasons[] = '客户端完整性校验异常';
        }

        if ((bool) ($riskSignals['systemProxyEnabled'] ?? false)) {
            $events[] = ['proxy_detected', 'critical', 'System proxy reported by client.'];
            $proxyAddress = strtolower((string) ($riskSignals['systemProxyAddress'] ?? ''));
            if ($proxyAddress === '' || preg_match('/127\.0\.0\.1|localhost|:8888|:8080|:9090|:8000|fiddler|charles|burp|mitm/', $proxyAddress) === 1) {
                $blockReasons[] = '检测到系统代理';
            }
        }

        $processes = $riskSignals['suspiciousProcesses'] ?? [];
        if (is_array($processes) && $processes !== []) {
            $events[] = ['suspicious_process_detected', 'critical', 'Suspicious process names reported by client.'];
            $processText = strtolower(implode(' ', array_map('strval', $processes)));
            if (preg_match('/fiddler|charles|mitmproxy|burp|httptoolkit|proxyman|x64dbg|x32dbg|dnspy|ollydbg|ida|frida|cheatengine|cheat engine/', $processText) === 1) {
                $blockReasons[] = '检测到抓包、调试或逆向工具';
            }
        }

        $certificates = $riskSignals['suspiciousRootCertificates'] ?? [];
        if (is_array($certificates) && $certificates !== []) {
            $events[] = ['suspicious_root_ca_detected', 'critical', 'Suspicious root certificates reported by client.'];
            $blockReasons[] = '检测到可疑根证书';
        }

        $modules = $riskSignals['suspiciousModules'] ?? [];
        if (is_array($modules) && $modules !== []) {
            $events[] = ['suspicious_module_detected', 'high', 'Suspicious modules reported by client.'];
            $blockReasons[] = '检测到可疑模块';
        }

        if ((bool) ($riskSignals['vmDetected'] ?? false)) {
            $events[] = ['vm_detected', 'medium', 'Virtual machine flag reported by client.'];
        }

        $dedupedEvents = [];
        foreach ($events as $event) {
            $dedupedEvents[$event[0]] = $event;
        }

        $blockReasons = array_values(array_unique($blockReasons));
        $authorized = $blockReasons === [];

        return [
            'authorized' => $authorized,
            'riskLevel' => $authorized ? ($dedupedEvents === [] ? 'low' : 'medium') : 'critical',
            'blockReason' => $authorized ? '' : implode('；', $blockReasons) . '，请关闭相关工具后重试。',
            'events' => array_values($dedupedEvents),
        ];
    }

    public function recordClientRiskSignals(int $productId, string $machineId, array $riskSignals, array $decision): void
    {
        foreach ($decision['events'] ?? [] as $event) {
            $this->recordEvent(
                $productId,
                $machineId,
                (string) $event[0],
                (string) $event[1],
                (string) $event[2],
                ['riskSignals' => $riskSignals]
            );
        }
    }
}
