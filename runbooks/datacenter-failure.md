# Datacenter Failure Recovery Runbook

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Cloud Infrastructure Engineer  
**Review Schedule:** Monthly

---

## Overview

This runbook provides step-by-step procedures for recovering from complete datacenter failures affecting BioPoint's primary infrastructure. Datacenter failures can result from power outages, network failures, natural disasters, or major cloud provider issues affecting an entire region.

**Recovery Objectives:**
- **RTO:** 1 hour
- **RPO:** 1 hour maximum data loss
- **HIPAA Compliance:** Maintain throughout recovery with cross-region data protection

---

## Detection Methods

### Primary Detection
- **Complete Service Unavailability:** All endpoints returning errors
- **Regional Health Check Failures:** Multiple availability zone failures
- **Cloud Provider Alerts:** Regional service disruption notifications
- **Monitoring System Failures:** Loss of monitoring data from primary region

### Secondary Detection
- **Network Connectivity Loss:** Unable to reach primary region infrastructure
- **Database Connection Failures:** Complete loss of database connectivity
- **CDN/WAF Failures:** Edge location failures in primary region
- **User Reports:** Widespread mobile app connectivity issues

---

## Immediate Response (0-10 minutes)

### 1. Assess Regional Failure Scope
```bash
# Check primary region connectivity
echo "Testing primary region connectivity..."
curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 10 || echo "PRIMARY_API_FAILED"

# Check database connectivity
echo "Testing database connectivity..."
psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-primary.us-east-1.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1 && echo "PRIMARY_DB_OK" || echo "PRIMARY_DB_FAILED"

# Check AWS service health
echo "Checking AWS service health..."
curl -s "https://health.aws.amazon.com/json/events.json" | jq -r '.events[] | select(.service == "EC2" and .region == "us-east-1" and .status == "service-disruption") | .status' | head -1

# Check CloudFlare status
echo "Checking CloudFlare status..."
curl -s "https://www.cloudflarestatus.com/api/v2/status.json" | jq -r '.status.indicator'
```

### 2. Verify Standby Region Status
```bash
# Check standby region API
echo "Testing standby region API..."
curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" --max-time 10 || echo "STANDBY_API_FAILED"

# Check standby database
echo "Testing standby database..."
psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1 && echo "STANDBY_DB_OK" || echo "STANDBY_DB_FAILED"

# Check cross-region S3 replication
echo "Checking cross-region S3 replication..."
aws s3api get-bucket-replication --bucket biopoint-uploads --region us-east-1 > /dev/null 2>&1 && echo "REPLICATION_CONFIGURED" || echo "REPLICATION_NOT_CONFIGURED"

# Check standby S3 bucket
echo "Testing standby S3 bucket..."
aws s3 ls s3://biopoint-uploads-west/ --region us-west-2 > /dev/null 2>&1 && echo "STANDBY_S3_OK" || echo "STANDBY_S3_FAILED"
```

### 3. Initiate Emergency Response
```bash
# Send critical alert
curl -X POST "https://api.pagerduty.com/integration/${PAGERDUTY_KEY}/enqueue" \
     -H "Content-Type: application/json" \
     -d "{
       \"routing_key\": \"${PAGERDUTY_KEY}\",
       \"event_action\": \"trigger\",
       \"payload\": {
         \"summary\": \"CRITICAL: BioPoint Primary Datacenter Failure\",
         \"source\": \"infrastructure-monitoring\",
         \"severity\": \"critical\",
         \"custom_details\": {
           \"region\": \"us-east-1\",
           \"detection_time\": \"$(date)\",
           \"standby_status\": \"$(curl -s -o /dev/null -w \"%{http_code}\" https://api-west.biopoint.com/health || echo 'FAILED')\"
         }
       }
     }"

# Notify leadership team
echo "CRITICAL: Primary datacenter failure detected" | mail -s "Emergency: Datacenter Failure $(date)" \
     emergency@biopoint.com,cto@biopoint.com,ceo@biopoint.com

# Log incident
echo "$(date): Primary datacenter failure detected - initiating failover" >> /var/log/dr-incidents.log
```

---

## Assessment Phase (10-20 minutes)

### 1. Determine Failure Scope

