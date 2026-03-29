#!/bin/bash

# BioPoint S3/R2 Storage Backup Script
# Automated backup system for Cloudflare R2/S3 with cross-region replication
# Usage: ./backup-s3.sh [full|incremental]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_TYPE="${1:-incremental}"
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
BACKUP_BASE_DIR="/tmp/biopoint-s3-backups"
BACKUP_DIR="$BACKUP_BASE_DIR/$BACKUP_TYPE"
LOG_FILE="$BACKUP_DIR/backup-$TIMESTAMP.log"
METRICS_FILE="$BACKUP_DIR/metrics-$TIMESTAMP.json"

# S3 configuration
S3_SOURCE_BUCKET="$S3_BUCKET_NAME"
S3_BACKUP_BUCKET="${S3_BUCKET_NAME}-backups"
S3_BACKUP_PREFIX="s3-backups/$BACKUP_TYPE"

# Cross-region backup configuration
S3_CROSS_REGION_BUCKET="${S3_BUCKET_NAME}-backups-dr"
CROSS_REGION_ENABLED="${CROSS_REGION_BACKUP:-false}"

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
            --data "{\"text\":\"🚨 BioPoint S3 Backup Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "BioPoint S3 Backup Alert [$severity]" "$ALERT_EMAIL" || true
    fi
}

calculate_checksum() {
    local file="$1"
    if [[ -f "$file" ]]; then
        sha256sum "$file" | cut -d' ' -f1
    else
        echo ""
    fi
}

get_s3_object_checksum() {
    local bucket="$1"
    local key="$2"
    
    aws s3api head-object --bucket "$bucket" --key "$key" \
        --query 'Metadata.checksum' --output text 2>/dev/null || echo ""
}

# Create backup directory
mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE"

log "Starting $BACKUP_TYPE S3 backup for BioPoint"
log "Timestamp: $TIMESTAMP"
log "Backup type: $BACKUP_TYPE"
log "Source bucket: $S3_SOURCE_BUCKET"
log "Backup bucket: $S3_BACKUP_BUCKET"

# Validate S3 access
log "Validating S3 access..."
if ! aws s3 ls "s3://$S3_SOURCE_BUCKET" > /dev/null 2>&1; then
    log "ERROR: Unable to access source bucket: $S3_SOURCE_BUCKET"
    send_alert "CRITICAL" "S3 backup failed: Unable to access source bucket"
    exit 1
fi

if ! aws s3 ls "s3://$S3_BACKUP_BUCKET" > /dev/null 2>&1; then
    log "Creating backup bucket: $S3_BACKUP_BUCKET"
    aws s3 mb "s3://$S3_BACKUP_BUCKET" || {
        log "ERROR: Unable to create backup bucket"
        send_alert "CRITICAL" "S3 backup failed: Unable to create backup bucket"
        exit 1
    }
    
    # Configure bucket versioning and lifecycle
    aws s3api put-bucket-versioning \
        --bucket "$S3_BACKUP_BUCKET" \
        --versioning-configuration Status=Enabled
    
    # Set lifecycle policy for Glacier transition
    cat > /tmp/lifecycle-policy.json <<EOF
{
    "Rules": [
        {
            "ID": "TransitionToGlacier",
            "Status": "Enabled",
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ],
            "NoncurrentVersionTransitions": [
                {
                    "NoncurrentDays": 30,
                    "StorageClass": "GLACIER"
                }
            ]
        }
    ]
}
EOF
    
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$S3_BACKUP_BUCKET" \
        --lifecycle-configuration file:///tmp/lifecycle-policy.json
fi

# Create encryption key
log "Creating encryption key..."
openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
chmod 600 "$ENCRYPTION_KEY_FILE"

# Get bucket statistics
log "Analyzing source bucket..."
BUCKET_SIZE=$(aws s3 ls "s3://$S3_SOURCE_BUCKET" --recursive --summarize | grep "Total Size:" | awk '{print $3}')
OBJECT_COUNT=$(aws s3 ls "s3://$S3_SOURCE_BUCKET" --recursive --summarize | grep "Total Objects:" | awk '{print $3}')

log "Source bucket statistics:"
log "  Total objects: $OBJECT_COUNT"
log "  Total size: $BUCKET_SIZE bytes"

