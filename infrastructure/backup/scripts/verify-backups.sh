#!/bin/bash

# BioPoint Backup Verification Script
# Comprehensive verification of database and S3 backups
# Usage: ./verify-backups.sh [weekly|monthly]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFICATION_TYPE="${1:-weekly}"
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

# Verification configuration
VERIFY_BASE_DIR="/tmp/biopoint-verify"
VERIFY_DIR="$VERIFY_BASE_DIR/$VERIFICATION_TYPE"
LOG_FILE="$VERIFY_DIR/verification-$TIMESTAMP.log"
REPORT_FILE="$VERIFY_DIR/verification-report-$TIMESTAMP.md"
METRICS_FILE="$VERIFY_DIR/metrics-$TIMESTAMP.json"

# S3 configuration
S3_BACKUP_BUCKET="${S3_BUCKET_NAME}-backups"
S3_BACKUP_PREFIX="database"
S3_BACKUP_PREFIX_S3="s3-backups"

# Monitoring configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Verification thresholds
MAX_BACKUP_AGE_DAYS=2
MIN_BACKUP_SIZE_MB=1
MAX_VERIFICATION_TIME_MINUTES=30

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
            --data "{\"text\":\"$emoji BioPoint Backup Verification [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Send email alert if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "BioPoint Backup Verification [$severity]" "$ALERT_EMAIL" || true
    fi
}

# Create verification directory
mkdir -p "$VERIFY_DIR"
touch "$LOG_FILE"

log "Starting backup verification: $VERIFICATION_TYPE"
log "Timestamp: $TIMESTAMP"

# Initialize verification results
VERIFICATION_RESULTS=()
OVERALL_STATUS="PASS"
WARNINGS=0
ERRORS=0

# Function to add verification result
add_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    VERIFICATION_RESULTS+=("$test_name|$status|$message|$details")
    
    if [[ "$status" == "FAIL" ]]; then
        OVERALL_STATUS="FAIL"
        ((ERRORS++))
        send_alert "CRITICAL" "Backup verification failed: $test_name - $message"
    elif [[ "$status" == "WARN" ]]; then
        ((WARNINGS++))
    fi
}

# 1. Verify Database Backups
log "=== Verifying Database Backups ==="

# Check if recent database backups exist
log "Checking for recent database backups..."

LATEST_DB_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/daily/" --recursive | grep "\.sql\.enc$" | sort | tail -1)

if [[ -z "$LATEST_DB_BACKUP" ]]; then
    add_result "Database Backup Existence" "FAIL" "No database backups found"
else
    BACKUP_DATE=$(echo "$LATEST_DB_BACKUP" | awk '{print $1}')
    BACKUP_TIME=$(echo "$LATEST_DB_BACKUP" | awk '{print $2}')
    BACKUP_KEY=$(echo "$LATEST_DB_BACKUP" | awk '{print $4}')
    
    # Check backup age
    BACKUP_AGE_DAYS=$(( ($(date +%s) - $(date -d "$BACKUP_DATE $BACKUP_TIME" +%s)) / 86400 ))
    
    if [[ $BACKUP_AGE_DAYS -gt $MAX_BACKUP_AGE_DAYS ]]; then
        add_result "Database Backup Age" "WARN" "Latest backup is $BACKUP_AGE_DAYS days old (max: $MAX_BACKUP_AGE_DAYS)"
    else
        add_result "Database Backup Age" "PASS" "Latest backup is $BACKUP_AGE_DAYS days old"
    fi
    
    # Check backup size
    BACKUP_SIZE=$(echo "$LATEST_DB_BACKUP" | awk '{print $3}')
    BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))
    
    if [[ $BACKUP_SIZE_MB -lt $MIN_BACKUP_SIZE_MB ]]; then
        add_result "Database Backup Size" "WARN" "Backup size is only ${BACKUP_SIZE_MB}MB (min: ${MIN_BACKUP_SIZE_MB}MB)"
    else
        add_result "Database Backup Size" "PASS" "Backup size is ${BACKUP_SIZE_MB}MB"
    fi
    
    # Verify backup integrity
    log "Verifying database backup integrity..."
    
    # Download backup for verification
    BACKUP_FILE="$VERIFY_DIR/$(basename "$BACKUP_KEY")"
    KEY_FILE="$VERIFY_DIR/key-$(basename "$BACKUP_KEY" .sql.enc).key"
    
    log "Downloading backup for verification: $BACKUP_KEY"
    if aws s3 cp "s3://$S3_BACKUP_BUCKET/$BACKUP_KEY" "$BACKUP_FILE"; then
        # Find and download corresponding encryption key
        KEY_PREFIX=$(dirname "$BACKUP_KEY" | sed 's|daily|keys|')
        LATEST_KEY=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$KEY_PREFIX/" --recursive | grep "key-" | sort | tail -1 | awk '{print $4}')
        
        if [[ -n "$LATEST_KEY" ]]; then
            aws s3 cp "s3://$S3_BACKUP_BUCKET/$LATEST_KEY" "$KEY_FILE"
            
            # Attempt decryption
            DECRYPTED_FILE="${BACKUP_FILE%.enc}"
            if openssl enc -d -AES-256-CBC -in "$BACKUP_FILE" -out "$DECRYPTED_FILE" -pass file:"$KEY_FILE"; then
                # Verify it's a valid PostgreSQL backup
                if file "$DECRYPTED_FILE" | grep -q "PostgreSQL"; then
                    add_result "Database Backup Integrity" "PASS" "Backup decrypted successfully and is valid PostgreSQL format"
                else
                    add_result "Database Backup Integrity" "WARN" "Backup decrypted but format validation inconclusive"
                fi
                
                # Clean up decrypted file
                rm -f "$DECRYPTED_FILE"
            else
                add_result "Database Backup Integrity" "FAIL" "Failed to decrypt backup"
            fi
        else
            add_result "Database Backup Integrity" "FAIL" "Could not find encryption key for backup"
        fi
        
        # Clean up downloaded files
        rm -f "$BACKUP_FILE" "$KEY_FILE"
    else
        add_result "Database Backup Download" "FAIL" "Failed to download backup for verification"
    fi
