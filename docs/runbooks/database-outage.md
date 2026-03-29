# Database Outage Runbook

## Overview
This runbook provides step-by-step procedures for responding to database outages in the BioPoint production environment, with specific focus on HIPAA compliance and PHI data protection.

## Severity Levels

### P0 - Critical Database Outage
- **Definition**: Complete database unavailability or data corruption
- **Impact**: All database-dependent features unavailable, potential data loss
- **Response Time**: Immediate (within 5 minutes)
- **Escalation**: Engineering Manager → CTO → CEO

### P1 - Major Database Issues
- **Definition**: Significant performance degradation or partial functionality loss
- **Impact**: Slow queries, connection timeouts, some features unavailable
- **Response Time**: Within 15 minutes
- **Escalation**: Senior Engineer → Engineering Manager

### P2 - Minor Database Issues
- **Definition**: Limited performance impact or connection issues
- **Impact**: Occasional timeouts, slow responses
- **Response Time**: Within 30 minutes
- **Escalation**: On-call Engineer

## Immediate Response (First 5 Minutes)

### 1. Acknowledge Alert
- [ ] Acknowledge alert in PagerDuty
- [ ] Join #incident-response Slack channel
- [ ] Create incident in JIRA with label `database-outage`
- [ ] Notify stakeholders in #general Slack channel
- [ ] **CRITICAL**: If PHI breach suspected, immediately notify Security Team

### 2. Initial Assessment
- [ ] Check database health endpoint: `curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" https://api.biopoint.com/health/db`
- [ ] Check database connection pool status
- [ ] Review recent database deployments or schema changes
- [ ] Check Datadog for database metrics anomalies
- [ ] Check for any active database maintenance windows

### 3. Determine Scope
- [ ] Is this a complete database outage or performance degradation?
- [ ] Which database instances are affected (primary, replica, read-only)?
- [ ] Are all applications affected or specific services?
- [ ] Is there any indication of data corruption or loss?
- [ ] **PHI Impact**: Has any PHI been compromised or exposed?

## Investigation Steps

### 4. Database Connectivity Tests
```bash
# Test database connectivity from API pod
kubectl exec -it biopoint-api-pod -n biopoint-api -- node -e "
const db = require('./dist/config/database').default;
db.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"

# Test database connection from within cluster
kubectl run db-test --image=postgres:14 --rm -it --restart=Never -- \
  psql postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME} -c "SELECT 1;"

# Check database service endpoints
kubectl get endpoints -n biopoint-database
kubectl describe service biopoint-database -n biopoint-database
```

### 5. Database Pod Status
```bash
# Check database pods
kubectl get pods -n biopoint-database -o wide
kubectl describe pods -n biopoint-database

# Check database logs
kubectl logs -n biopoint-database deployment/biopoint-database --tail=100

# Check recent events
kubectl get events -n biopoint-database --sort-by='.lastTimestamp'
```

### 6. Resource Utilization
```bash
# Check database resource usage
kubectl top pods -n biopoint-database --containers

# Check database metrics in Datadog
# Navigate to: https://app.datadoghq.com/dash/integration/30/postgres---overview

# Check connection pool usage
curl -s http://localhost:3000/metrics | grep database_connections
```

### 7. Storage and Disk Space
```bash
# Check disk usage
kubectl exec -it biopoint-database-pod -n biopoint-database -- df -h

# Check database size
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT datname, pg_size_pretty(pg_database_size(datname)) 
  FROM pg_database 
  WHERE datname = '${DB_NAME}';
  "

# Check WAL file size
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  du -sh /var/lib/postgresql/data/pg_wal/
```

### 8. Replication Status (if applicable)
```bash
# Check replication lag
kubectl exec -it biopoint-database-primary -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn, 
         write_lag, flush_lag, replay_lag 
  FROM pg_stat_replication;
  "

# Check replica status
kubectl exec -it biopoint-database-replica -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay;
  "
```

## Common Issues and Solutions

### Issue 1: Database Connection Pool Exhaustion

**Symptoms:**
- "too many connections" errors
- Connection timeouts
- Application unable to connect

**Diagnosis:**
```bash
# Check active connections
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
  "

# Check connection limits
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "SHOW max_connections;"
```

**Resolution:**
1. [ ] Increase connection pool size in application configuration
2. [ ] Scale application horizontally to distribute connections
3. [ ] Identify and terminate idle connections
4. [ ] Review connection leak in application code
5. [ ] Consider connection pooling with PgBouncer

