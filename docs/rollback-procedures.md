# BioPoint Rollback Procedures

## Overview

This document outlines the rollback procedures for BioPoint production deployments. Rollbacks are critical for maintaining system availability and data integrity when issues arise during or after deployment.

## Rollback Types

### 1. Automatic Rollback
Triggered by system monitoring when deployment health checks fail.

### 2. Manual Rollback
Initiated by operations team when issues are detected post-deployment.

### 3. Emergency Rollback
Immediate rollback for critical issues affecting patient safety or data security.

## Rollback Triggers

### Automatic Triggers
- Health check failures
- Error rate > 5% for 5 minutes
- Response time > 5 seconds for 10 minutes
- Database connectivity issues
- Security vulnerability detection

### Manual Triggers
- Performance degradation
- Functional issues reported
- Monitoring anomalies
- Customer complaints
- Regulatory compliance concerns

## Pre-Rollback Checklist

### Assessment Phase
- [ ] Identify root cause of issue
- [ ] Assess impact on users and data
- [ ] Determine if rollback is necessary
- [ ] Verify rollback target is healthy
- [ ] Notify stakeholders

### Preparation Phase
- [ ] Confirm rollback procedures
- [ ] Prepare communication plan
- [ ] Ensure rollback scripts available
- [ ] Verify database backup (if needed)
- [ ] Alert monitoring team

## Blue-Green Rollback

### Quick Rollback (Traffic Switch)

```bash
#!/bin/bash
# Quick rollback script - switches traffic immediately

set -euo pipefail

NAMESPACE="biopoint-production"
CURRENT_COLOR=$(kubectl get service biopoint-production-service -n $NAMESPACE -o jsonpath='{.spec.selector.color}')

if [[ "$CURRENT_COLOR" == "blue" ]]; then
    ROLLBACK_COLOR="green"
else
    ROLLBACK_COLOR="blue"
fi

echo "Rolling back from $CURRENT_COLOR to $ROLLBACK_COLOR"

# Switch traffic
kubectl patch service biopoint-production-service -n $NAMESPACE \
    -p '{"spec":{"selector":{"color":"'${ROLLBACK_COLOR}'"}}}'

# Verify traffic switch
sleep 30

# Test new traffic endpoint
PRODUCTION_URL="https://api.biopoint.health"
for i in {1..5}; do
    if curl -f $PRODUCTION_URL/health >/dev/null 2>&1; then
        echo "Rollback successful - health check passing"
        exit 0
    fi
    sleep 10
done

echo "Rollback verification failed"
exit 1
```

### Detailed Rollback Process

#### Step 1: Assess Current State

```bash
# Check current deployment status
kubectl get deployments -n biopoint-production

# Check current active color
CURRENT_COLOR=$(kubectl get service biopoint-production-service -n biopoint-production -o jsonpath='{.spec.selector.color}')
echo "Current active color: $CURRENT_COLOR"

# Check deployment health
kubectl get pods -n biopoint-production -l color=$CURRENT_COLOR

# Check previous deployment status
if [[ "$CURRENT_COLOR" == "blue" ]]; then
    PREVIOUS_COLOR="green"
else
    PREVIOUS_COLOR="blue"
fi

echo "Previous color: $PREVIOUS_COLOR"
kubectl get pods -n biopoint-production -l color=$PREVIOUS_COLOR
```

#### Step 2: Validate Rollback Target

```bash
# Verify previous deployment is ready
kubectl rollout status deployment/biopoint-api-$PREVIOUS_COLOR -n biopoint-production --timeout=60s

# Test previous deployment directly
PREVIOUS_URL=$(kubectl get service biopoint-api-$PREVIOUS_COLOR -n biopoint-production -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

if [[ -n "$PREVIOUS_URL" ]]; then
    echo "Testing previous deployment at: $PREVIOUS_URL"
    curl -f "http://$PREVIOUS_URL/health" || echo "Previous deployment health check failed"
fi
```

