<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Approval;

use KeyTrialPro\shared\Persistence\Database;

final class ApprovalService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function listOpen(?int $productId = null): array
    {
        $sql = 'SELECT id, product_id, ticket_type, machine_id, status, requested_by, created_at
                FROM approval_tickets
                WHERE status IN (\'pending\', \'under_review\')';
        $params = [];

        if ($productId !== null) {
            $sql .= ' AND product_id = :productId';
            $params['productId'] = $productId;
        }

        return $this->db->select($sql . ' ORDER BY created_at ASC LIMIT 100', $params);
    }

    public function createTicket(int $productId, string $ticketType, string $machineId, ?string $requestedBy, ?string $reason): array
    {
        $this->db->execute(
            'INSERT INTO approval_tickets (product_id, ticket_type, machine_id, status, requested_by, reason, created_at, updated_at)
             VALUES (:productId, :ticketType, :machineId, :status, :requestedBy, :reason, UTC_TIMESTAMP(), UTC_TIMESTAMP())',
            [
                'productId' => $productId,
                'ticketType' => $ticketType,
                'machineId' => $machineId,
                'status' => 'pending',
                'requestedBy' => $requestedBy,
                'reason' => $reason,
            ]
        );

        $ticket = $this->db->selectOne(
            'SELECT id, product_id, ticket_type, machine_id, status, requested_by, reason, created_at
             FROM approval_tickets
             WHERE id = LAST_INSERT_ID()'
        );

        return $ticket ?? [];
    }

    public function decide(int $ticketId, string $decision, ?int $adminId, ?string $notes): array
    {
        $normalizedDecision = in_array($decision, ['approved', 'rejected'], true) ? $decision : 'rejected';

        $ticket = $this->db->selectOne(
            'SELECT id, product_id, ticket_type, machine_id, status
             FROM approval_tickets
             WHERE id = :ticketId
             LIMIT 1',
            ['ticketId' => $ticketId]
        );

        if ($ticket === null) {
            throw new \RuntimeException('Approval ticket not found.');
        }

        $this->db->execute(
            'UPDATE approval_tickets
             SET status = :status, updated_at = UTC_TIMESTAMP()
             WHERE id = :ticketId',
            [
                'status' => $normalizedDecision,
                'ticketId' => $ticketId,
            ]
        );

        $this->db->execute(
            'INSERT INTO approval_logs (ticket_id, admin_id, decision, notes, created_at)
             VALUES (:ticketId, :adminId, :decision, :notes, UTC_TIMESTAMP())',
            [
                'ticketId' => $ticketId,
                'adminId' => $adminId,
                'decision' => $normalizedDecision,
                'notes' => $notes,
            ]
        );

        return [
            'ticketId' => $ticketId,
            'previousStatus' => $ticket['status'],
            'status' => $normalizedDecision,
            'machineId' => $ticket['machine_id'],
            'productId' => (int) $ticket['product_id'],
        ];
    }
}
