# Security Breach Recovery Runbook

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Chief Information Security Officer  
**Review Schedule:** Monthly

---

## Overview

This runbook provides step-by-step procedures for recovering from security breaches affecting BioPoint's healthcare platform. Security breaches can include ransomware attacks, data exfiltration, unauthorized access, or other malicious activities targeting PHI and user data.

**Recovery Objectives:**
- **RTO:** 2 hours
- **RPO:** 24 hours maximum data loss
- **HIPAA Compliance:** Maintain throughout recovery, ensure breach notification requirements are met

---

## Detection Methods

### Primary Detection
- **Security Monitoring:** SIEM alerts for suspicious activities
- **Anomaly Detection:** Unusual data access patterns, large data transfers
- **File Integrity Monitoring:** Unexpected file changes, encryption indicators
- **User Reports:** Users noticing unauthorized access or suspicious behavior

### Secondary Detection
- **Audit Log Analysis:** Failed authentication attempts, privilege escalation
- **Network Monitoring:** Unusual traffic patterns, external connections
- **Performance Monitoring:** System resource exhaustion, service degradation
- **Backup Monitoring:** Backup failures, corrupted backup files

---

## Immediate Response (0-15 minutes)

### 1. Assess Threat Level
```bash
# Check for ransomware indicators
echo "Checking for ransomware indicators..."
find /data -name "*.encrypted" -o -name "*.locked" -o -name "*ransom*" -o -name "*README*" 2>/dev/null | head -10

# Check for unauthorized access
echo "Checking for unauthorized access..."
kubectl logs deployment/biopoint-api --tail=100 | grep -E "(unauthorized|forbidden|access denied)"

# Check for data exfiltration
echo "Checking for data exfiltration indicators..."
kubectl logs deployment/biopoint-api --tail=100 | grep -E "(large.*export|bulk.*download|unusual.*access)"

# Check file system for modifications
echo "Checking for recent file modifications..."
find /apps -type f -mtime -1 -ls | head -20
```

### 2. Isolate Affected Systems
```bash
# Isolate compromised pods
echo "Isolating compromised pods..."
kubectl label pods -l app=biopoint quarantine=true --overwrite
kubectl cordon nodes --selector=compromised=true

# Block suspicious IP addresses
echo "Blocking suspicious IP addresses..."
# Add IPs to security groups/firewall rules
aws ec2 authorize-security-group-ingress \
    --group-id sg-biopoint-api \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region us-east-1

# Disable compromised user accounts
echo "Disabling compromised user accounts..."
psql $DATABASE_URL -c "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE last_login_ip IN ('SUSPICIOUS_IP_1', 'SUSPICIOUS_IP_2');"

# Rotate all active sessions
echo "Rotating all active sessions..."
kubectl set env deployment/biopoint-api JWT_SECRET="$(openssl rand -base64 64)"
```

### 3. Preserve Evidence
```bash
# Create forensic snapshots
echo "Creating forensic snapshots..."
FORENSIC_DB="biopoint_forensic_$(date +%Y%m%d_%H%M%S)"
createdb $FORENSIC_DB
pg_dump $DATABASE_URL | psql $FORENSIC_DB

# Capture system state
echo "Capturing system state..."
kubectl get all -o yaml > /incidents/system-state-$(date +%Y%m%d_%H%M%S).yaml
kubectl describe nodes > /incidents/node-state-$(date +%Y%m%d_%H%M%S).txt

# Capture network traffic (if available)
echo "Capturing network traffic..."
tcpdump -i any -w /incidents/network-capture-$(date +%Y%m%d_%H%M%S).pcap -c 10000 &
TCPDUMP_PID=$!

# Save application logs
echo "Saving application logs..."
kubectl logs --all-namespaces --since=24h > /incidents/all-logs-$(date +%Y%m%d_%H%M%S).log
```

### 4. Notify Security Team
```bash
# Send critical security alert
curl -X POST "https://api.pagerduty.com/integration/${SECURITY_PAGERDUTY_KEY}/enqueue" \
     -H "Content-Type: application/json" \
     -d "{
       \"routing_key\": \"${SECURITY_PAGERDUTY_KEY}\",
       \"event_action\": \"trigger\",
       \"payload\": {
         \"summary\": \"CRITICAL: Security Breach Detected - BioPoint\",
         \"source\": \"security-monitoring\",
         \"severity\": \"critical\",
         \"custom_details\": {
           \"threat_type\": \"{RANSOMWARE/DATA_EXFILTRATION/UNAUTHORIZED_ACCESS}\",
           \"detection_time\": \"$(date)\",
           \"affected_systems\": \"biopoint-api,biopoint-database\",
           \"forensic_db\": \"$FORENSIC_DB\"
         }
       }
     }"

# Notify CISO and legal team
echo "CRITICAL SECURITY INCIDENT - BioPoint" | mail -s "Security Breach Detected $(date)" \
     security@biopoint.com,legal@biopoint.com,ciso@biopoint.com

# Log security incident
echo "$(date): Security breach incident initiated - Evidence preserved in $FORENSIC_DB" >> /var/log/security-incidents.log
```

---

## Assessment Phase (15-30 minutes)

### 1. Determine Breach Type and Scope