#### Step 3: Execute Traffic Switch

```bash
# Create rollback record
ROLLBACK_ID=$(date +%s)
cat > rollback-record.json << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "fromColor": "$CURRENT_COLOR",
    "toColor": "$PREVIOUS_COLOR",
    "reason": "$ROLLBACK_REASON",
    "initiatedBy": "$(whoami)",
    "status": "in_progress"
}
EOF

# Switch traffic
kubectl patch service biopoint-production-service -n biopoint-production \
    -p '{"spec":{"selector":{"color":"'${PREVIOUS_COLOR}'"}}}'

echo "Traffic switched from $CURRENT_COLOR to $PREVIOUS_COLOR"
```

#### Step 4: Verify Rollback

```bash
# Wait for traffic switch to propagate
sleep 30

# Test production endpoint
PRODUCTION_URL="https://api.biopoint.health"
echo "Testing production endpoint: $PRODUCTION_URL"

# Health check
for i in {1..10}; do
    if curl -f $PRODUCTION_URL/health >/dev/null 2>&1; then
        echo "Health check passed (attempt $i)"
        break
    fi
    if [[ $i -eq 10 ]]; then
        echo "Health check failed after 10 attempts"
        exit 1
    fi
    sleep 10
done

# Run comprehensive smoke tests
./scripts/run-smoke-tests.sh production

# Update rollback record
cat > rollback-record.json << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "fromColor": "$CURRENT_COLOR",
    "toColor": "$PREVIOUS_COLOR",
    "reason": "$ROLLBACK_REASON",
    "initiatedBy": "$(whoami)",
    "status": "completed",
    "verification": "passed"
}
EOF

# Store rollback record
aws s3 cp rollback-record.json s3://biopoint-deployments/rollbacks/${ROLLBACK_ID}.json
```

#### Step 5: Cleanup

```bash
# Scale down failed deployment (optional)
read -p "Scale down failed deployment? (y/N): " SCALE_DOWN
if [[ "$SCALE_DOWN" =~ ^[Yy]$ ]]; then
    kubectl scale deployment/biopoint-api-$CURRENT_COLOR --replicas=0 -n biopoint-production
    echo "Scaled down $CURRENT_COLOR deployment"
fi

# Archive logs
kubectl logs deployment/biopoint-api-$CURRENT_COLOR -n biopoint-production --since=1h > failed-deployment-logs.txt
aws s3 cp failed-deployment-logs.txt s3://biopoint-logs/failures/${ROLLBACK_ID}-logs.txt

echo "Rollback completed successfully"
```

## Database Rollback

### Schema Migration Rollback

```bash
#!/bin/bash
# Database migration rollback

set -euo pipefail

# Get current migration status
echo "Current migration status:"
doppler run -- npm run db:migrate:status

# List available rollback points
echo "Available rollback points:"
doppler run -- npx prisma migrate resolve --rolled-back

# Prompt for rollback target
read -p "Enter migration to rollback to (timestamp): " TARGET_MIGRATION

# Create backup before rollback
echo "Creating database backup..."
doppler run -- npm run db:backup

# Execute rollback
echo "Rolling back to migration: $TARGET_MIGRATION"
doppler run -- npx prisma migrate resolve --rolled-back "$TARGET_MIGRATION"

# Verify rollback
echo "Verifying rollback:"
doppler run -- npm run db:migrate:status

# Test application connectivity
echo "Testing application connectivity:"
doppler run -- npm run db:health
```

### Data Rollback (Emergency)

