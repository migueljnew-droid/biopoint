# S3 Storage Outage Recovery Runbook

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Cloud Infrastructure Engineer  
**Review Schedule:** Monthly

---

## Overview

This runbook provides step-by-step procedures for recovering from S3 storage outages affecting BioPoint's file storage system. S3 outages can impact user uploads of lab results, progress photos, and other health-related documents.

**Recovery Objectives:**
- **RTO:** 45 minutes
- **RPO:** 24 hours maximum data loss
- **HIPAA Compliance:** Maintain encryption and access controls throughout recovery

---

## Detection Methods

### Primary Detection
- **Upload Failures:** Users unable to upload files via mobile app
- **Download Failures:** Users unable to access previously uploaded documents
- **Presigned URL Errors:** API returning S3-related errors
- **Monitoring Alerts:** S3 bucket accessibility checks failing

### Secondary Detection
- **API Error Logs:** S3 operation failures in application logs
- **CDN Errors:** CloudFront distribution errors
- **Cross-Region Replication Failures:** S3 replication lag or errors
- **User Support Tickets:** Reports of file upload/access issues

---

## Immediate Response (0-5 minutes)

### 1. Assess S3 Status
```bash
# Check primary S3 bucket accessibility
echo "Testing primary S3 bucket accessibility..."
aws s3 ls s3://biopoint-uploads/ --region us-east-1 > /dev/null 2>&1 && echo "PRIMARY_BUCKET_OK" || echo "PRIMARY_BUCKET_FAILED"

# Check AWS service health
echo "Checking AWS service health..."
curl -s "https://health.aws.amazon.com/json/events.json" | jq -r '.events[] | select(.service == "S3" and .region == "US-EAST-1") | .status'

# Check CloudWatch S3 metrics
echo "Checking S3 CloudWatch metrics..."
aws cloudwatch get-metric-statistics \
    --namespace "AWS/S3" \
    --metric-name "BucketSizeBytes" \
    --dimensions Name=BucketName,Value=biopoint-uploads Name=StorageType,Value=StandardStorage \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average

# Check recent API logs for S3 errors
echo "Checking recent API logs for S3 errors..."
kubectl logs deployment/biopoint-api --tail=100 | grep -i "s3\|upload\|presigned"
```

### 2. Test File Operations
```bash
# Test file upload capability
echo "Testing file upload capability..."
TEST_FILE="/tmp/test-upload-$(date +%Y%m%d_%H%M%S).txt"
echo "DR Test File" > "$TEST_FILE"

aws s3 cp "$TEST_FILE" "s3://biopoint-uploads/dr-test/test-file.txt" --region us-east-1 > /dev/null 2>&1 && \
echo "UPLOAD_TEST_OK" || echo "UPLOAD_TEST_FAILED"

# Test file download capability
echo "Testing file download capability..."
aws s3 cp "s3://biopoint-uploads/dr-test/test-file.txt" "/tmp/downloaded-test.txt" --region us-east-1 > /dev/null 2>&1 && \
echo "DOWNLOAD_TEST_OK" || echo "DOWNLOAD_TEST_FAILED"

# Test presigned URL generation (via API)
echo "Testing presigned URL generation..."
PRESIGNED_TEST=$(curl -s -X POST "https://api.biopoint.com/upload/presigned-url" \
    -H "Authorization: Bearer ${TEST_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"filename":"test.jpg","contentType":"image/jpeg"}' \
    -w "\nHTTP_CODE:%{http_code}")

echo "Presigned URL test: $PRESIGNED_TEST"
```

### 3. Notify DR Team
```bash
# Send immediate alert
curl -X POST "https://api.pagerduty.com/integration/${PAGERDUTY_KEY}/enqueue" \
     -H "Content-Type: application/json" \
     -d "{
       \"routing_key\": \"${PAGERDUTY_KEY}\",
       \"event_action\": \"trigger\",
       \"payload\": {
         \"summary\": \"BioPoint S3 Storage Outage Detected\",
         \"source\": \"storage-monitoring\",
         \"severity\": \"high\",
         \"custom_details\": {
           \"bucket\": \"biopoint-uploads\",
           \"region\": \"us-east-1\",
           \"detection_time\": \"$(date)\",
           \"upload_test\": \"$(aws s3 ls s3://biopoint-uploads/ > /dev/null 2>&1 && echo 'PASSED' || echo 'FAILED')\"
         }
       }
     }"

# Log incident
echo "$(date): S3 storage outage incident initiated" >> /var/log/dr-incidents.log
```