### Issue 2: Database Disk Space Full

**Symptoms:**
- "no space left on device" errors
- Database becomes read-only
- WAL file accumulation

**Diagnosis:**
```bash
# Check disk usage
kubectl exec -it biopoint-database-pod -n biopoint-database -- df -h

# Check large tables
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
  FROM pg_tables 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
  LIMIT 10;
  "
```

**Resolution:**
1. [ ] Expand persistent volume claim (PVC)
2. [ ] Archive old data to cheaper storage
3. [ ] Clean up WAL files (if safe to do so)
4. [ ] Vacuum and analyze tables
5. [ ] Review data retention policies

### Issue 3: Database Performance Degradation

**Symptoms:**
- Slow query execution
- High CPU usage
- Lock contention

**Diagnosis:**
```bash
# Check slow queries
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT query, calls, total_time, mean_time, rows 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;
  "

# Check active locks
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT * FROM pg_locks WHERE NOT granted;
  "

# Check long-running queries
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
  "
```

**Resolution:**
1. [ ] Kill long-running queries if safe
2. [ ] Optimize slow queries with proper indexing
3. [ ] Increase database resources (CPU/memory)
4. [ ] Review and optimize application queries
5. [ ] Consider read replicas for read-heavy workloads

### Issue 4: Database Corruption

**Symptoms:**
- Data integrity errors
- Index corruption warnings
- Inconsistent query results

**Diagnosis:**
```bash
# Check database integrity
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT * FROM pg_stat_database WHERE datname = '${DB_NAME}';
  "

# Check for corruption errors in logs
kubectl logs -n biopoint-database deployment/biopoint-database | grep -i "corrupt\|integrity\|checksum"
```

**CRITICAL ACTIONS:**
1. [ ] **STOP ALL WRITE OPERATIONS IMMEDIATELY**
2. [ ] **BACKUP CURRENT STATE** (even if corrupted)
3. [ ] **NOTIFY SECURITY TEAM** (potential PHI breach)
4. [ ] **ASSESS DATA INTEGRITY** of PHI data
5. [ ] **PREPARE FOR RESTORATION** from backup

**Resolution:**
1. [ ] Restore from last known good backup
2. [ ] Apply WAL logs to point-in-time recovery
3. [ ] Verify data integrity after restoration
4. [ ] Conduct full security audit
5. [ ] Document incident for compliance

### Issue 5: Replication Lag (Replica Issues)

**Symptoms:**
- Stale data on read replicas
- High replication delay
- Replica connection failures

**Diagnosis:**
```bash
# Check replication status
kubectl exec -it biopoint-database-primary -n biopoint-database -- \
  psql -U ${DB_USER} -d ${DB_NAME} -c "
  SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
         write_lag, flush_lag, replay_lag 
  FROM pg_stat_replication;
  "
```

**Resolution:**
1. [ ] Check network connectivity between primary and replica
2. [ ] Verify replica has sufficient resources
3. [ ] Restart replication if necessary
4. [ ] Consider rebuilding replica if lag persists
5. [ ] Redirect read traffic to primary temporarily

## Recovery Procedures

### Database Restart
```bash
# Graceful restart
kubectl rollout restart deployment/biopoint-database -n biopoint-database

# Force restart (if unresponsive)
kubectl delete pod biopoint-database-pod -n biopoint-database

# Check restart status
kubectl get pods -n biopoint-database -w
```

### Point-in-Time Recovery
```bash
# List available backups
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  pgbackrest info

# Restore to specific point in time
kubectl exec -it biopoint-database-pod -n biopoint-database -- \
  pgbackrest restore --type=time "--target=2026-01-23 08:00:00"
```

### Database Failover (if using HA setup)
```bash
# Promote replica to primary
kubectl exec -it biopoint-database-replica -n biopoint-database -- \
  pg_ctl promote -D /var/lib/postgresql/data

# Update application configuration
kubectl patch deployment biopoint-api -n biopoint-api -p '
{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"DB_HOST","value":"new-primary-host"}]}]}}}}'
```

## HIPAA Compliance Considerations

### Data Breach Protocol
1. **Immediate Actions**:
   - [ ] **CONTAIN THE BREACH** - Stop unauthorized access
   - [ ] **ASSESS PHI INVOLVEMENT** - Determine what PHI was accessed
   - [ ] **NOTIFY SECURITY TEAM** - Within 15 minutes
   - [ ] **DOCUMENT EVERYTHING** - Maintain audit trail

