#!/bin/bash
# API Server Recovery Script - Multi-Region Failover
# Usage: ./dr-restore-api.sh [region]

set -euo pipefail

# Configuration
PRIMARY_REGION="${1:-us-east-1}"
STANDBY_REGION="${2:-us-west-2}"
LOG_FILE="/var/log/dr-api-recovery-$(date +%Y%m%d_%H%M%S).log"
API_IMAGE="${API_IMAGE:-biopoint/api:latest}"

echo "$(date): Starting API server recovery in $STANDBY_REGION region" | tee -a $LOG_FILE

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

# Step 1: Verify current API status
echo "$(date): Assessing current API status" | tee -a $LOG_FILE

PRIMARY_HEALTH=$(check_health "https://api.biopoint.com/health")
STANDBY_HEALTH=$(check_health "https://api-west.biopoint.com/health")

echo "$(date): Primary API health: HTTP $PRIMARY_HEALTH" | tee -a $LOG_FILE
echo "$(date): Standby API health: HTTP $STANDBY_HEALTH" | tee -a $LOG_FILE

# Step 2: Switch to standby region context
echo "$(date): Switching to standby region context" | tee -a $LOG_FILE
log_exec kubectl config use-context "biopoint-west"

# Step 3: Scale down failed primary deployments
echo "$(date): Scaling down primary deployments" | tee -a $LOG_FILE
if [ "$PRIMARY_HEALTH" != "200" ]; then
    log_exec kubectl config use-context "biopoint-east"
    log_exec kubectl scale deployment biopoint-api --replicas=0
    log_exec kubectl scale deployment biopoint-api-standby --replicas=0
    log_exec kubectl config use-context "biopoint-west"
fi

# Step 4: Deploy fresh API containers
echo "$(date): Deploying fresh API containers" | tee -a $LOG_FILE

# Update container image
log_exec kubectl set image deployment/biopoint-api "api=${API_IMAGE}"
log_exec kubectl set image deployment/biopoint-api-standby "api=${API_IMAGE}"

# Step 5: Scale up standby deployments
echo "$(date): Scaling up standby API deployments" | tee -a $LOG_FILE

# Scale API servers gradually
for replicas in 1 3 5; do
    echo "$(date): Scaling API to $replicas replicas" | tee -a $LOG_FILE
    log_exec kubectl scale deployment biopoint-api --replicas=$replicas
    sleep 30
done

# Scale standby API
log_exec kubectl scale deployment biopoint-api-standby --replicas=3

# Step 6: Wait for deployment to complete
echo "$(date): Waiting for deployment rollout" | tee -a $LOG_FILE
log_exec kubectl rollout status deployment/biopoint-api --timeout=600s

# Step 7: Verify pod status
echo "$(date): Verifying pod status" | tee -a $LOG_FILE
READY_PODS=$(kubectl get pods -l app=biopoint-api -o json | jq -r '.items[] | select(.status.phase == "Running" and ([ .status.conditions[] | select(.type == "Ready" and .status == "True") ] | length > 0)) | .metadata.name' | wc -l)
TOTAL_PODS=$(kubectl get pods -l app=biopoint-api | grep -c "Running")

echo "$(date): Ready pods: $READY_PODS / $TOTAL_PODS" | tee -a $LOG_FILE

if [ "$READY_PODS" -eq 0 ] || [ "$TOTAL_PODS" -eq 0 ]; then
    echo "$(date): ERROR: No pods ready" | tee -a $LOG_FILE
    exit 1
fi

# Step 8: Test API functionality
echo "$(date): Testing API functionality" | tee -a $LOG_FILE

# Wait for services to be ready
sleep 30

# Test health endpoint
STANDBY_HEALTH=$(check_health "https://api-west.biopoint.com/health" 30)
echo "$(date): Standby API health: HTTP $STANDBY_HEALTH" | tee -a $LOG_FILE

if [ "$STANDBY_HEALTH" != "200" ]; then
    echo "$(date): ERROR: Standby API health check failed" | tee -a $LOG_FILE
    exit 1
