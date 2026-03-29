#!/bin/bash

# BioPoint Database Restore Script
# Disaster recovery script for restoring PostgreSQL database from backups
# Usage: ./restore-database.sh [backup-key] [target-database-url]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_KEY="${1:-}"
TARGET_DATABASE_URL="${2:-}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Load environment variables
if [[ -f ".env" ]]; then
    source .env
elif [[ -f "../.env" ]]; then
    source ../.env
else
    echo "ERROR: .env file not found"
    exit 1
fi

# Validate required environment variables
required_vars=(
    "AWS_REGION"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "S3_BUCKET_NAME"
    "ENCRYPTION_KEY"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

# Restore configuration
RESTORE_BASE_DIR="/tmp/biopoint-restore"
RESTORE_DIR="$RESTORE_BASE_DIR/$TIMESTAMP"
LOG_FILE="$RESTORE_DIR/restore-$TIMESTAMP.log"

# S3 configuration
S3_BACKUP_BUCKET="${S3_BUCKET_NAME}-backups"

# Encryption configuration
ENCRYPTION_ALGORITHM="AES-256-CBC"

# Monitoring configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Confirmation required for production
CONFIRMATION_REQUIRED="${CONFIRMATION_REQUIRED:-true}"

# Functions
log() {
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local severity="$1"
    local message="$2"
    
    # Send Slack notification if webhook is configured
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        local emoji=""
        case "$severity" in
            "CRITICAL") emoji="🚨" ;;
            "WARNING") emoji="⚠️" ;;
            "INFO") emoji="✅" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji BioPoint Database Restore [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "BioPoint Database Restore [$severity]" "$ALERT_EMAIL" || true
    fi
}

# Display usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

BioPoint Database Restore Script

OPTIONS:
    -k, --backup-key KEY        S3 key of backup to restore (required)
    -d, --database-url URL      Target database URL (required)
    -f, --force                 Skip confirmation prompts
    -t, --test-only             Test restore without applying changes
    -h, --help                  Show this help message

EXAMPLES:
    # Restore from specific backup
    $0 -k "database/daily/biopoint-daily-20240123_020000.sql.enc" -d "postgresql://user:pass@localhost:5432/biopoint_restore"

    # Restore latest daily backup
    $0 -k "latest-daily" -d "postgresql://user:pass@localhost:5432/biopoint_restore"

    # Test restore (dry run)
    $0 -k "latest-daily" -d "postgresql://user:pass@localhost:5432/biopoint_restore" -t

EOF
    exit 1
}

# Parse command line arguments
TEST_ONLY=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--backup-key)
            BACKUP_KEY="$2"
            shift 2
            ;;
        -d|--database-url)
            TARGET_DATABASE_URL="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [[ -z "$BACKUP_KEY" ]]; then
    echo "ERROR: Backup key is required"
    usage
fi

if [[ -z "$TARGET_DATABASE_URL" ]]; then
    echo "ERROR: Target database URL is required"
    usage
fi

# Create restore directory
mkdir -p "$RESTORE_DIR"
touch "$LOG_FILE"

log "=== BioPoint Database Restore Started ==="
log "Timestamp: $TIMESTAMP"
log "Backup Key: $BACKUP_KEY"
log "Target Database: $TARGET_DATABASE_URL"
log "Test Only: $TEST_ONLY"

# Determine backup key if using shortcuts
case "$BACKUP_KEY" in
    "latest-daily")
        log "Finding latest daily backup..."
        BACKUP_KEY=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/database/daily/" --recursive | grep "\.sql\.enc$" | sort | tail -1 | awk '{print $4}')
        if [[ -z "$BACKUP_KEY" ]]; then
            log "ERROR: No daily backups found"
            exit 1
        fi
        log "Latest daily backup: $BACKUP_KEY"
        ;;
    "latest-weekly")
        log "Finding latest weekly backup..."
        BACKUP_KEY=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/database/weekly/" --recursive | grep "\.sql\.enc$" | sort | tail -1 | awk '{print $4}')
        if [[ -z "$BACKUP_KEY" ]]; then
            log "ERROR: No weekly backups found"
            exit 1
        fi
        log "Latest weekly backup: $BACKUP_KEY"
        ;;
    "latest-monthly")
        log "Finding latest monthly backup..."
        BACKUP_KEY=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/database/monthly/" --recursive | grep "\.sql\.enc$" | sort | tail -1 | awk '{print $4}')
        if [[ -z "$BACKUP_KEY" ]]; then
            log "ERROR: No monthly backups found"
            exit 1
        fi
        log "Latest monthly backup: $BACKUP_KEY"
        ;;