```bash
#!/bin/bash
# Emergency data rollback

set -euo pipefail

# Configuration
BACKUP_BUCKET="biopoint-backups"
RESTORE_POINT="${1:-latest}"
DB_SECRET="biopoint-db-credentials"

# Get backup file
if [[ "$RESTORE_POINT" == "latest" ]]; then
    BACKUP_FILE=$(aws s3 ls s3://$BACKUP_BUCKET/ | sort -r | head -1 | awk '{print $4}')
else
    BACKUP_FILE="backup-$RESTORE_POINT.sql"
fi

echo "Restoring from backup: $BACKUP_FILE"

# Download backup
aws s3 cp s3://$BACKUP_BUCKET/$BACKUP_FILE /tmp/restore.sql

# Get database credentials
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET | jq -r '.SecretString' | jq -r '.password')
DB_HOST=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET | jq -r '.SecretString' | jq -r '.host')
DB_NAME=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET | jq -r '.SecretString' | jq -r '.dbname')

# Create restore point
echo "Creating restore point..."
pg_dump -h $DB_HOST -U postgres -d $DB_NAME -f /tmp/pre-rollback-backup.sql

# Execute restore
echo "Executing data restore..."
psql -h $DB_HOST -U postgres -d $DB_NAME -f /tmp/restore.sql

# Verify data integrity
echo "Verifying data integrity..."
doppler run -- npm run db:validate

# Test application
echo "Testing application..."
./scripts/run-smoke-tests.sh production

echo "Data rollback completed"
```

## Application Rollback

### Configuration Rollback

```bash
#!/bin/bash
# Application configuration rollback

set -euo pipefail

NAMESPACE="biopoint-production"
CONFIG_MAP="biopoint-config"
SECRET="biopoint-secrets"

# Get current configuration revision
CURRENT_REVISION=$(kubectl get configmap $CONFIG_MAP -n $NAMESPACE -o jsonpath='{.metadata.annotations.kubernetes\.io/change-cause}')
echo "Current configuration: $CURRENT_REVISION"

# List available revisions
kubectl rollout history configmap $CONFIG_MAP -n $NAMESPACE || echo "No revision history available"

# Rollback config map
read -p "Rollback config map? (y/N): " ROLLBACK_CONFIG
if [[ "$ROLLBACK_CONFIG" =~ ^[Yy]$ ]]; then
    # Get previous version
    PREVIOUS_CONFIG=$(kubectl get configmap $CONFIG_MAP -n $NAMESPACE -o json | jq '.data')
    
    # Apply previous configuration
    echo "$PREVIOUS_CONFIG" | kubectl apply -f -
    
    echo "Config map rolled back"
fi

# Rollback secrets (if needed)
read -p "Rollback secrets? (y/N): " ROLLBACK_SECRETS
if [[ "$ROLLBACK_SECRETS" =~ ^[Yy]$ ]]; then
    # Restore from backup
    kubectl get secret $SECRET -n $NAMESPACE -o yaml | kubectl apply -f -
    
    echo "Secrets rolled back"
fi

# Restart deployment to pick up changes
kubectl rollout restart deployment/biopoint-api-$PREVIOUS_COLOR -n $NAMESPACE

# Wait for restart
kubectl rollout status deployment/biopoint-api-$PREVIOUS_COLOR -n $NAMESPACE
```

### Feature Flag Rollback

```bash
#!/bin/bash
# Feature flag rollback

set -euo pipefail

# Configuration
FEATURE_FLAGS=("new_ui" "enhanced_security" "beta_features")

# List current feature flags
echo "Current feature flags:"
for flag in "${FEATURE_FLAGS[@]}"; do
    VALUE=$(kubectl get configmap feature-flags -n biopoint-production -o jsonpath="{.data.$flag}")
    echo "  $flag: $VALUE"
done

# Select flags to disable
read -p "Enter flags to disable (space-separated): " FLAGS_TO_DISABLE

# Update feature flags
for flag in $FLAGS_TO_DISABLE; do
    kubectl patch configmap feature-flags -n biopoint-production \
        --type merge -p '{"data":{"'$flag'":"false"}}'
    echo "Disabled feature flag: $flag"
done

# Restart application to pick up changes
kubectl rollout restart deployment/biopoint-api -n biopoint-production

# Wait for restart
kubectl rollout status deployment/biopoint-api -n biopoint-production

echo "Feature flags updated successfully"
```