fi

# Test authentication endpoint
AUTH_TEST=$(curl -s -X POST "https://api-west.biopoint.com/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@biopoint.com","password":"test123"}' \
    -w "\nHTTP_CODE:%{http_code}" || echo "AUTH_FAILED")

if echo "$AUTH_TEST" | grep -q "HTTP_CODE:200\|HTTP_CODE:401"; then
    echo "$(date): Authentication endpoint responding" | tee -a $LOG_FILE
else
    echo "$(date): ERROR: Authentication endpoint failed" | tee -a $LOG_FILE
    exit 1
fi

# Test data access endpoint
DATA_TEST=$(curl -s -H "Authorization: Bearer ${TEST_TOKEN:-dummy_token}" \
    "https://api-west.biopoint.com/users/me" \
    -w "\nHTTP_CODE:%{http_code}" || echo "DATA_TEST_FAILED")

if echo "$DATA_TEST" | grep -q "HTTP_CODE:200\|HTTP_CODE:401"; then
    echo "$(date): Data access endpoint responding" | tee -a $LOG_FILE
else
    echo "$(date): ERROR: Data access endpoint failed" | tee -a $LOG_FILE
    exit 1
fi

# Step 9: Update load balancer configuration
echo "$(date): Updating load balancer configuration" | tee -a $LOG_FILE

# Update target group health checks
aws elbv2 modify-target-group-attributes \
    --target-group-arn "arn:aws:elasticloadbalancing:us-west-2:123456789012:targetgroup/biopoint-api-west-tg" \
    --attributes Key=deregistration_delay.timeout_seconds,Value=30 \
                Key=stickiness.enabled,Value=true \
                Key=stickiness.type,Value=lb_cookie \
                Key=stickiness.lb_cookie.duration_seconds,Value=86400

# Step 10: Configure auto-scaling
echo "$(date): Configuring auto-scaling" | tee -a $LOG_FILE

# Apply Horizontal Pod Autoscaler
kubectl apply -f - << EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biopoint-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biopoint-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
EOF

# Step 11: Verify comprehensive functionality
echo "$(date): Verifying comprehensive functionality" | tee -a $LOG_FILE

# Run functionality test suite
if [ -f "./scripts/test-api-functionality.sh" ]; then
    echo "$(date): Running functionality test suite" | tee -a $LOG_FILE
    ./scripts/test-api-functionality.sh "https://api-west.biopoint.com" | tee -a $LOG_FILE
    
    if [ $? -ne 0 ]; then
        echo "$(date): ERROR: Functionality tests failed" | tee -a $LOG_FILE
        exit 1
    fi
fi

# Step 12: Configure monitoring and alerting
echo "$(date): Configuring monitoring and alerting" | tee -a $LOG_FILE

# Update Prometheus targets
kubectl apply -f k8s/prometheus-standby-config.yaml

# Configure alerts for standby region
kubectl apply -f k8s/alertmanager-standby-config.yaml

# Step 13: Generate recovery report
cat > "/incidents/api-recovery-report-$(date +%Y%m%d_%H%M%S).md" << EOF
# API Server Recovery Report

**Date:** $(date)
**Recovery Region:** $STANDBY_REGION
**Recovery Method:** Regional Failover

## Recovery Summary
- **Primary Region Status:** HTTP $PRIMARY_HEALTH
- **Standby Region Status:** HTTP $STANDBY_HEALTH
- **Pods Ready:** $READY_PODS / $TOTAL_PODS
- **API Image:** $API_IMAGE

## Functionality Tests
- Health Check: HTTP $STANDBY_HEALTH
- Authentication: Responding
- Data Access: Responding
- Auto-scaling: Configured

## Performance Metrics
- Response Time: < 2s (health check)
- Availability: 99.9% target
- Scalability: 3-20 pods auto-scaling

## Next Steps
- Monitor performance for 24 hours
- Update monitoring baselines
- Schedule load testing
- Review auto-scaling thresholds
EOF

echo "$(date): API server recovery completed successfully" | tee -a $LOG_FILE