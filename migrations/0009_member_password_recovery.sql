ALTER TABLE members ADD COLUMN recovery_hash TEXT;
ALTER TABLE members ADD COLUMN recovery_salt TEXT;
ALTER TABLE members ADD COLUMN recovery_iterations INTEGER;