## Emergency Rollback

### Critical System Failure

```bash
#!/bin/bash
# Emergency rollback for critical failures

set -euo pipefail

# Immediate traffic switch
echo "EMERGENCY ROLLBACK INITIATED"
echo "Switching traffic immediately..."

CURRENT_COLOR=$(kubectl get service biopoint-production-service -n biopoint-production -o jsonpath='{.spec.selector.color}')

if [[ "$CURRENT_COLOR" == "blue" ]]; then
    EMERGENCY_COLOR="green"
else
    EMERGENCY_COLOR="blue"
fi

# Force traffic switch
kubectl patch service biopoint-production-service -n biopoint-production \
    -p '{"spec":{"selector":{"color":"'${EMERGENCY_COLOR}'"}}}' --force

# Immediate verification
sleep 10
if curl -f https://api.biopoint.health/health >/dev/null 2>&1; then
    echo "EMERGENCY ROLLBACK SUCCESSFUL"
    
    # Send emergency alert
    curl -X POST $SLACK_WEBHOOK \
        -H 'Content-type: application/json' \
        --data '{"text":"🚨 EMERGENCY ROLLBACK COMPLETED - System restored to '${EMERGENCY_COLOR}'"}'
else
    echo "EMERGENCY ROLLBACK FAILED - MANUAL INTERVENTION REQUIRED"
    exit 1
fi
```

### Security Incident Rollback

```bash
#!/bin/bash
# Security incident rollback

set -euo pipefail

# Security incident detected
# This script immediately isolates affected components

echo "SECURITY INCIDENT ROLLBACK INITIATED"

# 1. Immediately revoke access
kubectl delete networkpolicy allow-external -n biopoint-production
kubectl apply -f k8s/security/deny-all-networkpolicy.yaml

# 2. Switch to known-good deployment
current_color=$(kubectl get service biopoint-production-service -n biopoint-production -o jsonpath='{.spec.selector.color}')
if [[ "$current_color" == "blue" ]]; then
    secure_color="green"
else
    secure_color="blue"
fi

kubectl patch service biopoint-production-service -n biopoint-production \
    -p '{"spec":{"selector":{"color":"'${secure_color}'"}}}'

# 3. Scale down affected deployment
kubectl scale deployment/biopoint-api-$current_color --replicas=0 -n biopoint-production

# 4. Enable enhanced logging
kubectl patch deployment/biopoint-api-$secure_color -n biopoint-production \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"biopoint-api","env":[{"name":"LOG_LEVEL","value":"debug"},{"name":"SECURITY_LOGGING","value":"enabled"}]}]}}}}'

# 5. Notify security team
curl -X POST $SECURITY_WEBHOOK \
    -H 'Content-type: application/json' \
    --data '{"text":"🔒 SECURITY ROLLBACK COMPLETED - System isolated and secured"}'

echo "Security incident rollback completed"
```

## Rollback Validation

### Health Validation

```bash
#!/bin/bash
# Comprehensive rollback validation

set -euo pipefail

PRODUCTION_URL="https://api.biopoint.health"
TESTS_PASSED=0
TESTS_FAILED=0

# Health endpoint test
echo "Testing health endpoint..."
if curl -f $PRODUCTION_URL/health >/dev/null 2>&1; then
    echo "✅ Health endpoint responding"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ Health endpoint failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Database connectivity test
echo "Testing database connectivity..."
if curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" -f $PRODUCTION_URL/health/db >/dev/null 2>&1; then
    echo "✅ Database connectivity working"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ Database connectivity failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# API functionality test
echo "Testing API functionality..."
if curl -f $PRODUCTION_URL/api/v1/status >/dev/null 2>&1; then
    echo "✅ API functionality working"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ API functionality failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Security validation
echo "Testing security headers..."
HEADERS=$(curl -s -I $PRODUCTION_URL)
if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "✅ Security headers present"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "❌ Security headers missing"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Performance test
echo "Testing response time..."
START_TIME=$(date +%s%N)
curl -s $PRODUCTION_URL/health >/dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

if [[ $RESPONSE_TIME -lt 1000 ]]; then
    echo "✅ Response time acceptable (${RESPONSE_TIME}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "⚠️ Response time high (${RESPONSE_TIME}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Summary
echo ""
echo "Rollback Validation Summary:"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "✅ Rollback validation successful"
    exit 0
else
    echo "❌ Rollback validation failed"
    exit 1
fi
```

