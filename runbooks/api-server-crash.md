# API Server Crash Recovery Runbook

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** DevOps Engineer  
**Review Schedule:** Monthly

---

## Overview

This runbook provides step-by-step procedures for recovering from API server crashes affecting BioPoint's Fastify-based Node.js API. Server crashes can result from memory exhaustion, unhandled exceptions, dependency failures, or infrastructure issues.

**Recovery Objectives:**
- **RTO:** 15 minutes
- **RPO:** Not applicable (stateless service)
- **HIPAA Compliance:** Maintain throughout recovery

---

## Detection Methods

### Primary Detection
- **Health Check Failures:** API health endpoint returning non-200 status
- **Monitoring Alerts:** High error rates, response time spikes
- **Load Balancer Alerts:** Target health check failures
- **User Reports:** Mobile app showing connection errors

### Secondary Detection
- **Container Crashes:** Kubernetes pod restart loops
- **Memory Alerts:** High memory usage leading to OOM kills
- **Error Rate Spikes:** Application error logs increasing
- **Performance Degradation:** API response times exceeding thresholds

---

## Immediate Response (0-3 minutes)

### 1. Assess Severity
```bash
# Check API health endpoint
echo "Testing API health..."
curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "HEALTH CHECK FAILED"

# Check recent API logs
echo "Checking recent API errors..."
kubectl logs deployment/biopoint-api --tail=50 | grep -E "(error|Error|ERROR|exception|Exception|crash|timeout)"

# Check pod status
echo "Checking pod status..."
kubectl get pods -l app=biopoint-api -o wide

# Check service endpoints
echo "Checking service endpoints..."
kubectl get endpoints biopoint-api-service
```

### 2. Preserve Diagnostic Information
```bash
# Capture current logs
echo "Capturing current logs..."
kubectl logs deployment/biopoint-api --tail=500 > /incidents/api-logs-$(date +%Y%m%d_%H%M%S).log

# Capture pod events
echo "Capturing pod events..."
kubectl get events --field-selector involvedObject.name=biopoint-api --sort-by='.lastTimestamp' > /incidents/api-events-$(date +%Y%m%d_%H%M%S).log

# Capture resource usage
echo "Capturing resource usage..."
kubectl top pods -l app=biopoint-api > /incidents/api-resources-$(date +%Y%m%d_%H%M%S).log

# Save current configuration
echo "Saving current configuration..."
kubectl get deployment biopoint-api -o yaml > /incidents/api-deployment-$(date +%Y%m%d_%H%M%S).yaml
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
         \"summary\": \"BioPoint API Server Crash Detected\",
         \"source\": \"api-monitoring\",
         \"severity\": \"critical\",
         \"custom_details\": {
           \"service\": \"biopoint-api\",
           \"detection_time\": \"$(date)\",
           \"health_status\": \"$(curl -s -o /dev/null -w \"%{http_code}\" https://api.biopoint.com/health || echo '000')\"
         }
       }
     }"

# Log incident
echo "$(date): API server crash incident initiated" >> /var/log/dr-incidents.log
```

---

## Assessment Phase (3-10 minutes)

### 1. Determine Crash Cause

```bash
# Check for memory issues
echo "Checking memory usage..."
kubectl describe pods -l app=biopoint-api | grep -A 5 "Last State"

# Check for recent deployments
echo "Checking deployment history..."
kubectl rollout history deployment/biopoint-api

# Check resource constraints
echo "Checking resource limits..."
kubectl describe nodes | grep -A 10 "Allocated resources"

# Check for dependency failures
echo "Checking dependency connectivity..."
kubectl exec deployment/biopoint-api -- node -e "
const db = require('./src/db');
const redis = require('./src/redis');
Promise.all([
  db.query('SELECT 1'),
  redis.ping()
]).then(() => console.log('Dependencies OK')).catch(err => console.log('Dependency Error:', err.message));
"
```

### 2. Check Application Logs

