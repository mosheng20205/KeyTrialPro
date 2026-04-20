<?php

declare(strict_types=1);

namespace KeyTrialPro\shared\Security;

final class SignatureGuard
{
    public function __construct(private readonly string $hmacKey)
    {
    }

    public function verify(string $payload, string $signature): bool
    {
        $expected = hash_hmac('sha256', $payload, $this->hmacKey);
        return hash_equals($expected, $signature);
    }

    public function verifyWithSecret(string $payload, string $secret, string $signature): bool
    {
        $expected = hash_hmac('sha256', $payload, $secret);
        return hash_equals($expected, $signature);
    }

    public function signWithSecret(string $payload, string $secret): string
    {
        return hash_hmac('sha256', $payload, $secret);
    }
}
