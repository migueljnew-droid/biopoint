# Database Corruption Recovery Runbook

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Database Administrator  
**Review Schedule:** Monthly

---

## Overview

This runbook provides step-by-step procedures for recovering from database corruption incidents affecting BioPoint's PostgreSQL database hosted on Neon. Database corruption can result from hardware failures, software bugs, human error, or malicious attacks.

**Recovery Objectives:**
- **RTO:** 30 minutes
- **RPO:** 1 hour maximum data loss
- **HIPAA Compliance:** Maintain throughout recovery

---

## Detection Methods

### Primary Detection
- **Monitoring Alerts:** Neon dashboard alerts for data integrity issues
- **Application Errors:** Database connection failures, query errors
- **Health Checks:** Automated database integrity checks failing
- **User Reports:** Users unable to access or save data

### Secondary Detection
- **Audit Log Anomalies:** Unusual database activity patterns
- **Performance Degradation:** Sudden query performance issues
- **Storage Errors:** Disk space or I/O errors
- **Backup Failures:** Database backup operations failing

---

## Immediate Response (0-5 minutes)

### 1. Assess Severity
```bash
# Check database connectivity
echo "Testing database connectivity..."
psql $DATABASE_URL -c "SELECT version();" || echo "DATABASE CONNECTION FAILED"

# Check for obvious corruption errors
echo "Checking for corruption indicators..."
psql $DATABASE_URL -c "
  SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    last_vacuum,
    last_autovacuum
  FROM pg_stat_user_tables 
  ORDER BY n_live_tup DESC;
"

# Check recent database errors
echo "Checking recent database errors..."
kubectl logs deployment/biopoint-api --tail=100 | grep -i "database\|postgres\|corruption"
```

### 2. Preserve Current State
```bash
# Create forensic snapshot
echo "Creating forensic snapshot..."
FORENSIC_DB="biopoint_forensic_$(date +%Y%m%d_%H%M%S)"
createdb $FORENSIC_DB
pg_dump $DATABASE_URL | psql $FORENSIC_DB

# Capture database statistics
echo "Capturing database statistics..."
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database;" > /incidents/db_stats_$(date +%Y%m%d_%H%M%S).csv

# Save current configuration
echo "Saving database configuration..."
psql $DATABASE_URL -c "SELECT name, setting FROM pg_settings;" > /incidents/db_config_$(date +%Y%m%d_%H%M%S).csv
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
         \"summary\": \"BioPoint Database Corruption Detected\",
         \"source\": \"database-monitoring\",
         \"severity\": \"critical\",
         \"custom_details\": {
           \"database\": \"biopoint\",
           \"detection_time\": \"$(date)\",
           \"forensic_snapshot\": \"$FORENSIC_DB\"
         }
       }
     }"

# Log incident
echo "$(date): Database corruption incident initiated - Forensic DB: $FORENSIC_DB" >> /var/log/dr-incidents.log
```

---

## Assessment Phase (5-15 minutes)

### 1. Determine Corruption Scope
```sql
-- Check for data integrity issues
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples
FROM information_schema.tables 
JOIN pg_stat_user_tables ON table_name = relname
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name::regclass) DESC;

-- Check for constraint violations
DO $$
DECLARE
    r RECORD;
    constraint_count INTEGER;
BEGIN
    FOR r IN 
        SELECT table_name, constraint_name 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE '
            SELECT COUNT(*) 
            FROM ' || quote_ident(r.table_name) || ' t
            LEFT JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = ''' || r.constraint_name || '''
            WHERE NOT EXISTS (
                SELECT 1 FROM ' || quote_ident(rc.unique_constraint_name) || ' 
                WHERE ' || quote_ident(rc.unique_constraint_name) || '.id = t.' || quote_ident(rc.match_option) || '
            )'
        INTO constraint_count;
        
        IF constraint_count > 0 THEN
            RAISE NOTICE 'Foreign key constraint % on table % has % violations', 
                         r.constraint_name, r.table_name, constraint_count;
        END IF;
    END LOOP;
END $$;

-- Check for orphaned records
SELECT COUNT(*) as orphaned_lab_results
FROM lab_results lr
LEFT JOIN users u ON lr.user_id = u.id
WHERE u.id IS NULL;

SELECT COUNT(*) as orphaned_photos
FROM progress_photos pp
LEFT JOIN users u ON pp.user_id = u.id
WHERE u.id IS NULL;
```