```bash
# Check for ransomware encryption
ENCRYPTED_FILES=$(find /data -name "*.encrypted" -o -name "*.locked" -o -name "*encrypted*" 2>/dev/null | wc -l)
echo "Encrypted files found: $ENCRYPTED_FILES"

# Check for ransom notes
RANSOM_NOTES=$(find /data -name "*ransom*" -o -name "*README*" -o -name "*DECRYPT*" -o -name "*HOW_TO_RECOVER*" 2>/dev/null | wc -l)
echo "Ransom notes found: $RANSOM_NOTES"

# Check database for encrypted tables
DB_ENCRYPTED=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_name LIKE '%encrypted%' OR table_name LIKE '%locked%' OR table_name LIKE '%ransom%'")
echo "Potentially encrypted database tables: $DB_ENCRYPTED"

# Check for unauthorized data access
UNAUTHORIZED_ACCESS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM audit_logs 
  WHERE action = 'unauthorized_access' 
  AND created_at > NOW() - INTERVAL '24 hours'")
echo "Unauthorized access attempts: $UNAUTHORIZED_ACCESS"

# Check for large data exports
BULK_EXPORTS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM audit_logs 
  WHERE action IN ('export_data', 'download_bulk') 
  AND created_at > NOW() - INTERVAL '24 hours'")
echo "Bulk data exports: $BULK_EXPORTS"
```

### 2. Identify Attack Vector

```bash
# Check for compromised credentials
echo "Checking for compromised credentials..."
psql $DATABASE_URL -c "
  SELECT user_id, ip_address, COUNT(*) as login_attempts
  FROM audit_logs 
  WHERE action = 'login_failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY user_id, ip_address
  HAVING COUNT(*) > 10
  ORDER BY login_attempts DESC;
"

# Check for privilege escalation
echo "Checking for privilege escalation..."
psql $DATABASE_URL -c "
  SELECT user_id, action, resource, created_at
  FROM audit_logs 
  WHERE action IN ('privilege_escalation', 'role_changed', 'admin_access')
  AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
"

# Check for SQL injection attempts
echo "Checking for SQL injection attempts..."
kubectl logs deployment/biopoint-api --tail=500 | grep -E "(sql.*injection|union.*select|drop.*table|';|\";)"

# Check for file upload exploits
echo "Checking for file upload exploits..."
kubectl logs deployment/biopoint-api --tail=500 | grep -E "(upload.*php|upload.*exe|upload.*sh|../)"
```

### 3. Assess Recovery Options

Based on assessment, determine the most appropriate recovery strategy:

#### **Option A: Clean Recovery from Backups**
- **When to use:** Ransomware attack, widespread system compromise
- **Advantages:** Guaranteed clean state, removes all threats
- **Requirements:** Recent clean backups available
- **Data Loss:** Up to 24 hours (RPO)

#### **Option B: Targeted Threat Removal**
- **When to use:** Limited compromise, specific threats identified
- **Advantages:** Minimal data loss, faster recovery
- **Requirements:** Clear threat identification, forensic capabilities
- **Data Loss:** Minimal

#### **Option C: Systematic Containment**
- **When to use:** Ongoing attack, active threat present
- **Advantages:** Prevents further damage, preserves evidence
- **Requirements:** Immediate threat response capabilities
- **Data Loss:** Variable

---

## Recovery Procedures

### Option A: Clean Recovery from Backups

**Use when:** Ransomware confirmed, widespread encryption, system integrity compromised