2. **Assessment Phase**:
   - [ ] Determine scope of PHI exposure
   - [ ] Identify affected individuals
   - [ ] Assess risk of harm
   - [ ] Document timeline of events

3. **Notification Requirements**:
   - [ ] **HHS**: Notify within 60 days if >500 individuals
   - [ ] **Individuals**: Notify within 60 days
   - [ ] **Media**: Notify within 60 days if >500 individuals
   - [ ] **Business Associates**: Notify within specified timeframe

### Audit Trail Maintenance
- [ ] Log all database access during incident
- [ ] Document all recovery actions taken
- [ ] Preserve forensic evidence if needed
- [ ] Maintain chain of custody for logs
- [ ] Archive incident documentation

## Communication

### Internal Communication
1. **Slack Channels**:
   - `#incident-response` - Primary incident coordination
   - `#engineering` - Technical updates
   - `#security-team` - Security-related updates
   - `#general` - Company-wide updates

2. **Escalation Path**:
   - **Tier 1**: Database Administrator (0-15 minutes)
   - **Tier 2**: Senior Database Engineer (15-30 minutes)
   - **Tier 3**: Engineering Manager (30-60 minutes)
   - **Tier 4**: CTO + Security Team (60+ minutes)

### External Communication
1. **Customer Notification**:
   - Notify affected customers within SLA timeframe
   - Provide estimated resolution time
   - Offer alternative solutions if available

2. **Regulatory Notification** (if PHI involved):
   - Follow HIPAA breach notification timeline
   - Coordinate with Legal team
   - Prepare required documentation

## Post-Incident Actions

### 1. Service Restoration Verification
- [ ] Verify all database connections are working
- [ ] Run data integrity checks
- [ ] Verify replication is working (if applicable)
- [ ] Test all dependent applications
- [ ] Monitor for 30 minutes post-restoration

### 2. Data Integrity Verification
- [ ] Run checksums on critical tables
- [ ] Verify PHI data integrity
- [ ] Check audit logs for completeness
- [ ] Validate backup procedures worked

### 3. Incident Documentation
- [ ] Update JIRA incident ticket
- [ ] Document root cause analysis
- [ ] Record timeline of events
- [ ] Document PHI exposure assessment
- [ ] Note lessons learned

### 4. Compliance Documentation
- [ ] Complete incident report for HIPAA compliance
- [ ] Document breach assessment if applicable
- [ ] Prepare regulatory notifications if required
- [ ] Update security incident log

## Tools and Resources

### Database Tools
- **pgAdmin**: Database administration
- **psql**: Command-line PostgreSQL client
- **pg_stat_statements**: Query performance analysis
- **pgBackRest**: Backup and recovery

### Monitoring Tools
- **Datadog**: Database performance monitoring
- **pg_stat_activity**: Active connection monitoring
- **pg_stat_replication**: Replication monitoring
- **AWS RDS Console**: Cloud-based database monitoring

### Diagnostic Commands
```bash
# Database size and growth
SELECT datname, pg_size_pretty(pg_database_size(datname)) 
FROM pg_database WHERE datname = 'biopoint';

# Connection analysis
SELECT count(*), state, application_name 
FROM pg_stat_activity 
GROUP BY state, application_name;

# Lock analysis
SELECT * FROM pg_locks WHERE NOT granted;

# Long-running queries
SELECT pid, now() - query_start AS duration, query 
FROM pg_stat_activity 
WHERE state != 'idle' AND now() - query_start > interval '5 minutes';
```

## Contact Information

### Internal Contacts
- **Database Team**: db-team@biopoint.com
- **SRE Team**: sre-team@biopoint.com
- **Security Team**: security-team@biopoint.com
- **On-Call DBA**: Via PagerDuty

### External Vendors
- **AWS RDS Support**: Premium support case
- **PostgreSQL Support**: Community support
- **Database Consulting**: External consultant contact

### Emergency Contacts
- **AWS Emergency**: +1-206-266-4064
- **Security Team**: security-team@biopoint.com
- **Legal Team**: legal@biopoint.com
- **Compliance Officer**: compliance@biopoint.com

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Owner**: Database Team  
**Review Schedule**: Quarterly  
**HIPAA Compliance**: Reviewed and Approved