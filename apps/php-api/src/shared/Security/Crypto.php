<?php

declare(strict_types=1);

namespace KeyTrialPro\shared\Security;

final class Crypto
{
    public function __construct(private readonly string $key)
    {
    }

    public function encrypt(string $plaintext): array
    {
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $this->normalizedKey(), OPENSSL_RAW_DATA, $iv, $tag);

        return [
            'ciphertext' => base64_encode($ciphertext ?: ''),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
        ];
    }

    public function decrypt(string $ciphertext, string $iv, string $tag): string
    {
        return (string) openssl_decrypt(
            base64_decode($ciphertext),
            'aes-256-gcm',
            $this->normalizedKey(),
            OPENSSL_RAW_DATA,
            base64_decode($iv),
            base64_decode($tag),
        );
    }

    public function hmac(string $payload): string
    {
        return hash_hmac('sha256', $payload, $this->normalizedKey());
    }

    private function normalizedKey(): string
    {
        return substr(hash('sha256', $this->key, true), 0, 32);
    }
}