```bash
# Check which services are affected
echo "Checking service availability by component..."

# API Gateway
curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 5 || echo "API_GATEWAY_FAILED"

# Database
psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1 && echo "DATABASE_OK" || echo "DATABASE_FAILED"

# S3 Storage
aws s3 ls s3://biopoint-uploads/ --region us-east-1 > /dev/null 2>&1 && echo "S3_OK" || echo "S3_FAILED"

# CDN
aws cloudfront get-distribution --id E123456789ABC --query 'Distribution.Status' --output text

# Load Balancer
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/biopoint-api-tg --query 'TargetHealthDescriptions[*].TargetHealth.State'

# Check for data corruption indicators
echo "Checking for data corruption..."
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as total_records,
    MAX(created_at) as latest_record,
    MIN(created_at) as earliest_record
  FROM users;
" 2>/dev/null || echo "DATABASE_CORRUPTED"
```

### 2. Evaluate Recovery Options

Based on assessment, determine the most appropriate recovery strategy:

#### **Option A: Full Regional Failover**
- **When to use:** Complete primary region failure, standby region healthy
- **Advantages:** Fastest recovery, complete service restoration
- **Requirements:** Standby infrastructure ready and tested
- **RTO:** 30-45 minutes

#### **Option B: Gradual Service Migration**
- **When to use:** Partial failure, some services still available
- **Advantages:** Lower risk, can verify each service
- **Requirements:** Service-by-service migration capability
- **RTO:** 45-60 minutes

#### **Option C: Hybrid Recovery**
- **When to use:** Mixed failure scenario, some data unavailable
- **Advantages:** Maximizes available functionality
- **Requirements:** Service degradation handling
- **RTO:** 60-90 minutes

---

## Recovery Procedures

### Option A: Full Regional Failover

**Use when:** Complete primary region failure confirmed, standby region operational