fi

# 2. Verify S3 Backups
log "=== Verifying S3 Backups ==="

# Check if recent S3 backups exist
log "Checking for recent S3 backups..."

LATEST_S3_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX_S3/" --recursive | grep "metadata-" | sort | tail -1)

if [[ -z "$LATEST_S3_BACKUP" ]]; then
    add_result "S3 Backup Existence" "FAIL" "No S3 backups found"
else
    S3_BACKUP_DATE=$(echo "$LATEST_S3_BACKUP" | awk '{print $1}')
    S3_BACKUP_TIME=$(echo "$LATEST_S3_BACKUP" | awk '{print $2}')
    S3_BACKUP_KEY=$(echo "$LATEST_S3_BACKUP" | awk '{print $4}')
    
    # Check backup age
    S3_BACKUP_AGE_DAYS=$(( ($(date +%s) - $(date -d "$S3_BACKUP_DATE $S3_BACKUP_TIME" +%s)) / 86400 ))
    
    if [[ $S3_BACKUP_AGE_DAYS -gt $MAX_BACKUP_AGE_DAYS ]]; then
        add_result "S3 Backup Age" "WARN" "Latest S3 backup is $S3_BACKUP_AGE_DAYS days old (max: $MAX_BACKUP_AGE_DAYS)"
    else
        add_result "S3 Backup Age" "PASS" "Latest S3 backup is $S3_BACKUP_AGE_DAYS days old"
    fi
    
    # Download and verify metadata
    METADATA_FILE="$VERIFY_DIR/s3-metadata-$TIMESTAMP.json"
    if aws s3 cp "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_KEY" "$METADATA_FILE"; then
        if [[ -s "$METADATA_FILE" ]]; then
            # Validate metadata structure
            if jq empty "$METADATA_FILE" 2>/dev/null; then
                OBJECTS_SYNCED=$(jq -r '.objects_synced // 0' "$METADATA_FILE")
                TOTAL_OBJECTS=$(jq -r '.total_objects // 0' "$METADATA_FILE")
                
                if [[ $OBJECTS_SYNCED -gt 0 ]]; then
                    add_result "S3 Backup Metadata" "PASS" "Metadata is valid, $OBJECTS_SYNCED objects synced"
                else
                    add_result "S3 Backup Metadata" "WARN" "Metadata shows 0 objects synced"
                fi
            else
                add_result "S3 Backup Metadata" "FAIL" "Metadata file is invalid JSON"
            fi
        else
            add_result "S3 Backup Metadata" "FAIL" "Metadata file is empty"
        fi
    else
        add_result "S3 Backup Metadata Download" "FAIL" "Failed to download metadata"
    fi
fi

# 3. Verify Backup Retention Policies
log "=== Verifying Backup Retention Policies ==="

# Check daily backups retention
DAILY_BACKUPS=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/daily/" --recursive | grep "\.sql\.enc$" | wc -l)
if [[ $DAILY_BACKUPS -lt 5 ]]; then
    add_result "Daily Backup Retention" "WARN" "Only $DAILY_BACKUPS daily backups found (expected: 5-7)"
