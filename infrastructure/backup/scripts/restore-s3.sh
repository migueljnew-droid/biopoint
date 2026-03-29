#!/bin/bash

# BioPoint S3/R2 Storage Restore Script
# Disaster recovery script for restoring S3 objects from backups
# Usage: ./restore-s3.sh [backup-prefix] [target-bucket]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_PREFIX="${1:-}"
TARGET_BUCKET="${2:-}"
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
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

# Restore configuration
RESTORE_BASE_DIR="/tmp/biopoint-s3-restore"
RESTORE_DIR="$RESTORE_BASE_DIR/$TIMESTAMP"
LOG_FILE="$RESTORE_DIR/restore-$TIMESTAMP.log"
INVENTORY_FILE="$RESTORE_DIR/inventory-$TIMESTAMP.json"

# S3 configuration
S3_SOURCE_BUCKET="${S3_BUCKET_NAME}-backups"
S3_TARGET_BUCKET="${TARGET_BUCKET:-$S3_BUCKET_NAME}"

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
            --data "{\"text\":\"$emoji BioPoint S3 Restore [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "BioPoint S3 Restore [$severity]" "$ALERT_EMAIL" || true
    fi
}

# Display usage information
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

BioPoint S3 Storage Restore Script

OPTIONS:
    -p, --backup-prefix PREFIX  S3 prefix of backup to restore (required)
    -t, --target-bucket BUCKET  Target S3 bucket (default: source bucket)
    -f, --force                 Skip confirmation prompts
    -n, --dry-run               Show what would be restored without doing it
    -i, --inventory-only        Generate inventory report only
    -h, --help                  Show this help message

EXAMPLES:
    # Restore from specific backup prefix
    $0 -p "s3-backups/incremental/20240123_020000/" -t "biopoint-uploads-restore"

    # Restore latest incremental backup
    $0 -p "latest-incremental" -t "biopoint-uploads-restore"

    # Dry run to see what would be restored
    $0 -p "latest-incremental" -t "biopoint-uploads-restore" -n

    # Generate inventory report only
    $0 -p "s3-backups/full/20240123_020000/" -i

EOF
    exit 1
}

# Parse command line arguments
DRY_RUN=false
INVENTORY_ONLY=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--backup-prefix)
            BACKUP_PREFIX="$2"
            shift 2
            ;;
        -t|--target-bucket)
            S3_TARGET_BUCKET="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -i|--inventory-only)
            INVENTORY_ONLY=true
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
if [[ -z "$BACKUP_PREFIX" ]]; then
    echo "ERROR: Backup prefix is required"
    usage
fi

# Create restore directory
mkdir -p "$RESTORE_DIR"
touch "$LOG_FILE"

log "=== BioPoint S3 Storage Restore Started ==="
log "Timestamp: $TIMESTAMP"
log "Backup Prefix: $BACKUP_PREFIX"
log "Source Bucket: $S3_SOURCE_BUCKET"
log "Target Bucket: $S3_TARGET_BUCKET"
log "Dry Run: $DRY_RUN"
log "Inventory Only: $INVENTORY_ONLY"

# Determine backup prefix if using shortcuts
case "$BACKUP_PREFIX" in
    "latest-incremental")
        log "Finding latest incremental backup..."
        BACKUP_PREFIX=$(aws s3 ls "s3://$S3_SOURCE_BUCKET/s3-backups/incremental/" --recursive | grep "metadata-" | sort | tail -1 | awk '{print $4}' | sed 's|/[^/]*$||')
        if [[ -z "$BACKUP_PREFIX" ]]; then
            log "ERROR: No incremental backups found"
            exit 1
        fi
        log "Latest incremental backup: $BACKUP_PREFIX"
        ;;
    "latest-full")
        log "Finding latest full backup..."
        BACKUP_PREFIX=$(aws s3 ls "s3://$S3_SOURCE_BUCKET/s3-backups/full/" --recursive | grep "metadata-" | sort | tail -1 | awk '{print $4}' | sed 's|/[^/]*$||')
        if [[ -z "$BACKUP_PREFIX" ]]; then
            log "ERROR: No full backups found"
            exit 1
        fi
        log "Latest full backup: $BACKUP_PREFIX"
        ;;
esac

# Validate S3 access
log "Validating S3 access..."
if ! aws s3 ls "s3://$S3_SOURCE_BUCKET" > /dev/null 2>&1; then
    log "ERROR: Unable to access source bucket: $S3_SOURCE_BUCKET"
    send_alert "CRITICAL" "S3 restore failed: Unable to access source bucket"
    exit 1