```bash
#!/bin/bash
# Full Regional Failover Procedure

set -euo pipefail

LOG_FILE="/var/log/datacenter-failover-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): INITIATING FULL REGIONAL FAILOVER" >> $LOG_FILE

# Step 1: Promote standby database
echo "$(date): Promoting standby database to primary" >> $LOG_FILE

# Switch kubectl context to standby region
kubectl config use-context biopoint-west

# Promote Neon standby to primary
curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
     -H "Authorization: Bearer ${NEON_API_KEY}" \
     -H "Content-Type: application/json" >> $LOG_FILE

# Verify database promotion
DB_READY=false
for i in {1..10}; do
    if psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1; then
        DB_READY=true
        echo "$(date): Database promotion successful" >> $LOG_FILE
        break
    fi
    echo "$(date): Waiting for database promotion... ($i/10)" >> $LOG_FILE
    sleep 30
done

if [ "$DB_READY" = false ]; then
    echo "$(date): Database promotion failed" >> $LOG_FILE
    exit 1
fi

# Step 2: Scale up standby infrastructure
echo "$(date): Scaling up standby infrastructure" >> $LOG_FILE

# Scale up API servers
kubectl scale deployment biopoint-api --replicas=5
kubectl scale deployment biopoint-api-standby --replicas=3
kubectl scale deployment biopoint-mobile-backend --replicas=3

# Verify scaling
kubectl rollout status deployment/biopoint-api --timeout=300s >> $LOG_FILE

# Step 3: Update DNS for global failover
echo "$(date): Updating DNS for global failover" >> $LOG_FILE

# Create DNS change batch for Route 53
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
aws route53 change-resource-record-sets \
    --hosted-zone-id "Z123456789ABC" \
    --change-batch file:///tmp/dns-failover.json >> $LOG_FILE

# Step 4: Update CDN configuration
echo "$(date): Updating CDN configuration" >> $LOG_FILE

# Get current CloudFront configuration
aws cloudfront get-distribution-config --id E123456789ABC > /tmp/current-cf-config.json

# Update origins to point to standby region
jq '.DistributionConfig.Origins.Items[0].DomainName = "api-west.biopoint.com" | 
    .DistributionConfig.Origins.Items[1].DomainName = "app-west.biopoint.com"' \
   /tmp/current-cf-config.json > /tmp/updated-cf-config.json

# Apply CloudFront configuration
ETAG=$(jq -r '.ETag' /tmp/current-cf-config.json)
aws cloudfront update-distribution \
    --id "E123456789ABC" \
    --distribution-config file:///tmp/updated-cf-config.json \
    --if-match "$ETAG" >> $LOG_FILE

# Step 5: Activate cross-region S3 replication
echo "$(date): Activating cross-region S3 replication" >> $LOG_FILE

# Ensure replication is configured from standby to primary (for failback)
aws s3api put-bucket-replication \
    --bucket "biopoint-uploads-west" \
    --replication-configuration file://s3-reverse-replication-config.json

# Step 6: Verify service functionality
echo "$(date): Verifying service functionality in standby region" >> $LOG_FILE

# Wait for DNS propagation
sleep 120

# Test API health
API_HEALTH=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" --max-time 30 || echo "000")
echo "$(date): Standby API health: HTTP $API_HEALTH" >> $LOG_FILE

# Test database connectivity
psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "
  SELECT 
    COUNT(*) as total_users,
    MAX(updated_at) as latest_update
  FROM users;" >> $LOG_FILE

# Test S3 functionality
aws s3 cp /tmp/test-file.txt "s3://biopoint-uploads-west/dr-test/failover-test.txt" --region us-west-2 && \
echo "$(date): Standby S3 upload successful" >> $LOG_FILE || \
echo "$(date): Standby S3 upload failed" >> $LOG_FILE

# Step 7: Update status page
echo "$(date): Updating status page" >> $LOG_FILE

curl -X POST "https://status.biopoint.com/incidents" \
     -H "Authorization: Bearer ${STATUSPAGE_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "incident": {
         "name": "Service Restored - Regional Failover Complete",
         "status": "resolved",
         "impact": "major",
         "message": "Service has been restored using standby infrastructure in US-West-2 region. All systems operational."
       }
     }' >> $LOG_FILE

# Step 8: Verify comprehensive functionality
echo "$(date): Verifying comprehensive functionality" >> $LOG_FILE

# Run full functionality test suite
./scripts/test-comprehensive-functionality.sh https://api-west.biopoint.com >> $LOG_FILE

if [ $? -eq 0 ]; then
    echo "$(date): Full regional failover completed successfully" >> $LOG_FILE
    
    # Start monitoring for primary region recovery
    nohup bash -c 'while true; do
        if curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 10 | grep -q "200"; then
            echo "$(date): Primary region recovered, initiating failback"
            /opt/biopoint/scripts/dr-failback-datacenter.sh
            break
        fi
        echo "$(date): Primary region still unavailable"
        sleep 300
done' >> $LOG_FILE 2>&1 &
    
else
    echo "$(date): Functionality verification failed" >> $LOG_FILE
    exit 1
fi
```

### Option B: Gradual Service Migration

**Use when:** Partial failure, some services still functional, need controlled migration