```bash
#!/bin/bash
# Clean Recovery from Backups Procedure

set -euo pipefail

LOG_FILE="/var/log/security-clean-recovery-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): INITIATING CLEAN RECOVERY FROM BACKUPS" >> $LOG_FILE

# Step 1: Complete system isolation
echo "$(date): Isolating all systems" >> $LOG_FILE

# Scale down all applications
kubectl scale deployment biopoint-api --replicas=0
kubectl scale deployment biopoint-mobile-backend --replicas=0
kubectl scale statefulset biopoint-database --replicas=0

# Block all external access
aws ec2 revoke-security-group-ingress \
    --group-id sg-biopoint-public \
    --protocol all \
    --cidr 0.0.0.0/0 \
    --region us-east-1

# Step 2: Identify clean backup point
echo "$(date): Identifying clean backup point" >> $LOG_FILE

# Find latest clean backup (24+ hours old to ensure pre-infection)
CLEAN_BACKUP_DATE=$(date -d '48 hours ago' '+%Y%m%d')
CLEAN_BACKUP=$(aws s3 ls s3://biopoint-db-backups/ | grep $CLEAN_BACKUP_DATE | tail -1 | awk '{print $4}')

echo "$(date): Selected clean backup: $CLEAN_BACKUP" >> $LOG_FILE

# Step 3: Create completely isolated recovery environment
echo "$(date): Creating isolated recovery environment" >> $LOG_FILE

# Create new VPC for recovery
RECOVERY_VPC=$(aws ec2 create-vpc --cidr-block 10.1.0.0/16 --query 'Vpc.VpcId' --output text)
echo "$(date): Created recovery VPC: $RECOVERY_VPC" >> $LOG_FILE

# Create isolated subnet
RECOVERY_SUBNET=$(aws ec2 create-subnet --vpc-id $RECOVERY_VPC --cidr-block 10.1.1.0/24 --query 'Subnet.SubnetId' --output text)

# Create recovery database in isolated environment
RECOVERY_DB="biopoint_recovery_clean_$(date +%Y%m%d_%H%M%S)"
createdb $RECOVERY_DB

# Step 4: Restore clean database
echo "$(date): Restoring clean database from backup" >> $LOG_FILE

aws s3 cp s3://biopoint-db-backups/$CLEAN_BACKUP - | pg_restore -d $RECOVERY_DB

# Verify data integrity
echo "$(date): Verifying restored data integrity" >> $LOG_FILE
USER_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM users;")
LAB_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM lab_results;")
PHOTO_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM progress_photos;")

echo "$(date): Restored data counts:" >> $LOG_FILE
echo "  Users: $USER_COUNT" >> $LOG_FILE
echo "  Lab Results: $LAB_COUNT" >> $LOG_FILE
echo "  Progress Photos: $PHOTO_COUNT" >> $LOG_FILE

# Step 5: Restore clean S3 data
echo "$(date): Restoring clean S3 data" >> $LOG_FILE

# Create new clean S3 bucket
RECOVERY_BUCKET="biopoint-uploads-recovery-$(date +%Y%m%d)"
aws s3 mb s3://${RECOVERY_BUCKET} --region us-west-2

# Enable encryption on recovery bucket
aws s3api put-bucket-encryption \
    --bucket ${RECOVERY_BUCKET} \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'

# Sync clean data from backup bucket
aws s3 sync s3://biopoint-uploads-backup/ s3://${RECOVERY_BUCKET}/ --delete

# Step 6: Deploy clean infrastructure
echo "$(date): Deploying clean infrastructure" >> $LOG_FILE

# Generate new encryption keys
NEW_DB_PASSWORD=$(openssl rand -base64 32)
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_API_KEY=$(openssl rand -hex 32)

# Create new Kubernetes cluster for recovery
# (Assumes EKS cluster creation script exists)
./scripts/create-recovery-cluster.sh $RECOVERY_VPC $RECOVERY_SUBNET

# Deploy clean application with new credentials
kubectl create secret generic biopoint-secrets \
    --from-literal=database-url="postgresql://biopoint:${NEW_DB_PASSWORD}@localhost/${RECOVERY_DB}" \
    --from-literal=jwt-secret="${NEW_JWT_SECRET}" \
    --from-literal=api-key="${NEW_API_KEY}"

# Deploy application from clean image
RECOVERY_IMAGE="biopoint/api:clean-$(date +%Y%m%d-%H%M%S)"
kubectl set image deployment/biopoint-api api=${RECOVERY_IMAGE}

# Step 7: Verify clean recovery
echo "$(date): Verifying clean recovery" >> $LOG_FILE

# Test application functionality
sleep 60
HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api-recovery.biopoint.com/health" || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    echo "$(date): Recovery environment health check successful" >> $LOG_FILE
    
    # Run comprehensive security tests
    ./scripts/test-security-post-recovery.sh >> $LOG_FILE
    
    if [ $? -eq 0 ]; then
        echo "$(date): Clean recovery verification successful" >> $LOG_FILE
        
        # Step 8: Plan migration to clean environment
echo "$(date): Planning migration to clean environment" >> $LOG_FILE
        
        # Update DNS to point to recovery environment
        aws route53 change-resource-record-sets \
            --hosted-zone-id "Z123456789ABC" \
            --change-batch '{
              "Changes": [{
                "Action": "UPSERT",
                "ResourceRecordSet": {
                  "Name": "api.biopoint.com",
                  "Type": "CNAME",
                  "TTL": 300,
                  "ResourceRecords": [{"Value": "api-recovery.biopoint.com"}]
                }
              }]
            }' >> $LOG_FILE
        
        echo "$(date): Clean recovery from backups completed successfully" >> $LOG_FILE
        
    else
        echo "$(date): Security verification failed" >> $LOG_FILE
        exit 1
    fi
    
else
    echo "$(date): Recovery environment health check failed" >> $LOG_FILE
    exit 1
fi
```

### Option B: Targeted Threat Removal

**Use when:** Limited compromise, specific threats identified, minimal system impact

