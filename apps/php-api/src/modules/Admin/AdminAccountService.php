<?php

declare(strict_types=1);

namespace KeyTrialPro\modules\Admin;

use KeyTrialPro\shared\Persistence\Database;

final class AdminAccountService
{
    public function __construct(private readonly Database $db)
    {
    }

    public function syncBootstrapAdmin(array $bootstrapConfig): void
    {
        $email = $this->normalizeEmail((string) ($bootstrapConfig['email'] ?? ''));
        $password = (string) ($bootstrapConfig['password'] ?? '');

        if ($email === '' || $password === '') {
            return;
        }

        $displayName = trim((string) ($bootstrapConfig['displayName'] ?? 'Platform Administrator'));
        $displayName = $displayName === '' ? 'Platform Administrator' : $displayName;
        $mfaEnabled = (bool) ($bootstrapConfig['mfaEnabled'] ?? true);
        $mfaSecret = $this->normalizeMfaSecret((string) ($bootstrapConfig['mfaSecret'] ?? ''));
        $forceSync = (bool) ($bootstrapConfig['forceSync'] ?? false);

        $existing = $this->db->selectOne(
            'SELECT id FROM admins WHERE email = :email LIMIT 1',
            ['email' => $email]
        );

        if ($existing === null) {
            $this->db->execute(
                'INSERT INTO admins (email, display_name, password_hash, mfa_secret, role_code, mfa_enabled, status, created_at)
                 VALUES (:email, :displayName, :passwordHash, :mfaSecret, :roleCode, :mfaEnabled, :status, UTC_TIMESTAMP())',
                [
                    'email' => $email,
                    'displayName' => $displayName,
                    'passwordHash' => password_hash($password, PASSWORD_BCRYPT),
                    'mfaSecret' => $mfaSecret !== '' ? $mfaSecret : 'JBSWY3DPEHPK3PXP',
                    'roleCode' => 'platform_super_admin',
                    'mfaEnabled' => $mfaEnabled ? 1 : 0,
                    'status' => 'active',
                ]
            );

            return;
        }

        if (!$forceSync) {
            return;
        }

        $params = [
            'id' => (int) $existing['id'],
            'displayName' => $displayName,
            'passwordHash' => password_hash($password, PASSWORD_BCRYPT),
            'mfaEnabled' => $mfaEnabled ? 1 : 0,
        ];

        $sql = 'UPDATE admins
                SET display_name = :displayName,
                    password_hash = :passwordHash,
                    mfa_enabled = :mfaEnabled,
                    status = :status';
        $params['status'] = 'active';

        if ($mfaSecret !== '') {
            $sql .= ', mfa_secret = :mfaSecret';
            $params['mfaSecret'] = $mfaSecret;
        }

        $sql .= ' WHERE id = :id';

        $this->db->execute($sql, $params);
    }

    public function getProfile(int $adminId): ?array
    {
        $admin = $this->db->selectOne(
            'SELECT id, email, display_name, role_code, mfa_enabled, mfa_secret, status
             FROM admins
             WHERE id = :id
             LIMIT 1',
            ['id' => $adminId]
        );

        return $admin === null ? null : $this->mapProfile($admin);
    }

    public function updateProfile(int $adminId, string $email, string $displayName, bool $mfaEnabled): array
    {
        $email = $this->normalizeEmail($email);
        $displayName = trim($displayName);

        if ($email === '') {
            throw new \InvalidArgumentException('Administrator email is required.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Administrator email format is invalid.');
        }

        if ($displayName === '') {
            throw new \InvalidArgumentException('Display name is required.');
        }

        $admin = $this->db->selectOne(
            'SELECT id, mfa_secret
             FROM admins
             WHERE id = :id
             LIMIT 1',
            ['id' => $adminId]
        );

        if ($admin === null) {
            throw new \RuntimeException('Administrator account not found.');
        }

        $duplicate = $this->db->selectOne(
            'SELECT id FROM admins WHERE email = :email AND id <> :id LIMIT 1',
            ['email' => $email, 'id' => $adminId]
        );

        if ($duplicate !== null) {
            throw new \RuntimeException('Administrator email is already in use.');
        }

        $mfaSecret = $this->normalizeMfaSecret((string) ($admin['mfa_secret'] ?? ''));
        if ($mfaEnabled && $mfaSecret === '') {
            $mfaSecret = $this->generateBase32Secret();
        }

        $this->db->execute(
            'UPDATE admins
             SET email = :email,
                 display_name = :displayName,
                 mfa_enabled = :mfaEnabled,
                 mfa_secret = :mfaSecret
             WHERE id = :id',
            [
                'id' => $adminId,
                'email' => $email,
                'displayName' => $displayName,
                'mfaEnabled' => $mfaEnabled ? 1 : 0,
                'mfaSecret' => $mfaSecret !== '' ? $mfaSecret : 'JBSWY3DPEHPK3PXP',
            ]
        );

        $profile = $this->getProfile($adminId);
        if ($profile === null) {
            throw new \RuntimeException('Administrator account not found after update.');
        }

        return $profile;
    }

    public function changePassword(int $adminId, string $currentPassword, string $newPassword): void
    {
        if ($currentPassword === '') {
            throw new \InvalidArgumentException('Current password is required.');
        }

        if (strlen($newPassword) < 8) {
            throw new \InvalidArgumentException('New password must be at least 8 characters.');
        }

        $admin = $this->db->selectOne(
            'SELECT password_hash
             FROM admins
             WHERE id = :id
             LIMIT 1',
            ['id' => $adminId]
        );

        if ($admin === null) {
            throw new \RuntimeException('Administrator account not found.');
        }

        $hash = (string) ($admin['password_hash'] ?? '');
        if ($hash === '' || !password_verify($currentPassword, $hash)) {
            throw new \RuntimeException('Current password is incorrect.');
        }

        $this->db->execute(
            'UPDATE admins
             SET password_hash = :passwordHash
             WHERE id = :id',
            [
                'id' => $adminId,
                'passwordHash' => password_hash($newPassword, PASSWORD_BCRYPT),
            ]
        );
    }

    private function mapProfile(array $admin): array
    {
        $mfaSecret = $this->normalizeMfaSecret((string) ($admin['mfa_secret'] ?? ''));

        return [
            'id' => (int) $admin['id'],
            'email' => (string) $admin['email'],
            'displayName' => (string) $admin['display_name'],
            'roleCode' => (string) $admin['role_code'],
            'status' => (string) $admin['status'],
            'mfaEnabled' => (bool) $admin['mfa_enabled'],
            'mfaSecret' => $mfaSecret,
            'mfaProvisioningUri' => $mfaSecret === ''
                ? null
                : sprintf(
                    'otpauth://totp/%s?secret=%s&issuer=%s',
                    rawurlencode('KeyTrialPro:' . (string) $admin['email']),
                    rawurlencode($mfaSecret),
                    rawurlencode('KeyTrialPro')
                ),
        ];
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function normalizeMfaSecret(string $secret): string
    {
        return strtoupper(trim($secret));
    }

    private function generateBase32Secret(int $length = 32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bytes = random_bytes($length);
        $secret = '';

        for ($index = 0; $index < $length; $index++) {
            $secret .= $alphabet[ord($bytes[$index]) % strlen($alphabet)];
        }

        return $secret;
    }
}