```bash
#!/bin/bash
# Gradual Service Migration Procedure

set -euo pipefail

LOG_FILE="/var/log/datacenter-gradual-migration-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): STARTING GRADUAL SERVICE MIGRATION" >> $LOG_FILE

# Step 1: Migrate database first (most critical)
echo "$(date): Step 1 - Migrating database" >> $LOG_FILE

# Promote standby database
curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
     -H "Authorization: Bearer ${NEON_API_KEY}" \
     -H "Content-Type: application/json" >> $LOG_FILE

# Update API configuration to use standby database
echo "$(date): Updating API configuration for standby database" >> $LOG_FILE
kubectl patch deployment biopoint-api -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "api",
          "env": [{
            "name": "DATABASE_URL",
            "value": "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint"
          }]
        }]
      }
    }
  }
}'

# Verify database migration
sleep 30
DB_TEST=$(psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1 && echo "SUCCESS" || echo "FAILED")
echo "$(date): Database migration: $DB_TEST" >> $LOG_FILE

# Step 2: Migrate API services gradually
echo "$(date): Step 2 - Migrating API services" >> $LOG_FILE

# Deploy API services in standby region
kubectl apply -f k8s/api-standby-deployment.yaml

# Scale up gradually
for replicas in 1 2 3 5; do
    echo "$(date): Scaling API to $replicas replicas" >> $LOG_FILE
    kubectl scale deployment biopoint-api-standby --replicas=$replicas
    sleep 60
done

# Step 3: Update load balancer weights
echo "$(date): Step 3 - Updating load balancer weights" >> $LOG_FILE

# Gradually shift traffic to standby region
for weight in 10 25 50 75 100; do
    echo "$(date): Setting standby region weight to $weight%" >> $LOG_FILE
    
    aws elbv2 modify-target-group-attributes \
        --target-group-arn "arn:aws:elasticloadbalancing:us-west-2:123456789012:targetgroup/biopoint-api-west-tg" \
        --attributes Key=load_balancing.algorithm.type,Value=weighted_round_robin
    
    sleep 30
done

# Step 4: Migrate S3 storage
echo "$(date): Step 4 - Migrating S3 storage" >> $LOG_FILE

# Enable bidirectional replication
aws s3api put-bucket-replication \
    --bucket biopoint-uploads-west \
    --replication-configuration file://s3-bidirectional-replication.json

# Update presigned URL generation to use standby bucket
kubectl set env deployment/biopoint-api-standby \
    S3_BUCKET="biopoint-uploads-west" \
    AWS_REGION="us-west-2"

# Step 5: Migrate mobile backend
echo "$(date): Step 5 - Migrating mobile backend" >> $LOG_FILE

kubectl apply -f k8s/mobile-backend-standby-deployment.yaml
kubectl scale deployment biopoint-mobile-backend-standby --replicas=3

# Step 6: Update DNS with weighted routing
echo "$(date): Step 6 - Updating DNS routing" >> $LOG_FILE

cat > /tmp/dns-weighted-migration.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.biopoint.com",
        "Type": "CNAME",
        "TTL": 300,
        "SetIdentifier": "primary",
        "Weight": 0,
        "ResourceRecords": [{"Value": "api-east.biopoint.com"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.biopoint.com",
        "Type": "CNAME",
        "TTL": 300,
        "SetIdentifier": "standby",
        "Weight": 100,
        "ResourceRecords": [{"Value": "api-west.biopoint.com"}]
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id "Z123456789ABC" \
    --change-batch file:///tmp/dns-weighted-migration.json

# Step 7: Verify gradual migration success
echo "$(date): Verifying gradual migration success" >> $LOG_FILE

# Test each component
COMPONENTS=("database" "api" "s3" "mobile-backend")
for component in "${COMPONENTS[@]}"; do
    echo "$(date): Testing $component..." >> $LOG_FILE
    
    case $component in
        "database")
            psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" >> $LOG_FILE
            ;;
        "api")
            curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" >> $LOG_FILE
            ;;
        "s3")
            aws s3 ls s3://biopoint-uploads-west/ --region us-west-2 >> $LOG_FILE
            ;;
        "mobile-backend")
            curl -f -s -o /dev/null -w "%{http_code}" "https://mobile-west.biopoint.com/health" >> $LOG_FILE
            ;;
    esac
done

echo "$(date): Gradual service migration completed successfully" >> $LOG_FILE
```

### Option C: Hybrid Recovery

**Use when:** Mixed failure scenario, need to maximize available functionality

