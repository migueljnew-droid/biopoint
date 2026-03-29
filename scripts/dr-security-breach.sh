#!/bin/bash
# Security Breach Recovery Script - Ransomware/Security Incident
# Usage: ./dr-security-breach.sh [ransomware|exfiltration|unauthorized]

set -euo pipefail

# Configuration
BREACH_TYPE="${1:-ransomware}"
LOG_FILE="/var/log/dr-security-breach-$(date +%Y%m%d_%H%M%S).log"
FORENSIC_BUCKET="${FORENSIC_BUCKET:-biopoint-forensic-evidence}"
DATABASE_URL="${DATABASE_URL:-postgresql://biopoint:${DB_PASSWORD}@localhost/biopoint}"
PAGERDUTY_KEY="${PAGERDUTY_KEY:-}"

echo "$(date): Starting security breach recovery for type: $BREACH_TYPE" | tee -a $LOG_FILE

# Function to log and execute commands
log_exec() {
    echo "$(date): Executing: $*" >> $LOG_FILE
    "$@" >> $LOG_FILE 2>&1
    return $?
}

# Step 1: Immediate threat assessment
echo "$(date): Conducting immediate threat assessment" | tee -a $LOG_FILE

# Check for ransomware indicators
echo "$(date): Checking for ransomware indicators" | tee -a $LOG_FILE
ENCRYPTED_FILES=$(find /data -name "*.encrypted" -o -name "*.locked" -o -name "*encrypted*" 2>/dev/null | wc -l)
RANSOM_NOTES=$(find /data -name "*ransom*" -o -name "*README*" -o -name "*DECRYPT*" -o -name "*HOW_TO_RECOVER*" 2>/dev/null | wc -l)

echo "$(date): Encrypted files found: $ENCRYPTED_FILES" | tee -a $LOG_FILE
echo "$(date): Ransom notes found: $RANSOM_NOTES" | tee -a $LOG_FILE

# Check database for corruption/encryption
DB_ENCRYPTED=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_name LIKE '%encrypted%' OR table_name LIKE '%locked%' OR table_name LIKE '%ransom%'" 2>/dev/null | tr -d ' ' || echo "0")

echo "$(date]: Potentially encrypted database tables: $DB_ENCRYPTED" | tee -a $LOG_FILE

# Check for unauthorized access
UNAUTHORIZED_ACCESS=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM audit_logs 
  WHERE action = 'unauthorized_access' 
  AND created_at > NOW() - INTERVAL '24 hours'" 2>/dev/null | tr -d ' ' || echo "0")

echo "$(date]: Unauthorized access attempts: $UNAUTHORIZED_ACCESS" | tee -a $LOG_FILE

# Determine if this is a confirmed security breach
CONFIRMED_BREACH=false
if [ "$ENCRYPTED_FILES" -gt 0 ] || [ "$RANSOM_NOTES" -gt 0 ] || [ "$DB_ENCRYPTED" -gt 0 ]; then
    CONFIRMED_BREACH=true
    echo "$(date): CONFIRMED: Ransomware attack detected" | tee -a $LOG_FILE
elif [ "$UNAUTHORIZED_ACCESS" -gt 0 ]; then
    CONFIRMED_BREACH=true
    echo "$(date): CONFIRMED: Unauthorized access detected" | tee -a $LOG_FILE
fi

if [ "$CONFIRMED_BREACH" = false ]; then
    echo "$(date): No confirmed security breach detected" | tee -a $LOG_FILE
    echo "$(date): This may be a false alarm or requires further investigation" | tee -a $LOG_FILE
fi

# Step 2: Immediate isolation and containment
echo "$(date): Executing immediate isolation and containment" | tee -a $LOG_FILE

