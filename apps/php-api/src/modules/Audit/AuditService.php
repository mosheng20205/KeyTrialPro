<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Audit;

use KeyTrialPro\shared\Persistence\Database;

final class AuditService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function latest(?int $productId = null): array
    {
        $sql = 'SELECT id, product_id, actor_type, actor_id, action_code, target_type, target_id, ip_address, created_at
                FROM audit_logs';
        $params = [];

        if ($productId !== null) {
            $sql .= ' WHERE product_id = :productId';
            $params['productId'] = $productId;
        }

        return $this->db->select($sql . ' ORDER BY created_at DESC LIMIT 100', $params);
    }

    public function log(
        string $actorType,
        string $actorId,
        string $actionCode,
        string $targetType,
        string $targetId,
        ?int $productId = null,
        ?string $ipAddress = null,
        ?array $metadata = null,
    ): void {
        $this->db->execute(
            'INSERT INTO audit_logs (
                product_id, actor_type, actor_id, action_code, target_type, target_id, ip_address, metadata_json, created_at
             ) VALUES (
                :productId, :actorType, :actorId, :actionCode, :targetType, :targetId, :ipAddress, :metadataJson, UTC_TIMESTAMP()
             )',
            [
                'productId' => $productId,
                'actorType' => $actorType,
                'actorId' => $actorId,
                'actionCode' => $actionCode,
                'targetType' => $targetType,
                'targetId' => $targetId,
                'ipAddress' => $ipAddress,
                'metadataJson' => $metadata === null ? null : json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]
        );
    }
}
