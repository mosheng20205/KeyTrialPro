CREATE DATABASE IF NOT EXISTS keytrialpro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE keytrialpro;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    client_app_key VARCHAR(128) NOT NULL DEFAULT '',
    trial_duration_minutes INT NOT NULL DEFAULT 60,
    heartbeat_interval_seconds INT NOT NULL DEFAULT 180,
    offline_grace_minutes INT NOT NULL DEFAULT 5,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_security_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    machine_binding_mode VARCHAR(32) NOT NULL DEFAULT 'strict',
    anti_debug_enabled TINYINT(1) NOT NULL DEFAULT 1,
    anti_vm_enabled TINYINT(1) NOT NULL DEFAULT 1,
    hook_detection_enabled TINYINT(1) NOT NULL DEFAULT 1,
    challenge_fail_tolerance INT NOT NULL DEFAULT 3,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_security_profile_product (product_id),
    CONSTRAINT fk_product_security_profile_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS license_policies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    policy_code VARCHAR(64) NOT NULL,
    license_type VARCHAR(32) NOT NULL,
    max_bindings INT NOT NULL DEFAULT 1,
    rebind_limit INT NOT NULL DEFAULT 3,
    requires_manual_review_after_limit TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_license_policy (product_id, policy_code),
    CONSTRAINT fk_license_policy_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS trial_policies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    trial_duration_minutes INT NOT NULL DEFAULT 60,
    heartbeat_interval_seconds INT NOT NULL DEFAULT 180,
    offline_grace_minutes INT NOT NULL DEFAULT 5,
    max_rebind_count INT NOT NULL DEFAULT 3,
    degrade_mode VARCHAR(32) NOT NULL DEFAULT 'read_only',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_trial_policy_product (product_id),
    CONSTRAINT fk_trial_policy_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS licenses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    license_key VARCHAR(128) NOT NULL UNIQUE,
    license_type VARCHAR(32) NOT NULL DEFAULT 'standard',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    max_bindings INT NOT NULL DEFAULT 1,
    expires_at DATETIME NULL,
    metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_license_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS license_bindings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    license_id BIGINT UNSIGNED NULL,
    machine_id CHAR(64) NOT NULL,
    machine_hash CHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    bound_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_verified_at DATETIME NULL,
    UNIQUE KEY uq_product_machine (product_id, machine_id),
    KEY idx_binding_product_status (product_id, status),
    CONSTRAINT fk_binding_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_binding_license FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Upgrade note:
-- Versions before the 2026-04-21 activation fix could leave license_bindings.license_id
-- pointing at an older license when the same machine re-activated with a new card key.
-- The server-side fix now updates license_id and machine_hash during the
-- INSERT ... ON DUPLICATE KEY UPDATE path in LicenseService::activateLicense().
--
-- For upgraded production databases, verify bindings with:
--   SELECT id, product_id, license_id, machine_id, machine_hash, status
--   FROM license_bindings
--   WHERE product_id = <product_id> AND machine_id = '<machine_id>';
--
-- If a row still points to an older license, repair it with:
--   UPDATE license_bindings
--   SET license_id = <new_license_id>,
--       machine_hash = '<machine_hash>',
--       status = 'active',
--       bound_at = UTC_TIMESTAMP(),
--       last_verified_at = UTC_TIMESTAMP()
--   WHERE product_id = <product_id>
--     AND machine_id = '<machine_id>';

CREATE TABLE IF NOT EXISTS machine_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    machine_id CHAR(64) NOT NULL,
    fingerprint_hash CHAR(64) NOT NULL,
    encrypted_payload MEDIUMTEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    risk_flags_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_machine_snapshot_product_machine (product_id, machine_id),
    CONSTRAINT fk_machine_snapshot_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS challenge_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    challenge_id VARCHAR(32) NOT NULL UNIQUE,
    product_code VARCHAR(64) NOT NULL,
    machine_hash CHAR(64) NOT NULL,
    signature_subject CHAR(64) NOT NULL,
    challenge_value VARCHAR(128) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_challenge_product_machine (product_code, machine_hash)
);