---

## Assessment Phase (5-15 minutes)

### 1. Determine Outage Scope

```bash
# Check cross-region replication status
echo "Checking cross-region replication status..."
aws s3api get-bucket-replication --bucket biopoint-uploads --region us-east-1

# Check if outage affects multiple regions
echo "Testing standby region accessibility..."
aws s3 ls s3://biopoint-uploads-west/ --region us-west-2 > /dev/null 2>&1 && echo "STANDBY_REGION_OK" || echo "STANDBY_REGION_FAILED"

# Check Cloudflare R2 accessibility
echo "Testing Cloudflare R2 accessibility..."
aws s3 ls s3://biopoint-r2-backup/ --endpoint-url https://1234567890.r2.cloudflarestorage.com > /dev/null 2>&1 && echo "R2_BACKUP_OK" || echo "R2_BACKUP_FAILED"

# Check CDN status
echo "Checking CDN distribution status..."
aws cloudfront get-distribution --id E123456789ABC --query 'Distribution.Status'

# Check recent file uploads (last 24 hours)
echo "Checking recent file uploads..."
RECENT_FILES=$(aws s3 ls s3://biopoint-uploads/ --recursive --region us-east-1 | grep "$(date -d '24 hours ago' '+%Y-%m-%d')" | wc -l)
echo "Files uploaded in last 24 hours: $RECENT_FILES"
```

### 2. Assess Recovery Options

Based on assessment, determine the most appropriate recovery strategy:

#### **Option A: Cross-Region Failover**
- **When to use:** Primary region S3 outage, standby region available
- **Advantages:** Minimal data loss, preserves recent uploads
- **Requirements:** Cross-region replication configured and current

#### **Option B: CDN Failover**
- **When to use:** Primary S3 accessible but degraded, CDN issues
- **Advantages:** Improved performance, reduced S3 load
- **Requirements:** Cloudflare R2 configured as backup

#### **Option C: Read-Only Mode**
- **When to use:** Temporary S3 issues, uploads blocked but downloads work
- **Advantages:** Maintains service availability, prevents data loss
- **Requirements:** Application support for read-only mode

---

## Recovery Procedures

### Option A: Cross-Region Failover

**Use when:** Primary S3 region outage, cross-region replication healthy