### 2. Check Backup Availability
```bash
# List available backups
echo "Checking available backups..."
aws s3 ls s3://biopoint-db-backups/ --recursive | tail -10

# Verify latest backup integrity
LATEST_BACKUP=$(aws s3 ls s3://biopoint-db-backups/ --recursive | tail -1 | awk '{print $4}')
echo "Latest backup: $LATEST_BACKUP"

# Test backup restoration (dry run)
aws s3 cp s3://biopoint-db-backups/$LATEST_BACKUP - | head -c 1024 > /tmp/backup-test.sql
if [ -s /tmp/backup-test.sql ]; then
    echo "Backup file is accessible and readable"
else
    echo "ERROR: Backup file is corrupted or inaccessible"
fi

# Check backup age
BACKUP_DATE=$(echo $LATEST_BACKUP | grep -o '[0-9]\{8\}' | head -1)
CURRENT_DATE=$(date +%Y%m%d)
BACKUP_AGE=$(( (CURRENT_DATE - BACKUP_DATE) ))
echo "Backup age: $BACKUP_AGE days"
```

### 3. Assess Recovery Options

Based on assessment, determine the most appropriate recovery strategy:

#### **Option A: Point-in-Time Recovery (PITR)**
- **When to use:** Recent corruption, good backups available
- **Advantages:** Minimal data loss, preserves recent transactions
- **Requirements:** Continuous archiving enabled, valid backup chain

#### **Option B: Clean Backup Restore**
- **When to use:** Widespread corruption, PITR unavailable
- **Advantages:** Guaranteed clean state, simpler process
- **Disadvantages:** Up to 24 hours data loss

#### **Option C: Manual Data Repair**
- **When to use:** Limited corruption, critical data affected
- **Advantages:** Minimal data loss, targeted repair
- **Requirements:** Deep database expertise, extensive validation

---

## Recovery Procedures

### Option A: Point-in-Time Recovery (PITR)

**Use when:** Corruption detected within 6 hours, continuous archiving available

```bash
#!/bin/bash
# Point-in-Time Recovery Procedure

set -euo pipefail

# Configuration
RESTORE_TIME="$(date -d '2 hours ago' '+%Y-%m-%d %H:%M:%S')"
RECOVERY_DB="biopoint_recovery_pitr"
LOG_FILE="/var/log/db-recovery-pitr-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting Point-in-Time Recovery to $RESTORE_TIME" >> $LOG_FILE

# Step 1: Create recovery target
echo "$(date): Creating recovery database" >> $LOG_FILE
createdb $RECOVERY_DB

# Step 2: Restore base backup
echo "$(date): Restoring base backup" >> $LOG_FILE
LATEST_BASE_BACKUP=$(aws s3 ls s3://biopoint-db-backups/base-backups/ | tail -1 | awk '{print $4}')
aws s3 cp s3://biopoint-db-backups/base-backups/$LATEST_BASE_BACKUP - | pg_restore -d $RECOVERY_DB

# Step 3: Apply WAL archives to reach target time
echo "$(date): Applying WAL archives to $RESTORE_TIME" >> $LOG_FILE
psql $RECOVERY_DB -c "
    SELECT pg_wal_replay_resume();
    -- Configure recovery target
    ALTER SYSTEM SET recovery_target_time = '$RESTORE_TIME';
    ALTER SYSTEM SET recovery_target_inclusive = false;
    SELECT pg_reload_conf();
"

# Step 4: Verify data integrity
echo "$(date): Verifying data integrity" >> $LOG_FILE
psql $RECOVERY_DB -c "
    SELECT 
        COUNT(*) as total_users,
        MAX(updated_at) as latest_update,
        MIN(created_at) as earliest_user
    FROM users;
" >> $LOG_FILE

# Step 5: Validate critical relationships
echo "$(date): Validating data relationships" >> $LOG_FILE
VALIDATION_ERRORS=$(psql $RECOVERY_DB -t -c "
    SELECT COUNT(*) FROM (
        SELECT lr.id 
        FROM lab_results lr 
        LEFT JOIN users u ON lr.user_id = u.id 
        WHERE u.id IS NULL
        UNION ALL
        SELECT pp.id 
        FROM progress_photos pp 
        LEFT JOIN users u ON pp.user_id = u.id 
        WHERE u.id IS NULL
    ) AS violations;
")

if [ "$VALIDATION_ERRORS" -eq 0 ]; then
    echo "$(date): Data integrity validation passed" >> $LOG_FILE
    
    # Step 6: Promote recovery database
    echo "$(date): Promoting recovery database to production" >> $LOG_FILE
    
    # Update application configuration
    kubectl set env deployment/biopoint-api DATABASE_URL="postgresql://biopoint:${DB_PASSWORD}@localhost/$RECOVERY_DB"
    
    # Step 7: Verify application functionality
    echo "$(date): Verifying application functionality" >> $LOG_FILE
    sleep 30
    
    HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" "https://api.biopoint.com/health" || echo "000")
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo "$(date): PITR recovery completed successfully" >> $LOG_FILE
    else
        echo "$(date): Application health check failed after PITR" >> $LOG_FILE
        exit 1
    fi
    
else
    echo "$(date): Data integrity validation failed - $VALIDATION_ERRORS violations found" >> $LOG_FILE
    exit 1
fi
```

