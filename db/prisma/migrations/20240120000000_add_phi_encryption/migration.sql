-- Migration to add encrypted columns for PHI data
-- This migration adds encrypted versions of sensitive fields while preserving existing data

-- Add encrypted columns to Profile table
ALTER TABLE "Profile" 
ADD COLUMN IF NOT EXISTS "dateOfBirth_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Add encrypted columns to LabMarker table
ALTER TABLE "LabMarker" 
ADD COLUMN IF NOT EXISTS "value_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Add encrypted columns to LabReport table for notes that may contain PHI
ALTER TABLE "LabReport" 
ADD COLUMN IF NOT EXISTS "notes_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Add encrypted columns to DailyLog table for notes that may contain PHI
ALTER TABLE "DailyLog" 
ADD COLUMN IF NOT EXISTS "notes_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Add encrypted columns to StackItem table for notes that may contain PHI
ALTER TABLE "StackItem" 
ADD COLUMN IF NOT EXISTS "notes_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Add encrypted columns to ProgressPhoto table for notes that may contain PHI
ALTER TABLE "ProgressPhoto" 
ADD COLUMN IF NOT EXISTS "notes_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB DEFAULT '{}'::jsonb;

-- Create indexes for encrypted columns
CREATE INDEX IF NOT EXISTS "Profile_dateOfBirth_encrypted_idx" ON "Profile"("dateOfBirth_encrypted");
CREATE INDEX IF NOT EXISTS "LabMarker_value_encrypted_idx" ON "LabMarker"("value_encrypted");
CREATE INDEX IF NOT EXISTS "LabReport_notes_encrypted_idx" ON "LabReport"("notes_encrypted");
CREATE INDEX IF NOT EXISTS "DailyLog_notes_encrypted_idx" ON "DailyLog"("notes_encrypted");
CREATE INDEX IF NOT EXISTS "StackItem_notes_encrypted_idx" ON "StackItem"("notes_encrypted");
CREATE INDEX IF NOT EXISTS "ProgressPhoto_notes_encrypted_idx" ON "ProgressPhoto"("notes_encrypted");

-- Create composite indexes for encryption queries
CREATE INDEX IF NOT EXISTS "Profile_encryption_version_idx" ON "Profile"("encryption_version");
CREATE INDEX IF NOT EXISTS "LabMarker_encryption_version_idx" ON "LabMarker"("encryption_version");
CREATE INDEX IF NOT EXISTS "LabReport_encryption_version_idx" ON "LabReport"("encryption_version");
CREATE INDEX IF NOT EXISTS "DailyLog_encryption_version_idx" ON "DailyLog"("encryption_version");
CREATE INDEX IF NOT EXISTS "StackItem_encryption_version_idx" ON "StackItem"("encryption_version");
CREATE INDEX IF NOT EXISTS "ProgressPhoto_encryption_version_idx" ON "ProgressPhoto"("encryption_version");

-- Add comment to document encryption purpose
COMMENT ON TABLE "Profile" IS 'User profile data with PHI encryption support';
COMMENT ON TABLE "LabMarker" IS 'Lab marker data with value encryption support';
COMMENT ON TABLE "LabReport" IS 'Lab report data with notes encryption support';
COMMENT ON TABLE "DailyLog" IS 'Daily tracking data with notes encryption support';
COMMENT ON TABLE "StackItem" IS 'Stack item data with notes encryption support';
COMMENT ON TABLE "ProgressPhoto" IS 'Progress photo data with notes encryption support';