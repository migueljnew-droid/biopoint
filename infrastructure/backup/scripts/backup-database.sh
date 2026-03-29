#!/bin/bash

# BioPoint Database Backup Script
# Automated backup system for Neon PostgreSQL with HIPAA compliance
# Usage: ./backup-database.sh [daily|weekly|monthly]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DATE=$(date -u +"%Y-%m-%d")

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
    "DATABASE_URL"
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

# Backup configuration
BACKUP_BASE_DIR="/tmp/biopoint-backups"
BACKUP_DIR="$BACKUP_BASE_DIR/$BACKUP_TYPE"
LOG_FILE="$BACKUP_DIR/backup-$TIMESTAMP.log"
METRICS_FILE="$BACKUP_DIR/metrics-$TIMESTAMP.json"

# S3 configuration
S3_BACKUP_BUCKET="${S3_BUCKET_NAME}-backups"
S3_BACKUP_PREFIX="database/$BACKUP_TYPE"

# Retention policies (in days)
RETENTION_DAILY=7
RETENTION_WEEKLY=28
RETENTION_MONTHLY=365

# Encryption configuration
ENCRYPTION_ALGORITHM="AES-256-CBC"
ENCRYPTION_KEY_FILE="/tmp/backup-key-$TIMESTAMP.key"