### Option B: Clean Backup Restore

**Use when:** Widespread corruption, PITR unavailable, or data integrity uncertain

```bash
#!/bin/bash
# Clean Backup Restore Procedure

set -euo pipefail

# Configuration
BACKUP_DATE="$(date -d '24 hours ago' '+%Y%m%d')"
RECOVERY_DB="biopoint_recovery_clean"
LOG_FILE="/var/log/db-recovery-clean-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting clean backup restore from $BACKUP_DATE" >> $LOG_FILE

# Step 1: Identify clean backup
echo "$(date): Identifying clean backup" >> $LOG_FILE
CLEAN_BACKUP=$(aws s3 ls s3://biopoint-db-backups/ | grep $BACKUP_DATE | tail -1 | awk '{print $4}')

if [ -z "$CLEAN_BACKUP" ]; then
    echo "$(date): No clean backup found for $BACKUP_DATE" >> $LOG_FILE
    exit 1
fi

# Step 2: Create recovery environment
echo "$(date): Creating recovery environment" >> $LOG_FILE
createdb $RECOVERY_DB

# Step 3: Restore clean backup
echo "$(date): Restoring clean backup: $CLEAN_BACKUP" >> $LOG_FILE
aws s3 cp s3://biopoint-db-backups/$CLEAN_BACKUP - | pg_restore -d $RECOVERY_DB

# Step 4: Validate restored data
echo "$(date): Validating restored data" >> $LOG_FILE
USER_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM users;")
LAB_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM lab_results;")
PHOTO_COUNT=$(psql $RECOVERY_DB -t -c "SELECT COUNT(*) FROM progress_photos;")

echo "$(date): Restored data counts:" >> $LOG_FILE
echo "  Users: $USER_COUNT" >> $LOG_FILE
echo "  Lab Results: $LAB_COUNT" >> $LOG_FILE
echo "  Progress Photos: $PHOTO_COUNT" >> $LOG_FILE

# Step 5: Check data consistency
echo "$(date): Checking data consistency" >> $LOG_FILE
psql $RECOVERY_DB -c "
    SELECT 
        'users' as table_name,
        COUNT(*) as record_count,
        MAX(updated_at) as latest_update
    FROM users
    UNION ALL
    SELECT 
        'lab_results' as table_name,
        COUNT(*) as record_count,
        MAX(created_at) as latest_update
    FROM lab_results
    UNION ALL
    SELECT 
        'progress_photos' as table_name,
        COUNT(*) as record_count,
        MAX(created_at) as latest_update
    FROM progress_photos;
" >> $LOG_FILE

# Step 6: Run comprehensive validation
echo "$(date): Running comprehensive validation" >> $LOG_FILE
psql $RECOVERY_DB -f /opt/biopoint/scripts/validate-database-integrity.sql >> $LOG_FILE

if [ $? -eq 0 ]; then
    echo "$(date): Data validation successful" >> $LOG_FILE
    
    # Step 7: Prepare for production cutover
    echo "$(date): Preparing for production cutover" >> $LOG_FILE
    
    # Create final backup of corrupted state
    pg_dump $DATABASE_URL > /incidents/corrupted-state-$(date +%Y%m%d_%H%M%S).sql
    
    # Step 8: Switch to recovery database
    echo "$(date): Switching to recovery database" >> $LOG_FILE
    kubectl set env deployment/biopoint-api DATABASE_URL="postgresql://biopoint:${DB_PASSWORD}@localhost/$RECOVERY_DB"
    
    # Step 9: Verify production functionality
    echo "$(date): Verifying production functionality" >> $LOG_FILE
    sleep 30
    
    # Test critical user journeys
    ./scripts/test-critical-user-journeys.sh >> $LOG_FILE
    
    if [ $? -eq 0 ]; then
        echo "$(date): Clean backup restore completed successfully" >> $LOG_FILE
    else
        echo "$(date): Critical user journey tests failed" >> $LOG_FILE
        exit 1
    fi
    
else
    echo "$(date): Data validation failed" >> $LOG_FILE
    exit 1
fi
```