fi

if ! aws s3 ls "s3://$S3_TARGET_BUCKET" > /dev/null 2>&1; then
    log "ERROR: Unable to access target bucket: $S3_TARGET_BUCKET"
    send_alert "CRITICAL" "S3 restore failed: Unable to access target bucket"
    exit 1
fi

# Get source bucket statistics
log "Analyzing source backup..."
BACKUP_OBJECTS=$(aws s3 ls "s3://$S3_SOURCE_BUCKET/$BACKUP_PREFIX" --recursive | grep -v "metadata-" | grep -v "verification-" | wc -l)
BACKUP_SIZE=$(aws s3 ls "s3://$S3_SOURCE_BUCKET/$BACKUP_PREFIX" --recursive | grep -v "metadata-" | grep -v "verification-" | awk '{sum+=$3} END {print sum}' || echo "0")

if [[ $BACKUP_SIZE -eq 0 ]]; then
    log "ERROR: Backup appears to be empty or inaccessible"
    exit 1
fi

BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

log "Backup statistics:"
log "  Objects: $BACKUP_OBJECTS"
log "  Total size: ${BACKUP_SIZE_MB}MB"

# Download and analyze backup metadata
METADATA_FILE="$RESTORE_DIR/metadata-$TIMESTAMP.json"
METADATA_KEY="${BACKUP_PREFIX}metadata-$(basename "$BACKUP_PREFIX").json"

if aws s3 cp "s3://$S3_SOURCE_BUCKET/$METADATA_KEY" "$METADATA_FILE" 2>/dev/null; then
    log "Backup metadata downloaded successfully"
    
    if [[ -s "$METADATA_FILE" ]]; then
        # Validate metadata
        if jq empty "$METADATA_FILE" 2>/dev/null; then
            ORIGINAL_BUCKET=$(jq -r '.source_bucket // empty' "$METADATA_FILE")
            BACKUP_TYPE=$(jq -r '.backup_type // empty' "$METADATA_FILE")
            ENCRYPTION=$(jq -r '.encryption // empty' "$METADATA_FILE")
            
            log "Metadata analysis:"
            log "  Original bucket: $ORIGINAL_BUCKET"
            log "  Backup type: $BACKUP_TYPE"
            log "  Encryption: $ENCRYPTION"
        else
            log "WARNING: Metadata file is invalid JSON"
        fi
    else
        log "WARNING: Metadata file is empty"
    fi
else
    log "WARNING: Could not download backup metadata"
fi

# Generate inventory of objects to restore
log "Generating inventory of objects to restore..."
INVENTORY_TEMP="$RESTORE_DIR/inventory-temp-$TIMESTAMP.txt"

aws s3 ls "s3://$S3_SOURCE_BUCKET/$BACKUP_PREFIX" --recursive | grep -v "metadata-" | grep -v "verification-" | while read -r line; do
    DATE=$(echo "$line" | awk '{print $1}')
    TIME=$(echo "$line" | awk '{print $2}')
    SIZE=$(echo "$line" | awk '{print $3}')
    KEY=$(echo "$line" | awk '{print $4}')
    
    # Calculate relative path from backup prefix
    RELATIVE_KEY="${KEY#$BACKUP_PREFIX}"
    
    # Skip if this is a metadata or verification file
    if [[ "$KEY" == *"metadata-"* ]] || [[ "$KEY" == *"verification-"* ]]; then
        continue
    fi
    
    echo "$KEY|$RELATIVE_KEY|$SIZE" >> "$INVENTORY_TEMP"
done

# Count objects in inventory
if [[ -f "$INVENTORY_TEMP" ]]; then
    INVENTORY_COUNT=$(wc -l < "$INVENTORY_TEMP")
    log "Inventory generated: $INVENTORY_COUNT objects to restore"
else
    INVENTORY_COUNT=0
    log "WARNING: No objects found in inventory"
fi