```bash
#!/bin/bash
# Hybrid Recovery Procedure

set -euo pipefail

LOG_FILE="/var/log/datacenter-hybrid-recovery-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): INITIATING HYBRID RECOVERY" >> $LOG_FILE

# Step 1: Assess which services are available in each region
echo "$(date): Assessing service availability by region" >> $LOG_FILE

# Test primary region services
PRIMARY_SERVICES=""
if curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 5 | grep -q "200"; then
    PRIMARY_SERVICES="$PRIMARY_SERVICES api"
fi

if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
    PRIMARY_SERVICES="$PRIMARY_SERVICES database"
fi

if aws s3 ls s3://biopoint-uploads/ --region us-east-1 > /dev/null 2>&1; then
    PRIMARY_SERVICES="$PRIMARY_SERVICES s3"
fi

# Test standby region services
STANDBY_SERVICES=""
if curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" --max-time 5 | grep -q "200"; then
    STANDBY_SERVICES="$STANDBY_SERVICES api"
fi

if psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1; then
    STANDBY_SERVICES="$STANDBY_SERVICES database"
fi

if aws s3 ls s3://biopoint-uploads-west/ --region us-west-2 > /dev/null 2>&1; then
    STANDBY_SERVICES="$STANDBY_SERVICES s3"
fi

echo "$(date): Primary region services: $PRIMARY_SERVICES" >> $LOG_FILE
echo "$(date): Standby region services: $STANDBY_SERVICES" >> $LOG_FILE

# Step 2: Configure hybrid service architecture
echo "$(date): Configuring hybrid service architecture" >> $LOG_FILE

# Create service mesh configuration for intelligent routing
cat > /tmp/hybrid-service-config.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: biopoint-hybrid-config
data:
  PRIMARY_REGION: "us-east-1"
  STANDBY_REGION: "us-west-2"
  DATABASE_PRIMARY: "ep-biopoint-primary.us-east-1.aws.neon.tech"
  DATABASE_STANDBY: "ep-biopoint-standby.us-west-2.aws.neon.tech"
  S3_PRIMARY: "biopoint-uploads"
  S3_STANDBY: "biopoint-uploads-west"
  API_PRIMARY: "https://api.biopoint.com"
  API_STANDBY: "https://api-west.biopoint.com"
EOF

kubectl apply -f /tmp/hybrid-service-config.yaml

# Step 3: Deploy intelligent routing service
echo "$(date): Deploying intelligent routing service" >> $LOG_FILE

kubectl apply -f k8s/hybrid-routing-service.yaml

# Step 4: Configure region-aware load balancing
echo "$(date): Configuring region-aware load balancing" >> $LOG_FILE

# Create weighted routing based on service availability
cat > /tmp/hybrid-dns-config.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.biopoint.com",
        "Type": "CNAME",
        "TTL": 60,
        "SetIdentifier": "primary-available",
        "Weight": 80,
        "ResourceRecords": [{"Value": "api-east.biopoint.com"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.biopoint.com",
        "Type": "CNAME",
        "TTL": 60,
        "SetIdentifier": "standby-failover",
        "Weight": 20,
        "ResourceRecords": [{"Value": "api-west.biopoint.com"}]
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id "Z123456789ABC" \
    --change-batch file:///tmp/hybrid-dns-config.json

# Step 5: Implement cross-region data synchronization
echo "$(date): Implementing cross-region data synchronization" >> $LOG_FILE

# Set up database replication if not already configured
if echo "$PRIMARY_SERVICES" | grep -q "database" && echo "$STANDBY_SERVICES" | grep -q "database"; then
    echo "$(date): Both databases available, ensuring replication" >> $LOG_FILE
    
    # Verify replication lag
    REPLICATION_LAG=$(psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -t -c "
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT")
    
    echo "$(date): Database replication lag: ${REPLICATION_LAG}s" >> $LOG_FILE
fi

# Step 6: Enable cross-region S3 access
echo "$(date): Enabling cross-region S3 access" >> $LOG_FILE

# Configure IAM roles for cross-region access
aws iam put-role-policy \
    --role-name biopoint-cross-region-access \
    --policy-name cross-region-s3-access \
    --policy-document file://iam-cross-region-s3-policy.json

# Step 7: Test hybrid functionality
echo "$(date): Testing hybrid functionality" >> $LOG_FILE

# Test database connectivity from both regions
if echo "$PRIMARY_SERVICES" | grep -q "database"; then
    echo "$(date): Testing primary database" >> $LOG_FILE
    psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;" >> $LOG_FILE
fi

if echo "$STANDBY_SERVICES" | grep -q "database"; then
    echo "$(date): Testing standby database" >> $LOG_FILE
    psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT COUNT(*) FROM users;" >> $LOG_FILE
fi

# Test API functionality
if echo "$PRIMARY_SERVICES" | grep -q "api"; then
    echo "$(date): Testing primary API" >> $LOG_FILE
    curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" >> $LOG_FILE
fi

if echo "$STANDBY_SERVICES" | grep -q "api"; then
    echo "$(date): Testing standby API" >> $LOG_FILE
    curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" >> $LOG_FILE
fi

# Step 8: Monitor and optimize
echo "$(date): Monitoring hybrid recovery performance" >> $LOG_FILE

# Set up monitoring for cross-region performance
kubectl apply -f k8s/hybrid-monitoring.yaml

echo "$(date): Hybrid recovery completed successfully" >> $LOG_FILE

echo "$(date): Hybrid recovery architecture deployed" >> $LOG_FILE
```

---

## Post-Recovery Procedures

### 1. Data Integrity Verification