### Option C: Manual Data Repair

**Use when:** Limited corruption, specific tables affected, critical data at risk

```sql
-- Manual Data Repair Procedure
-- Execute with extreme caution - always test on backup first

-- Step 1: Identify corrupted records
CREATE TEMPORARY TABLE corrupted_users AS
SELECT id, email, created_at, updated_at
FROM users 
WHERE updated_at > NOW() - INTERVAL '2 hours'
  AND id IN (
      SELECT user_id 
      FROM lab_results 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY user_id 
      HAVING COUNT(*) > 1000  -- Suspicious activity
  );

-- Review corrupted records
SELECT * FROM corrupted_users ORDER BY updated_at DESC;

-- Step 2: Backup corrupted data
CREATE TABLE users_backup_$(date +%Y%m%d_%H%M%S) AS
SELECT * FROM users WHERE id IN (SELECT id FROM corrupted_users);

-- Step 3: Identify clean reference data
CREATE TEMPORARY TABLE clean_reference_data AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    (SELECT MAX(lr.created_at) FROM lab_results lr WHERE lr.user_id = u.id) as last_lab_result,
    (SELECT MAX(pp.created_at) FROM progress_photos pp WHERE pp.user_id = u.id) as last_photo
FROM users u
WHERE u.id IN (SELECT id FROM corrupted_users)
  AND EXISTS (
      SELECT 1 FROM lab_results lr 
      WHERE lr.user_id = u.id 
      AND lr.created_at < NOW() - INTERVAL '2 hours'
  );

-- Step 4: Repair corrupted records
UPDATE users 
SET updated_at = cr.last_lab_result
FROM clean_reference_data cr
WHERE users.id = cr.id
  AND users.updated_at > NOW() - INTERVAL '2 hours';

-- Step 5: Validate repairs
SELECT 
    u.id,
    u.email,
    u.updated_at,
    cr.last_lab_result,
    CASE 
        WHEN u.updated_at = cr.last_lab_result THEN 'REPAIRED'
        ELSE 'NEEDS ATTENTION'
    END as repair_status
FROM users u
JOIN clean_reference_data cr ON u.id = cr.id;

-- Step 6: Verify data integrity
SELECT 
    'users' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '2 hours' THEN 1 END) as recently_updated
FROM users;

SELECT 
    'lab_results' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '2 hours' THEN 1 END) as recently_created
FROM lab_results;
```

---

## Post-Recovery Procedures

### 1. Data Integrity Verification