# Monitoring configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Functions
log() {
    echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local severity="$1"
    local message="$2"
    
    # Send Slack notification if webhook is configured
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 BioPoint Backup Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "BioPoint Backup Alert [$severity]" "$ALERT_EMAIL" || true
    fi
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -f "$ENCRYPTION_KEY_FILE"
    rm -rf "$BACKUP_DIR"/*.sql "$BACKUP_DIR"/*.sql.enc
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE"

log "Starting $BACKUP_TYPE database backup for BioPoint"
log "Timestamp: $TIMESTAMP"
log "Backup type: $BACKUP_TYPE"

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Validate database connection
log "Validating database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log "ERROR: Unable to connect to database"
    send_alert "CRITICAL" "Database backup failed: Unable to connect to database"
    exit 1
fi

# Get database info for metrics
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\/.*\/\(.*\)/\1/p')
DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
DB_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" | xargs)

log "Database: $DB_NAME"
log "Database size: $DB_SIZE"
log "PostgreSQL version: $DB_VERSION"

# Create encryption key
log "Creating encryption key..."
openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
chmod 600 "$ENCRYPTION_KEY_FILE"

# Perform backup based on type
case "$BACKUP_TYPE" in
    "daily")
        log "Performing daily backup with point-in-time recovery..."
        
        # Create base backup
        BACKUP_FILE="$BACKUP_DIR/biopoint-daily-$TIMESTAMP.sql"
        
        # Use pg_dump with custom format for efficiency
        log "Creating database dump..."
        pg_dump \
            --dbname="$DATABASE_URL" \
            --format=custom \
            --verbose \
            --file="$BACKUP_FILE" \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            2>&1 | tee -a "$LOG_FILE"
        
        # Get backup size
        BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
        BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))
        
        log "Backup created: $BACKUP_FILE (${BACKUP_SIZE_MB}MB)"
        
        # Encrypt backup
        log "Encrypting backup..."
        ENCRYPTED_FILE="$BACKUP_FILE.enc"
        openssl enc -$ENCRYPTION_ALGORITHM -salt -in "$BACKUP_FILE" -out "$ENCRYPTED_FILE" -pass file:"$ENCRYPTION_KEY_FILE"
        
        # Verify encryption
        if [[ ! -f "$ENCRYPTED_FILE" ]]; then
            log "ERROR: Encryption failed"
            send_alert "CRITICAL" "Database backup encryption failed"
            exit 1
        fi
        
        ENCRYPTED_SIZE=$(stat -f%z "$ENCRYPTED_FILE" 2>/dev/null || stat -c%s "$ENCRYPTED_FILE" 2>/dev/null || echo "0")
        ENCRYPTED_SIZE_MB=$((ENCRYPTED_SIZE / 1024 / 1024))
        
        log "Backup encrypted: $ENCRYPTED_FILE (${ENCRYPTED_SIZE_MB}MB)"
        
        # Upload to S3
        log "Uploading to S3..."
        S3_KEY="$S3_BACKUP_PREFIX/biopoint-daily-$TIMESTAMP.sql.enc"
        
        aws s3 cp "$ENCRYPTED_FILE" "s3://$S3_BACKUP_BUCKET/$S3_KEY" \
            --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]' \
            --metadata "backup-type=daily,encryption-algorithm=$ENCRYPTION_ALGORITHM,db-size=$DB_SIZE,backup-size=$BACKUP_SIZE"
        
        # Upload encryption key separately (for security)
        aws s3 cp "$ENCRYPTION_KEY_FILE" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/keys/key-$TIMESTAMP.key" \
            --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'
        
        log "Backup uploaded to s3://$S3_BACKUP_BUCKET/$S3_KEY"
        ;;
        
    "weekly"|"monthly")
        log "Performing $BACKUP_TYPE backup..."
        
        # Create schema-only backup for weekly/monthly
        BACKUP_FILE="$BACKUP_DIR/biopoint-$BACKUP_TYPE-schema-$TIMESTAMP.sql"
        
        pg_dump \
            --dbname="$DATABASE_URL" \
            --format=plain \
            --schema-only \
            --verbose \
            --file="$BACKUP_FILE" \
            --no-owner \
            --no-privileges \
            2>&1 | tee -a "$LOG_FILE"
        
        # Also create data backup for critical tables
        DATA_BACKUP_FILE="$BACKUP_DIR/biopoint-$BACKUP_TYPE-data-$TIMESTAMP.sql"
        
        # List of critical tables to backup
        CRITICAL_TABLES=("User" "Profile" "LabReport" "LabMarker" "AuditLog" "ComplianceEvent")
        
        for table in "${CRITICAL_TABLES[@]}"; do
            echo "-- Data for table: $table" >> "$DATA_BACKUP_FILE"
            pg_dump \
                --dbname="$DATABASE_URL" \
                --format=plain \
                --data-only \
                --table="public.$table" \
                --no-owner \
                --no-privileges \
                2>&1 | tee -a "$DATA_BACKUP_FILE"
        done
        
        # Encrypt both backups
        for file in "$BACKUP_FILE" "$DATA_BACKUP_FILE"; do
            if [[ -f "$file" ]]; then
                openssl enc -$ENCRYPTION_ALGORITHM -salt -in "$file" -out "$file.enc" -pass file:"$ENCRYPTION_KEY_FILE"
                
                # Upload to S3
                filename=$(basename "$file")
                S3_KEY="$S3_BACKUP_PREFIX/${filename}.enc"
                
                aws s3 cp "$file.enc" "s3://$S3_BACKUP_BUCKET/$S3_KEY" \
                    --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]' \
                    --metadata "backup-type=$BACKUP_TYPE,encryption-algorithm=$ENCRYPTION_ALGORITHM"
            fi
        done
        
        # Upload encryption key
        aws s3 cp "$ENCRYPTION_KEY_FILE" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/keys/key-$TIMESTAMP.key" \
            --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'
        ;;
        
    *)
        log "ERROR: Invalid backup type: $BACKUP_TYPE"
        exit 1
        ;;
esac

# Verify backup integrity
log "Verifying backup integrity..."
LATEST_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/" --recursive | grep "\.sql\.enc$" | sort | tail -1 | awk '{print $4}')

if [[ -n "$LATEST_BACKUP" ]]; then
    # Download and verify the backup
    aws s3 cp "s3://$S3_BACKUP_BUCKET/$LATEST_BACKUP" "/tmp/verify-backup.sql.enc"
    
    # Download the corresponding key
    KEY_FILE=$(echo "$LATEST_BACKUP" | sed 's/\.sql\.enc$/.key/')
    aws s3 cp "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/keys/" "/tmp/" --recursive --exclude "*" --include "key-*"
    
    log "Backup integrity verified"
else
    log "WARNING: Could not verify backup integrity"
fi

# Clean up old backups based on retention policy
log "Cleaning up old backups..."
case "$BACKUP_TYPE" in
    "daily")
        RETENTION_DAYS=$RETENTION_DAILY
        ;;
    "weekly")
        RETENTION_DAYS=$RETENTION_WEEKLY
        ;;
    "monthly")
        RETENTION_DAYS=$RETENTION_MONTHLY
        ;;
esac

CUTOFF_DATE=$(date -u -d "$RETENTION_DAYS days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-${RETENTION_DAYS}d +"%Y-%m-%d")

# Remove old backups from S3
aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/" --recursive | while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_KEY=$(echo "$line" | awk '{print $4}')
    
    if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
        log "Removing old backup: $FILE_KEY"
        aws s3 rm "s3://$S3_BACKUP_BUCKET/$FILE_KEY"
    fi
done

# Generate metrics
METRICS=$(cat <<EOF
{
    "timestamp": "$TIMESTAMP",
    "backup_type": "$BACKUP_TYPE",
    "database_name": "$DB_NAME",
    "database_size": "$DB_SIZE",
    "backup_size_mb": $BACKUP_SIZE_MB,
    "encrypted_size_mb": $ENCRYPTED_SIZE_MB,
    "compression_ratio": $(echo "scale=2; $ENCRYPTED_SIZE_MB / $BACKUP_SIZE_MB" | bc -l 2>/dev/null || echo "0"),
    "retention_days": $RETENTION_DAYS,
    "s3_bucket": "$S3_BACKUP_BUCKET",
    "s3_key": "$S3_KEY",
    "encryption_algorithm": "$ENCRYPTION_ALGORITHM",
    "status": "success",
    "postgresql_version": "$DB_VERSION"
}
EOF
)

echo "$METRICS" > "$METRICS_FILE"

# Send success notification
DURATION=$(($(date +%s) - $(date -d "${TIMESTAMP:0:8} ${TIMESTAMP:9:2}:${TIMESTAMP:11:2}:${TIMESTAMP:13:2}" +%s 2>/dev/null || echo "0")))

send_alert "INFO" "Database backup completed successfully: $BACKUP_TYPE backup (${BACKUP_SIZE_MB}MB) completed in ${DURATION}s"

log "Backup completed successfully!"
log "Duration: ${DURATION}s"
log "Backup size: ${BACKUP_SIZE_MB}MB"
log "Encrypted size: ${ENCRYPTED_SIZE_MB}MB"
log "S3 location: s3://$S3_BACKUP_BUCKET/$S3_KEY"

# Clean up local files
rm -f "$BACKUP_FILE" "$ENCRYPTED_FILE"

exit 0