```bash
#!/bin/bash
# Cross-Region Data Integrity Verification

set -euo pipefail

LOG_FILE="/var/log/datacenter-integrity-check-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting cross-region data integrity verification" >> $LOG_FILE

# Step 1: Verify database consistency
echo "$(date): Verifying database consistency" >> $LOG_FILE

# Compare user counts between regions
PRIMARY_USERS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;" 2>/dev/null || echo "0")
STANDBY_USERS=$(psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;" 2>/dev/null || echo "0")

echo "$(date): Primary region users: $PRIMARY_USERS" >> $LOG_FILE
echo "$(date): Standby region users: $STANDBY_USERS" >> $LOG_FILE

# Check for data inconsistency
if [ "$PRIMARY_USERS" != "$STANDBY_USERS" ]; then
    echo "$(date): WARNING: User count mismatch between regions" >> $LOG_FILE
fi

# Step 2: Verify S3 data consistency
echo "$(date): Verifying S3 data consistency" >> $LOG_FILE

# Compare object counts
PRIMARY_OBJECTS=$(aws s3 ls s3://biopoint-uploads/ --recursive --region us-east-1 | wc -l)
STANDBY_OBJECTS=$(aws s3 ls s3://biopoint-uploads-west/ --recursive --region us-west-2 | wc -l)

echo "$(date]: Primary S3 objects: $PRIMARY_OBJECTS" >> $LOG_FILE
echo "$(date]: Standby S3 objects: $STANDBY_OBJECTS" >> $LOG_FILE

# Step 3: Check replication lag
echo "$(date): Checking replication lag" >> $LOG_FILE

# Database replication lag
DB_LAG=$(psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -t -c "
  SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT" 2>/dev/null || echo "UNKNOWN")

echo "$(date): Database replication lag: ${DB_LAG}s" >> $LOG_FILE

# S3 replication status
S3_REPLICATION_STATUS=$(aws s3api get-bucket-replication --bucket biopoint-uploads --region us-east-1 --query 'ReplicationConfiguration.Rules[0].Status' --output text 2>/dev/null || echo "NOT_CONFIGURED")
echo "$(date]: S3 replication status: $S3_REPLICATION_STATUS" >> $LOG_FILE

# Step 4: Generate integrity report
cat > /incidents/datacenter-integrity-report-$(date +%Y%m%d_%H%M%S).md << EOF
# Datacenter Recovery Integrity Report

**Date:** $(date)
**Incident ID:** BP-DR-{ID}
**Recovery Method:** {FULL_FAILOVER/GRADUAL_MIGRATION/HYBRID}

## Data Consistency Summary
- **Primary Region Users:** $PRIMARY_USERS
- **Standby Region Users:** $STANDBY_USERS
- **Primary S3 Objects:** $PRIMARY_OBJECTS
- **Standby S3 Objects:** $STANDBY_OBJECTS

## Replication Status
- **Database Replication Lag:** ${DB_LAG}s
- **S3 Replication Status:** $S3_REPLICATION_STATUS

## Consistency Check Results
$(if [ "$PRIMARY_USERS" = "$STANDBY_USERS" ]; then echo "✅ User data consistent"; else echo "⚠️ User data mismatch detected"; fi)
$(if [ "$PRIMARY_OBJECTS" -eq "$STANDBY_OBJECTS" ]; then echo "✅ S3 data consistent"; else echo "⚠️ S3 data mismatch detected"; fi)
$(if [ "$DB_LAG" != "UNKNOWN" ] && [ "$DB_LAG" -lt 300 ]; then echo "✅ Replication lag acceptable"; else echo "⚠️ Replication lag high"; fi)

## Recommendations
$(if [ "$PRIMARY_USERS" != "$STANDBY_USERS" ]; then echo "- Investigate user data inconsistency"; fi)
$(if [ "$PRIMARY_OBJECTS" != "$STANDBY_OBJECTS" ]; then echo "- Investigate S3 data inconsistency"; fi)
$(if [ "$DB_LAG" != "UNKNOWN" ] && [ "$DB_LAG" -ge 300 ]; then echo "- Monitor database replication lag"; fi)

- Continue monitoring for 24 hours
- Schedule integrity check in 1 week
- Update replication configurations if needed
EOF

echo "$(date): Data integrity verification completed" >> $LOG_FILE
```