else
    add_result "Daily Backup Retention" "PASS" "$DAILY_BACKUPS daily backups found"
fi

# Check weekly backups retention
WEEKLY_BACKUPS=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/weekly/" --recursive | grep "\.sql\.enc$" | wc -l)
if [[ $WEEKLY_BACKUPS -lt 3 ]]; then
    add_result "Weekly Backup Retention" "WARN" "Only $WEEKLY_BACKUPS weekly backups found (expected: 4)"
else
    add_result "Weekly Backup Retention" "PASS" "$WEEKLY_BACKUPS weekly backups found"
fi

# 4. Verify Encryption
log "=== Verifying Encryption ==="

# Check that backups are encrypted
SAMPLE_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/daily/" --recursive | grep "\.sql\.enc$" | head -1 | awk '{print $4}')
if [[ -n "$SAMPLE_BACKUP" ]]; then
    # Download a small sample to check encryption
    SAMPLE_FILE="$VERIFY_DIR/sample-encrypted-$TIMESTAMP.sql.enc"
    if aws s3 cp "s3://$S3_BACKUP_BUCKET/$SAMPLE_BACKUP" "$SAMPLE_FILE"; then
        # Check if file appears to be encrypted (should be binary)
        if file "$SAMPLE_FILE" | grep -q "data"; then
            add_result "Backup Encryption" "PASS" "Backups appear to be encrypted"
        else
            add_result "Backup Encryption" "WARN" "Backup file format unexpected"
        fi
        
        rm -f "$SAMPLE_FILE"
    else
        add_result "Backup Encryption Check" "FAIL" "Failed to download sample backup"
    fi
fi

# 5. Verify S3 Bucket Configuration
log "=== Verifying S3 Bucket Configuration ==="

# Check bucket versioning
VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket "$S3_BACKUP_BUCKET" --query 'Status' --output text 2>/dev/null || echo "")
if [[ "$VERSIONING_STATUS" == "Enabled" ]]; then
    add_result "S3 Bucket Versioning" "PASS" "Bucket versioning is enabled"
else
    add_result "S3 Bucket Versioning" "FAIL" "Bucket versioning is not enabled (status: $VERSIONING_STATUS)"
fi

# Check server-side encryption
ENCRYPTION_RULES=$(aws s3api get-bucket-encryption --bucket "$S3_BACKUP_BUCKET" --query 'ServerSideEncryptionConfiguration.Rules' --output json 2>/dev/null || echo "[]")
if [[ $(echo "$ENCRYPTION_RULES" | jq length) -gt 0 ]]; then
    add_result "S3 Bucket Encryption" "PASS" "Server-side encryption is configured"
else
    add_result "S3 Bucket Encryption" "FAIL" "Server-side encryption is not configured"
fi

# 6. Verify Cross-Region Replication (if configured)
if [[ "${CROSS_REGION_BACKUP:-false}" == "true" ]]; then
    log "=== Verifying Cross-Region Replication ==="
    
    S3_CROSS_REGION_BUCKET="${S3_BUCKET_NAME}-backups-dr"
    if aws s3 ls "s3://$S3_CROSS_REGION_BUCKET" > /dev/null 2>&1; then
        CROSS_REGION_BACKUPS=$(aws s3 ls "s3://$S3_CROSS_REGION_BUCKET/" --recursive | grep "metadata-" | wc -l)
        if [[ $CROSS_REGION_BACKUPS -gt 0 ]]; then
            add_result "Cross-Region Replication" "PASS" "$CROSS_REGION_BACKUPS backups found in DR region"
        else
            add_result "Cross-Region Replication" "WARN" "No backups found in DR region"
        fi
    else
        add_result "Cross-Region Replication" "WARN" "Cross-region bucket not accessible"
    fi
fi

# Generate verification report
cat > "$REPORT_FILE" <<EOF
# BioPoint Backup Verification Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Verification Type:** $VERIFICATION_TYPE  
**Overall Status:** $OVERALL_STATUS  
**Errors:** $ERRORS  
**Warnings:** $WARNINGS  

## Summary

This report provides a comprehensive verification of BioPoint's backup systems, including database backups, S3 storage backups, encryption, retention policies, and configuration compliance.

## Detailed Results

| Test | Status | Message | Details |
|------|--------|---------|---------|
EOF