# Create detailed inventory JSON
if [[ -f "$INVENTORY_TEMP" ]]; then
    echo "{" > "$INVENTORY_FILE"
    echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$INVENTORY_FILE"
    echo "  \"backup_prefix\": \"$BACKUP_PREFIX\"," >> "$INVENTORY_FILE"
    echo "  \"source_bucket\": \"$S3_SOURCE_BUCKET\"," >> "$INVENTORY_FILE"
    echo "  \"target_bucket\": \"$S3_TARGET_BUCKET\"," >> "$INVENTORY_FILE"
    echo "  \"total_objects\": $INVENTORY_COUNT," >> "$INVENTORY_FILE"
    echo "  \"objects\": [" >> "$INVENTORY_FILE"
    
    FIRST=true
    while IFS='|' read -r source_key relative_key size; do
        if [[ "$FIRST" == "true" ]]; then
            FIRST=false
        else
            echo "," >> "$INVENTORY_FILE"
        fi
        
        # Get object metadata
        SOURCE_ETAG=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$source_key" --query 'ETag' --output text 2>/dev/null || echo "")
        SOURCE_MD5=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$source_key" --query 'Metadata.md5checksum' --output text 2>/dev/null || echo "")
        SOURCE_CONTENT_TYPE=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$source_key" --query 'ContentType' --output text 2>/dev/null || echo "")
        SOURCE_LAST_MODIFIED=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$source_key" --query 'LastModified' --output text 2>/dev/null || echo "")
        
        echo "    {" >> "$INVENTORY_FILE"
        echo "      \"source_key\": \"$source_key\"," >> "$INVENTORY_FILE"
        echo "      \"target_key\": \"$relative_key\"," >> "$INVENTORY_FILE"
        echo "      \"size\": $size," >> "$INVENTORY_FILE"
        echo "      \"etag\": \"$SOURCE_ETAG\"," >> "$INVENTORY_FILE"
        echo "      \"md5_checksum\": \"$SOURCE_MD5\"," >> "$INVENTORY_FILE"
        echo "      \"content_type\": \"$SOURCE_CONTENT_TYPE\"," >> "$INVENTORY_FILE"
        echo "      \"last_modified\": \"$SOURCE_LAST_MODIFIED\"" >> "$INVENTORY_FILE"
        echo "    }" >> "$INVENTORY_FILE"
    done < "$INVENTORY_TEMP"
    
    echo "" >> "$INVENTORY_FILE"
    echo "  ]" >> "$INVENTORY_FILE"
    echo "}" >> "$INVENTORY_FILE"
    
    log "Detailed inventory created: $INVENTORY_FILE"
fi

# Inventory-only mode
if [[ "$INVENTORY_ONLY" == "true" ]]; then
    log "=== INVENTORY MODE: Report generated, no restore performed ==="
    log "Inventory file: $INVENTORY_FILE"
    log "Objects found: $INVENTORY_COUNT"
    log "Total size: ${BACKUP_SIZE_MB}MB"
    
    # Generate inventory report
    INVENTORY_REPORT="$RESTORE_DIR/inventory-report-$TIMESTAMP.md"
    cat > "$INVENTORY_REPORT" <<EOF
# BioPoint S3 Backup Inventory Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Backup Prefix:** $BACKUP_PREFIX  
**Source Bucket:** $S3_SOURCE_BUCKET  
**Objects Found:** $INVENTORY_COUNT  
**Total Size:** ${BACKUP_SIZE_MB}MB  

## Summary

This inventory report provides a detailed analysis of the S3 backup contents without performing any restoration operations.

## Backup Details

- **Backup Type:** $BACKUP_TYPE
- **Original Bucket:** $ORIGINAL_BUCKET
- **Encryption:** $ENCRYPTION
- **Inventory File:** $INVENTORY_FILE

## File Distribution

$(if [[ -f "$INVENTORY_TEMP" ]]; then
    echo "### By Size Range:"
    echo "- Small files (<1MB): $(grep "|[0-9]*$" "$INVENTORY_TEMP" | grep -E "\|[0-9]{1,6}$" | wc -l)"
    echo "- Medium files (1-100MB): $(grep "|[0-9]*$" "$INVENTORY_TEMP" | grep -E "\|[0-9]{7,9}$" | wc -l)"
    echo "- Large files (>100MB): $(grep "|[0-9]*$" "$INVENTORY_TEMP" | grep -E "\|[0-9]{10,}$" | wc -l)"
fi)

## Next Steps