```bash
# Search for specific error patterns
echo "Analyzing error patterns..."
kubectl logs deployment/biopoint-api --tail=200 | grep -E "(FATAL|ERROR|uncaughtException|UnhandledPromiseRejection)"

# Check for memory leaks
echo "Checking for memory issues..."
kubectl logs deployment/biopoint-api --tail=200 | grep -E "(memory|heap|out of memory|OOM)"

# Check for database connection issues
echo "Checking database connectivity..."
kubectl logs deployment/biopoint-api --tail=200 | grep -E "(database|connection|timeout|ECONNREFUSED)"

# Check for dependency errors
echo "Checking dependency errors..."
kubectl logs deployment/biopoint-api --tail=200 | grep -E "(axios|fetch|request|ETIMEDOUT|ENOTFOUND)"
```

### 3. Assess Recovery Options

Based on assessment, determine the most appropriate recovery strategy:

#### **Option A: Automatic Restart**
- **When to use:** Temporary resource exhaustion, minor configuration issues
- **Advantages:** Fastest recovery, minimal intervention
- **Procedure:** Pod restart with resource adjustment

#### **Option B: Rolling Deployment**
- **When to use:** Application code issues, dependency updates needed
- **Advantages:** Zero-downtime deployment, gradual rollout
- **Procedure:** New deployment with updated configuration

#### **Option C: Infrastructure Failover**
- **When to use:** Regional infrastructure failure, major outages
- **Advantages:** Complete infrastructure isolation
- **Procedure:** Failover to standby region

---

## Recovery Procedures

### Option A: Automatic Restart with Resource Adjustment

**Use when:** Memory exhaustion, temporary resource constraints, minor configuration drift

```bash
#!/bin/bash
# Automatic Restart Recovery Procedure

set -euo pipefail

LOG_FILE="/var/log/api-recovery-restart-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting automatic restart recovery" >> $LOG_FILE

# Step 1: Analyze resource usage patterns
echo "$(date): Analyzing resource usage patterns" >> $LOG_FILE
kubectl top pods -l app=biopoint-api >> $LOG_FILE

# Check if pods are being OOM killed
OOM_KILLED=$(kubectl get pods -l app=biopoint-api -o json | jq -r '.items[].status.containerStatuses[] | select(.lastState.terminated.reason == "OOMKilled") | .name' | wc -l)
echo "$(date): Pods OOM killed: $OOM_KILLED" >> $LOG_FILE

# Step 2: Adjust resource limits if needed
if [ "$OOM_KILLED" -gt 0 ]; then
    echo "$(date): Increasing memory limits due to OOM kills" >> $LOG_FILE
    
    # Increase memory limits by 50%
    kubectl patch deployment biopoint-api -p '{
        "spec": {
            "template": {
                "spec": {
                    "containers": [{
                        "name": "api",
                        "resources": {
                            "limits": {
                                "memory": "1536Mi"
                            },
                            "requests": {
                                "memory": "768Mi"
                            }
                        }
                    }]
                }
            }
        }
    }'
fi

# Step 3: Force pod restart
echo "$(date): Forcing pod restart" >> $LOG_FILE
kubectl rollout restart deployment/biopoint-api

# Step 4: Monitor restart progress
echo "$(date): Monitoring restart progress" >> $LOG_FILE
kubectl rollout status deployment/biopoint-api --timeout=300s >> $LOG_FILE

# Step 5: Verify health after restart
echo "$(date): Verifying health after restart" >> $LOG_FILE
sleep 30

HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "000")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "$(date): API health check successful after restart" >> $LOG_FILE
    
    # Step 6: Run comprehensive functionality tests
    echo "$(date): Running functionality tests" >> $LOG_FILE
    ./scripts/test-api-functionality.sh >> $LOG_FILE
    
    if [ $? -eq 0 ]; then
        echo "$(date): Automatic restart recovery completed successfully" >> $LOG_FILE
    else
        echo "$(date): Functionality tests failed after restart" >> $LOG_FILE
        exit 1
    fi
else
    echo "$(date): Health check failed after restart (HTTP $HEALTH_CHECK)" >> $LOG_FILE
    exit 1
fi
```