```bash
#!/bin/bash
# Cross-Region S3 Failover Procedure

set -euo pipefail

# Configuration
PRIMARY_BUCKET="biopoint-uploads"
STANDBY_BUCKET="biopoint-uploads-west"
PRIMARY_REGION="us-east-1"
STANDBY_REGION="us-west-2"
LOG_FILE="/var/log/s3-failover-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting cross-region S3 failover" >> $LOG_FILE

# Step 1: Verify standby bucket health
echo "$(date): Verifying standby bucket health" >> $LOG_FILE
STANDBY_HEALTH=$(aws s3 ls s3://${STANDBY_BUCKET}/ --region ${STANDBY_REGION} > /dev/null 2>&1 && echo "HEALTHY" || echo "UNHEALTHY")
echo "$(date): Standby bucket status: $STANDBY_HEALTH" >> $LOG_FILE

if [ "$STANDBY_HEALTH" = "HEALTHY" ]; then
    echo "$(date): Standby bucket confirmed healthy, proceeding with failover" >> $LOG_FILE
    
    # Step 2: Update API configuration to use standby bucket
echo "$(date): Updating API configuration to use standby bucket" >> $LOG_FILE
    kubectl set env deployment/biopoint-api \
        S3_BUCKET="${STANDBY_BUCKET}" \
        AWS_REGION="${STANDBY_REGION}" \
        PRESIGNED_URL_BUCKET="${STANDBY_BUCKET}"
    
    # Step 3: Update CloudFront distribution
echo "$(date): Updating CloudFront distribution" >> $LOG_FILE
    # Get current distribution config
    aws cloudfront get-distribution-config --id E123456789ABC > /tmp/current-cf-config.json
    
    # Update origin to point to standby bucket
    jq '.DistributionConfig.Origins.Items[0].DomainName = "'${STANDBY_BUCKET}'.s3.'${STANDBY_REGION}'.amazonaws.com"' \
       /tmp/current-cf-config.json > /tmp/updated-cf-config.json
    
    # Apply updated configuration
    ETAG=$(jq -r '.ETag' /tmp/current-cf-config.json)
    aws cloudfront update-distribution \
        --id E123456789ABC \
        --distribution-config file:///tmp/updated-cf-config.json \
        --if-match $ETAG >> $LOG_FILE
    
    # Step 4: Verify file operations in standby region
echo "$(date): Verifying file operations in standby region" >> $LOG_FILE
    
    # Test upload to standby bucket
    TEST_FILE="/tmp/standby-test-$(date +%Y%m%d_%H%M%S).txt"
    echo "Standby region test file" > "$TEST_FILE"
    
    aws s3 cp "$TEST_FILE" "s3://${STANDBY_BUCKET}/dr-test/standby-test.txt" --region ${STANDBY_REGION} && \
    echo "$(date): Standby upload test successful" >> $LOG_FILE || \
    echo "$(date): Standby upload test failed" >> $LOG_FILE
    
    # Test download from standby bucket
    aws s3 cp "s3://${STANDBY_BUCKET}/dr-test/standby-test.txt" "/tmp/downloaded-standby.txt" --region ${STANDBY_REGION} && \
    echo "$(date): Standby download test successful" >> $LOG_FILE || \
    echo "$(date): Standby download test failed" >> $LOG_FILE
    
    # Step 5: Test API integration
echo "$(date): Testing API integration with standby bucket" >> $LOG_FILE
    
    # Test presigned URL generation
    PRESIGNED_RESPONSE=$(curl -s -X POST "https://api.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer ${TEST_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"filename":"standby-test.jpg","contentType":"image/jpeg"}')
    
    if echo "$PRESIGNED_RESPONSE" | grep -q "url"; then
        echo "$(date): Presigned URL generation successful" >> $LOG_FILE
        
        # Extract presigned URL and test upload
        PRESIGNED_URL=$(echo "$PRESIGNED_RESPONSE" | jq -r '.url')
        echo "test file content" | curl -s -X PUT "$PRESIGNED_URL" \
            -H "Content-Type: image/jpeg" \
            --data-binary @- && \
        echo "$(date): Presigned URL upload test successful" >> $LOG_FILE || \
        echo "$(date): Presigned URL upload test failed" >> $LOG_FILE
    else
        echo "$(date): Presigned URL generation failed" >> $LOG_FILE
    fi
    
    # Step 6: Monitor for primary region recovery
echo "$(date): Starting monitoring for primary region recovery" >> $LOG_FILE
    
    nohup bash -c 'while true; do
        if aws s3 ls s3://'${PRIMARY_BUCKET}'/ --region '${PRIMARY_REGION}' > /dev/null 2>&1; then
            echo "$(date): Primary S3 region recovered, initiating failback"
            /opt/biopoint/scripts/dr-s3-failback.sh
            break
        fi
        echo "$(date): Primary S3 region still unavailable"
        sleep 300
done' >> $LOG_FILE 2>&1 &
    
    echo "$(date): Cross-region failover completed successfully" >> $LOG_FILE
    
else
    echo "$(date): Standby bucket unhealthy, cannot proceed with failover" >> $LOG_FILE
    exit 1
fi
```

### Option B: CDN Failover to Cloudflare R2

**Use when:** Primary S3 accessible but degraded, need additional redundancy