# Perform backup based on type
case "$BACKUP_TYPE" in
    "full")
        log "Performing full S3 backup..."
        
        # Create manifest file
        MANIFEST_FILE="$BACKUP_DIR/manifest-$TIMESTAMP.json"
        echo "{" > "$MANIFEST_FILE"
        echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$MANIFEST_FILE"
        echo "  \"backup_type\": \"full\"," >> "$MANIFEST_FILE"
        echo "  \"source_bucket\": \"$S3_SOURCE_BUCKET\"," >> "$MANIFEST_FILE"
        echo "  \"objects\": [" >> "$MANIFEST_FILE"
        
        # Sync all objects
        SYNC_LOG="$BACKUP_DIR/sync-$TIMESTAMP.log"
        
        aws s3 sync "s3://$S3_SOURCE_BUCKET" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$TIMESTAMP/" \
            --metadata-directive COPY \
            --server-side-encryption AES256 \
            --storage-class STANDARD \
            --delete \
            2>&1 | tee "$SYNC_LOG"
        
        # Process sync log to create manifest
        OBJECTS_SYNCED=$(grep -c "copy:" "$SYNC_LOG" || echo "0")
        OBJECTS_DELETED=$(grep -c "delete:" "$SYNC_LOG" || echo "0")
        
        log "Full backup completed:"
        log "  Objects synced: $OBJECTS_SYNCED"
        log "  Objects deleted: $OBJECTS_DELETED"
        
        # Create backup metadata
        METADATA_FILE="$BACKUP_DIR/metadata-$TIMESTAMP.json"
        cat > "$METADATA_FILE" <<EOF
{
    "timestamp": "$TIMESTAMP",
    "backup_type": "full",
    "source_bucket": "$S3_SOURCE_BUCKET",
    "backup_bucket": "$S3_BACKUP_BUCKET",
    "backup_prefix": "$S3_BACKUP_PREFIX/$TIMESTAMP/",
    "objects_synced": $OBJECTS_SYNCED,
    "objects_deleted": $OBJECTS_DELETED,
    "total_objects": $OBJECT_COUNT,
    "total_size": $BUCKET_SIZE,
    "encryption": "AES256",
    "storage_class": "STANDARD"
}
EOF
        
        # Upload metadata
        aws s3 cp "$METADATA_FILE" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/metadata-$TIMESTAMP.json" \
            --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'
        ;;
        
    "incremental")
        log "Performing incremental S3 backup..."
        
        # Find the last successful backup
        LAST_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/" --recursive | grep "metadata-" | sort | tail -1 | awk '{print $4}' | sed 's/.*metadata-\(.*\)\.json/\1/' || echo "")
        
        if [[ -n "$LAST_BACKUP" ]]; then
            log "Last backup found: $LAST_BACKUP"
            
            # Use --size-only for faster incremental sync (assumes objects don't change size without changing)
            SYNC_LOG="$BACKUP_DIR/sync-$TIMESTAMP.log"
            
            aws s3 sync "s3://$S3_SOURCE_BUCKET" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$TIMESTAMP/" \
                --metadata-directive COPY \
                --server-side-encryption AES256 \
                --size-only \
                2>&1 | tee "$SYNC_LOG"
            
            OBJECTS_SYNCED=$(grep -c "copy:" "$SYNC_LOG" || echo "0")
            
            log "Incremental backup completed:"
            log "  Objects synced: $OBJECTS_SYNCED"
        else
            log "No previous backup found, performing full backup instead"
            exec "$0" "full"
        fi
        ;;
        
    *)
        log "ERROR: Invalid backup type: $BACKUP_TYPE"
        exit 1
        ;;
esac

# Verify backup integrity
log "Verifying backup integrity..."
VERIFICATION_LOG="$BACKUP_DIR/verification-$TIMESTAMP.log"

# Sample verification: check a few random objects
SAMPLE_OBJECTS=$(aws s3 ls "s3://$S3_SOURCE_BUCKET" --recursive | shuf | head -10 | awk '{print $4}')