### Option B: Rolling Deployment Recovery

**Use when:** Application crashes, dependency issues, configuration problems

```bash
#!/bin/bash
# Rolling Deployment Recovery Procedure

set -euo pipefail

LOG_FILE="/var/log/api-recovery-deployment-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting rolling deployment recovery" >> $LOG_FILE

# Step 1: Build and push new container image
echo "$(date): Building new container image" >> $LOG_FILE
DOCKER_IMAGE="biopoint/api:recovery-$(date +%Y%m%d-%H%M%S)"

cd /apps/api
docker build -t $DOCKER_IMAGE .
docker push $DOCKER_IMAGE

# Step 2: Update deployment configuration
echo "$(date): Updating deployment configuration" >> $LOG_FILE

# Create recovery deployment configuration
cat > /tmp/api-recovery-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: biopoint-api
  labels:
    app: biopoint-api
    version: recovery
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: biopoint-api
  template:
    metadata:
      labels:
        app: biopoint-api
        version: recovery
    spec:
      containers:
      - name: api
        image: $DOCKER_IMAGE
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: biopoint-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: biopoint-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
EOF

# Step 3: Apply new deployment
echo "$(date): Applying new deployment" >> $LOG_FILE
kubectl apply -f /tmp/api-recovery-deployment.yaml

# Step 4: Monitor rolling deployment
echo "$(date): Monitoring rolling deployment" >> $LOG_FILE
kubectl rollout status deployment/biopoint-api --timeout=600s >> $LOG_FILE

# Step 5: Verify deployment success
echo "$(date): Verifying deployment success" >> $LOG_FILE
sleep 60

# Check pod status
READY_PODS=$(kubectl get pods -l app=biopoint-api -o json | jq -r '.items[] | select(.status.phase == "Running" and ([ .status.conditions[] | select(.type == "Ready" and .status == "True") ] | length > 0)) | .metadata.name' | wc -l)
TOTAL_PODS=$(kubectl get pods -l app=biopoint-api | grep -c "Running")

echo "$(date): Ready pods: $READY_PODS / $TOTAL_PODS" >> $LOG_FILE

if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
    echo "$(date): All pods ready, testing functionality" >> $LOG_FILE
    
    # Step 6: Test API functionality
    HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "000")
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo "$(date): Health check successful, running comprehensive tests" >> $LOG_FILE
        
        # Run comprehensive API tests
        ./scripts/test-api-comprehensive.sh >> $LOG_FILE
        
        if [ $? -eq 0 ]; then
            echo "$(date): Rolling deployment recovery completed successfully" >> $LOG_FILE
        else
            echo "$(date): Comprehensive tests failed" >> $LOG_FILE
            exit 1
        fi
    else
        echo "$(date): Health check failed (HTTP $HEALTH_CHECK)" >> $LOG_FILE
        exit 1
    fi
else
    echo "$(date): Deployment incomplete - $READY_PODS/$TOTAL_PODS pods ready" >> $LOG_FILE
    exit 1
fi
```

### Option C: Infrastructure Failover

**Use when:** Regional infrastructure failure, major cloud provider issues

