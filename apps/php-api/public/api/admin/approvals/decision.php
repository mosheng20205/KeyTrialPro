<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../../src/bootstrap/endpoint.php';
use KeyTrialPro\shared\Security\AdminTokenGuard;

$app = api_bootstrap();
AdminTokenGuard::requireAuth($app['config']['security']['adminJwtSecret']);
$request = api_request();
$ticketId = (int) $request->input('ticketId', 0);

if ($ticketId <= 0) {
    api_error('ticketId is required', 'VALIDATION_ERROR', 422);
}

try {
    $result = $app['approvalService']->decide(
        $ticketId,
        (string) $request->input('decision', 'rejected'),
        (int) $request->input('adminId', 0),
        (string) $request->input('notes', '')
    );

    $app['auditService']->log(
        'admin',
        (string) $request->input('adminId', 'system'),
        'approval.decide',
        'approval_ticket',
        (string) $ticketId,
        $result['productId'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        $result
    );

    api_ok([
        'status' => $result['status'],
        'decision' => $result,
    ]);
} catch (\RuntimeException $exception) {
    api_error($exception->getMessage(), 'APPROVAL_NOT_FOUND', 404);
}