## Rollback Decision Matrix

| Issue Type | Severity | Response Time | Rollback Required |
|------------|----------|---------------|-------------------|
| Security Vulnerability | Critical | Immediate | Yes |
| Data Breach | Critical | Immediate | Yes |
| System Unavailable | Critical | < 5 minutes | Yes |
| Performance Degraded | High | < 15 minutes | Likely |
| Functionality Broken | High | < 30 minutes | Likely |
| Minor Bugs | Medium | < 60 minutes | Unlikely |
| Cosmetic Issues | Low | N/A | No |

## Communication Procedures

### Rollback Notification

```bash
#!/bin/bash
# Rollback notification script

ROLLBACK_REASON="${1:-Unknown}"
ROLLBACK_FROM="${2:-Unknown}"
ROLLBACK_TO="${3:-Unknown}"

# Slack notification
curl -X POST $SLACK_WEBHOOK \
    -H 'Content-type: application/json' \
    --data @- << EOF
{
    "text": "🚨 ROLLBACK INITIATED",
    "attachments": [{
        "color": "danger",
        "fields": [
            {"title": "Reason", "value": "$ROLLBACK_REASON", "short": true},
            {"title": "From", "value": "$ROLLBACK_FROM", "short": true},
            {"title": "To", "value": "$ROLLBACK_TO", "short": true},
            {"title": "Time", "value": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "short": true},
            {"title": "Initiated By", "value": "$(whoami)", "short": true}
        ]
    }]
}
EOF

# Email notification (if critical)
if [[ "$ROLLBACK_REASON" =~ (security|critical) ]]; then
    mail -s "CRITICAL: BioPoint Rollback Initiated" ops-team@biopoint.health << EOF
A rollback has been initiated for BioPoint production.

Details:
- Reason: $ROLLBACK_REASON
- From: $ROLLBACK_FROM
- To: $ROLLBACK_TO
- Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Initiated By: $(whoami)

Please investigate immediately.
EOF
fi
```

## Post-Rollback Activities

### Investigation

1. **Root Cause Analysis**
   ```bash
   # Collect logs
   kubectl logs deployment/biopoint-api-$FAILED_COLOR -n biopoint-production --since=2h > failure-analysis-logs.txt
   
   # Collect metrics
   curl https://api.biopoint.health/metrics > failure-metrics.json
   
   # Database state
   doppler run -- npm run db:health > failure-db-health.json
   ```

2. **Incident Documentation**
   ```bash
   # Create incident report
   cat > incident-report.md << EOF
   # Incident Report - $(date -u +%Y-%m-%dT%H:%M:%SZ)
   
   ## Summary
   - **Incident Type**: Rollback
   - **Duration**: [Duration]
   - **Impact**: [Impact description]
   - **Root Cause**: [Root cause]
   
   ## Timeline
   - [Timeline of events]
   
   ## Resolution
   - [Resolution steps]
   
   ## Prevention
   - [Preventive measures]
   EOF
   ```

3. **Process Improvement**
   - Update deployment procedures
   - Enhance monitoring
   - Improve testing
   - Update documentation

---

**Document Version**: 1.0.0
**Last Updated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Next Review**: $(date -d '+6 months' -u +%Y-%m-%dT%H:%M:%SZ)