```bash
#!/bin/bash
# Infrastructure Failover Recovery Procedure

set -euo pipefail

LOG_FILE="/var/log/api-recovery-failover-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting infrastructure failover recovery" >> $LOG_FILE

# Step 1: Verify primary region failure
echo "$(date): Verifying primary region failure" >> $LOG_FILE
PRIMARY_HEALTH=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api-east.biopoint.com/health" --max-time 10 || echo "000")

echo "$(date): Primary region health: HTTP $PRIMARY_HEALTH" >> $LOG_FILE

if [ "$PRIMARY_HEALTH" != "200" ]; then
    echo "$(date): Primary region confirmed down, initiating failover" >> $LOG_FILE
    
    # Step 2: Activate standby region
echo "$(date): Activating standby region infrastructure" >> $LOG_FILE
    
    # Switch to standby context
    kubectl config use-context biopoint-west
    
    # Scale up standby deployments
    kubectl scale deployment biopoint-api --replicas=5
    kubectl scale deployment biopoint-api-standby --replicas=3
    
    # Step 3: Promote standby database
echo "$(date): Promoting standby database" >> $LOG_FILE
    curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
         -H "Authorization: Bearer ${NEON_API_KEY}" \
         -H "Content-Type: application/json" >> $LOG_FILE
    
    # Step 4: Update DNS for global failover
echo "$(date): Updating DNS for global failover" >> $LOG_FILE
    aws route53 change-resource-record-sets \
        --hosted-zone-id "Z123456789ABC" \
        --change-batch '{
          "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
              "Name": "api.biopoint.com",
              "Type": "CNAME",
              "TTL": 60,
              "ResourceRecords": [{"Value": "api-west.biopoint.com"}]
            }
          }]
        }' >> $LOG_FILE
    
    # Step 5: Verify standby region functionality
echo "$(date): Verifying standby region functionality" >> $LOG_FILE
    sleep 60
    
    # Test database connectivity
    psql "postgresql://biopoint:${DB_PASSWORD}@ep-biopoint-standby.us-west-2.aws.neon.tech/biopoint" \
         -c "SELECT COUNT(*) FROM users;" >> $LOG_FILE
    
    # Test API health
    STANDBY_HEALTH=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api-west.biopoint.com/health" --max-time 30 || echo "000")
    
    if [ "$STANDBY_HEALTH" = "200" ]; then
        echo "$(date): Standby region operational, updating status" >> $LOG_FILE
        
        # Update status page
        curl -X POST "https://status.biopoint.com/incidents" \
             -H "Authorization: Bearer ${STATUSPAGE_API_KEY}" \
             -H "Content-Type: application/json" \
             -d '{
               "incident": {
                 "name": "Service Restored - Standby Region Active",
                 "status": "resolved",
                 "impact": "major",
                 "message": "Service has been restored using standby infrastructure in US-West-2."
               }
             }' >> $LOG_FILE
        
        echo "$(date): Infrastructure failover completed successfully" >> $LOG_FILE
        
        # Start monitoring for primary region recovery
        nohup bash -c 'while true; do
            if curl -f -s -o /dev/null -w "%{http_code}" "https://api-east.biopoint.com/health" --max-time 10 | grep -q "200"; then
                echo "$(date): Primary region recovered, initiating failback"
                /opt/biopoint/scripts/dr-failback-datacenter.sh
                break
            fi
            echo "$(date): Primary region still unavailable"
            sleep 300
done' >> $LOG_FILE 2>&1 &
        
    else
        echo "$(date): Standby region verification failed - CRITICAL" >> $LOG_FILE
        exit 1
    fi
    
else
    echo "$(date): Primary region appears healthy, investigating other causes" >> $LOG_FILE
fi
```

---

## Post-Recovery Procedures

### 1. Functionality Verification