for obj in $SAMPLE_OBJECTS; do
    if [[ -n "$obj" ]]; then
        # Calculate source checksum
        SOURCE_CHECKSUM=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$obj" --query 'ETag' --output text 2>/dev/null || echo "")
        
        # Calculate backup checksum
        BACKUP_OBJ="$S3_BACKUP_PREFIX/$TIMESTAMP/$obj"
        BACKUP_CHECKSUM=$(aws s3api head-object --bucket "$S3_BACKUP_BUCKET" --key "$BACKUP_OBJ" --query 'ETag' --output text 2>/dev/null || echo "")
        
        if [[ "$SOURCE_CHECKSUM" == "$BACKUP_CHECKSUM" ]]; then
            echo "✓ $obj: checksums match" >> "$VERIFICATION_LOG"
        else
            echo "✗ $obj: checksum mismatch (source: $SOURCE_CHECKSUM, backup: $BACKUP_CHECKSUM)" >> "$VERIFICATION_LOG"
            log "WARNING: Checksum mismatch for $obj"
        fi
    fi
done

# Upload verification log
aws s3 cp "$VERIFICATION_LOG" "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/verification-$TIMESTAMP.log" \
    --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'

# Cross-region replication if enabled
if [[ "$CROSS_REGION_ENABLED" == "true" ]]; then
    log "Performing cross-region replication..."
    
    if ! aws s3 ls "s3://$S3_CROSS_REGION_BUCKET" > /dev/null 2>&1; then
        log "Creating cross-region backup bucket: $S3_CROSS_REGION_BUCKET"
        aws s3 mb "s3://$S3_CROSS_REGION_BUCKET" || {
            log "WARNING: Unable to create cross-region bucket"
        }
    fi
    
    # Replicate to cross-region bucket
    aws s3 sync "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$TIMESTAMP/" \
        "s3://$S3_CROSS_REGION_BUCKET/$S3_BACKUP_PREFIX/$TIMESTAMP/" \
        --metadata-directive COPY \
        --server-side-encryption AES256 \
        2>&1 | tee "$BACKUP_DIR/cross-region-$TIMESTAMP.log"
    
    log "Cross-region replication completed"
fi

# Clean up old backups based on retention policy
log "Cleaning up old backups..."
RETENTION_DAYS=30  # Keep 30 days of backups

CUTOFF_DATE=$(date -u -d "$RETENTION_DAYS days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-${RETENTION_DAYS}d +"%Y-%m-%d")

# List and remove old backup folders
aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/" --recursive | grep "^[0-9]\{8\}_[0-9]\{6\}/" | while read -r line; do
    BACKUP_DATE=$(echo "$line" | awk '{print $1}')
    BACKUP_PREFIX=$(echo "$line" | awk '{print $2}' | cut -d'/' -f1)
    
    if [[ "$BACKUP_DATE" < "$CUTOFF_DATE" ]]; then
        log "Removing old backup: $BACKUP_PREFIX"
        aws s3 rm "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$BACKUP_PREFIX" --recursive
    fi
done

# Generate metrics
METRICS=$(cat <<EOF
{
    "timestamp": "$TIMESTAMP",
    "backup_type": "$BACKUP_TYPE",
    "source_bucket": "$S3_SOURCE_BUCKET",
    "backup_bucket": "$S3_BACKUP_BUCKET",
    "cross_region_bucket": "$S3_CROSS_REGION_BUCKET",
    "cross_region_enabled": $CROSS_REGION_ENABLED,
    "total_objects": $OBJECT_COUNT,
    "total_size": $BUCKET_SIZE,
    "objects_synced": ${OBJECTS_SYNCED:-0},
    "objects_deleted": ${OBJECTS_DELETED:-0},
    "encryption": "AES256",
    "storage_class": "STANDARD",
    "lifecycle_policy": "GLACIER after 90 days",
    "retention_days": $RETENTION_DAYS,
    "status": "success"
}
EOF
)

echo "$METRICS" > "$METRICS_FILE"

# Send success notification
DURATION=$(($(date +%s) - $(date -d "${TIMESTAMP:0:8} ${TIMESTAMP:9:2}:${TIMESTAMP:11:2}:${TIMESTAMP:13:2}" +%s 2>/dev/null || echo "0")))

send_alert "INFO" "S3 backup completed successfully: $BACKUP_TYPE backup (${OBJECTS_SYNCED:-0} objects) completed in ${DURATION}s"

log "S3 backup completed successfully!"
log "Duration: ${DURATION}s"
log "Objects synced: ${OBJECTS_SYNCED:-0}"
log "Backup location: s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$TIMESTAMP/"

# Clean up local files
rm -f "$ENCRYPTION_KEY_FILE" "$METADATA_FILE"

exit 0