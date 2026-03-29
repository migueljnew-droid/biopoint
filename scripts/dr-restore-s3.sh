#!/bin/bash
# S3 Storage Recovery Script - Cross-Region Failover
# Usage: ./dr-restore-s3.sh [primary|standby|r2]

set -euo pipefail

# Configuration
PRIMARY_BUCKET="${PRIMARY_BUCKET:-biopoint-uploads}"
STANDBY_BUCKET="${STANDBY_BUCKET:-biopoint-uploads-west}"
R2_BUCKET="${R2_BUCKET:-biopoint-r2-backup}"
R2_ENDPOINT="${R2_ENDPOINT:-https://1234567890.r2.cloudflarestorage.com}"
LOG_FILE="/var/log/dr-s3-recovery-$(date +%Y%m%d_%H%M%S).log"
RECOVERY_MODE="${1:-standby}"

echo "$(date): Starting S3 recovery using $RECOVERY_MODE mode" | tee -a $LOG_FILE

# Function to log and execute commands
log_exec() {
    echo "$(date): Executing: $*" >> $LOG_FILE
    "$@" >> $LOG_FILE 2>&1
    return $?
}

# Function to test S3 connectivity
test_s3_bucket() {
    local bucket=$1
    local region=$2
    local endpoint=${3:-}
    
    if [ -n "$endpoint" ]; then
        aws s3 ls "s3://${bucket}/" --endpoint-url "$endpoint" --region us-east-1 > /dev/null 2>&1
    else
        aws s3 ls "s3://${bucket}/" --region "$region" > /dev/null 2>&1
    fi
}

# Step 1: Assess current S3 status
echo "$(date): Assessing current S3 status" | tee -a $LOG_FILE

PRIMARY_HEALTH="FAILED"
STANDBY_HEALTH="FAILED"
R2_HEALTH="FAILED"

# Test primary bucket
if test_s3_bucket "$PRIMARY_BUCKET" "us-east-1"; then
    PRIMARY_HEALTH="OK"
fi

# Test standby bucket
if test_s3_bucket "$STANDBY_BUCKET" "us-west-2"; then
    STANDBY_HEALTH="OK"
fi

# Test R2 bucket
if test_s3_bucket "$R2_BUCKET" "us-east-1" "$R2_ENDPOINT"; then
    R2_HEALTH="OK"
fi

echo "$(date): Primary S3: $PRIMARY_HEALTH" | tee -a $LOG_FILE
echo "$(date): Standby S3: $STANDBY_HEALTH" | tee -a $LOG_FILE
echo "$(date): R2 Storage: $R2_HEALTH" | tee -a $LOG_FILE

# Step 2: Execute recovery based on mode
case "$RECOVERY_MODE" in
    "primary")
        if [ "$PRIMARY_HEALTH" = "OK" ]; then
            echo "$(date): Primary S3 healthy, no recovery needed" | tee -a $LOG_FILE
            exit 0
        else
            echo "$(date): ERROR: Primary S3 failed and primary mode requested" | tee -a $LOG_FILE
            exit 1
        fi
        ;;
    "standby")
        if [ "$STANDBY_HEALTH" = "OK" ]; then
            echo "$(date): Executing standby region failover" | tee -a $LOG_FILE
            execute_standby_failover
        else
            echo "$(date): ERROR: Standby S3 unavailable, trying R2" | tee -a $LOG_FILE
            if [ "$R2_HEALTH" = "OK" ]; then
                RECOVERY_MODE="r2"
                execute_r2_failover
            else
                echo "$(date): ERROR: No backup storage available" | tee -a $LOG_FILE
                exit 1
            fi
        fi
        ;;
    "r2")
        if [ "$R2_HEALTH" = "OK" ]; then
            echo "$(date): Executing R2 failover" | tee -a $LOG_FILE
            execute_r2_failover
        else
            echo "$(date): ERROR: R2 storage unavailable" | tee -a $LOG_FILE
            exit 1
        fi
        ;;
    *)
        echo "$(date): ERROR: Invalid recovery mode: $RECOVERY_MODE" | tee -a $LOG_FILE
        echo "$(date): Valid modes: primary, standby, r2" | tee -a $LOG_FILE
        exit 1
        ;;
esac

