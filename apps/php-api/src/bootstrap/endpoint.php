<?php

declare(strict_types=1);

use KeyTrialPro\bootstrap\App;
use KeyTrialPro\shared\Http\JsonResponse;
use KeyTrialPro\shared\Http\Request;

require_once __DIR__ . '/autoload.php';

function api_bootstrap(): array
{
    return App::boot();
}

function api_request(): Request
{
    return Request::capture();
}

function api_ok(array $data, int $status = 200): never
{
    JsonResponse::send([
        'success' => true,
        'data' => $data,
        'serverTime' => gmdate(DATE_ATOM),
    ], $status);
}

function api_error(string $message, string $code = 'APP_ERROR', int $status = 400): never
{
    JsonResponse::send([
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
        ],
        'serverTime' => gmdate(DATE_ATOM),
    ], $status);
}

function api_verify_client_signature(array $app, \KeyTrialPro\shared\Http\Request $request, array $product, string $subject): void
{
    $appKey = (string) $request->input('appKey', '');
    $timestamp = (string) $request->input('timestamp', '');
    $nonce = (string) $request->input('nonce', '');
    $signature = (string) $request->input('signature', '');

    if ($appKey === '' || $timestamp === '' || $nonce === '' || $signature === '') {
        api_error('appKey, timestamp, nonce, and signature are required', 'AUTH_SIGNATURE_MISSING', 401);
    }

    $productKey = (string) ($product['client_app_key'] ?? '');
    if ($productKey === '' || !hash_equals($productKey, $appKey)) {
        api_error('Client app key is invalid for product', 'AUTH_APP_KEY_INVALID', 401);
    }

    if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
        api_error('Request timestamp is outside the allowed window', 'AUTH_TIMESTAMP_INVALID', 401);
    }

    $payload = implode('|', [
        $product['product_code'],
        $timestamp,
        $nonce,
        $subject,
    ]);

    // Use product's own client_app_key for HMAC verification
    $expected = hash_hmac('sha256', $payload, $productKey);
    if (!hash_equals($expected, $signature)) {
        api_error('Request signature is invalid', 'AUTH_SIGNATURE_INVALID', 401);
    }

    try {
        $app['replayGuard']->assertUnique((int) $product['id'], $nonce, $subject);
    } catch (\RuntimeException $exception) {
        api_error($exception->getMessage(), 'AUTH_REPLAY_DETECTED', 409);
    }
}