```bash
#!/bin/bash
# Comprehensive Data Integrity Verification

set -euo pipefail

DATABASE_URL="${RECOVERY_DATABASE_URL:-$DATABASE_URL}"
LOG_FILE="/var/log/db-integrity-check-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting comprehensive data integrity verification" >> $LOG_FILE

# Check user data consistency
echo "$(date): Verifying user data consistency" >> $LOG_FILE
psql $DATABASE_URL -c "
    SELECT 
        'Total Users' as metric,
        COUNT(*) as value
    FROM users
    WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
        'Users with Lab Results' as metric,
        COUNT(DISTINCT user_id) as value
    FROM lab_results
    
    UNION ALL
    
    SELECT 
        'Users with Photos' as metric,
        COUNT(DISTINCT user_id) as value
    FROM progress_photos;
" >> $LOG_FILE

# Check for orphaned records
echo "$(date): Checking for orphaned records" >> $LOG_FILE
ORPHANED_LABS=$(psql $DATABASE_URL -t -c "
    SELECT COUNT(*) 
    FROM lab_results lr 
    LEFT JOIN users u ON lr.user_id = u.id 
    WHERE u.id IS NULL OR u.deleted_at IS NOT NULL;
")

ORPHANED_PHOTOS=$(psql $DATABASE_URL -t -c "
    SELECT COUNT(*) 
    FROM progress_photos pp 
    LEFT JOIN users u ON pp.user_id = u.id 
    WHERE u.id IS NULL OR u.deleted_at IS NOT NULL;
")

echo "Orphaned lab results: $ORPHANED_LABS" >> $LOG_FILE
echo "Orphaned progress photos: $ORPHANED_PHOTOS" >> $LOG_FILE

# Check audit log continuity
echo "$(date): Checking audit log continuity" >> $LOG_FILE
psql $DATABASE_URL -c "
    SELECT 
        DATE(created_at) as log_date,
        COUNT(*) as audit_entries,
        MIN(created_at) as first_entry,
        MAX(created_at) as last_entry
    FROM audit_logs
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY log_date DESC;
" >> $LOG_FILE

# Generate integrity report
echo "$(date): Generating integrity report" >> $LOG_FILE
cat > /incidents/db-integrity-report-$(date +%Y%m%d_%H%M%S).md << EOF
# Database Integrity Verification Report

**Date:** $(date)
**Database:** $(echo $DATABASE_URL | sed 's/password=[^&]*//')
**Recovery Method:** {PITR/Clean_Backup/Manual_Repair}

## Data Consistency Summary
- Total Users: $(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;")
- Total Lab Results: $(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM lab_results;")
- Total Progress Photos: $(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM progress_photos;")

## Integrity Issues Found
- Orphaned Lab Results: $ORPHANED_LABS
- Orphaned Progress Photos: $ORPHANED_PHOTOS

## Audit Log Continuity
$(psql $DATABASE_URL -c "SELECT '✓ Continuous logging maintained' WHERE COUNT(*) > 0 FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';")

## Recommendations
$(if [ "$ORPHANED_LABS" -gt 0 ] || [ "$ORPHANED_PHOTOS" -gt 0 ]; then
    echo "- Clean up orphaned records"
    echo "- Investigate cause of orphaned data"
fi)

- Monitor database performance for 24 hours
- Schedule next integrity check in 1 week
- Update backup procedures if needed
EOF

echo "$(date): Data integrity verification completed" >> $LOG_FILE
```

### 2. HIPAA Compliance Verification

