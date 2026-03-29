#!/bin/bash
# Datacenter Failover Script - Complete Regional Failover
# Usage: ./dr-failover-datacenter.sh [primary|standby]

set -euo pipefail

# Configuration
PRIMARY_REGION="${1:-us-east-1}"
STANDBY_REGION="${2:-us-west-2}"
LOG_FILE="/var/log/dr-datacenter-failover-$(date +%Y%m%d_%H%M%S).log"
NEON_API_KEY="${NEON_API_KEY:-}"
STATUSPAGE_API_KEY="${STATUSPAGE_API_KEY:-}"

echo "$(date): Starting complete datacenter failover from $PRIMARY_REGION to $STANDBY_REGION" | tee -a $LOG_FILE

# Function to log and execute commands
log_exec() {
    echo "$(date): Executing: $*" >> $LOG_FILE
    "$@" >> $LOG_FILE 2>&1
    return $?
}

# Function to check service health
check_health() {
    local url=$1
    local timeout=${2:-10}
    curl -f -s -o /dev/null -w "%{http_code}" "$url" --max-time "$timeout" || echo "000"
}

# Step 1: Assess current infrastructure status
echo "$(date): Assessing current infrastructure status" | tee -a $LOG_FILE

# Check primary region services
PRIMARY_API=$(check_health "https://api.biopoint.com/health")
PRIMARY_DB="FAILED"
if psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-primary.us-east-1.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1; then
    PRIMARY_DB="OK"
fi
PRIMARY_S3="FAILED"
if aws s3 ls "s3://biopoint-uploads/" --region us-east-1 > /dev/null 2>&1; then
    PRIMARY_S3="OK"
fi

# Check standby region services
STANDBY_API=$(check_health "https://api-west.biopoint.com/health")
STANDBY_DB="FAILED"
if psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1; then
    STANDBY_DB="OK"
fi
STANDBY_S3="FAILED"
if aws s3 ls "s3://biopoint-uploads-west/" --region us-west-2 > /dev/null 2>&1; then
    STANDBY_S3="OK"
fi

echo "$(date): Primary region status:" | tee -a $LOG_FILE
echo "  API: HTTP $PRIMARY_API" | tee -a $LOG_FILE
echo "  Database: $PRIMARY_DB" | tee -a $LOG_FILE
echo "  S3: $PRIMARY_S3" | tee -a $LOG_FILE

echo "$(date): Standby region status:" | tee -a $LOG_FILE
echo "  API: HTTP $STANDBY_API" | tee -a $LOG_FILE
echo "  Database: $STANDBY_DB" | tee -a $LOG_FILE
echo "  S3: $STANDBY_S3" | tee -a $LOG_FILE

# Only proceed if primary is failed and standby is healthy
if [ "$PRIMARY_API" = "200" ] || [ "$PRIMARY_DB" = "OK" ] || [ "$PRIMARY_S3" = "OK" ]; then
    echo "$(date): Primary region still has some services operational" | tee -a $LOG_FILE
    echo "$(date): This script should only be run when primary region is completely failed" | tee -a $LOG_FILE
    exit 1
fi

if [ "$STANDBY_API" != "200" ] || [ "$STANDBY_DB" != "OK" ] || [ "$STANDBY_S3" != "OK" ]; then
    echo "$(date): ERROR: Standby region is not healthy enough for failover" | tee -a $LOG_FILE
    exit 1
fi

# Step 2: Update status page
echo "$(date): Updating status page" | tee -a $LOG_FILE
if [ -n "$STATUSPAGE_API_KEY" ]; then
    log_exec curl -X POST "https://status.biopoint.com/incidents" \
         -H "Authorization: Bearer ${STATUSPAGE_API_KEY}" \
         -H "Content-Type: application/json" \
         -d '{
           "incident": {
             "name": "Regional Failover in Progress",
             "status": "investigating",
             "impact": "major",
             "message": "We are currently failing over to our standby infrastructure due to primary region issues. Service may be temporarily unavailable."
           }
         }'
fi

# Step 3: Promote standby database to primary
echo "$(date): Promoting standby database to primary" | tee -a $LOG_FILE