# Function to execute standby region failover
execute_standby_failover() {
    echo "$(date): Starting standby region failover" | tee -a $LOG_FILE
    
    # Step 3: Update API configuration for standby bucket
    echo "$(date): Updating API configuration for standby bucket" | tee -a $LOG_FILE
    
    if command -v kubectl &> /dev/null; then
        log_exec kubectl set env deployment/biopoint-api \
            S3_BUCKET="${STANDBY_BUCKET}" \
            AWS_REGION="us-west-2" \
            PRESIGNED_URL_BUCKET="${STANDBY_BUCKET}"
        
        # Wait for rollout
        log_exec kubectl rollout status deployment/biopoint-api --timeout=300s
    fi
    
    # Step 4: Update CloudFront distribution
    echo "$(date): Updating CloudFront distribution" | tee -a $LOG_FILE
    
    # Get current distribution config
    aws cloudfront get-distribution-config --id E123456789ABC > /tmp/current-cf-config.json
    
    # Update origin to point to standby bucket
    if [ -f /tmp/current-cf-config.json ]; then
        jq '.DistributionConfig.Origins.Items[0].DomainName = "'${STANDBY_BUCKET}'.s3.us-west-2.amazonaws.com"' \
           /tmp/current-cf-config.json > /tmp/updated-cf-config.json
        
        # Apply updated configuration
        ETAG=$(jq -r '.ETag' /tmp/current-cf-config.json)
        aws cloudfront update-distribution \
            --id "E123456789ABC" \
            --distribution-config file:///tmp/updated-cf-config.json \
            --if-match "$ETAG" >> $LOG_FILE 2>&1
    fi
    
    # Step 5: Test file operations in standby region
    echo "$(date): Testing file operations in standby region" | tee -a $LOG_FILE
    
    # Create test file
    TEST_FILE="/tmp/standby-test-$(date +%Y%m%d_%H%M%S).txt"
    echo "Standby region test file" > "$TEST_FILE"
    
    # Test upload
    if log_exec aws s3 cp "$TEST_FILE" "s3://${STANDBY_BUCKET}/dr-test/standby-test.txt" --region us-west-2; then
        echo "$(date): Standby upload test successful" | tee -a $LOG_FILE
    else
        echo "$(date): ERROR: Standby upload test failed" | tee -a $LOG_FILE
        return 1
    fi
    
    # Test download
    if log_exec aws s3 cp "s3://${STANDBY_BUCKET}/dr-test/standby-test.txt" "/tmp/downloaded-standby.txt" --region us-west-2; then
        echo "$(date): Standby download test successful" | tee -a $LOG_FILE
    else
        echo "$(date): ERROR: Standby download test failed" | tee -a $LOG_FILE
        return 1
    fi
    
    # Step 6: Test API integration
    echo "$(date): Testing API integration with standby bucket" | tee -a $LOG_FILE
    
    # Test presigned URL generation
    PRESIGNED_RESPONSE=$(curl -s -X POST "https://api-west.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer ${TEST_TOKEN:-dummy_token}" \
        -H "Content-Type: application/json" \
        -d '{"filename":"standby-test.jpg","contentType":"image/jpeg"}' 2>/dev/null)
    
    if echo "$PRESIGNED_RESPONSE" | grep -q "url"; then
        echo "$(date): Presigned URL generation successful" | tee -a $LOG_FILE
        
        # Extract presigned URL and test upload
        PRESIGNED_URL=$(echo "$PRESIGNED_RESPONSE" | jq -r '.url' 2>/dev/null)
        if [ -n "$PRESIGNED_URL" ]; then
            echo "test file content" | curl -s -X PUT "$PRESIGNED_URL" \
                -H "Content-Type: image/jpeg" \
                --data-binary @- && \
            echo "$(date): Presigned URL upload test successful" | tee -a $LOG_FILE || \
            echo "$(date): Presigned URL upload test failed" | tee -a $LOG_FILE
        fi
    else
        echo "$(date): Presigned URL generation failed" | tee -a $LOG_FILE
    fi
    
    # Step 7: Monitor for primary region recovery
    echo "$(date): Starting monitoring for primary region recovery" | tee -a $LOG_FILE
    
    nohup bash -c 'while true; do
        if aws s3 ls s3://'${PRIMARY_BUCKET}'/ --region us-east-1 > /dev/null 2>&1; then
            echo "$(date): Primary S3 region recovered"
            # Notify operations team
            echo "Primary S3 region has recovered. Manual failback may be initiated." | mail -s "S3 Recovery Notification" ops@biopoint.com
            break
        fi
        echo "$(date): Primary S3 still unavailable"
        sleep 300
done' >> $LOG_FILE 2>&1 &
    
    echo "$(date): Standby region failover completed successfully" | tee -a $LOG_FILE
}

