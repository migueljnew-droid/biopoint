-- Add rate limiting and account lockout tables for HIPAA compliance
-- This migration adds tables to support advanced rate limiting and account lockout features

-- Rate limiting table to track request counts per key
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- Create index for efficient rate limit queries
CREATE INDEX "RateLimit_key_timestamp_idx" ON "RateLimit"("key", "timestamp");

-- Account lockout table for tracking failed login attempts
CREATE TABLE "AccountLockout" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failedAttempts" JSONB NOT NULL DEFAULT '[]',
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLockout_pkey" PRIMARY KEY ("id")
);

-- Create unique index on identifier
CREATE UNIQUE INDEX "AccountLockout_identifier_key" ON "AccountLockout"("identifier");

-- Create index for efficient lockout queries
CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- Add updatedAt trigger for AccountLockout table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_account_lockout_updated_at 
    BEFORE UPDATE ON "AccountLockout"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();