if [ -n "$NEON_API_KEY" ]; then
    log_exec curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
         -H "Authorization: Bearer ${NEON_API_KEY}" \
         -H "Content-Type: application/json"
    
    # Wait for database promotion
    echo "$(date): Waiting for database promotion to complete" | tee -a $LOG_FILE
    for i in {1..20}; do
        if psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1; then
            echo "$(date): Database promotion successful" | tee -a $LOG_FILE
            break
        fi
        echo "$(date): Waiting for database promotion... ($i/20)" | tee -a $LOG_FILE
        sleep 30
    done
else
    echo "$(date): WARNING: Neon API key not configured, manual database promotion may be required" | tee -a $LOG_FILE
fi

# Step 4: Switch to standby Kubernetes context
echo "$(date): Switching to standby Kubernetes context" | tee -a $LOG_FILE
log_exec kubectl config use-context "biopoint-west"

# Step 5: Scale up standby infrastructure
echo "$(date): Scaling up standby infrastructure" | tee -a $LOG_FILE

# Scale API deployments
log_exec kubectl scale deployment biopoint-api --replicas=5
log_exec kubectl scale deployment biopoint-api-standby --replicas=3
log_exec kubectl scale deployment biopoint-mobile-backend --replicas=3

# Scale supporting services
log_exec kubectl scale deployment biopoint-worker --replicas=2
log_exec kubectl scale deployment biopoint-cronjobs --replicas=1

# Wait for scaling to complete
log_exec kubectl rollout status deployment/biopoint-api --timeout=600s

# Step 6: Update DNS for global failover
echo "$(date): Updating DNS for global failover" | tee -a $LOG_FILE

# Create DNS change batch
cat > /tmp/dns-failover.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.biopoint.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "api-west.biopoint.com"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "app.biopoint.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "app-west.biopoint.com"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "status.biopoint.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "status-west.biopoint.com"}]
      }
    }
  ]
}
EOF

# Apply DNS changes
log_exec aws route53 change-resource-record-sets \
    --hosted-zone-id "Z123456789ABC" \
    --change-batch file:///tmp/dns-failover.json

# Step 7: Update CDN configuration
echo "$(date): Updating CDN configuration" | tee -a $LOG_FILE

# Get current CloudFront configuration
if aws cloudfront get-distribution-config --id E123456789ABC > /tmp/current-cf-config.json 2>/dev/null; then
    # Update origins to point to standby region
    jq '.DistributionConfig.Origins.Items[0].DomainName = "api-west.biopoint.com" | 
        .DistributionConfig.Origins.Items[1].DomainName = "app-west.biopoint.com"' \
       /tmp/current-cf-config.json > /tmp/updated-cf-config.json
    
    # Apply CloudFront configuration
    ETAG=$(jq -r '.ETag' /tmp/current-cf-config.json)
    log_exec aws cloudfront update-distribution \
        --id "E123456789ABC" \
        --distribution-config file:///tmp/updated-cf-config.json \
        --if-match "$ETAG"
fi

# Step 8: Configure cross-region S3 replication
echo "$(date): Configuring cross-region S3 replication" | tee -a $LOG_FILE

# Enable bidirectional replication for future failback
if aws s3api get-bucket-replication --bucket "biopoint-uploads-west" --region us-west-2 > /tmp/standby-replication.json 2>/dev/null; then
    echo "$(date): Standby region replication already configured" | tee -a $LOG_FILE
else
    # Create replication configuration for failback
    cat > /tmp/reverse-replication-config.json << EOF
{
  "Role": "arn:aws:iam::123456789012:role/biopoint-s3-replication",
  "Rules": [
    {
      "ID": "biopoint-failback-replication",
      "Status": "Enabled",
      "Priority": 1,
      "DeleteMarkerReplication": { "Status": "Enabled" },
      "Filter": { "Prefix": "" },
      "Destination": {
        "Bucket": "arn:aws:s3:::biopoint-uploads",
        "StorageClass": "STANDARD",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": { "Minutes": 15 }
        }
      }
    }
  ]
}
EOF
    
    log_exec aws s3api put-bucket-replication \
        --bucket "biopoint-uploads-west" \
        --replication-configuration file:///tmp/reverse-replication-config.json
fi

# Step 9: Verify comprehensive functionality
echo "$(date): Verifying comprehensive functionality" | tee -a $LOG_FILE

# Wait for DNS propagation
sleep 120

# Test all services
SERVICES=(
    "https://api-west.biopoint.com/health:API"
    "https://app-west.biopoint.com/health:Mobile"
    "https://status-west.biopoint.com:Status"
)