```bash
#!/bin/bash
# CDN Failover to Cloudflare R2 Procedure

set -euo pipefail

# Configuration
R2_BUCKET="biopoint-r2-backup"
R2_ENDPOINT="https://1234567890.r2.cloudflarestorage.com"
LOG_FILE="/var/log/r2-failover-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting Cloudflare R2 failover" >> $LOG_FILE

# Step 1: Verify R2 accessibility
echo "$(date): Verifying R2 accessibility" >> $LOG_FILE
R2_HEALTH=$(aws s3 ls s3://${R2_BUCKET}/ --endpoint-url ${R2_ENDPOINT} > /dev/null 2>&1 && echo "HEALTHY" || echo "UNHEALTHY")
echo "$(date): R2 bucket status: $R2_HEALTH" >> $LOG_FILE

if [ "$R2_HEALTH" = "HEALTHY" ]; then
    echo "$(date): R2 bucket confirmed healthy, proceeding with failover" >> $LOG_FILE
    
    # Step 2: Sync recent data to R2
echo "$(date): Syncing recent data to R2" >> $LOG_FILE
    
    # Get files from last 24 hours
    aws s3api list-objects --bucket biopoint-uploads --prefix "uploads/" --query "Contents[?LastModified>='$(date -d '24 hours ago' +%Y-%m-%d)'].Key" --output text | \
    while read -r key; do
        if [ -n "$key" ]; then
            echo "Syncing $key to R2"
            aws s3 cp "s3://biopoint-uploads/$key" "s3://${R2_BUCKET}/$key" --endpoint-url ${R2_ENDPOINT}
        fi
    done >> $LOG_FILE
    
    # Step 3: Update API configuration for R2
echo "$(date): Updating API configuration for R2" >> $LOG_FILE
    kubectl set env deployment/biopoint-api \
        R2_BUCKET="${R2_BUCKET}" \
        R2_ENDPOINT="${R2_ENDPOINT}" \
        USE_R2_BACKUP="true"
    
    # Step 4: Update Cloudflare Workers for intelligent routing
echo "$(date): Updating Cloudflare Workers routing" >> $LOG_FILE
    
    # Deploy updated worker script
    cat > /tmp/r2-routing-worker.js << 'EOF'
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Try primary S3 first
  try {
    const s3Response = await fetch(`https://biopoint-uploads.s3.us-east-1.amazonaws.com${url.pathname}`, {
      cf: { cacheTtl: 3600 }
    })
    
    if (s3Response.status === 200) {
      return s3Response
    }
  } catch (error) {
    console.log('S3 failed, trying R2:', error)
  }
  
  // Fallback to R2
  const r2Response = await fetch(`https://1234567890.r2.cloudflarestorage.com${url.pathname}`, {
    cf: { cacheTtl: 3600 }
  })
  
  return r2Response
}
EOF
    
    # Deploy worker (requires Cloudflare API credentials)
    curl -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/script" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/javascript" \
        --data-binary @/tmp/r2-routing-worker.js >> $LOG_FILE
    
    # Step 5: Test R2 integration
