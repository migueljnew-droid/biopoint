-- BioPoint Rate Limiting and Account Security Tables
-- This script adds the necessary tables for advanced rate limiting and account lockout features
-- Run this script manually on your PostgreSQL database

-- Create RateLimit table for tracking request counts per key
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1
);

-- Create index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS "RateLimit_key_timestamp_idx" ON "RateLimit"("key", "timestamp");

-- Create AccountLockout table for tracking failed login attempts
CREATE TABLE IF NOT EXISTS "AccountLockout" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "failedAttempts" JSONB NOT NULL DEFAULT '[]',
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on identifier
CREATE UNIQUE INDEX IF NOT EXISTS "AccountLockout_identifier_key" ON "AccountLockout"("identifier");

-- Create index for efficient lockout queries
CREATE INDEX IF NOT EXISTS "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");

-- Create updatedAt trigger for AccountLockout table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_account_lockout_updated_at ON "AccountLockout";

-- Create trigger for updatedAt
CREATE TRIGGER update_account_lockout_updated_at 
    BEFORE UPDATE ON "AccountLockout"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "RateLimit" IS 'Tracks API request counts for rate limiting';
COMMENT ON COLUMN "RateLimit"."key" IS 'Unique identifier for rate limit bucket (e.g., auth:192.168.1.100)';
COMMENT ON COLUMN "RateLimit"."timestamp" IS 'Timestamp of the request';
COMMENT ON COLUMN "RateLimit"."count" IS 'Request count within the time window';

COMMENT ON TABLE "AccountLockout" IS 'Tracks failed login attempts and account lockouts';
COMMENT ON COLUMN "AccountLockout"."identifier" IS 'Unique identifier (email or username)';
COMMENT ON COLUMN "AccountLockout"."failedAttempts" IS 'Array of failed attempt timestamps and IPs';
COMMENT ON COLUMN "AccountLockout"."lockedUntil" IS 'Timestamp when lockout expires';
COMMENT ON COLUMN "AccountLockout"."lastAttemptAt" IS 'Timestamp of the most recent attempt';

-- Create a function to clean up old rate limit entries (run this periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete rate limit entries older than 2 hours
    DELETE FROM "RateLimit" 
    WHERE "timestamp" < CURRENT_TIMESTAMP - INTERVAL '2 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old failed attempts (run this periodically)
CREATE OR REPLACE FUNCTION cleanup_old_failed_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Remove failed attempts older than 1 hour from existing records
    UPDATE "AccountLockout"
    SET "failedAttempts" = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements("failedAttempts") AS elem
        WHERE (elem->>'timestamp')::bigint > EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - INTERVAL '1 hour')) * 1000
    ),
    "updatedAt" = CURRENT_TIMESTAMP
    WHERE "failedAttempts" IS NOT NULL AND jsonb_array_length("failedAttempts") > 0;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "RateLimit" TO biopoint_api_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "AccountLockout" TO biopoint_api_user;

-- Add these tables to your backup/monitoring procedures
-- Add appropriate indexes if needed for your specific query patterns

-- Sample queries for monitoring:

-- Check current rate limit usage
-- SELECT "key", COUNT(*) as request_count, MIN("timestamp") as window_start, MAX("timestamp") as window_end
-- FROM "RateLimit" 
-- WHERE "timestamp" > CURRENT_TIMESTAMP - INTERVAL '1 hour'
-- GROUP BY "key"
-- ORDER BY request_count DESC;

-- Check current account lockouts
-- SELECT "identifier", "lockedUntil", "lastAttemptAt", jsonb_array_length("failedAttempts") as attempt_count
-- FROM "AccountLockout" 
-- WHERE "lockedUntil" > CURRENT_TIMESTAMP
-- ORDER BY "lockedUntil" DESC;

-- Check failed attempt patterns
-- SELECT 
--     "identifier", 
--     jsonb_array_length("failedAttempts") as attempt_count,
--     "lastAttemptAt",
--     "failedAttempts"->0->>'ip' as latest_ip
-- FROM "AccountLockout" 
-- WHERE jsonb_array_length("failedAttempts") > 0
-- ORDER BY jsonb_array_length("failedAttempts") DESC;

PRINT 'Rate limiting tables created successfully!';
PRINT 'Remember to:';
PRINT '1. Update your Prisma schema to include these models';
PRINT '2. Run "prisma generate" to update the client';
PRINT '3. Configure your notification service for account lockouts';
PRINT '4. Set up monitoring for these tables';
PRINT '5. Schedule cleanup jobs for old data';