USE keytrialpro;

DROP PROCEDURE IF EXISTS ktp_add_license_admin_column;

DELIMITER //
CREATE PROCEDURE ktp_add_license_admin_column(
    IN p_column_name VARCHAR(64),
    IN p_alter_sql TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'licenses'
          AND COLUMN_NAME = p_column_name
    ) THEN
        SET @ddl = p_alter_sql;
        PREPARE statement FROM @ddl;
        EXECUTE statement;
        DEALLOCATE PREPARE statement;
    END IF;
END//
DELIMITER ;

CALL ktp_add_license_admin_column(
    'activation_mode',
    'ALTER TABLE licenses ADD COLUMN activation_mode VARCHAR(32) NOT NULL DEFAULT ''fixed'' AFTER max_bindings'
);

CALL ktp_add_license_admin_column(
    'activation_duration_value',
    'ALTER TABLE licenses ADD COLUMN activation_duration_value INT NULL AFTER activation_mode'
);

CALL ktp_add_license_admin_column(
    'activation_duration_unit',
    'ALTER TABLE licenses ADD COLUMN activation_duration_unit VARCHAR(16) NULL AFTER activation_duration_value'
);

CALL ktp_add_license_admin_column(
    'activated_at',
    'ALTER TABLE licenses ADD COLUMN activated_at DATETIME NULL AFTER activation_duration_unit'
);

CALL ktp_add_license_admin_column(
    'notes',
    'ALTER TABLE licenses ADD COLUMN notes TEXT NULL AFTER metadata_json'
);

DROP PROCEDURE IF EXISTS ktp_add_license_admin_column;

UPDATE licenses
SET activation_mode = CASE
        WHEN expires_at IS NULL THEN 'permanent'
        ELSE 'fixed'
    END,
    activation_duration_value = NULL,
    activation_duration_unit = NULL,
    activated_at = NULL
WHERE activation_mode = 'fixed'
  AND activation_duration_value IS NULL
  AND activation_duration_unit IS NULL
  AND activated_at IS NULL;