```bash
#!/bin/bash
# Comprehensive API Functionality Verification

set -euo pipefail

LOG_FILE="/var/log/api-functionality-test-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting comprehensive API functionality verification" >> $LOG_FILE

# Test 1: Health Check
echo "$(date): Testing health endpoint" >> $LOG_FILE
HEALTH_STATUS=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "000")
echo "$(date): Health check status: $HEALTH_STATUS" >> $LOG_FILE

# Test 2: Authentication
echo "$(date): Testing authentication" >> $LOG_FILE
AUTH_RESPONSE=$(curl -s -X POST "https://api.biopoint.com/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@biopoint.com","password":"test123"}' \
    -w "\nHTTP_CODE:%{http_code}" || echo "AUTH_FAILED")

echo "$(date): Authentication response: $AUTH_RESPONSE" >> $LOG_FILE

# Extract token if authentication successful
if echo "$AUTH_RESPONSE" | grep -q "HTTP_CODE:200"; then
    TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "$(date): Authentication token obtained" >> $LOG_FILE
    
    # Test 3: User Data Access
    echo "$(date): Testing user data access" >> $LOG_FILE
    USER_DATA_STATUS=$(curl -f -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "https://api.biopoint.com/users/me" || echo "000")
    echo "$(date): User data access status: $USER_DATA_STATUS" >> $LOG_FILE
    
    # Test 4: Biomarker Data
    echo "$(date): Testing biomarker data access" >> $LOG_FILE
    BIOMARKER_STATUS=$(curl -f -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "https://api.biopoint.com/users/me/biomarkers" || echo "000")
    echo "$(date): Biomarker data status: $BIOMARKER_STATUS" >> $LOG_FILE
    
    # Test 5: Lab Results
    echo "$(date): Testing lab results access" >> $LOG_FILE
    LAB_STATUS=$(curl -f -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "https://api.biopoint.com/users/me/lab-results" || echo "000")
    echo "$(date): Lab results status: $LAB_STATUS" >> $LOG_FILE
    
    # Test 6: File Upload Capability
    echo "$(date): Testing file upload capability" >> $LOG_FILE
    UPLOAD_TEST=$(curl -s -X POST "https://api.biopoint.com/upload/presigned-url" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"filename":"test.jpg","contentType":"image/jpeg"}' \
        -w "\nHTTP_CODE:%{http_code}" || echo "UPLOAD_FAILED")
    echo "$(date): Upload test response: $UPLOAD_TEST" >> $LOG_FILE
    
else
    echo "$(date): Authentication failed - cannot proceed with user-specific tests" >> $LOG_FILE
fi

# Test 7: Database Connectivity
echo "$(date): Testing database connectivity" >> $LOG_FILE
DB_TEST=$(curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" -s -X GET "https://api.biopoint.com/health/db" \
    -w "\nHTTP_CODE:%{http_code}" || echo "DB_TEST_FAILED")
echo "$(date): Database connectivity test: $DB_TEST" >> $LOG_FILE

# Test 8: External Dependencies
echo "$(date): Testing external dependencies" >> $LOG_FILE
DEPS_TEST=$(curl -s -X GET "https://api.biopoint.com/health/deps" \
    -w "\nHTTP_CODE:%{http_code}" || echo "DEPS_TEST_FAILED")
echo "$(date): Dependencies test: $DEPS_TEST" >> $LOG_FILE

# Generate functionality report
cat > /incidents/api-functionality-report-$(date +%Y%m%d_%H%M%S).md << EOF
# API Functionality Verification Report

**Date:** $(date)
**Incident ID:** BP-DR-{ID}
**Recovery Method:** {RESTART/DEPLOYMENT/FAILOVER}

## Test Results Summary
- Health Check: $(if [ "$HEALTH_STATUS" = "200" ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- Authentication: $(if echo "$AUTH_RESPONSE" | grep -q "HTTP_CODE:200"; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- User Data Access: $(if [ "$USER_DATA_STATUS" = "200" ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- Biomarker Data: $(if [ "$BIOMARKER_STATUS" = "200" ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- Lab Results: $(if [ "$LAB_STATUS" = "200" ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- File Upload: $(if echo "$UPLOAD_TEST" | grep -q "HTTP_CODE:200"; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- Database Connectivity: $(if echo "$DB_TEST" | grep -q "HTTP_CODE:200"; then echo "✅ PASS"; else echo "❌ FAIL"; fi)
- External Dependencies: $(if echo "$DEPS_TEST" | grep -q "HTTP_CODE:200"; then echo "✅ PASS"; else echo "❌ FAIL"; fi)

## Performance Metrics
$(curl -s -w "\nTotal time: %{time_total}s\nDNS lookup: %{time_namelookup}s\nConnect time: %{time_connect}s\n" -o /dev/null https://api.biopoint.com/health)

## Recommendations
- Monitor API performance for 24 hours
- Review error logs for any anomalies
- Schedule load testing within 1 week
- Update monitoring thresholds if needed
EOF

echo "$(date): Functionality verification completed" >> $LOG_FILE
```

