-- Create test database schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create test users with different roles
CREATE ROLE test_admin WITH LOGIN PASSWORD 'test_admin_pass';
CREATE ROLE test_user WITH LOGIN PASSWORD 'test_user_pass';
CREATE ROLE test_readonly WITH LOGIN PASSWORD 'test_readonly_pass';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE biopoint_test TO test_admin;
GRANT CONNECT ON DATABASE biopoint_test TO test_user;
GRANT CONNECT ON DATABASE biopoint_test TO test_readonly;

-- Create test schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS test;

-- Test data cleanup function
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
    -- Truncate all tables except migration history
    TRUNCATE TABLE public."User", public."LabReport", public."DailyLog", 
                 public."AuditLog", public."BioPointScore" CASCADE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_test_data() TO test_admin, test_user;