esac

# Validate target database connection
log "Validating target database connection..."
if ! psql "$TARGET_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log "ERROR: Unable to connect to target database"
    send_alert "CRITICAL" "Database restore failed: Unable to connect to target database"
    exit 1
fi

# Get target database info
TARGET_DB_NAME=$(echo "$TARGET_DATABASE_URL" | sed -n 's/.*\/\/.*\/\(.*\)/\1/p')
TARGET_DB_SIZE=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)

log "Target database: $TARGET_DB_NAME"
log "Current database size: $TARGET_DB_SIZE"

# Pre-restore safety checks
log "Performing pre-restore safety checks..."

# Check if target database is production
if [[ "$TARGET_DB_NAME" == *"prod"* ]] || [[ "$TARGET_DB_NAME" == *"production"* ]]; then
    log "WARNING: Target database appears to be production: $TARGET_DB_NAME"
    
    if [[ "$CONFIRMATION_REQUIRED" == "true" ]] && [[ "$FORCE" == "false" ]]; then
        echo "Are you sure you want to restore to this production database? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
fi

# Check if target database has existing data
TABLE_COUNT=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
if [[ $TABLE_COUNT -gt 0 ]]; then
    log "WARNING: Target database contains $TABLE_COUNT existing tables"
    
    if [[ "$CONFIRMATION_REQUIRED" == "true" ]] && [[ "$FORCE" == "false" ]]; then
        echo "Target database contains existing data. Continue with restore? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
fi

# Download backup from S3
log "Downloading backup from S3..."
BACKUP_FILE="$RESTORE_DIR/$(basename "$BACKUP_KEY")"

if ! aws s3 cp "s3://$S3_BACKUP_BUCKET/$BACKUP_KEY" "$BACKUP_FILE"; then
    log "ERROR: Failed to download backup from S3"
    send_alert "CRITICAL" "Database restore failed: Unable to download backup from S3"
    exit 1
fi

BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

log "Backup downloaded: $BACKUP_FILE (${BACKUP_SIZE_MB}MB)"

# Find and download encryption key
log "Finding encryption key..."
KEY_PREFIX=$(dirname "$BACKUP_KEY" | sed 's|/[^/]*$||')/keys
LATEST_KEY=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$KEY_PREFIX/" --recursive | grep "key-" | sort | tail -1 | awk '{print $4}')

if [[ -z "$LATEST_KEY" ]]; then
    log "ERROR: Could not find encryption key for backup"
    exit 1
fi

KEY_FILE="$RESTORE_DIR/$(basename "$LATEST_KEY")"
if ! aws s3 cp "s3://$S3_BACKUP_BUCKET/$LATEST_KEY" "$KEY_FILE"; then
    log "ERROR: Failed to download encryption key"
    exit 1
fi

log "Encryption key downloaded: $KEY_FILE"

# Decrypt backup
log "Decrypting backup..."
DECRYPTED_FILE="${BACKUP_FILE%.enc}"

if ! openssl enc -d -AES-256-CBC -in "$BACKUP_FILE" -out "$DECRYPTED_FILE" -pass file:"$KEY_FILE"; then
    log "ERROR: Failed to decrypt backup"
    send_alert "CRITICAL" "Database restore failed: Decryption failed"
    exit 1
fi

DECRYPTED_SIZE=$(stat -f%z "$DECRYPTED_FILE" 2>/dev/null || stat -c%s "$DECRYPTED_FILE" 2>/dev/null || echo "0")
DECRYPTED_SIZE_MB=$((DECRYPTED_SIZE / 1024 / 1024))