### 2. Performance Monitoring

```bash
#!/bin/bash
# Post-Recovery Performance Monitoring

set -euo pipefail

LOG_FILE="/var/log/api-performance-monitor-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting post-recovery performance monitoring" >> $LOG_FILE

# Monitor for 30 minutes
duration=1800  # 30 minutes in seconds
interval=60    # Check every minute
end_time=$(($(date +%s) + $duration))

echo "$(date): Monitoring for 30 minutes with 1-minute intervals" >> $LOG_FILE

while [ $(date +%s) -lt $end_time ]; do
    timestamp=$(date)
    
    # Check API health
    health_status=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" --max-time 10 || echo "000")
    health_time=$(curl -f -s -o /dev/null -w "%{time_total}" "https://api.biopoint.com/health" --max-time 10 || echo "999")
    
    # Check response time for authenticated endpoint
    auth_time=$(curl -f -s -o /dev/null -w "%{time_total}" \
        -H "Authorization: Bearer ${MONITORING_TOKEN}" \
        "https://api.biopoint.com/users/me" --max-time 10 || echo "999")
    
    # Check pod resource usage
    cpu_usage=$(kubectl top pods -l app=biopoint-api --no-headers | awk '{sum+=$2} END {print sum/NR}' || echo "0")
    memory_usage=$(kubectl top pods -l app=biopoint-api --no-headers | awk '{sum+=$3} END {print sum/NR}' || echo "0")
    
    # Log metrics
    echo "$timestamp,health:$health_status,health_time:$health_time,auth_time:$auth_time,cpu:${cpu_usage}m,memory:${memory_usage}Mi" >> $LOG_FILE
    
    # Check for anomalies
    if [ "$health_status" != "200" ]; then
        echo "$timestamp: ALERT - Health check failed (HTTP $health_status)" >> $LOG_FILE
    fi
    
    if (( $(echo "$health_time > 2.0" | bc -l) )); then
        echo "$timestamp: ALERT - Health check slow (${health_time}s)" >> $LOG_FILE
    fi
    
    if (( $(echo "$auth_time > 1.0" | bc -l) )); then
        echo "$timestamp: ALERT - Auth endpoint slow (${auth_time}s)" >> $LOG_FILE
    fi
    
    sleep $interval
done

echo "$(date): Performance monitoring completed" >> $LOG_FILE

# Generate performance report
echo "$(date): Generating performance report" >> $LOG_FILE

AVG_HEALTH_TIME=$(grep -o "health_time:[0-9.]*" $LOG_FILE | cut -d: -f2 | awk '{sum+=$1; count++} END {print sum/count}')
AVG_AUTH_TIME=$(grep -o "auth_time:[0-9.]*" $LOG_FILE | cut -d: -f2 | awk '{sum+=$1; count++} END {print sum/count}')
MAX_CPU=$(grep -o "cpu:[0-9]*m" $LOG_FILE | cut -d: -f2 | sed 's/m//' | sort -n | tail -1)
MAX_MEMORY=$(grep -o "memory:[0-9]*Mi" $LOG_FILE | cut -d: -f2 | sed 's/Mi//' | sort -n | tail -1)

cat > /incidents/api-performance-report-$(date +%Y%m%d_%H%M%S).md << EOF
# API Performance Monitoring Report

**Monitoring Period:** 30 minutes post-recovery
**Date:** $(date)

## Performance Summary
- **Average Health Check Time:** ${AVG_HEALTH_TIME}s
- **Average Auth Endpoint Time:** ${AVG_AUTH_TIME}s
- **Maximum CPU Usage:** ${MAX_CPU}m
- **Maximum Memory Usage:** ${MAX_MEMORY}Mi

## Health Check Results
$(grep "health:" $LOG_FILE | grep -v "ALERT" | wc -l) successful checks
$(grep "ALERT.*Health check failed" $LOG_FILE | wc -l) failed checks
$(grep "ALERT.*Health check slow" $LOG_FILE | wc -l) slow responses

## Recommendations
$(if (( $(echo "$AVG_HEALTH_TIME > 1.0" | bc -l) )); then echo "- Investigate high health check latency"; fi)
$(if (( $(echo "$AVG_AUTH_TIME > 0.5" | bc -l) )); then echo "- Optimize authentication endpoint performance"; fi)
$(if [ "$MAX_CPU" -gt 400 ]; then echo "- Monitor CPU usage for potential optimization"; fi)
$(if [ "$MAX_MEMORY" -gt 800 ]; then echo "- Monitor memory usage for potential leaks"; fi)

- Continue monitoring for next 24 hours
- Schedule performance optimization review
- Update alerting thresholds based on baseline
EOF
```

