<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Admin;

use KeyTrialPro\shared\Persistence\Database;

final class AdminAuthService
{
    public function __construct(
        private readonly Database $db,
        private readonly string $jwtSecret,
    ) {
    }

    public function attempt(string $email, string $password): array
    {
        $admin = $this->db->selectOne(
            'SELECT id, email, display_name, role_code, mfa_enabled, password_hash, status
             FROM admins
             WHERE email = :email
             LIMIT 1',
            ['email' => $email]
        );

        if ($admin === null || $admin['status'] !== 'active') {
            return ['authenticated' => false, 'requiresMfa' => false];
        }

        $hash = (string) ($admin['password_hash'] ?? '');
        if ($hash !== '' && !password_verify($password, $hash)) {
            return ['authenticated' => false, 'requiresMfa' => false];
        }

        if ((bool) $admin['mfa_enabled']) {
            return [
                'authenticated' => true,
                'requiresMfa' => true,
                'challengeToken' => $this->issueSessionToken((int) $admin['id'], (string) $admin['email'], 'mfa_challenge'),
            ];
        }

        return [
            'authenticated' => true,
            'requiresMfa' => false,
            'token' => $this->issueSessionToken((int) $admin['id'], (string) $admin['email'], (string) ($admin['role_code'] ?? 'admin')),
            'admin' => [
                'id' => (int) $admin['id'],
                'email' => $admin['email'],
                'displayName' => $admin['display_name'],
                'roleCode' => $admin['role_code'],
            ],
        ];
    }

    public function verifyMfa(string $email, string $code): array
    {
        $admin = $this->db->selectOne(
            'SELECT id, email, display_name, role_code, mfa_enabled, mfa_secret, status
             FROM admins
             WHERE email = :email
             LIMIT 1',
            ['email' => $email]
        );

        if ($admin === null || $admin['status'] !== 'active') {
            throw new \RuntimeException('Admin account not found or inactive.');
        }

        if (!preg_match('/^\d{6}$/', $code)) {
            throw new \RuntimeException('MFA code must be a 6-digit value.');
        }

        if ((bool) $admin['mfa_enabled']) {
            $secret = (string) ($admin['mfa_secret'] ?? '');
            if ($secret === '' || !$this->verifyTotp($secret, $code)) {
                throw new \RuntimeException('MFA code is invalid.');
            }
        }

        return [
            'status' => 'verified',
            'token' => $this->issueSessionToken((int) $admin['id'], (string) $admin['email'], (string) $admin['role_code']),
            'admin' => [
                'id' => (int) $admin['id'],
                'email' => $admin['email'],
                'displayName' => $admin['display_name'],
                'roleCode' => $admin['role_code'],
            ],
        ];
    }

    private function issueSessionToken(int $adminId, string $email, string $scope): string
    {
        $payload = [
            'sub' => $adminId,
            'email' => $email,
            'scope' => $scope,
            'iat' => time(),
            'exp' => time() + 3600,
        ];

        $encodedPayload = base64_encode(json_encode($payload, JSON_UNESCAPED_SLASHES) ?: '{}');
        $signature = hash_hmac('sha256', $encodedPayload, $this->jwtSecret);

        return $encodedPayload . '.' . $signature;
    }

    private function verifyTotp(string $base32Secret, string $code, int $window = 1): bool
    {
        $secret = $this->base32Decode($base32Secret);
        if ($secret === '') {
            return false;
        }

        $timeSlice = (int) floor(time() / 30);
        for ($offset = -$window; $offset <= $window; $offset++) {
            if (hash_equals($this->generateTotp($secret, $timeSlice + $offset), $code)) {
                return true;
            }
        }

        return false;
    }

    private function generateTotp(string $secret, int $timeSlice): string
    {
        $binaryTime = pack('N*', 0) . pack('N*', $timeSlice);
        $hash = hash_hmac('sha1', $binaryTime, $secret, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $segment = substr($hash, $offset, 4);
        $value = unpack('N', $segment)[1] & 0x7FFFFFFF;

        return str_pad((string) ($value % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $value): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $value = strtoupper($value);
        $value = preg_replace('/[^A-Z2-7]/', '', $value) ?? '';

        $bits = '';
        $output = '';
        foreach (str_split($value) as $char) {
            $position = strpos($alphabet, $char);
            if ($position === false) {
                return '';
            }
            $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
        }

        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $output .= chr(bindec($chunk));
            }
        }

        return $output;
    }
}
