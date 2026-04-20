<?php

declare(strict_types=1);

namespace KeyTrialPro\bootstrap;

use KeyTrialPro\modules\Admin\AdminAccountService;
use KeyTrialPro\modules\Admin\AdminAuthService;
use KeyTrialPro\modules\Approval\ApprovalService;
use KeyTrialPro\modules\Audit\AuditService;
use KeyTrialPro\modules\Fingerprint\FingerprintService;
use KeyTrialPro\modules\License\LicenseService;
use KeyTrialPro\modules\Policy\PolicyService;
use KeyTrialPro\modules\Product\ProductService;
use KeyTrialPro\modules\Risk\RiskService;
use KeyTrialPro\modules\SecurityProfile\SecurityProfileService;
use KeyTrialPro\modules\Stats\StatsService;
use KeyTrialPro\shared\Persistence\Database;
use KeyTrialPro\shared\Security\Crypto;
use KeyTrialPro\shared\Security\ReplayGuard;
use KeyTrialPro\shared\Security\SignatureGuard;

final class App
{
    public static function boot(): array
    {
        $config = config::load();
        $database = new Database($config['db']);
        $crypto = new Crypto($config['security']['dataEncryptionKey']);
        $adminAccountService = new AdminAccountService($database);
        $adminAccountService->syncBootstrapAdmin($config['security']['adminBootstrap']);

        return [
            'config' => $config,
            'db' => $database,
            'crypto' => $crypto,
            'signatureGuard' => new SignatureGuard($config['security']['apiHmacKey']),
            'replayGuard' => new ReplayGuard($database),
            'productService' => new ProductService($database),
            'fingerprintService' => new FingerprintService($database, $crypto),
            'riskService' => new RiskService($database),
            'licenseService' => new LicenseService($database, $crypto),
            'policyService' => new PolicyService($database),
            'securityProfileService' => new SecurityProfileService($database),
            'statsService' => new StatsService($database, $config['presence']['windowSeconds']),
            'approvalService' => new ApprovalService($database),
            'adminAuthService' => new AdminAuthService($database, $config['security']['adminJwtSecret']),
            'adminAccountService' => $adminAccountService,
            'auditService' => new AuditService($database),
        ];
    }
}