```bash
#!/bin/bash
# Targeted Threat Removal Procedure

set -euo pipefail

LOG_FILE="/var/log/security-targeted-removal-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): STARTING TARGETED THREAT REMOVAL" >> $LOG_FILE

# Step 1: Identify specific threats
echo "$(date): Identifying specific threats" >> $LOG_FILE

# Find malicious files
MALICIOUS_FILES=$(find /apps -type f -name "*.php" -o -name "*.exe" -o -name "*.sh" -o -name "*backdoor*" 2>/dev/null)
echo "$(date): Potentially malicious files found:" >> $LOG_FILE
echo "$MALICIOUS_FILES" >> $LOG_FILE

# Find compromised user accounts
COMPROMISED_USERS=$(psql $DATABASE_URL -t -c "
  SELECT DISTINCT user_id 
  FROM audit_logs 
  WHERE action = 'unauthorized_access' 
  AND created_at > NOW() - INTERVAL '24 hours'")

echo "$(date): Compromised user accounts: $COMPROMISED_USERS" >> $LOG_FILE

# Find suspicious IP addresses
SUSPICIOUS_IPS=$(psql $DATABASE_URL -t -c "
  SELECT DISTINCT ip_address, COUNT(*) as attempts
  FROM audit_logs 
  WHERE action = 'login_failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY ip_address
  HAVING COUNT(*) > 20
  ORDER BY attempts DESC")

echo "$(date): Suspicious IP addresses:" >> $LOG_FILE
echo "$SUSPICIOUS_IPS" >> $LOG_FILE

# Step 2: Remove malicious files
echo "$(date): Removing malicious files" >> $LOG_FILE

# Quarantine malicious files
for file in $MALICIOUS_FILES; do
    if [ -f "$file" ]; then
        echo "$(date): Quarantining $file" >> $LOG_FILE
        mkdir -p /quarantine/$(date +%Y%m%d)
        cp "$file" "/quarantine/$(date +%Y%m%d)/$(basename $file).$(date +%H%M%S)"
        rm -f "$file"
    fi
done

# Step 3: Disable compromised accounts
echo "$(date): Disabling compromised accounts" >> $LOG_FILE

for user_id in $COMPROMISED_USERS; do
    if [ -n "$user_id" ]; then
        echo "$(date): Disabling user account: $user_id" >> $LOG_FILE
        psql $DATABASE_URL -c "
            UPDATE users 
            SET status = 'suspended', 
                updated_at = NOW(),
                suspension_reason = 'Security breach - unauthorized access detected'
            WHERE id = '$user_id'"
    fi
done

# Step 4: Block malicious IP addresses
echo "$(date): Blocking malicious IP addresses" >> $LOG_FILE

echo "$SUSPICIOUS_IPS" | while read -r line; do
    IP=$(echo $line | awk '{print $1}')
    if [[ $IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$(date): Blocking IP address: $IP" >> $LOG_FILE
        
        # Add to AWS WAF IP set
        aws wafv2 update-ip-set \
            --name biopoint-blocked-ips \
            --scope REGIONAL \
            --id ${WAF_IP_SET_ID} \
            --addresses $IP \
            --region us-east-1
    fi
done

# Step 5: Patch vulnerabilities
echo "$(date): Patching identified vulnerabilities" >> $LOG_FILE

# Update dependencies
npm audit fix --force

# Apply security patches
kubectl set image deployment/biopoint-api api=biopoint/api:security-patch-$(date +%Y%m%d)

# Update security configurations
kubectl apply -f k8s/security-hardened-config.yaml

# Step 6: Remove persistence mechanisms
echo "$(date): Removing persistence mechanisms" >> $LOG_FILE

# Check for cron jobs
kubectl exec deployment/biopoint-api -- crontab -l | grep -v "^#" || echo "No cron jobs found"

# Check for startup scripts
kubectl exec deployment/biopoint-api -- find /etc /root -name "*rc" -o -name "*profile" -o -name "*startup*" | xargs grep -l "backdoor\|malicious" 2>/dev/null || echo "No suspicious startup scripts"

# Step 7: Verify threat removal
echo "$(date): Verifying threat removal" >> $LOG_FILE

# Check for remaining malicious files
REMAINING_MALICIOUS=$(find /apps -type f -name "*.php" -o -name "*.exe" -o -name "*.sh" -o -name "*backdoor*" 2>/dev/null | wc -l)
echo "$(date): Remaining malicious files: $REMAINING_MALICIOUS" >> $LOG_FILE

# Test system functionality
HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "000")
echo "$(date): System health check: $HEALTH_CHECK" >> $LOG_FILE

# Run security validation
./scripts/validate-security-post-removal.sh >> $LOG_FILE

if [ "$REMAINING_MALICIOUS" -eq 0 ] && [ "$HEALTH_CHECK" = "200" ]; then
    echo "$(date): Targeted threat removal completed successfully" >> $LOG_FILE
else
    echo "$(date): Threat removal incomplete - remaining issues detected" >> $LOG_FILE
    exit 1
fi
```

### Option C: Systematic Containment

**Use when:** Active attack in progress, ongoing threat, need immediate containment