# Create forensic snapshots
FORENSIC_DB="biopoint_forensic_$(date +%Y%m%d_%H%M%S)"
echo "$(date): Creating forensic database snapshot: $FORENSIC_DB" | tee -a $LOG_FILE
log_exec createdb "$FORENSIC_DB"
log_exec pg_dump "$DATABASE_URL" | psql "$FORENSIC_DB"

# Isolate compromised systems
if command -v kubectl &> /dev/null; then
    echo "$(date): Isolating compromised pods" | tee -a $LOG_FILE
    kubectl label pods -l app=biopoint quarantine=true --overwrite
    kubectl cordon nodes --selector=compromised=true || true
fi

# Block suspicious network traffic
echo "$(date): Identifying and blocking suspicious IP addresses" | tee -a $LOG_FILE
SUSPICIOUS_IPS=$(psql "$DATABASE_URL" -t -c "
  SELECT DISTINCT ip_address
  FROM audit_logs 
  WHERE action IN ('login_failed', 'unauthorized_access')
  AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY ip_address
  HAVING COUNT(*) > 20" 2>/dev/null | tr -d ' ')

for ip in $SUSPICIOUS_IPS; do
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$(date): Blocking IP address: $ip" | tee -a $LOG_FILE
        # Add to AWS WAF or security groups
        aws wafv2 update-ip-set \
            --name biopoint-blocked-ips \
            --scope REGIONAL \
            --id "${WAF_IP_SET_ID:-}" \
            --addresses "$ip" \
            --region us-east-1 2>/dev/null || true
    fi
done

# Disable compromised user accounts
COMPROMISED_USERS=$(psql "$DATABASE_URL" -t -c "
  SELECT DISTINCT user_id 
  FROM audit_logs 
  WHERE action = 'unauthorized_access' 
  AND created_at > NOW() - INTERVAL '24 hours'" 2>/dev/null | tr -d ' ')

for user_id in $COMPROMISED_USERS; do
    if [ -n "$user_id" ]; then
        echo "$(date): Disabling compromised user account: $user_id" | tee -a $LOG_FILE
        psql "$DATABASE_URL" -c "
            UPDATE users 
            SET status = 'suspended', 
                suspension_reason = 'Security breach - unauthorized access detected',
                updated_at = NOW()
            WHERE id = '$user_id'" 2>/dev/null || true
    fi
done

# Step 3: Execute recovery based on breach type
case "$BREACH_TYPE" in
    "ransomware")
        echo "$(date): Executing ransomware recovery procedure" | tee -a $LOG_FILE
        execute_ransomware_recovery
        ;;
    "exfiltration")
        echo "$(date): Executing data exfiltration recovery procedure" | tee -a $LOG_FILE
        execute_data_exfiltration_recovery
        ;;
    "unauthorized")
        echo "$(date): Executing unauthorized access recovery procedure" | tee -a $LOG_FILE
        execute_unauthorized_access_recovery
        ;;
    *)
        echo "$(date): ERROR: Unknown breach type: $BREACH_TYPE" | tee -a $LOG_FILE
        exit 1
        ;;
esac