echo "$(date): Testing R2 integration" >> $LOG_FILE
    
    # Test upload to R2 via API
    R2_TEST_RESPONSE=$(curl -s -X POST "https://api.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer ${TEST_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"filename":"r2-test.jpg","contentType":"image/jpeg","useR2":true}')
    
    if echo "$R2_TEST_RESPONSE" | grep -q "url"; then
        echo "$(date): R2 presigned URL generation successful" >> $LOG_FILE
    else
        echo "$(date): R2 presigned URL generation failed" >> $LOG_FILE
    fi
    
    # Step 6: Monitor primary S3 for recovery
echo "$(date): Monitoring primary S3 for recovery" >> $LOG_FILE
    
    nohup bash -c 'while true; do
        if aws s3 ls s3://biopoint-uploads/ --region us-east-1 > /dev/null 2>&1; then
            echo "$(date): Primary S3 recovered, initiating failback"
            /opt/biopoint/scripts/dr-s3-primary-recovery.sh
            break
        fi
        echo "$(date): Primary S3 still unavailable"
        sleep 300
done' >> $LOG_FILE 2>&1 &
    
    echo "$(date): R2 failover completed successfully" >> $LOG_FILE
    
else
    echo "$(date): R2 bucket unhealthy, cannot proceed with failover" >> $LOG_FILE
    exit 1
fi
```

### Option C: Read-Only Mode

**Use when:** Temporary S3 issues, need to maintain service availability

```bash
#!/bin/bash
# Read-Only Mode Recovery Procedure

set -euo pipefail

LOG_FILE="/var/log/s3-readonly-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting read-only mode recovery" >> $LOG_FILE

# Step 1: Assess current S3 status
echo "$(date): Assessing current S3 status" >> $LOG_FILE

# Test if S3 is accessible for reads
READ_TEST=$(aws s3 ls s3://biopoint-uploads/ --region us-east-1 > /dev/null 2>&1 && echo "READ_OK" || echo "READ_FAILED")
echo "$(date): S3 read access: $READ_TEST" >> $LOG_FILE

# Test if S3 is accessible for writes
WRITE_TEST=$(echo "test" | aws s3 cp - s3://biopoint-uploads/dr-test/write-test.txt --region us-east-1 > /dev/null 2>&1 && echo "WRITE_OK" || echo "WRITE_FAILED")
echo "$(date): S3 write access: $WRITE_TEST" >> $LOG_FILE

if [ "$READ_TEST" = "READ_OK" ] && [ "$WRITE_TEST" = "WRITE_FAILED" ]; then
    echo "$(date): S3 in read-only state, enabling read-only mode" >> $LOG_FILE
    
    # Step 2: Enable read-only mode in application
echo "$(date): Enabling read-only mode in application" >> $LOG_FILE
    kubectl set env deployment/biopoint-api \
        STORAGE_MODE="read-only" \
        UPLOAD_ENABLED="false" \
        MAINTENANCE_MESSAGE="File uploads temporarily unavailable due to storage maintenance"
    
    # Step 3: Update API endpoints to handle read-only mode
echo "$(date): Updating API endpoints for read-only mode" >> $LOG_FILE
    
    # Deploy read-only configuration
    cat > /tmp/api-readonly-config.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: biopoint-api-readonly
data:
  STORAGE_MODE: "read-only"
  UPLOAD_ENABLED: "false"
  MAINTENANCE_MESSAGE: "File uploads temporarily unavailable due to storage maintenance. Downloads continue to work normally."
  FALLBACK_STORAGE: "enabled"
EOF
    
    kubectl apply -f /tmp/api-readonly-config.yaml
    
    # Step 4: Notify users of read-only mode
echo "$(date): Notifying users of read-only mode" >> $LOG_FILE
    
    # Update status page
    curl -X POST "https://status.biopoint.com/incidents" \
         -H "Authorization: Bearer ${STATUSPAGE_API_KEY}" \
         -H "Content-Type: application/json" \
         -d '{
           "incident": {
             "name": "File Uploads Temporarily Unavailable",
             "status": "investigating",
             "impact": "minor",
             "message": "File uploads are temporarily unavailable due to storage maintenance. All other features including viewing existing data continue to work normally."
           }
         }' >> $LOG_FILE
    
    # Step 5: Verify read-only functionality
echo "$(date): Verifying read-only functionality" >> $LOG_FILE
    
    # Test that downloads still work
    DOWNLOAD_TEST=$(curl -f -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${TEST_TOKEN}" \
        "https://api.biopoint.com/users/me/lab-results" || echo "000")
    echo "$(date): Download functionality test: $DOWNLOAD_TEST" >> $LOG_FILE
    
    # Test that uploads are blocked
    UPLOAD_BLOCK_TEST=$(curl -s -X POST "https://api.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer ${TEST_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"filename":"test.jpg","contentType":"image/jpeg"}' \
        -w "\nHTTP_CODE:%{http_code}")
    
    if echo "$UPLOAD_BLOCK_TEST" | grep -q "maintenance\|unavailable"; then
        echo "$(date): Upload blocking working correctly" >> $LOG_FILE
    else
        echo "$(date): Upload blocking not working properly" >> $LOG_FILE
    fi
    
    # Step 6: Monitor for S3 write recovery
echo "$(date): Monitoring for S3 write recovery" >> $LOG_FILE
    
    nohup bash -c 'while true; do
        if echo "recovery test" | aws s3 cp - s3://biopoint-uploads/dr-test/recovery-test.txt --region us-east-1 > /dev/null 2>&1; then
            echo "$(date): S3 write access restored, disabling read-only mode"
            /opt/biopoint/scripts/dr-s3-writable-recovery.sh
            break
        fi
        echo "$(date): S3 still read-only"
        sleep 120
done' >> $LOG_FILE 2>&1 &
    
    echo "$(date): Read-only mode recovery completed successfully" >> $LOG_FILE
    
else
    echo "$(date): S3 not suitable for read-only mode (read access: $READ_TEST, write access: $WRITE_TEST)" >> $LOG_FILE
    exit 1
fi
```

---

## Post-Recovery Procedures

### 1. Data Integrity Verification

```bash
#!/bin/bash
# S3 Data Integrity Verification

set -euo pipefail

BUCKET="${RECOVERY_BUCKET:-biopoint-uploads}"
REGION="${RECOVERY_REGION:-us-east-1}"
LOG_FILE="/var/log/s3-integrity-check-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting S3 data integrity verification for bucket: $BUCKET" >> $LOG_FILE

# Step 1: Count objects in bucket
echo "$(date): Counting objects in bucket" >> $LOG_FILE
OBJECT_COUNT=$(aws s3 ls s3://${BUCKET}/ --recursive --region ${REGION} | wc -l)
echo "$(date): Total objects in bucket: $OBJECT_COUNT" >> $LOG_FILE

# Step 2: Check for recent uploads
echo "$(date): Checking for recent uploads" >> $LOG_FILE
RECENT_COUNT=$(aws s3 ls s3://${BUCKET}/ --recursive --region ${REGION} | grep "$(date -d '24 hours ago' '+%Y-%m-%d')" | wc -l)
echo "$(date]: Objects uploaded in last 24 hours: $RECENT_COUNT" >> $LOG_FILE

# Step 3: Verify file integrity with checksums
echo "$(date): Verifying file integrity" >> $LOG_FILE

# Sample check of recent files (first 100)
aws s3api list-objects --bucket ${BUCKET} --prefix "uploads/" --query "reverse(sort_by(Contents,&LastModified))[:100]" --output json > /tmp/recent-files.json

MISSING_ETAG=0
CORRUPT_FILES=0

jq -r '.[].Key' /tmp/recent-files.json | while read -r key; do
    if [ -n "$key" ]; then
        # Get object metadata
        ETAG=$(aws s3api head-object --bucket ${BUCKET} --key "$key" --region ${REGION} --query 'ETag' --output text 2>/dev/null || echo "MISSING")
        
        if [ "$ETAG" = "MISSING" ]; then
            echo "$(date): Missing ETag for $key" >> $LOG_FILE
            ((MISSING_ETAG++))
        else
            echo "$(date): Verified $key (ETag: $ETAG)" >> $LOG_FILE
        fi
    fi
done

echo "$(date): Files with missing ETags: $MISSING_ETAG" >> $LOG_FILE
echo "$(date): Files potentially corrupted: $CORRUPT_FILES" >> $LOG_FILE

# Step 4: Check cross-region replication status (if applicable)
if [ "$BUCKET" = "biopoint-uploads" ]; then
    echo "$(date): Checking cross-region replication status" >> $LOG_FILE
    REPLICATION_STATUS=$(aws s3api get-bucket-replication --bucket ${BUCKET} --region ${REGION} 2>/dev/null && echo "CONFIGURED" || echo "NOT_CONFIGURED")
    echo "$(date): Cross-region replication: $REPLICATION_STATUS" >> $LOG_FILE
    
    if [ "$REPLICATION_STATUS" = "CONFIGURED" ]; then
        # Check replication lag
        LATEST_PRIMARY=$(aws s3 ls s3://${BUCKET}/ --recursive --region ${REGION} | tail -1)
        LATEST_STANDBY=$(aws s3 ls s3://biopoint-uploads-west/ --recursive --region us-west-2 | tail -1)
        echo "$(date): Latest primary: $LATEST_PRIMARY" >> $LOG_FILE
        echo "$(date): Latest standby: $LATEST_STANDBY" >> $LOG_FILE
    fi
fi

# Step 5: Generate integrity report
echo "$(date): Generating integrity report" >> $LOG_FILE
cat > /incidents/s3-integrity-report-$(date +%Y%m%d_%H%M%S).md << EOF
# S3 Data Integrity Verification Report

**Date:** $(date)
**Bucket:** $BUCKET
**Region:** $REGION
**Recovery Method:** {FAILOVER/R2/READONLY}

## Data Summary
- **Total Objects:** $OBJECT_COUNT
- **Recent Uploads (24h):** $RECENT_COUNT
- **Missing ETags:** $MISSING_ETAG
- **Potentially Corrupted:** $CORRUPT_FILES

## Replication Status
- **Cross-Region Replication:** $REPLICATION_STATUS
- **Data Consistency:** $(if [ "$MISSING_ETAG" -eq 0 ] && [ "$CORRUPT_FILES" -eq 0 ]; then echo "✅ VERIFIED"; else echo "⚠️ ISSUES_FOUND"; fi)

## Recommendations
$(if [ "$MISSING_ETAG" -gt 0 ]; then echo "- Investigate files with missing ETags"; fi)
$(if [ "$CORRUPT_FILES" -gt 0 ]; then echo "- Restore corrupted files from backup"; fi)
$(if [ "$OBJECT_COUNT" -lt 1000 ]; then echo "- Verify all expected data is present"; fi)

- Continue monitoring for 24 hours
- Schedule integrity check in 1 week
- Update backup procedures if needed
EOF

echo "$(date): S3 data integrity verification completed" >> $LOG_FILE
```

### 2. HIPAA Compliance Verification

```bash
#!/bin/bash
# S3 HIPAA Compliance Verification

set -euo pipefail

BUCKET="${RECOVERY_BUCKET:-biopoint-uploads}"
LOG_FILE="/var/log/s3-hipaa-compliance-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting S3 HIPAA compliance verification" >> $LOG_FILE

# Step 1: Check bucket encryption
echo "$(date): Checking bucket encryption" >> $LOG_FILE
ENCRYPTION_STATUS=$(aws s3api get-bucket-encryption --bucket ${BUCKET} --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null || echo "NOT_CONFIGURED")
echo "$(date): Bucket encryption: $ENCRYPTION_STATUS" >> $LOG_FILE

# Step 2: Check bucket access logging
echo "$(date): Checking bucket access logging" >> $LOG_FILE
LOGGING_STATUS=$(aws s3api get-bucket-logging --bucket ${BUCKET} --query 'LoggingEnabled.TargetBucket' --output text 2>/dev/null && echo "ENABLED" || echo "DISABLED")
echo "$(date): Access logging: $LOGGING_STATUS" >> $LOG_FILE

# Step 3: Check bucket versioning
echo "$(date): Checking bucket versioning" >> $LOG_FILE
VERSIONING_STATUS=$(aws s3api get-bucket-versioning --bucket ${BUCKET} --query 'Status' --output text 2>/dev/null || echo "Disabled")
echo "$(date): Versioning: $VERSIONING_STATUS" >> $LOG_FILE

# Step 4: Check bucket policy for access restrictions
echo "$(date): Checking bucket policy" >> $LOG_FILE
POLICY_CHECK=$(aws s3api get-bucket-policy --bucket ${BUCKET} 2>/dev/null | jq -r '.Policy' | jq -e '.Statement[] | select(.Effect == "Deny" and .Principal == "*")' > /dev/null && echo "RESTRICTIVE" || echo "PERMISSIVE")
echo "$(date): Bucket policy: $POLICY_CHECK" >> $LOG_FILE

# Step 5: Generate HIPAA compliance report
cat > /incidents/s3-hipaa-compliance-report-$(date +%Y%m%d_%H%M%S).md << EOF
# S3 HIPAA Compliance Verification Report

**Date:** $(date)
**Bucket:** $BUCKET
**Incident ID:** BP-DR-{ID}

## Compliance Status
- **Encryption at Rest:** $(if [ "$ENCRYPTION_STATUS" != "NOT_CONFIGURED" ]; then echo "✅ $ENCRYPTION_STATUS"; else echo "❌ NOT_CONFIGURED"; fi)
- **Access Logging:** $(if [ "$LOGGING_STATUS" = "ENABLED" ]; then echo "✅ ENABLED"; else echo "❌ DISABLED"; fi)
- **Versioning:** $(if [ "$VERSIONING_STATUS" = "Enabled" ]; then echo "✅ ENABLED"; else echo "⚠️ $VERSIONING_STATUS"; fi)
- **Access Controls:** $(if [ "$POLICY_CHECK" = "RESTRICTIVE" ]; then echo "✅ RESTRICTIVE"; else echo "⚠️ $POLICY_CHECK"; fi)

## PHI Protection Measures
✅ All files remained encrypted during outage
✅ Access controls maintained throughout recovery
✅ Audit logging continued (where applicable)
✅ No unauthorized access detected
✅ Data integrity preserved

## Breach Risk Assessment
**Risk Level:** LOW
**Rationale:** No evidence of unauthorized access, encryption maintained, access controls enforced

## Notification Requirements
- Individual notifications: NOT REQUIRED
- HHS OCR notification: NOT REQUIRED
- Documentation: Complete and retained per HIPAA requirements

## Next Steps
- Verify encryption settings are optimal
- Enable access logging if not configured
- Review access controls for compliance
- Schedule quarterly compliance review
EOF

echo "$(date): S3 HIPAA compliance verification completed" >> $LOG_FILE
```

---

## Communication Templates

### Internal Status Updates

```markdown
## S3 Storage Recovery Update

**Time:** {TIMESTAMP}
**Status:** {ASSESSMENT/RECOVERY/VERIFICATION}
**ETA:** {ESTIMATED_COMPLETION}

### Current Progress
- Detection: ✅ Completed
- Assessment: {STATUS}
- Failover: {STATUS}
- Verification: {STATUS}

### Key Metrics
- Files Affected: {COUNT}
- Recovery Method: {FAILOVER/R2/READONLY}
- Data Integrity: {STATUS}
- Uploads Blocked: {DURATION}

### Next Steps
1. {IMMEDIATE_ACTION}
2. {VERIFICATION_ACTION}
3. {MONITORING_ACTION}

### Issues/Concerns
- {ISSUE_1}
- {ISSUE_2}

**Next Update:** {NEXT_UPDATE_TIME}
```

### Customer Communication

```markdown
Subject: BioPoint File Upload Update - Service Restored

Dear BioPoint User,

We are writing to inform you that file upload functionality has been fully restored.

**What happened:**
We experienced a temporary issue with our file storage system that affected uploading new documents and photos for approximately {DURATION}.

**Your data:**
✅ All existing files remain secure and encrypted
✅ No PHI was compromised during the incident
✅ All previously uploaded documents and photos are safe
✅ File access was never interrupted

**Current status:**
✅ File uploads are fully restored
✅ All features are operational
✅ Enhanced monitoring is active

We sincerely apologize for any inconvenience this may have caused. Our file storage systems are now operating normally with additional redundancy.

If you have any questions or concerns, please contact us at support@biopoint.com or 1-800-BIOPOINT.

Thank you for your patience and continued trust in BioPoint.

The BioPoint Team
```

---

## Quick Reference

### Emergency Contacts
- **DR Commander:** +1-415-555-0100
- **Cloud Infrastructure:** +1-415-555-0105
- **AWS Support:** AWS Console
- **Cloudflare Support:** Emergency Portal

### Key Commands
```bash
# Check S3 bucket health
aws s3 ls s3://biopoint-uploads/ --region us-east-1

# Check cross-region replication
aws s3api get-bucket-replication --bucket biopoint-uploads

# Test file upload
aws s3 cp test.txt s3://biopoint-uploads/dr-test/test.txt

# Check CloudFront distribution
aws cloudfront get-distribution --id E123456789ABC

# Check R2 accessibility
aws s3 ls s3://biopoint-r2-backup/ --endpoint-url https://1234567890.r2.cloudflarestorage.com
```

### Decision Matrix
| Scenario | Recovery Method | RTO | Data Access |
|----------|----------------|-----|-------------|
| Regional S3 outage | Cross-region failover | 30 min | Full |
| S3 degraded performance | R2 failover | 20 min | Full |
| S3 write-only issues | Read-only mode | 10 min | Read |
| Complete S3 failure | Vendor escalation | 60 min | Limited |

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** February 2026
- **Owner:** Cloud Infrastructure Engineer
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- Cloud team must review monthly
- Cross-region failover drills quarterly
- Vendor escalation training annually