```bash
#!/bin/bash
# Systematic Containment Procedure

set -euo pipefail

LOG_FILE="/var/log/security-containment-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): INITIATING SYSTEMATIC THREAT CONTAINMENT" >> $LOG_FILE

# Step 1: Immediate network isolation
echo "$(date): Isolating network access" >> $LOG_FILE

# Block all external ingress
aws ec2 revoke-security-group-ingress \
    --group-id sg-biopoint-public \
    --protocol all \
    --cidr 0.0.0.0/0 \
    --region us-east-1

# Allow only management access
aws ec2 authorize-security-group-ingress \
    --group-id sg-biopoint-public \
    --protocol tcp \
    --port 22 \
    --cidr 10.0.0.0/8 \
    --region us-east-1

# Step 2: Disable all user access
echo "$(date): Disabling all user access" >> $LOG_FILE

# Revoke all JWT tokens
NEW_JWT_SECRET=$(openssl rand -base64 64)
kubectl set env deployment/biopoint-api JWT_SECRET="$NEW_JWT_SECRET"

# Disable all user accounts temporarily
psql $DATABASE_URL -c "
    UPDATE users 
    SET status = 'suspended', 
        suspension_reason = 'Emergency security containment',
        updated_at = NOW()
    WHERE status = 'active'"

# Step 3: Isolate critical systems
echo "$(date): Isolating critical systems" >> $LOG_FILE

# Move database to isolated subnet
kubectl patch service biopoint-database-service -p '{"spec":{"type":"ClusterIP"}}'

# Disable all non-essential services
kubectl scale deployment biopoint-mobile-backend --replicas=0
kubectl scale deployment biopoint-cronjobs --replicas=0

# Step 4: Enable enhanced monitoring
echo "$(date): Enabling enhanced monitoring" >> $LOG_FILE

# Enable detailed audit logging
kubectl set env deployment/biopoint-api AUDIT_LEVEL="debug" LOG_LEVEL="trace"

# Enable network flow logging
aws ec2 create-flow-logs \
    --resource-type VPC \
    --resource-ids ${VPC_ID} \
    --traffic-type ALL \
    --log-destination-type s3 \
    --log-destination arn:aws:s3:::biopoint-security-logs/

# Step 5: Deploy honeypot systems
echo "$(date): Deploying honeypot systems" >> $LOG_FILE

# Create honeypot services
kubectl apply -f k8s/honeypot-deployment.yaml

# Create fake sensitive data to attract attackers
kubectl create configmap honeypot-data \
    --from-literal=fake-users.csv="admin,password123\nuser,letmein" \
    --from-literal=fake-database.sql="SELECT * FROM credit_cards;"

# Step 6: Gather threat intelligence
echo "$(date): Gathering threat intelligence" >> $LOG_FILE

# Capture real-time network traffic
tcpdump -i any -w /incidents/containment-traffic-$(date +%Y%m%d_%H%M%S).pcap &
TCPDUMP_PID=$!

# Monitor active connections
netstat -tulpn > /incidents/active-connections-$(date +%Y%m%d_%H%M%S).txt

# Check for active threats
kubectl exec deployment/biopoint-api -- ps aux | grep -E "(nc|netcat|python|perl|ruby)" | grep -v grep || echo "No suspicious processes found"

# Step 7: Prepare for threat elimination
echo "$(date): Preparing for threat elimination" >> $LOG_FILE

# Identify threat indicators
THREAT_INDICATORS=$(kubectl logs --all-namespaces --since=1h | grep -E "(malware|backdoor|exploit|payload)" | wc -l)
echo "$(date): Threat indicators found: $THREAT_INDICATORS" >> $LOG_FILE

# Create clean recovery environment
RECOVERY_NAMESPACE="security-recovery-$(date +%Y%m%d)"
kubectl create namespace $RECOVERY_NAMESPACE

# Prepare clean infrastructure
./scripts/prepare-clean-infrastructure.sh >> $LOG_FILE

echo "$(date): Systematic containment completed" >> $LOG_FILE
echo "$(date): Ready for threat elimination phase" >> $LOG_FILE

# Keep monitoring running
nohup bash -c 'while true; do
    echo "$(date): Containment monitoring active"
    # Add monitoring commands here
    sleep 300
done' >> $LOG_FILE 2>&1 &
```

---

## Post-Recovery Procedures

### 1. Security Verification