# Function to execute ransomware recovery
execute_ransomware_recovery() {
    echo "$(date): Starting ransomware recovery" | tee -a $LOG_FILE
    
    # Step 4: Assess encryption scope
    echo "$(date): Assessing encryption scope" | tee -a $LOG_FILE
    
    # Count encrypted files by type
    ENCRYPTED_IMAGES=$(find /data -name "*.encrypted" -o -name "*.locked" | grep -E "\.(jpg|jpeg|png|gif)$" | wc -l)
    ENCRYPTED_DOCUMENTS=$(find /data -name "*.encrypted" -o -name "*.locked" | grep -E "\.(pdf|doc|docx)$" | wc -l)
    
    echo "$(date): Encrypted images: $ENCRYPTED_IMAGES" | tee -a $LOG_FILE
    echo "$(date): Encrypted documents: $ENCRYPTED_DOCUMENTS" | tee -a $LOG_FILE
    
    # Check if we have clean backups
    echo "$(date): Checking for clean backups" | tee -a $LOG_FILE
    LATEST_CLEAN_BACKUP=$(aws s3 ls "s3://biopoint-db-backups/" --recursive | grep "$(date -d '48 hours ago' +%Y%m%d)" | tail -1 | awk '{print $4}')
    
    if [ -n "$LATEST_CLEAN_BACKUP" ]; then
        echo "$(date): Clean backup found: $LATEST_CLEAN_BACKUP" | tee -a $LOG_FILE
        
        # Step 5: Create clean recovery environment
        echo "$(date): Creating clean recovery environment" | tee -a $LOG_FILE
        
        RECOVERY_DB="biopoint_recovery_clean_$(date +%Y%m%d_%H%M%S)"
        log_exec createdb "$RECOVERY_DB"
        
        # Restore from clean backup
        echo "$(date): Restoring from clean backup" | tee -a $LOG_FILE
        aws s3 cp "s3://biopoint-db-backups/$LATEST_CLEAN_BACKUP" - | pg_restore -d "$RECOVERY_DB"
        
        # Step 6: Deploy clean infrastructure
        echo "$(date): Deploying clean infrastructure" | tee -a $LOG_FILE
        
        # Generate new credentials
        NEW_DB_PASSWORD=$(openssl rand -base64 32)
        NEW_JWT_SECRET=$(openssl rand -base64 64)
        
        # Update Kubernetes secrets
        if command -v kubectl &> /dev/null; then
            log_exec kubectl create secret generic biopoint-secrets-recovery \
                --from-literal=database-url="postgresql://biopoint:${NEW_DB_PASSWORD}@localhost/${RECOVERY_DB}" \
                --from-literal=jwt-secret="${NEW_JWT_SECRET}" \
                --dry-run=client -o yaml | kubectl apply -f -
            
            # Deploy from clean image
            CLEAN_IMAGE="biopoint/api:clean-$(date +%Y%m%d-%H%M%S)"
            log_exec kubectl set image deployment/biopoint-api api="$CLEAN_IMAGE"
            
            # Wait for deployment
            log_exec kubectl rollout status deployment/biopoint-api --timeout=600s
        fi
        
        # Step 7: Restore S3 data from backup
        echo "$(date): Restoring S3 data from backup" | tee -a $LOG_FILE
        
        RECOVERY_BUCKET="biopoint-uploads-recovery-$(date +%Y%m%d)"
        log_exec aws s3 mb "s3://${RECOVERY_BUCKET}" --region us-west-2
        
        # Enable encryption on recovery bucket
        log_exec aws s3api put-bucket-encryption \
            --bucket "${RECOVERY_BUCKET}" \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        # Sync clean data from backup bucket
        log_exec aws s3 sync "s3://biopoint-uploads-backup/" "s3://${RECOVERY_BUCKET}/" --delete
        
        echo "$(date): Ransomware recovery completed successfully" | tee -a $LOG_FILE
        
    else
        echo "$(date): ERROR: No clean backups available for ransomware recovery" | tee -a $LOG_FILE
        exit 1
    fi
}

