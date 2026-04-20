<?php

declare(strict_types=1);

namespace KeyTrialPro\shared\Security;

use KeyTrialPro\shared\Http\JsonResponse;

final class AdminTokenGuard
{
    public static function validate(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $signature] = $parts;
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payloadJson = base64_decode($encodedPayload, true);
        if ($payloadJson === false) {
            return null;
        }

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && (int) $payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }

    public static function requireAuth(string $secret): array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!str_starts_with($header, 'Bearer ')) {
            JsonResponse::send([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHORIZED',
                    'message' => 'Missing token',
                ],
                'serverTime' => gmdate(DATE_ATOM),
            ], 401);
        }

        $token = substr($header, 7);
        $payload = self::validate($token, $secret);

        if ($payload === null) {
            JsonResponse::send([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHORIZED',
                    'message' => 'Invalid token',
                ],
                'serverTime' => gmdate(DATE_ATOM),
            ], 401);
        }

        return $payload;
    }
}