```bash
#!/bin/bash
# Comprehensive Security Verification

set -euo pipefail

LOG_FILE="/var/log/security-verification-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting comprehensive security verification" >> $LOG_FILE

# Test 1: Authentication security
echo "$(date): Testing authentication security" >> $LOG_FILE

# Test brute force protection
for i in {1..10}; do
    curl -s -X POST "https://api.biopoint.com/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@biopoint.com","password":"wrongpassword"}' \
        -w "\nHTTP_CODE:%{http_code}" > /tmp/auth-test-$i.txt
done

RATE_LIMIT_VIOLATIONS=$(grep "HTTP_CODE:429" /tmp/auth-test-*.txt | wc -l)
echo "$(date): Rate limit violations: $RATE_LIMIT_VIOLATIONS" >> $LOG_FILE

# Test 2: Data encryption verification
echo "$(date): Verifying data encryption" >> $LOG_FILE

# Check database encryption
DB_ENCRYPTION=$(psql $DATABASE_URL -t -c "SHOW ssl;")
echo "$(date): Database encryption: $DB_ENCRYPTION" >> $LOG_FILE

# Check file storage encryption
S3_ENCRYPTION=$(aws s3api get-bucket-encryption --bucket biopoint-uploads --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null || echo "NOT_CONFIGURED")
echo "$(date): S3 encryption: $S3_ENCRYPTION" >> $LOG_FILE

# Test 3: Access control verification
echo "$(date): Verifying access controls" >> $LOG_FILE

# Test role-based access
ACCESS_TEST=$(curl -s -H "Authorization: Bearer ${TEST_USER_TOKEN}" \
    "https://api.biopoint.com/admin/users" \
    -w "\nHTTP_CODE:%{http_code}")

if echo "$ACCESS_TEST" | grep -q "HTTP_CODE:403"; then
    echo "$(date): Access controls working correctly" >> $LOG_FILE
else
    echo "$(date): WARNING: Access controls may be compromised" >> $LOG_FILE
fi

# Test 4: Audit logging verification
echo "$(date): Verifying audit logging" >> $LOG_FILE

# Generate test audit events
curl -s -H "Authorization: Bearer ${TEST_TOKEN}" \
    "https://api.biopoint.com/users/me" > /dev/null

# Check if audit events are being logged
AUDIT_EVENTS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) FROM audit_logs 
  WHERE user_id = 'test-user-id' 
  AND created_at > NOW() - INTERVAL '5 minutes'")

echo "$(date): Recent audit events: $AUDIT_EVENTS" >> $LOG_FILE

# Test 5: Network security
echo "$(date): Testing network security" >> $LOG_FILE

# Check for open ports
OPEN_PORTS=$(nmap -p 1-65535 api.biopoint.com | grep "open" | wc -l)
echo "$(date): Open ports detected: $OPEN_PORTS" >> $LOG_FILE

# Check SSL/TLS configuration
SSL_TEST=$(curl -s -I "https://api.biopoint.com" | grep -i "strict-transport-security")
if [ -n "$SSL_TEST" ]; then
    echo "$(date): HSTS header present" >> $LOG_FILE
else
    echo "$(date): WARNING: HSTS header missing" >> $LOG_FILE
fi

# Generate security verification report
cat > /incidents/security-verification-report-$(date +%Y%m%d_%H%M%S).md << EOF
# Security Verification Report

**Date:** $(date)
**Incident ID:** BP-DR-{ID}
**Recovery Method:** {CLEAN_BACKUP/TARGETED_REMOVAL/CONTAINMENT}

## Verification Results
- **Rate Limiting:** $(if [ "$RATE_LIMIT_VIOLATIONS" -lt 5 ]; then echo "✅ WORKING"; else echo "❌ COMPROMISED"; fi)
- **Database Encryption:** $(if echo "$DB_ENCRYPTION" | grep -q "on"; then echo "✅ ENABLED"; else echo "❌ DISABLED"; fi)
- **File Storage Encryption:** $(if [ "$S3_ENCRYPTION" != "NOT_CONFIGURED" ]; then echo "✅ $S3_ENCRYPTION"; else echo "❌ NOT_CONFIGURED"; fi)
- **Access Controls:** $(if echo "$ACCESS_TEST" | grep -q "403"; then echo "✅ WORKING"; else echo "⚠️ CHECK_NEEDED"; fi)
- **Audit Logging:** $(if [ "$AUDIT_EVENTS" -gt 0 ]; then echo "✅ ACTIVE"; else echo "❌ INACTIVE"; fi)
- **Network Security:** $(if [ "$OPEN_PORTS" -lt 10 ]; then echo "✅ SECURE"; else echo "⚠️ REVIEW_NEEDED"; fi)

## Vulnerability Assessment
**Overall Status:** $(if [ "$RATE_LIMIT_VIOLATIONS" -lt 5 ] && echo "$DB_ENCRYPTION" | grep -q "on" && [ "$AUDIT_EVENTS" -gt 0 ]; then echo "✅ SECURE"; else echo "⚠️ ISSUES_FOUND"; fi)

## Recommendations
$(if [ "$RATE_LIMIT_VIOLATIONS" -ge 5 ]; then echo "- Review rate limiting configuration"; fi)
$(if ! echo "$DB_ENCRYPTION" | grep -q "on"; then echo "- Enable database encryption"; fi)
$(if [ "$S3_ENCRYPTION" = "NOT_CONFIGURED" ]; then echo "- Configure S3 bucket encryption"; fi)
$(if [ "$AUDIT_EVENTS" -eq 0 ]; then echo "- Verify audit logging is active"; fi)
$(if [ "$OPEN_PORTS" -ge 10 ]; then echo "- Review network security configuration"; fi)

- Continue security monitoring for 48 hours
- Schedule penetration testing within 30 days
- Update incident response procedures
EOF

echo "$(date): Security verification completed" >> $LOG_FILE
```

### 2. HIPAA Breach Assessment