CREATE TABLE IF NOT EXISTS trial_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trial_session_id VARCHAR(32) NOT NULL UNIQUE,
    product_id BIGINT UNSIGNED NOT NULL,
    machine_id CHAR(64) NOT NULL,
    started_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    last_verify_at DATETIME NULL,
    last_server_time_at DATETIME NULL,
    offline_grace_expires_at DATETIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_trial_product_machine (product_id, machine_id),
    CONSTRAINT fk_trial_session_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS presence_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    machine_id CHAR(64) NOT NULL,
    sdk_version VARCHAR(32) NOT NULL,
    last_ip VARCHAR(64) NULL,
    last_seen_at DATETIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'online',
    UNIQUE KEY uq_presence_product_machine (product_id, machine_id),
    KEY idx_presence_last_seen (last_seen_at),
    CONSTRAINT fk_presence_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS daily_product_stats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stats_date DATE NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    total_activated_count INT NOT NULL DEFAULT 0,
    daily_new_activated_count INT NOT NULL DEFAULT 0,
    daily_active_count INT NOT NULL DEFAULT 0,
    daily_trial_started_count INT NOT NULL DEFAULT 0,
    daily_trial_expired_count INT NOT NULL DEFAULT 0,
    daily_risk_event_count INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_daily_product_stats (stats_date, product_id),
    CONSTRAINT fk_daily_product_stats_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS daily_platform_stats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stats_date DATE NOT NULL UNIQUE,
    total_activated_count INT NOT NULL DEFAULT 0,
    daily_new_activated_count INT NOT NULL DEFAULT 0,
    daily_active_count INT NOT NULL DEFAULT 0,
    daily_trial_started_count INT NOT NULL DEFAULT 0,
    daily_trial_expired_count INT NOT NULL DEFAULT 0,
    daily_risk_event_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS risk_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    rule_code VARCHAR(64) NOT NULL,
    threshold_value VARCHAR(64) NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_risk_rule (product_id, rule_code),
    CONSTRAINT fk_risk_rule_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS risk_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    machine_id CHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    risk_level VARCHAR(32) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    payload_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_risk_event_product_time (product_id, created_at),
    CONSTRAINT fk_risk_event_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS approval_tickets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    ticket_type VARCHAR(64) NOT NULL,
    machine_id CHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(128) NULL,
    reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_approval_ticket_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS approval_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT UNSIGNED NOT NULL,
    admin_id BIGINT UNSIGNED NULL,
    decision VARCHAR(32) NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_approval_log_ticket FOREIGN KEY (ticket_id) REFERENCES approval_tickets(id)
);

CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(160) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '$2y$10$placeholder.hash.for.bootstrap.only',
    mfa_secret VARCHAR(64) NOT NULL DEFAULT 'JBSWY3DPEHPK3PXP',
    role_code VARCHAR(64) NOT NULL DEFAULT 'platform_super_admin',
    mfa_enabled TINYINT(1) NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default bootstrap administrator:
--   email: admin@example.com
--   password: admin123
-- Runtime note:
--   Day-to-day changes should be done in the admin web UI.
--   Optional .env bootstrap keys can create or force-sync an admin account:
--   ADMIN_BOOTSTRAP_EMAIL
--   ADMIN_BOOTSTRAP_PASSWORD
--   ADMIN_BOOTSTRAP_DISPLAY_NAME
--   ADMIN_BOOTSTRAP_MFA_ENABLED
--   ADMIN_BOOTSTRAP_MFA_SECRET
--   ADMIN_BOOTSTRAP_FORCE_SYNC