### 2. Performance Monitoring

```bash
#!/bin/bash
# Post-Failover Performance Monitoring

set -euo pipefail

LOG_FILE="/var/log/datacenter-performance-monitor-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting post-failover performance monitoring" >> $LOG_FILE

# Monitor for 2 hours
duration=7200  # 2 hours in seconds
interval=300   # Check every 5 minutes
end_time=$(($(date +%s) + $duration))

echo "$(date): Monitoring for 2 hours with 5-minute intervals" >> $LOG_FILE

while [ $(date +%s) -lt $end_time ]; do
    timestamp=$(date)
    
    # Check API response times from both regions
    PRIMARY_RESPONSE_TIME=$(curl -f -s -o /dev/null -w "%{time_total}" "https://api.biopoint.com/health" --max-time 10 || echo "999")
    STANDBY_RESPONSE_TIME=$(curl -f -s -o /dev/null -w "%{time_total}" "https://api-west.biopoint.com/health" --max-time 10 || echo "999")
    
    # Check database connections
    PRIMARY_DB_TIME=$(time psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1 && echo "0.1" || echo "999")
    STANDBY_DB_TIME=$(time psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;" > /dev/null 2>&1 && echo "0.1" || echo "999")
    
    # Check resource usage in standby region
    switch kubectl config use-context biopoint-west
    STANDBY_CPU=$(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum/NR}' || echo "0")
    STANDBY_MEMORY=$(kubectl top nodes --no-headers | awk '{sum+=$5} END {print sum/NR}' || echo "0")
    
    # Log metrics
    echo "$timestamp,primary_api:$PRIMARY_RESPONSE_TIME,standby_api:$STANDBY_RESPONSE_TIME,primary_db:$PRIMARY_DB_TIME,standby_db:$STANDBY_DB_TIME,standby_cpu:${STANDBY_CPU}%,standby_memory:${STANDBY_MEMORY}%" >> $LOG_FILE
    
    # Check for performance issues
    if (( $(echo "$STANDBY_RESPONSE_TIME > 2.0" | bc -l) )); then
        echo "$timestamp: ALERT - Standby API slow (${STANDBY_RESPONSE_TIME}s)" >> $LOG_FILE
    fi
    
    if (( $(echo "$STANDBY_DB_TIME > 1.0" | bc -l) )); then
        echo "$timestamp: ALERT - Standby DB slow (${STANDBY_DB_TIME}s)" >> $LOG_FILE
    fi
    
    if (( $(echo "$STANDBY_CPU > 80" | bc -l) )); then
        echo "$timestamp: ALERT - High CPU usage (${STANDBY_CPU}%)" >> $LOG_FILE
    fi
    
    sleep $interval
done

echo "$(date): Performance monitoring completed" >> $LOG_FILE

# Generate performance report
echo "$(date): Generating performance report" >> $LOG_FILE

AVG_API_TIME=$(grep "standby_api:" $LOG_FILE | cut -d: -f3 | awk '{sum+=$1; count++} END {print sum/count}')
AVG_DB_TIME=$(grep "standby_db:" $LOG_FILE | cut -d: -f3 | awk '{sum+=$1; count++} END {print sum/count}')
MAX_CPU=$(grep "standby_cpu:" $LOG_FILE | cut -d: -f3 | sed 's/%//' | sort -n | tail -1)
MAX_MEMORY=$(grep "standby_memory:" $LOG_FILE | cut -d: -f3 | sed 's/%//' | sort -n | tail -1)

cat > /incidents/datacenter-performance-report-$(date +%Y%m%d_%H%M%S).md << EOF
# Datacenter Failover Performance Report

**Monitoring Period:** 2 hours post-failover
**Date:** $(date)

## Performance Summary
- **Average API Response Time:** ${AVG_API_TIME}s
- **Average Database Response Time:** ${AVG_DB_TIME}s
- **Maximum CPU Usage:** ${MAX_CPU}%
- **Maximum Memory Usage:** ${MAX_MEMORY}%

## Performance Alerts
$(grep "ALERT" $LOG_FILE | wc -l) performance alerts triggered
$(grep "ALERT.*API slow" $LOG_FILE | wc -l) API response time alerts
$(grep "ALERT.*DB slow" $LOG_FILE | wc -l) database response time alerts
$(grep "ALERT.*High CPU" $LOG_FILE | wc -l) CPU usage alerts

## Baseline Comparison
$(if (( $(echo "$AVG_API_TIME < 1.0" | bc -l) )); then echo "✅ API performance within baseline"; else echo "⚠️ API performance above baseline"; fi)
$(if (( $(echo "$AVG_DB_TIME < 0.5" | bc -l) )); then echo "✅ Database performance within baseline"; else echo "⚠️ Database performance above baseline"; fi)
$(if [ "$MAX_CPU" -lt 80 ]; then echo "✅ CPU usage within acceptable range"; else echo "⚠️ High CPU usage detected"; fi)

## Recommendations
$(if (( $(echo "$AVG_API_TIME >= 1.0" | bc -l) )); then echo "- Investigate API performance degradation"; fi)
$(if (( $(echo "$AVG_DB_TIME >= 0.5" | bc -l) )); then echo "- Optimize database queries or increase resources"; fi)
$(if [ "$MAX_CPU" -ge 80 ]; then echo "- Consider scaling up compute resources"; fi)

- Continue monitoring for next 24 hours
- Schedule performance optimization review
- Update capacity planning based on new baseline
EOF
```

