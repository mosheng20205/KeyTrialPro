USE keytrialpro;

DROP PROCEDURE IF EXISTS ktp_add_license_notes_column;

DELIMITER //
CREATE PROCEDURE ktp_add_license_notes_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'licenses'
          AND COLUMN_NAME = 'notes'
    ) THEN
        ALTER TABLE licenses
            ADD COLUMN notes TEXT NULL AFTER metadata_json;
    END IF;
END//
DELIMITER ;

CALL ktp_add_license_notes_column();

DROP PROCEDURE IF EXISTS ktp_add_license_notes_column;