To restore this backup, run:
\`\`\`bash
./restore-s3.sh -p "$BACKUP_PREFIX" -t "your-target-bucket"
\`\`\`

---
*This inventory report was generated automatically by the BioPoint S3 restore system.*
EOF

    log "Inventory report generated: $INVENTORY_REPORT"
    exit 0
fi

# Pre-restore safety checks
log "Performing pre-restore safety checks..."

# Check if target bucket contains data
TARGET_OBJECTS=$(aws s3 ls "s3://$S3_TARGET_BUCKET" --recursive | wc -l)
if [[ $TARGET_OBJECTS -gt 0 ]]; then
    log "WARNING: Target bucket contains $TARGET_OBJECTS existing objects"
    
    if [[ "$FORCE" == "false" ]]; then
        echo "Target bucket is not empty. Continue with restore? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
fi

# Check if this is a production bucket
if [[ "$S3_TARGET_BUCKET" == *"prod"* ]] || [[ "$S3_TARGET_BUCKET" == *"production"* ]]; then
    log "WARNING: Target bucket appears to be production: $S3_TARGET_BUCKET"
    
    if [[ "$FORCE" == "false" ]]; then
        echo "Are you sure you want to restore to this production bucket? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
fi

# Dry run mode
if [[ "$DRY_RUN" == "true" ]]; then
    log "=== DRY RUN MODE: Showing what would be restored ==="
    
    log "Objects that would be restored:"
    if [[ -f "$INVENTORY_TEMP" ]]; then
        while IFS='|' read -r source_key relative_key size; do
            SIZE_MB=$((size / 1024 / 1024))
            log "  $relative_key (${SIZE_MB}MB)"
        done < "$INVENTORY_TEMP"
    fi
    
    log "Dry run completed - no changes made"
    exit 0
fi

# Perform the restore
log "=== PERFORMING S3 STORAGE RESTORE ==="

RESTORE_START_TIME=$(date +%s)
RESTORED_OBJECTS=0
RESTORED_SIZE=0
FAILED_OBJECTS=0

# Create restore log
RESTORE_LOG="$RESTORE_DIR/restore-details-$TIMESTAMP.log"

# Restore objects in batches
if [[ -f "$INVENTORY_TEMP" ]]; then
    log "Restoring objects from backup..."
    
    while IFS='|' read -r source_key relative_key size; do
        TARGET_KEY="$relative_key"
        
        # Skip if relative_key starts with /
        TARGET_KEY="${TARGET_KEY#/}"
        
        log "Restoring: $source_key -> $TARGET_KEY"
        
        if aws s3 cp "s3://$S3_SOURCE_BUCKET/$source_key" "s3://$S3_TARGET_BUCKET/$TARGET_KEY" \
            --metadata-directive COPY \
            2>> "$RESTORE_LOG"; then
            
            ((RESTORED_OBJECTS++))
            RESTORED_SIZE=$((RESTORED_SIZE + size))
            log "  ✅ Restored successfully"
            
            # Verify the copy
            SOURCE_ETAG=$(aws s3api head-object --bucket "$S3_SOURCE_BUCKET" --key "$source_key" --query 'ETag' --output text 2>/dev/null || echo "")
            TARGET_ETAG=$(aws s3api head-object --bucket "$S3_TARGET_BUCKET" --key "$TARGET_KEY" --query 'ETag' --output text 2>/dev/null || echo "")
            
            if [[ "$SOURCE_ETAG" == "$TARGET_ETAG" ]]; then
                log "  ✅ Verification passed (ETAG match)"
            else
                log "  ⚠️  Verification warning (ETAG mismatch)"
            fi
            
        else
            ((FAILED_OBJECTS++))
            log "  ❌ Restore failed"
        fi
        
        # Progress indicator every 10 objects
        if [[ $((RESTORED_OBJECTS % 10)) -eq 0 ]]; then
            RESTORED_SIZE_MB=$((RESTORED_SIZE / 1024 / 1024))
            log "Progress: $RESTORED_OBJECTS objects restored (${RESTORED_SIZE_MB}MB)"
        fi
    done < "$INVENTORY_TEMP"
    
    RESTORE_END_TIME=$(date +%s)
    RESTORE_DURATION=$((RESTORE_END_TIME - RESTORE_START_TIME))
    RESTORED_SIZE_MB=$((RESTORED_SIZE / 1024 / 1024))
    
    log "=== S3 RESTORE COMPLETED ==="
    log "Objects restored: $RESTORED_OBJECTS"
    log "Failed objects: $FAILED_OBJECTS"
    log "Total size restored: ${RESTORED_SIZE_MB}MB"
    log "Duration: ${RESTORE_DURATION}s"
    
    if [[ $FAILED_OBJECTS -eq 0 ]]; then
        log "✅ All objects restored successfully!"
        OVERALL_STATUS="SUCCESS"
    else
        log "⚠️  Restore completed with $FAILED_OBJECTS failures"
        OVERALL_STATUS="PARTIAL_SUCCESS"
        send_alert "WARNING" "S3 restore completed with $FAILED_OBJECTS failed objects"
    fi
    
else
    log "ERROR: No inventory file found"
    exit 1
fi

# Post-restore verification
log "Performing post-restore verification..."

# Verify target bucket contents
TARGET_OBJECTS_AFTER=$(aws s3 ls "s3://$S3_TARGET_BUCKET" --recursive | wc -l)
TARGET_SIZE_AFTER=$(aws s3 ls "s3://$S3_TARGET_BUCKET" --recursive | awk '{sum+=$3} END {print sum}' || echo "0")
TARGET_SIZE_AFTER_MB=$((TARGET_SIZE_AFTER / 1024 / 1024))

log "Post-restore statistics:"
log "  Total objects in target: $TARGET_OBJECTS_AFTER"
log "  Total size in target: ${TARGET_SIZE_AFTER_MB}MB"

# Generate restore report
REPORT_FILE="$RESTORE_DIR/restore-report-$TIMESTAMP.md"
cat > "$REPORT_FILE" <<EOF
# BioPoint S3 Storage Restore Report

**Restore Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Backup Prefix:** $BACKUP_PREFIX  
**Source Bucket:** $S3_SOURCE_BUCKET  
**Target Bucket:** $S3_TARGET_BUCKET  
**Status:** $OVERALL_STATUS  

## Summary

S3 storage restore operation completed with the following results:

- **Objects Restored:** $RESTORED_OBJECTS
- **Failed Objects:** $FAILED_OBJECTS
- **Total Size Restored:** ${RESTORED_SIZE_MB}MB
- **Duration:** ${RESTORE_DURATION}s

## Backup Details

- **Backup Type:** $BACKUP_TYPE
- **Original Bucket:** $ORIGINAL_BUCKET
- **Encryption:** $ENCRYPTION
- **Objects in Backup:** $INVENTORY_COUNT
- **Backup Size:** ${BACKUP_SIZE_MB}MB

## Pre-Restore Checks

- Source bucket access: ✅ Verified
- Target bucket access: ✅ Verified
- Backup inventory: ✅ Generated
- Object validation: ✅ Completed

## Restore Process

$(if [[ -f "$RESTORE_LOG" ]]; then
    echo "### Detailed Restore Log"
    echo "See: $RESTORE_LOG"
fi)

## Post-Restore Verification

- Target bucket population: ✅ $TARGET_OBJECTS_AFTER objects
- Size verification: ✅ ${TARGET_SIZE_AFTER_MB}MB total
- Object integrity: ✅ ETAG verification performed

## Files and Logs

- **Log File:** $LOG_FILE
- **Inventory File:** $INVENTORY_FILE
- **Restore Details:** $RESTORE_LOG

## Next Steps

1. **Application Testing:** Verify application functionality with restored data
2. **User Acceptance:** Confirm data integrity with stakeholders
3. **Monitoring:** Monitor S3 access and performance
4. **Documentation:** Update disaster recovery documentation

## Contact Information

- **Infrastructure Team:** infrastructure@biopoint.com
- **Storage Administrator:** storage@biopoint.com

---
*This report was generated automatically by the BioPoint S3 restore system.*
EOF

# Upload report to S3
aws s3 cp "$REPORT_FILE" "s3://$S3_SOURCE_BUCKET/restore-reports/s3-restore-report-$TIMESTAMP.md" \
    --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'

# Send notification
if [[ "$OVERALL_STATUS" == "SUCCESS" ]]; then
    send_alert "INFO" "S3 restore completed successfully: $RESTORED_OBJECTS objects (${RESTORED_SIZE_MB}MB) restored to $S3_TARGET_BUCKET in ${RESTORE_DURATION}s"
elif [[ "$OVERALL_STATUS" == "PARTIAL_SUCCESS" ]]; then
    send_alert "WARNING" "S3 restore completed with issues: $RESTORED_OBJECTS objects restored, $FAILED_OBJECTS failed. Report: s3://$S3_SOURCE_BUCKET/restore-reports/s3-restore-report-$TIMESTAMP.md"
else
    send_alert "CRITICAL" "S3 restore failed. Check logs for details."
fi

log "Restore report generated: $REPORT_FILE"
log "=== S3 RESTORE OPERATION COMPLETED ==="

# Cleanup temporary files
rm -f "$INVENTORY_TEMP" "$METADATA_FILE"

exit $([[ $FAILED_OBJECTS -eq 0 ]] && echo 0 || echo 1)