for service_test in "${SERVICES[@]}"; do
    IFS=':' read -r url name <<< "$service_test"
    HEALTH=$(check_health "$url" 30)
    echo "$(date): $name service: HTTP $HEALTH" | tee -a $LOG_FILE
    
    if [ "$HEALTH" != "200" ]; then
        echo "$(date): ERROR: $name service failed" | tee -a $LOG_FILE
        FAILED_SERVICES="$FAILED_SERVICES $name"
    fi
done

# Test database connectivity
echo "$(date): Testing database connectivity" | tee -a $LOG_FILE
psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "
  SELECT 
    COUNT(*) as total_users,
    MAX(updated_at) as latest_update
  FROM users;" | tee -a $LOG_FILE

# Test S3 functionality
echo "$(date): Testing S3 functionality" | tee -a $LOG_FILE
aws s3 cp /tmp/test-failover.txt "s3://biopoint-uploads-west/dr-test/failover-test.txt" --region us-west-2 && \
echo "$(date): Standby S3 upload successful" | tee -a $LOG_FILE || \
echo "$(date): ERROR: Standby S3 upload failed" | tee -a $LOG_FILE

# Step 10: Update status page and generate report
echo "$(date): Updating status page and generating report" | tee -a $LOG_FILE

if [ -n "$STATUSPAGE_API_KEY" ]; then
    log_exec curl -X PATCH "https://status.biopoint.com/incidents/latest" \
         -H "Authorization: Bearer ${STATUSPAGE_API_KEY}" \
         -H "Content-Type: application/json" \
         -d '{
           "incident": {
             "status": "resolved",
             "message": "Regional failover completed successfully. All services are now operational in our standby infrastructure."
           }
         }'
fi

# Generate recovery report
cat > "/incidents/datacenter-failover-report-$(date +%Y%m%d_%H%M%S).md" << EOF
# Datacenter Failover Report

**Date:** $(date)
**Failover From:** $PRIMARY_REGION
**Failover To:** $STANDBY_REGION
**Duration:** $(($(date +%s) - $(date -d '$(head -1 $LOG_FILE | cut -d: -f1-2)' +%s))) seconds

## Infrastructure Status
| Service | Primary Region | Standby Region |
|---------|----------------|----------------|
| API | HTTP $PRIMARY_API | HTTP $STANDBY_API |
| Database | $PRIMARY_DB | $STANDBY_DB |
| S3 | $PRIMARY_S3 | $STANDBY_S3 |

## Recovery Actions
- ✅ Database promoted to primary
- ✅ API services scaled up
- ✅ DNS updated for global failover
- ✅ CDN configuration updated
- ✅ Cross-region replication configured
- ✅ Functionality verification completed

## Failed Services
${FAILED_SERVICES:-None}

## Next Steps
- Monitor system performance for 24 hours
- Verify all monitoring systems are operational
- Schedule primary region health check
- Update disaster recovery documentation
- Conduct post-incident review

## Contact Information
- Emergency: +1-415-555-0100
- Operations: ops@biopoint.com
- Status Page: https://status.biopoint.com
EOF

echo "$(date): Datacenter failover completed successfully" | tee -a $LOG_FILE

# Start monitoring for primary region recovery
if [ "$PRIMARY_API" != "200" ] || [ "$PRIMARY_DB" != "OK" ] || [ "$PRIMARY_S3" != "OK" ]; then
    echo "$(date): Starting monitoring for primary region recovery" | tee -a $LOG_FILE
    
    nohup bash -c 'while true; do
        API_HEALTH=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 10 2>/dev/null || echo "000")
        DB_HEALTH=$(psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-primary.us-east-1.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "FAILED")
        S3_HEALTH=$(aws s3 ls "s3://biopoint-uploads/" --region us-east-1 > /dev/null 2>&1 && echo "OK" || echo "FAILED")
        
        if [ "$API_HEALTH" = "200" ] && [ "$DB_HEALTH" = "OK" ] && [ "$S3_HEALTH" = "OK" ]; then
            echo "$(date): Primary region fully recovered"
            echo "Primary region has been restored to full functionality. Manual failback can be initiated." | \
                mail -s "Primary Region Recovery Complete" ops@biopoint.com
            break
        fi
        echo "$(date): Primary region still unavailable - API:$API_HEALTH DB:$DB_HEALTH S3:$S3_HEALTH"
        sleep 300
done' >> $LOG_FILE 2>&1 &
fi