CREATE TABLE IF NOT EXISTS client_request_nonces (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    nonce VARCHAR(64) NOT NULL,
    subject_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    UNIQUE KEY uq_request_nonce (product_id, nonce),
    KEY idx_request_nonce_expiry (expires_at),
    CONSTRAINT fk_client_request_nonce_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    permissions_json JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_role_scopes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_scope_admin FOREIGN KEY (admin_id) REFERENCES admins(id),
    CONSTRAINT fk_admin_scope_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_admin_scope_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(64) NULL,
    metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_created_at (created_at),
    CONSTRAINT fk_audit_product FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO products (product_code, name, client_app_key, trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes)
VALUES
    ('desktop-pro', 'Desktop Pro', 'desktop-pro-app-key', 60, 180, 5),
    ('studio-max', 'Studio Max', 'studio-max-app-key', 1440, 300, 10)
ON DUPLICATE KEY UPDATE name = VALUES(name), client_app_key = VALUES(client_app_key);

INSERT INTO admins (email, display_name, role_code, mfa_enabled, password_hash, status)
VALUES ('admin@example.com', 'Platform Administrator', 'platform_super_admin', 1, '$2y$10$U6Jg4J3nrgmk99W5exov/.0pOn46qAOkwulw0Y8hTpGZLWlfo61lm', 'active')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash), status = VALUES(status);

INSERT INTO roles (role_code, display_name, permissions_json)
VALUES
    ('platform_super_admin', 'Platform Super Admin', JSON_ARRAY('products:*', 'licenses:*', 'risk:*', 'audit:*', 'approvals:*')),
    ('product_admin', 'Product Admin', JSON_ARRAY('product:read', 'license:write', 'risk:read', 'approval:read')),
    ('risk_reviewer', 'Risk Reviewer', JSON_ARRAY('risk:read', 'approval:write')),
    ('auditor', 'Auditor', JSON_ARRAY('audit:read', 'product:read'))
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO licenses (product_id, license_key, license_type, status, max_bindings, expires_at, metadata_json)
SELECT p.id, 'DESKTOP-PRO-001', 'standard', 'active', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), JSON_OBJECT('seed', true)
FROM products p
WHERE p.product_code = 'desktop-pro'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO licenses (product_id, license_key, license_type, status, max_bindings, expires_at, metadata_json)
SELECT p.id, 'STUDIO-MAX-001', 'premium', 'active', 2, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 DAY), JSON_OBJECT('seed', true)
FROM products p
WHERE p.product_code = 'studio-max'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO trial_policies (product_id, trial_duration_minutes, heartbeat_interval_seconds, offline_grace_minutes, max_rebind_count, degrade_mode)
SELECT p.id, p.trial_duration_minutes, p.heartbeat_interval_seconds, p.offline_grace_minutes, 3, 'read_only'
FROM products p
ON DUPLICATE KEY UPDATE
    trial_duration_minutes = VALUES(trial_duration_minutes),
    heartbeat_interval_seconds = VALUES(heartbeat_interval_seconds),
    offline_grace_minutes = VALUES(offline_grace_minutes),
    max_rebind_count = VALUES(max_rebind_count),
    degrade_mode = VALUES(degrade_mode);

INSERT INTO license_policies (product_id, policy_code, license_type, max_bindings, rebind_limit, requires_manual_review_after_limit)
SELECT p.id, 'default', 'standard', 1, 3, 1
FROM products p
ON DUPLICATE KEY UPDATE
    license_type = VALUES(license_type),
    max_bindings = VALUES(max_bindings),
    rebind_limit = VALUES(rebind_limit),
    requires_manual_review_after_limit = VALUES(requires_manual_review_after_limit);

INSERT INTO risk_rules (product_id, rule_code, threshold_value, action_code, enabled)
SELECT p.id, 'hardware_change_score', '50', 'manual_review', 1
FROM products p
ON DUPLICATE KEY UPDATE threshold_value = VALUES(threshold_value), action_code = VALUES(action_code), enabled = VALUES(enabled);

INSERT INTO risk_rules (product_id, rule_code, threshold_value, action_code, enabled)
SELECT p.id, 'challenge_failure_limit', '3', 'temporary_block', 1
FROM products p
ON DUPLICATE KEY UPDATE threshold_value = VALUES(threshold_value), action_code = VALUES(action_code), enabled = VALUES(enabled);