---

## Communication Templates

### Internal Status Updates

```markdown
## Datacenter Recovery Update

**Time:** {TIMESTAMP}
**Status:** {ASSESSMENT/FAILOVER/VERIFICATION}
**Region:** {PRIMARY/STANDBY/HYBRID}

### Current Progress
- Detection: ✅ Completed
- Assessment: {STATUS}
- Failover: {STATUS}
- Verification: {STATUS}

### Service Status
- API: {STATUS} ({REGION})
- Database: {STATUS} ({REGION})
- S3 Storage: {STATUS} ({REGION})
- Mobile Backend: {STATUS} ({REGION})

### Key Metrics
- Failover Method: {FULL/GRADUAL/HYBRID}
- Downtime: {DURATION}
- Recovery Time: {RECOVERY_DURATION}
- Data Integrity: {STATUS}

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
Subject: BioPoint Service Update - Regional Recovery

Dear BioPoint User,

We are writing to inform you that we have successfully restored full service availability following a regional infrastructure issue.

**What happened:**
We experienced a regional infrastructure disruption that affected service availability for approximately {DURATION}. Our team immediately initiated our disaster recovery procedures to restore service using our standby infrastructure.

**Your data:**
✅ All health data remains secure and encrypted
✅ No PHI was compromised during the incident
✅ All biomarker and lab data is intact
✅ Progress photos and documents are safe

**Current status:**
✅ Service is fully restored across all regions
✅ All features are operational
✅ Enhanced monitoring is active
✅ Additional redundancy has been implemented

We sincerely apologize for any inconvenience this may have caused. Our systems are now operating with improved resilience and geographic redundancy.

If you have any questions or concerns, please contact us at support@biopoint.com or 1-800-BIOPOINT.

Thank you for your patience and continued trust in BioPoint.

The BioPoint Team
```

---

## Quick Reference

### Emergency Contacts
- **DR Commander:** +1-415-555-0100
- **Cloud Infrastructure:** +1-415-555-0105
- **Database Admin:** +1-415-555-0102
- **AWS Support:** Enterprise Support Console
- **Cloudflare Support:** Emergency Portal

### Key Commands
```bash
# Check regional health
curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health"
curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health"

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"
psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" -c "SELECT 1;"

# Promote standby database
curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
     -H "Authorization: Bearer ${NEON_API_KEY}"

# Update DNS routing
aws route53 change-resource-record-sets --hosted-zone-id "Z123456789ABC" --change-batch file://dns-failover.json
```

### Decision Matrix
| Scenario | Recovery Method | RTO | Complexity | Risk |
|----------|----------------|-----|------------|------|
| Complete failure | Full failover | 30m | Low | Low |
| Partial failure | Gradual migration | 45m | Medium | Medium |
| Mixed availability | Hybrid recovery | 60m | High | Low |
| Data corruption | Clean restore | 90m | Medium | High |

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** February 2026
- **Owner:** Cloud Infrastructure Engineer
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- Infrastructure team must review monthly
- Cross-region failover drills quarterly
- Full datacenter simulation annually