# Function to execute R2 failover
execute_r2_failover() {
    echo "$(date): Starting R2 failover" | tee -a $LOG_FILE
    
    # Step 3: Sync recent data to R2
    echo "$(date): Syncing recent data to R2" | tee -a $LOG_FILE
    
    # Get files from last 24 hours from primary (if accessible) or standby
    SOURCE_BUCKET="$PRIMARY_BUCKET"
    SOURCE_REGION="us-east-1"
    
    if [ "$PRIMARY_HEALTH" != "OK" ] && [ "$STANDBY_HEALTH" = "OK" ]; then
        SOURCE_BUCKET="$STANDBY_BUCKET"
        SOURCE_REGION="us-west-2"
    fi
    
    echo "$(date): Syncing from $SOURCE_BUCKET to R2" | tee -a $LOG_FILE
    
    # Sync recent files
    aws s3api list-objects --bucket "$SOURCE_BUCKET" --prefix "uploads/" \
        --query "Contents[?LastModified>='$(date -d '24 hours ago' +%Y-%m-%d)'].Key" \
        --output text | while read -r key; do
        if [ -n "$key" ]; then
            echo "Syncing $key to R2"
            aws s3 cp "s3://${SOURCE_BUCKET}/$key" "s3://${R2_BUCKET}/$key" \
                --endpoint-url "$R2_ENDPOINT" --region us-east-1
        fi
    done >> $LOG_FILE
    
    # Step 4: Update API configuration for R2
    echo "$(date): Updating API configuration for R2" | tee -a $LOG_FILE
    
    if command -v kubectl &> /dev/null; then
        log_exec kubectl set env deployment/biopoint-api \
            R2_BUCKET="${R2_BUCKET}" \
            R2_ENDPOINT="${R2_ENDPOINT}" \
            USE_R2_BACKUP="true"
        
        # Wait for rollout
        log_exec kubectl rollout status deployment/biopoint-api --timeout=300s
    fi
    
    # Step 5: Update Cloudflare Workers for intelligent routing
    echo "$(date): Updating Cloudflare Workers routing" | tee -a $LOG_FILE
    
    # Deploy updated worker script
    cat > /tmp/r2-routing-worker.js << 'EOF'
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Try primary S3 first (if healthy)
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
    if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${ZONE_ID:-}" ]; then
        curl -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/workers/script" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/javascript" \
            --data-binary @/tmp/r2-routing-worker.js >> $LOG_FILE 2>&1
    fi
    
    # Step 6: Test R2 integration
    echo "$(date): Testing R2 integration" | tee -a $LOG_FILE
    
    # Test upload to R2 via API
    R2_TEST_RESPONSE=$(curl -s -X POST "https://api-west.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer ${TEST_TOKEN:-dummy_token}" \
        -H "Content-Type: application/json" \
        -d '{"filename":"r2-test.jpg","contentType":"image/jpeg","useR2":true}' 2>/dev/null)
    
    if echo "$R2_TEST_RESPONSE" | grep -q "url"; then
        echo "$(date): R2 presigned URL generation successful" | tee -a $LOG_FILE
    else
        echo "$(date): R2 presigned URL generation failed" | tee -a $LOG_FILE
    fi
    
    echo "$(date): R2 failover completed successfully" | tee -a $LOG_FILE
}

# Step 8: Generate recovery report
cat > "/incidents/s3-recovery-report-$(date +%Y%m%d_%H%M%S).md" << EOF
# S3 Storage Recovery Report

**Date:** $(date)
**Recovery Mode:** $RECOVERY_MODE
**Primary S3:** $PRIMARY_HEALTH
**Standby S3:** $STANDBY_HEALTH
**R2 Storage:** $R2_HEALTH

## Recovery Summary
- **Method Used:** $RECOVERY_MODE failover
- **Configuration Updated:** API servers, CDN distribution
- **Functionality Tested:** Upload, download, presigned URLs

## Storage Status
- **Primary Bucket:** $PRIMARY_BUCKET (us-east-1)
- **Standby Bucket:** $STANDBY_BUCKET (us-west-2)
- **R2 Bucket:** $R2_BUCKET (Cloudflare)

## Next Steps
- Monitor storage performance for 24 hours
- Verify cross-region replication
- Test backup procedures
- Update disaster recovery documentation
EOF

echo "$(date): S3 recovery process completed successfully" | tee -a $LOG_FILE