---

## Communication Templates

### Internal Status Updates

```markdown
## API Server Recovery Update

**Time:** {TIMESTAMP}
**Status:** {ASSESSMENT/RECOVERY/VERIFICATION}
**ETA:** {ESTIMATED_COMPLETION}

### Current Progress
- Detection: ✅ Completed
- Assessment: {STATUS}
- Recovery: {STATUS}
- Verification: {STATUS}

### Key Metrics
- Recovery Method: {RESTART/DEPLOYMENT/FAILOVER}
- Downtime: {DURATION}
- Users Affected: {COUNT}
- Failed Requests: {COUNT}

### Next Steps
1. {IMMEDIATE_ACTION}
2. {FOLLOWUP_ACTION}
3. {VERIFICATION_ACTION}

### Issues/Concerns
- {ISSUE_1}
- {ISSUE_2}

**Next Update:** {NEXT_UPDATE_TIME}
```

### Customer Communication

```markdown
Subject: BioPoint Service Update - Brief Maintenance

Dear BioPoint User,

We are writing to inform you of a brief service interruption that occurred earlier today.

**What happened:**
We experienced a temporary issue with our API services that affected app functionality for approximately {DURATION}.

**Your data:**
✅ All health data remains secure and encrypted
✅ No PHI was compromised during the incident
✅ All biomarker and lab data is safe
✅ No data loss occurred

**Current status:**
✅ Service is fully restored
✅ All app features are operational
✅ Enhanced monitoring is active

We sincerely apologize for any inconvenience this may have caused. Our systems are now operating normally with improved resilience.

If you have any questions or concerns, please contact us at support@biopoint.com or 1-800-BIOPOINT.

Thank you for your patience and continued trust in BioPoint.

The BioPoint Team
```

---

## Quick Reference

### Emergency Contacts
- **DR Commander:** +1-415-555-0100
- **DevOps Engineer:** +1-415-555-0101
- **Kubernetes Support:** kubernetes-team@biopoint.com
- **Cloud Provider:** AWS Support Console

### Key Commands
```bash
# Check API health
curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health"

# Check pod status
kubectl get pods -l app=biopoint-api -o wide

# Check recent logs
kubectl logs deployment/biopoint-api --tail=100

# Restart deployment
kubectl rollout restart deployment/biopoint-api

# Check resource usage
kubectl top pods -l app=biopoint-api
```

### Decision Matrix
| Scenario | Recovery Method | RTO | Impact |
|----------|----------------|-----|----------|
| Memory exhaustion | Auto restart | 5 min | Minimal |
| Application crash | Rolling deployment | 10 min | Low |
| Regional outage | Infrastructure failover | 15 min | High |
| Dependency failure | Dependency fix | 20 min | Medium |

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** February 2026
- **Owner:** DevOps Engineer
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- DevOps team must review monthly
- Failover drills quarterly
- Load testing exercises annually