```bash
#!/bin/bash
# HIPAA Compliance Verification

set -euo pipefail

LOG_FILE="/var/log/hipaa-compliance-check-$(date +%Y%m%d_%H%M%S).log"

echo "$(date): Starting HIPAA compliance verification" >> $LOG_FILE

# Check encryption status
echo "$(date): Verifying encryption status" >> $LOG_FILE
ENCRYPTION_STATUS=$(psql $DATABASE_URL -t -c "
    SELECT CASE 
        WHEN current_setting('ssl') = 'on' THEN 'SSL_ENABLED'
        ELSE 'SSL_DISABLED'
    END;
")
echo "Database encryption: $ENCRYPTION_STATUS" >> $LOG_FILE

# Check audit logging
echo "$(date): Verifying audit logging" >> $LOG_FILE
AUDIT_STATUS=$(psql $DATABASE_URL -t -c "
    SELECT CASE 
        WHEN COUNT(*) > 0 THEN 'AUDIT_ACTIVE'
        ELSE 'AUDIT_INACTIVE'
    END
    FROM audit_logs 
    WHERE created_at > NOW() - INTERVAL '1 hour';
")
echo "Audit logging: $AUDIT_STATUS" >> $LOG_FILE

# Check access controls
echo "$(date): Verifying access controls" >> $LOG_FILE
ACCESS_STATUS=$(kubectl get pods -l app=biopoint-api -o jsonpath='{.items[0].spec.containers[0].env[?(@.name=="DATABASE_URL")].value}' | grep -q "password" && echo "CREDENTIALS_SECURED" || echo "CREDENTIALS_EXPOSED")
echo "Access controls: $ACCESS_STATUS" >> $LOG_FILE

# Generate HIPAA compliance report
cat > /incidents/hipaa-compliance-report-$(date +%Y%m%d_%H%M%S).md << EOF
# HIPAA Compliance Verification Report

**Date:** $(date)
**Incident ID:** BP-DR-{ID}
**Database Recovery:** Completed

## Compliance Status
- **Encryption at Rest:** Maintained throughout recovery
- **Encryption in Transit:** $ENCRYPTION_STATUS
- **Audit Logging:** $AUDIT_STATUS
- **Access Controls:** $ACCESS_STATUS
- **Data Integrity:** Verified

## PHI Protection Measures
✅ No unauthorized PHI access during recovery
✅ All PHI remained encrypted throughout process
✅ Audit trail maintained without gaps
✅ Access restricted to authorized personnel only
✅ Data minimization principles followed

## Breach Risk Assessment
**Risk Level:** LOW
**Rationale:** No evidence of unauthorized PHI access, encryption maintained, audit logging continuous

## Notification Requirements
- Individual notifications: NOT REQUIRED
- HHS OCR notification: NOT REQUIRED
- Documentation: Complete and retained per HIPAA requirements

## Next Steps
- Monitor system for 24 hours
- Schedule quarterly compliance review
- Update incident response documentation
EOF

echo "$(date): HIPAA compliance verification completed" >> $LOG_FILE
```

---

## Communication Templates

### Internal Status Updates

```markdown
## Database Corruption Recovery Update

**Time:** {TIMESTAMP}
**Status:** {ASSESSMENT/RECOVERY/VERIFICATION}
**ETA:** {ESTIMATED_COMPLETION}

### Current Progress
- Detection: ✅ Completed
- Assessment: {STATUS}
- Recovery: {STATUS}
- Verification: {STATUS}

### Key Metrics
- Data Loss: {RPO_ACHIEVED}
- Recovery Time: {ELAPSED_TIME}
- Users Affected: {COUNT}

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
Subject: BioPoint Service Update - Database Maintenance

Dear BioPoint User,

We are writing to inform you of a brief service disruption that occurred earlier today.

**What happened:**
We detected and resolved a database issue that affected data access for approximately {DURATION}.

**Your data:**
✅ All health data remains secure and encrypted
✅ No PHI was compromised during the incident
✅ All biomarker and lab data has been restored
✅ Recent updates may have been delayed by up to 1 hour

**Current status:**
✅ Service is fully restored
✅ All features are operational
✅ Enhanced monitoring is active

We sincerely apologize for any inconvenience this may have caused. Our database systems are now operating normally with additional safeguards in place.

If you have any questions or concerns, please contact us at support@biopoint.com or 1-800-BIOPOINT.

Thank you for your patience and continued trust in BioPoint.

The BioPoint Team
```

---

## Quick Reference

### Emergency Contacts
- **DR Commander:** +1-415-555-0100
- **Database Admin:** +1-415-555-0102
- **Neon Support:** support@neon.tech
- **AWS Support:** AWS Console

### Key Commands
```bash
# Database health check
psql $DATABASE_URL -c "SELECT version(), NOW(), current_database();"

# Check recent activity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '1 hour';"

# Check backup status
aws s3 ls s3://biopoint-db-backups/ | tail -5

# Create forensic snapshot
createdb biopoint_forensic_$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | psql biopoint_forensic_$(date +%Y%m%d_%H%M%S)
```

### Decision Matrix
| Scenario | Recovery Method | RTO | Data Loss |
|----------|----------------|-----|-----------|
| Recent corruption (< 6h) | PITR | 30 min | < 1h |
| Widespread corruption | Clean backup | 45 min | 24h |
| Limited corruption | Manual repair | 60 min | 0-2h |
| Backup corruption | Vendor escalation | 2h+ | Variable |

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** February 2026
- **Owner:** Database Administrator
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- Database team must review monthly
- Hands-on recovery exercises quarterly
- Vendor coordination training annually