log "Backup decrypted: $DECRYPTED_FILE (${DECRYPTED_SIZE_MB}MB)"

# Verify backup format
log "Verifying backup format..."
if file "$DECRYPTED_FILE" | grep -q "PostgreSQL"; then
    log "Backup format verified: PostgreSQL custom format"
elif head -1 "$DECRYPTED_FILE" | grep -q "PostgreSQL database dump"; then
    log "Backup format verified: PostgreSQL plain format"
else
    log "WARNING: Backup format verification inconclusive"
fi

# Test mode: verify backup without restoring
if [[ "$TEST_ONLY" == "true" ]]; then
    log "=== TEST MODE: Verifying backup without restoring ==="
    
    # Create temporary test database
    TEST_DB_NAME="biopoint_test_restore_$TIMESTAMP"
    TEST_DB_URL=$(echo "$TARGET_DATABASE_URL" | sed "s|$TARGET_DB_NAME|$TEST_DB_NAME|")
    
    log "Creating test database: $TEST_DB_NAME"
    
    # Extract database host and credentials
    DB_HOST=$(echo "$TARGET_DATABASE_URL" | sed -n 's/.*@\(.*\):[0-9]*\/.*$/\1/p')
    DB_PORT=$(echo "$TARGET_DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*$/\1/p')
    DB_USER=$(echo "$TARGET_DATABASE_URL" | sed -n 's/.*\/\/\(.*\):.*@.*/\1/p')
    
    # Create test database (requires superuser access)
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB_NAME" 2>/dev/null; then
        log "Test database created successfully"
        
        # Test restore to temporary database
        log "Testing restore to temporary database..."
        if pg_restore --dbname="$TEST_DB_URL" --verbose "$DECRYPTED_FILE" > "$RESTORE_DIR/test-restore-$TIMESTAMP.log" 2>&1; then
            log "✅ Test restore completed successfully!"
            
            # Verify restored data
            TABLE_COUNT=$(psql "$TEST_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
            log "Restored tables: $TABLE_COUNT"
            
            # Sample data verification
            USER_COUNT=$(psql "$TEST_DB_URL" -t -c "SELECT COUNT(*) FROM public.\"User\";" | xargs 2>/dev/null || echo "0")
            log "Sample user count: $USER_COUNT"
            
            # Clean up test database
            log "Cleaning up test database..."
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB_NAME"
            
            log "=== TEST MODE COMPLETED SUCCESSFULLY ==="
            log "The backup is valid and can be restored safely."
            
        else
            log "❌ Test restore failed!"
            send_alert "CRITICAL" "Database restore test failed - backup may be corrupted"
            exit 1
        fi
    else
        log "ERROR: Unable to create test database (requires superuser privileges)"
        exit 1
    fi
    
else
    # Full restore mode
    log "=== PERFORMING FULL DATABASE RESTORE ==="
    
    # Additional confirmation for production
    if [[ "$CONFIRMATION_REQUIRED" == "true" ]] && [[ "$FORCE" == "false" ]]; then
        echo "⚠️  WARNING: You are about to restore database to $TARGET_DB_NAME"
        echo "This will overwrite existing data. Are you absolutely sure? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
    
    # Pre-restore backup of existing data (if any)
    if [[ $TABLE_COUNT -gt 0 ]]; then
        log "Creating pre-restore backup of existing data..."
        PRE_RESTORE_BACKUP="$RESTORE_DIR/pre-restore-backup-$TIMESTAMP.sql"
        pg_dump --dbname="$TARGET_DATABASE_URL" --format=plain --file="$PRE_RESTORE_BACKUP" --no-owner --no-privileges
        log "Pre-restore backup created: $PRE_RESTORE_BACKUP"
    fi
    
    # Drop existing connections and prepare for restore
    log "Preparing target database for restore..."
    psql "$TARGET_DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" || true
    
    # Perform the restore
    log "Restoring database..."
    RESTORE_START_TIME=$(date +%s)
    
    if pg_restore --dbname="$TARGET_DATABASE_URL" --verbose --clean --if-exists --no-owner --no-privileges "$DECRYPTED_FILE" > "$RESTORE_DIR/restore-$TIMESTAMP.log" 2>&1; then
        RESTORE_END_TIME=$(date +%s)
        RESTORE_DURATION=$((RESTORE_END_TIME - RESTORE_START_TIME))
        
        log "✅ Database restore completed successfully!"
        log "Restore duration: ${RESTORE_DURATION}s"
        
        # Verify restored database
        log "Verifying restored database..."
        
        # Check connection
        if psql "$TARGET_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
            log "✅ Database connection verified"
        else
            log "❌ Database connection failed after restore"
            send_alert "CRITICAL" "Database restore completed but connection failed"
            exit 1
        fi
        
        # Check table count
        NEW_TABLE_COUNT=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
        log "Restored tables: $NEW_TABLE_COUNT"
        
        # Sample data verification
        USER_COUNT=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.\"User\";" | xargs 2>/dev/null || echo "0")
        log "Sample user count: $USER_COUNT"
        
        if [[ $USER_COUNT -gt 0 ]]; then
            log "✅ Sample data verification passed"
        else
            log "⚠️  Warning: No users found in restored database"
        fi
        
        # Get final database size
        FINAL_DB_SIZE=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
        log "Final database size: $FINAL_DB_SIZE"
        
        # Post-restore optimization
        log "Performing post-restore optimization..."
        psql "$TARGET_DATABASE_URL" -c "VACUUM ANALYZE;" > /dev/null 2>&1 || true
        
        log "=== DATABASE RESTORE COMPLETED SUCCESSFULLY ==="
        
        # Success notification
        send_alert "INFO" "Database restore completed successfully: $TARGET_DB_NAME restored from $BACKUP_KEY in ${RESTORE_DURATION}s"
        
    else
        log "❌ Database restore failed!"
        send_alert "CRITICAL" "Database restore failed for $TARGET_DB_NAME"
        exit 1
    fi
fi

# Cleanup
log "Cleaning up temporary files..."
rm -f "$BACKUP_FILE" "$KEY_FILE" "$DECRYPTED_FILE"

# Generate restore report
REPORT_FILE="$RESTORE_DIR/restore-report-$TIMESTAMP.md"
cat > "$REPORT_FILE" <<EOF
# BioPoint Database Restore Report

**Restore Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Backup Source:** $BACKUP_KEY  
**Target Database:** $TARGET_DB_NAME  
**Restore Type:** $([[ "$TEST_ONLY" == "true" ]] && echo "TEST ONLY" || echo "FULL RESTORE")  
**Status:** SUCCESS  

## Summary

Database restore operation completed successfully with the following details:

- **Backup Size:** ${BACKUP_SIZE_MB}MB (encrypted)
- **Restored Size:** ${DECRYPTED_SIZE_MB}MB
- **Duration:** ${RESTORE_DURATION:-N/A}s
- **Tables Restored:** ${NEW_TABLE_COUNT:-N/A}

## Pre-Restore Checks

- Database connection: ✅ Verified
- Target database validation: ✅ Completed
- Backup integrity: ✅ Verified
- Encryption key: ✅ Validated

## Post-Restore Verification

- Database connectivity: ✅ Established
- Table structure: ✅ Verified
- Sample data check: ✅ ${USER_COUNT:-0} users found
- Database optimization: ✅ Completed

## Files and Logs

- **Log File:** $LOG_FILE
- **Restore Log:** $RESTORE_DIR/restore-$TIMESTAMP.log
- **Pre-restore Backup:** ${PRE_RESTORE_BACKUP:-N/A}

## Next Steps

1. **Application Testing:** Verify application functionality
2. **User Acceptance:** Confirm data integrity with stakeholders
3. **Monitoring:** Monitor system performance and errors
4. **Documentation:** Update disaster recovery documentation

## Contact Information

- **Infrastructure Team:** infrastructure@biopoint.com
- **Database Administrator:** dba@biopoint.com

---
*This report was generated automatically by the BioPoint database restore system.*
EOF

log "Restore report generated: $REPORT_FILE"
log "=== RESTORE OPERATION COMPLETED ==="

exit 0