for result in "${VERIFICATION_RESULTS[@]}"; do
    IFS='|' read -r test_name status message details <<< "$result"
    
    # Determine status emoji
    case "$status" in
        "PASS") status_emoji="✅" ;;
        "WARN") status_emoji="⚠️" ;;
        "FAIL") status_emoji="❌" ;;
        *) status_emoji="❓" ;;
    esac
    
    echo "| $test_name | $status_emoji $status | $message | ${details:-N/A} |" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" <<EOF

## Recommendations

EOF

if [[ $ERRORS -gt 0 ]]; then
    cat >> "$REPORT_FILE" <<EOF
### 🚨 Critical Issues
- **Immediate Action Required:** Address the $ERRORS error(s) identified in this report
- **Priority:** Restore backup functionality before next scheduled backup
- **Contact:** Infrastructure team and system administrators

EOF
fi

if [[ $WARNINGS -gt 0 ]]; then
    cat >> "$REPORT_FILE" <<EOF
### ⚠️ Warnings
- **Review Required:** Address the $WARNINGS warning(s) to improve backup reliability
- **Timeline:** Resolve within 24-48 hours
- **Monitoring:** Increase monitoring frequency until resolved

EOF
fi

cat >> "$REPORT_FILE" <<EOF
### 📋 General Recommendations
1. **Regular Testing:** Perform backup restoration tests monthly
2. **Monitoring:** Set up automated alerts for backup failures
3. **Documentation:** Keep disaster recovery procedures updated
4. **Training:** Ensure team members are trained on recovery procedures

## Next Steps

1. **Review Results:** Analyze any failures or warnings in detail
2. **Take Action:** Address critical issues immediately
3. **Schedule Retest:** Plan follow-up verification after fixes
4. **Update Documentation:** Document any changes or improvements

## Contact Information

- **Infrastructure Team:** infrastructure@biopoint.com
- **On-Call Engineer:** +1-XXX-XXX-XXXX
- **Emergency Escalation:** +1-XXX-XXX-XXXX

---
*This report was generated automatically by the BioPoint backup verification system.*
EOF

# Generate metrics
VERIFICATION_DURATION=$(($(date +%s) - $(date -d "${TIMESTAMP:0:8} ${TIMESTAMP:9:2}:${TIMESTAMP:11:2}:${TIMESTAMP:13:2}" +%s 2>/dev/null || echo "0")))

METRICS=$(cat <<EOF
{
    "timestamp": "$TIMESTAMP",
    "verification_type": "$VERIFICATION_TYPE",
    "overall_status": "$OVERALL_STATUS",
    "errors": $ERRORS,
    "warnings": $WARNINGS,
    "duration_seconds": $VERIFICATION_DURATION,
    "tests_performed": ${#VERIFICATION_RESULTS[@]},
    "daily_backups_found": $DAILY_BACKUPS,
    "weekly_backups_found": $WEEKLY_BACKUPS,
    "latest_db_backup_age_days": ${BACKUP_AGE_DAYS:-999},
    "latest_s3_backup_age_days": ${S3_BACKUP_AGE_DAYS:-999}
}
EOF
)

echo "$METRICS" > "$METRICS_FILE"

# Upload report to S3
aws s3 cp "$REPORT_FILE" "s3://$S3_BACKUP_BUCKET/verification-reports/verification-report-$TIMESTAMP.md" \
    --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'

aws s3 cp "$METRICS_FILE" "s3://$S3_BACKUP_BUCKET/verification-reports/metrics-$TIMESTAMP.json" \
    --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'

# Send notification
if [[ "$OVERALL_STATUS" == "FAIL" ]]; then
    send_alert "CRITICAL" "Backup verification FAILED: $ERRORS errors, $WARNINGS warnings. Report: s3://$S3_BACKUP_BUCKET/verification-reports/verification-report-$TIMESTAMP.md"
elif [[ $WARNINGS -gt 0 ]]; then
    send_alert "WARNING" "Backup verification completed with warnings: $WARNINGS warnings. Report: s3://$S3_BACKUP_BUCKET/verification-reports/verification-report-$TIMESTAMP.md"
else
    send_alert "INFO" "Backup verification PASSED: All systems operational. Report: s3://$S3_BACKUP_BUCKET/verification-reports/verification-report-$TIMESTAMP.md"
fi

log "Verification completed!"
log "Overall Status: $OVERALL_STATUS"
log "Errors: $ERRORS"
log "Warnings: $WARNINGS"
log "Report: $REPORT_FILE"
log "Metrics: $METRICS_FILE"

# Clean up temporary files
rm -f "$VERIFY_DIR/sample-encrypted-$TIMESTAMP.sql.enc"
rm -f "$VERIFY_DIR/s3-metadata-$TIMESTAMP.json"

exit $((ERRORS > 0 ? 1 : 0))