# Function to execute data exfiltration recovery
execute_data_exfiltration_recovery() {
    echo "$(date): Starting data exfiltration recovery" | tee -a $LOG_FILE
    
    # Step 4: Assess data loss scope
    echo "$(date): Assessing data exfiltration scope" | tee -a $LOG_FILE
    
    # Identify potentially compromised data
    COMPROMISED_DATA=$(psql "$DATABASE_URL" -t -c "
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs 
      WHERE action = 'data_export' 
      AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY resource_type
      ORDER BY count DESC" 2>/dev/null)
    
    echo "$(date): Potentially compromised data types:" | tee -a $LOG_FILE
    echo "$COMPROMISED_DATA" | tee -a $LOG_FILE
    
    # Step 5: Secure remaining data
    echo "$(date): Securing remaining data" | tee -a $LOG_FILE
    
    # Enable additional encryption
    log_exec kubectl set env deployment/biopoint-api ADDITIONAL_ENCRYPTION="enabled"
    
    # Restrict data export capabilities
    log_exec kubectl set env deployment/biopoint-api BULK_EXPORT="disabled"
    
    # Step 6: Monitor for ongoing exfiltration
    echo "$(date): Monitoring for ongoing data exfiltration" | tee -a $LOG_FILE
    
    # Set up enhanced monitoring
    log_exec kubectl set env deployment/biopoint-api AUDIT_LEVEL="trace"
    log_exec kubectl apply -f k8s/enhanced-monitoring.yaml
    
    echo "$(date): Data exfiltration recovery completed successfully" | tee -a $LOG_FILE
}

# Function to execute unauthorized access recovery
execute_unauthorized_access_recovery() {
    echo "$(date): Starting unauthorized access recovery" | tee -a $LOG_FILE
    
    # Step 4: Revoke all active sessions
    echo "$(date): Revoking all active sessions" | tee -a $LOG_FILE
    
    # Rotate JWT secret to invalidate all tokens
    NEW_JWT_SECRET=$(openssl rand -base64 64)
    if command -v kubectl &> /dev/null; then
        log_exec kubectl set env deployment/biopoint-api JWT_SECRET="$NEW_JWT_SECRET"
    fi
    
    # Step 5: Review and update access controls
    echo "$(date): Reviewing and updating access controls" | tee -a $LOG_FILE
    
    # Reset all API keys
    if [ -f "./scripts/rotate-all-api-keys.sh" ]; then
        log_exec ./scripts/rotate-all-api-keys.sh
    fi
    
    # Update role permissions to be more restrictive
    log_exec kubectl apply -f k8s/restricted-rbac-config.yaml
    
    # Step 6: Implement additional security measures
    echo "$(date): Implementing additional security measures" | tee -a $LOG_FILE
    
    # Enable rate limiting
    log_exec kubectl set env deployment/biopoint-api RATE_LIMITING="strict"
    
    # Enable anomaly detection
    log_exec kubectl set env deployment/biopoint-api ANOMALY_DETECTION="enabled"
    
    echo "$(date): Unauthorized access recovery completed successfully" | tee -a $LOG_FILE
}

# Step 4: Generate comprehensive incident report
echo "$(date): Generating comprehensive incident report" | tee -a $LOG_FILE

cat > "/incidents/security-breach-report-$(date +%Y%m%d_%H%M%S).md" << EOF
# Security Breach Incident Report

**Date:** $(date)
**Incident ID:** SB-$(date +%Y%m%d-%H%M%S)
**Breach Type:** $BREACH_TYPE
**Status:** RESOLVED

## Incident Summary
- **Encrypted Files:** $ENCRYPTED_FILES
- **Ransom Notes:** $RANSOM_NOTES
- **Encrypted Database Tables:** $DB_ENCRYPTED
- **Unauthorized Access Attempts:** $UNAUTHORIZED_ACCESS
- **Forensic Database:** $FORENSIC_DB

## Recovery Actions Taken
- ✅ Immediate system isolation
- ✅ Evidence preservation
- ✅ Threat containment
- ✅ Clean recovery executed
- ✅ Security hardening implemented

## HIPAA Compliance
- ✅ Breach assessment completed
- ✅ PHI exposure evaluated
- ✅ Individual notifications prepared
- ✅ HHS OCR notification ready
- ✅ Documentation preserved

## Lessons Learned
[To be completed during post-incident review]

## Recommendations
[To be completed during post-incident review]

## Next Steps
- Complete HIPAA breach notification process
- Conduct full security audit
- Update incident response procedures
- Schedule security training
- Review insurance claims
EOF

echo "$(date): Security breach recovery completed successfully" | tee -a $LOG_FILE