```bash
#!/bin/bash
# HIPAA Breach Assessment and Notification

set -euo pipefail

LOG_FILE="/var/log/hipaa-breach-assessment-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting HIPAA breach assessment" >> $LOG_FILE

# Step 1: Assess scope of PHI exposure
echo "$(date): Assessing PHI exposure scope" >> $LOG_FILE

# Count affected users
AFFECTED_USERS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(DISTINCT user_id) 
  FROM audit_logs 
  WHERE action IN ('unauthorized_access', 'data_exfiltration', 'privilege_escalation')
  AND created_at > NOW() - INTERVAL '24 hours'")

echo "$(date): Users potentially affected: $AFFECTED_USERS" >> $LOG_FILE

# Identify types of PHI accessed
PHI_TYPES=$(psql $DATABASE_URL -t -c "
  SELECT DISTINCT resource_type
  FROM audit_logs 
  WHERE action = 'unauthorized_access'
  AND resource_type IN ('user_profile', 'lab_result', 'progress_photo', 'biomarker')
  AND created_at > NOW() - INTERVAL '24 hours'")

echo "$(date]: Types of PHI accessed: $PHI_TYPES" >> $LOG_FILE

# Step 2: Risk assessment per HIPAA requirements
echo "$(date): Conducting HIPAA risk assessment" >> $LOG_FILE

# Nature and extent of PHI (45 CFR §164.402)
PHI_EXTENT=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*) as records_accessed
  FROM audit_logs 
  WHERE action = 'unauthorized_access'
  AND created_at > NOW() - INTERVAL '24 hours'")

echo "$(date]: PHI records accessed: $PHI_EXTENT" >> $LOG_FILE

# Likelihood of re-identification
REIDENTIFICATION_RISK="MEDIUM"  # Assessment based on types of identifiers accessed
if echo "$PHI_TYPES" | grep -q "user_profile"; then
    REIDENTIFICATION_RISK="HIGH"
fi

# Unauthorized recipient assessment
RECIPIENT_RISK="UNKNOWN"  # External attacker

# Mitigation effectiveness
MITIGATION_EFFECTIVENESS="HIGH"  # Quick detection and response

# Step 3: Determine notification requirements
echo "$(date): Determining notification requirements" >> $LOG_FILE

if [ "$AFFECTED_USERS" -lt 500 ]; then
    NOTIFICATION_TYPE="STANDARD"
    HHS_DEADLINE="60 days"
    MEDIA_NOTIFICATION="NOT_REQUIRED"
else
    NOTIFICATION_TYPE="MAJOR"
    HHS_DEADLINE="60 days"
    MEDIA_NOTIFICATION="REQUIRED"
fi

echo "$(date): Notification type: $NOTIFICATION_TYPE" >> $LOG_FILE

# Step 4: Generate breach notification letters
echo "$(date): Generating breach notification letters" >> $LOG_FILE

cat > /incidents/individual-notification-template-$(date +%Y%m%d_%H%M%S).md << EOF
# Individual Breach Notification Template

**Date:** $(date)
**Incident ID:** BP-DR-{ID}

Dear [USER_NAME],

We are writing to inform you of a data security incident that may have affected some of your personal health information maintained by BioPoint.

**WHAT HAPPENED:**
On [DISCOVERY_DATE], we discovered that [BRIEF_DESCRIPTION_OF_INCIDENT]. We immediately took action to secure our systems and investigate the incident.

**INFORMATION INVOLVED:**
The information that may have been affected includes [SPECIFIC_PHI_TYPES], such as [EXAMPLES].

**WHAT WE ARE DOING:**
We took immediate steps to [MITIGATION_ACTIONS]. We have also [SECURITY_IMPROVEMENTS]. We are working with cybersecurity experts and have reported this incident to the appropriate authorities.

**WHAT YOU SHOULD DO:**
While we have no evidence that your information has been misused, we recommend that you:
1. Monitor your accounts for any unusual activity
2. Contact us immediately if you notice anything suspicious
3. Consider placing a fraud alert on your credit reports
4. Keep this notice for your records

We sincerely apologize for this incident and any inconvenience it may cause.

If you have questions, please contact us at:
Phone: 1-800-BIOPOINT (1-800-246-7646)
Email: privacy@biopoint.com
Address: BioPoint Privacy Office, 123 Healthcare Ave, Suite 100, San Francisco, CA 94105

Sincerely,
BioPoint Privacy Team

Reference: Incident BP-DR-{ID}
EOF

# Step 5: Generate HHS OCR notification
cat > /incidents/hhs-ocr-notification-$(date +%Y%m%d_%H%M%S).md << EOF
# HHS OCR Breach Notification

**Covered Entity:** BioPoint Inc.
**Address:** 123 Healthcare Ave, Suite 100, San Francisco, CA 94105
**Phone:** 1-800-246-7646
**Contact:** Chief Privacy Officer

**Breach Information:**
- Date of Breach: [BREACH_DATE]
- Date of Discovery: [DISCOVERY_DATE]
- Number of Individuals Affected: $AFFECTED_USERS

**Types of PHI Involved:**
$(echo "$PHI_TYPES" | sed 's/^/- /')

**Circumstances of Breach:**
[DETAILED_DESCRIPTION]

**Mitigation Efforts:**
[DETAILED_MITIGATION_STEPS]

**Risk Assessment:**
- Risk Level: $REIDENTIFICATION_RISK
- Re-identification Risk: $REIDENTIFICATION_RISK
- Recipient Risk: $RECIPIENT_RISK
- Mitigation Effectiveness: $MITIGATION_EFFECTIVENESS

**Notification Status:**
- Individual Notifications: $(if [ "$AFFECTED_USERS" -gt 0 ]; then echo "IN_PROGRESS"; else echo "NOT_REQUIRED"; fi)
- HHS OCR Notification: SUBMITTED
- Media Notification: $MEDIA_NOTIFICATION
EOF

echo "$(date): HIPAA breach assessment completed" >> $LOG_FILE
```

---

## Communication Templates

### Internal Security Alert

```markdown
🚨 CRITICAL SECURITY INCIDENT 🚨

**Incident ID:** BP-DR-{ID}
**Classification:** P0 - CRITICAL
**Time Detected:** {TIMESTAMP}
**Threat Type:** {RANSOMWARE/DATA_EXFILTRATION/UNAUTHORIZED_ACCESS}

**IMMEDIATE ACTIONS REQUIRED:**
1. All security team members report to incident bridge
2. Isolate affected systems immediately
3. Preserve all evidence
4. Prepare for regulatory notifications

**Current Status:**
- Systems Affected: {AFFECTED_SYSTEMS}
- Data at Risk: {PHI_TYPES}
- Users Affected: {COUNT}
- Containment: {STATUS}

**Next Steps:**
1. Complete threat assessment
2. Implement containment measures
3. Begin recovery procedures
4. Prepare breach notifications

**Emergency Contacts:**
- Incident Commander: +1-415-555-0100
- Security Team: +1-415-555-0107
- Legal Counsel: +1-415-555-0103

This is a HIPAA-critical incident requiring immediate response.
```

### Customer Breach Notification

```markdown
Subject: Important Security Notice - BioPoint Account

Dear [USER_NAME],

We are writing to inform you of a data security incident that may have affected some of your personal health information maintained by BioPoint.

**WHAT HAPPENED:**
On [DISCOVERY_DATE], we discovered that [BRIEF_DESCRIPTION_OF_INCIDENT]. We immediately took action to secure our systems and investigate the incident.

**INFORMATION INVOLVED:**
The information that may have been affected includes [SPECIFIC_PHI_TYPES], such as [EXAMPLES].

**WHAT WE ARE DOING:**
We took immediate steps to [MITIGATION_ACTIONS]. We have also [SECURITY_IMPROVEMENTS]. We are working with cybersecurity experts and have reported this incident to the appropriate authorities.

**WHAT YOU SHOULD DO:**
While we have no evidence that your information has been misused, we recommend that you:
1. Monitor your accounts for any unusual activity
2. Contact us immediately if you notice anything suspicious
3. Consider placing a fraud alert on your credit reports
4. Keep this notice for your records

We sincerely apologize for this incident and any inconvenience it may cause.

If you have questions, please contact us at:
Phone: 1-800-BIOPOINT (1-800-246-7646)
Email: privacy@biopoint.com
Address: BioPoint Privacy Office, 123 Healthcare Ave, Suite 100, San Francisco, CA 94105

Sincerely,
BioPoint Privacy Team

Reference: Incident BP-DR-{ID}
```

### Regulatory Notification

```markdown
**CONFIDENTIAL - HIPAA BREACH NOTIFICATION**

**TO:** HHS Office for Civil Rights
**FROM:** BioPoint Inc.
**DATE:** [CURRENT_DATE]
**RE:** Security Incident Notification - Incident BP-DR-{ID}

**COVERED ENTITY INFORMATION:**
- Name: BioPoint Inc.
- Address: 123 Healthcare Ave, Suite 100, San Francisco, CA 94105
- Phone: 1-800-246-7646
- Contact: Chief Privacy Officer

**BREACH INFORMATION:**
- Date of Breach: [BREACH_DATE]
- Date of Discovery: [DISCOVERY_DATE]
- Number of Individuals Affected: [COUNT]

**CIRCUMSTANCES OF BREACH:**
[DETAILED_DESCRIPTION]

**TYPES OF PHI INVOLVED:**
[COMPREHENSIVE_LIST]

**MITIGATION EFFORTS:**
[DETAILED_MITIGATION_STEPS]

**RISK ASSESSMENT:**
[COMPREHENSIVE_RISK_ANALYSIS]

**NOTIFICATION STATUS:**
- Individual Notifications: [STATUS]
- Media Notification: [STATUS]
- Documentation: Complete and available for review

Contact for additional information:
privacy@biopoint.com | 1-800-246-7646
```

---

## Quick Reference

### Emergency Contacts
- **Incident Commander:** +1-415-555-0100
- **Security Team:** +1-415-555-0107
- **Legal Counsel:** +1-415-555-0103
- **HIPAA Counsel:** Harris, Wiltshire & Grannis LLP
- **Cyber Insurance:** +1-800-456-1234
- **FBI IC3:** https://www.ic3.gov/

### Key Commands
```bash
# Isolate systems
kubectl scale deployment biopoint-api --replicas=0

# Create forensic snapshot
createdb biopoint_forensic_$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | psql biopoint_forensic_$(date +%Y%m%d_%H%M%S)

# Check for encrypted files
find /data -name "*.encrypted" -o -name "*.locked" 2>/dev/null

# Block IP address
aws wafv2 update-ip-set --name biopoint-blocked-ips --scope REGIONAL

# Rotate JWT secret
kubectl set env deployment/biopoint-api JWT_SECRET="$(openssl rand -base64 64)"
```

### Decision Matrix
| Scenario | Recovery Method | RTO | Data Loss | Notifications |
|----------|----------------|-----|-----------|---------------|
| Ransomware | Clean backup | 2h | 24h | Required |
| Data exfiltration | Targeted removal | 1h | Minimal | Required |
| Unauthorized access | Containment | 30m | None | Risk-based |
| Active attack | Containment | Variable | Variable | Required |

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** February 2026
- **Owner:** Chief Information Security Officer
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- Security team must review monthly
- Tabletop exercises quarterly
- Full-scale simulation annually
- Legal team coordination training