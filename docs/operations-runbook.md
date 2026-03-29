# BioPoint Operations Runbook

## Overview

This runbook provides comprehensive operational procedures for maintaining the BioPoint application in production, including daily tasks, weekly maintenance, monthly reviews, quarterly audits, and annual compliance activities.

## Daily Operations Checklist

### 1. System Health Monitoring (8:00 AM UTC)

#### API Health Check
```bash
# Check API status
curl -f https://api.biopoint.com/health || echo "API DOWN"

# Check response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.biopoint.com/health

# Check database connectivity
npm run health:database

# Check S3 connectivity
npm run health:s3
```

#### Key Metrics Review
- **API Response Time**: < 200ms (p95)
- **Error Rate**: < 1%
- **Database Connections**: < 80% of pool limit
- **S3 Upload Success Rate**: > 99%
- **User Active Sessions**: Track daily active users

#### Dashboard Monitoring
Access monitoring dashboards:
- **Application Monitoring**: https://dashboard.render.com/web/srv-biopoint-api
- **Database Monitoring**: https://console.neon.tech/app/projects/biopoint/metrics
- **Error Tracking**: https://sentry.io/organizations/biopoint/issues/
- **Analytics**: https://analytics.google.com/analytics/web/

### 2. Security Monitoring (9:00 AM UTC)

#### Failed Login Attempts
```sql
-- Check for suspicious login activity
SELECT COUNT(*), email, DATE_TRUNC('hour', created_at) as hour
FROM audit_log 
WHERE action = 'FAILED_LOGIN' 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY email, hour
HAVING COUNT(*) > 5
ORDER BY hour DESC;
```

#### Account Lockouts Review
```sql
-- Review recent account lockouts
SELECT identifier, locked_until, failed_attempts
FROM account_lockout 
WHERE locked_until > NOW()
  OR created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

#### Suspicious Activity Detection
- Review audit logs for unusual access patterns
- Check for bulk data downloads
- Monitor for API abuse patterns
- Review file upload activity

### 3. Performance Monitoring (10:00 AM UTC)

#### Database Performance
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements 
WHERE mean_time > 100  -- queries taking > 100ms
ORDER BY mean_time DESC 
LIMIT 10;

-- Check database size
SELECT pg_size_pretty(pg_database_size('biopoint'));

-- Check table bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### API Performance Review
- Review p95 response times by endpoint
- Check for slow endpoints (> 500ms)
- Monitor error rates by endpoint
- Review rate limiting violations

### 4. Backup Verification (11:00 AM UTC)

#### Database Backups
```bash
# Verify latest backup exists
aws s3 ls s3://biopoint-backups/database/ | tail -5

# Test backup integrity
aws s3 cp s3://biopoint-backups/database/latest-backup.sql.gz - | gunzip | head -10

# Check backup age (should be < 24 hours)
```

#### S3 Data Consistency
```bash
# Verify S3 bucket policies
aws s3api get-bucket-policy --bucket biopoint-uploads

# Check for orphaned files
aws s3 ls s3://biopoint-uploads/ --recursive | wc -l
```

### 5. User Support Review (2:00 PM UTC)

#### Support Ticket Review
- Check Zendesk for new tickets
- Review tickets tagged as "urgent" or "high priority"
- Check for common issues or trends
- Review user feedback from app stores

#### User Communication
- Review user emails for issues
- Check social media mentions
- Monitor community forums
- Review app store reviews

### 6. End-of-Day Summary (6:00 PM UTC)

#### Daily Metrics Report
Generate daily report with:
- Total active users
- New user registrations
- API request volume
- Error rates and types
- Performance metrics
- Security incidents
- Support ticket volume

#### Incident Documentation
Document any incidents:
- Issue description
- Root cause analysis
- Resolution steps
- Preventive measures

## Weekly Maintenance Tasks

### Monday: Database Maintenance

#### 1. Database Optimization
```sql
-- Update table statistics
ANALYZE;

-- Check for index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- Identify unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;
```

#### 2. Data Archival
```sql
-- Archive old audit logs (older than 90 days)
CREATE TABLE audit_log_archive_YYYYMM AS
SELECT * FROM audit_log 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete archived records
DELETE FROM audit_log 
WHERE created_at < NOW() - INTERVAL '90 days';
```

#### 3. Database Size Monitoring
```sql
-- Monitor database growth
SELECT 
    pg_size_pretty(pg_database_size('biopoint')) as current_size,
    pg_size_pretty(pg_database_size('biopoint') - pg_database_size('biopoint') * 0.1) as projected_size;
```

### Tuesday: Security Review

#### 1. Security Patch Review
- Check for security updates in dependencies
- Review CVE databases for relevant vulnerabilities
- Plan patching schedule
- Document security posture

#### 2. Access Control Review
```sql
-- Review user roles and permissions
SELECT role, COUNT(*) as user_count
FROM users 
GROUP BY role;

-- Check for inactive admin accounts
SELECT email, last_login_at 
FROM users 
WHERE role = 'ADMIN' 
  AND (last_login_at < NOW() - INTERVAL '30 days' OR last_login_at IS NULL);
```

#### 3. SSL Certificate Review
```bash
# Check SSL certificate expiration
openssl s_client -connect api.biopoint.com:443 -servername api.biopoint.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Check certificate chain
openssl s_client -connect api.biopoint.com:443 -servername api.biopoint.com -showcerts < /dev/null
```

### Wednesday: Performance Optimization

#### 1. Query Performance Analysis
```sql
-- Identify slow queries for optimization
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 50
ORDER BY mean_time DESC 
LIMIT 20;
```

#### 2. Index Optimization
```sql
-- Create indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_daily_log_user_date 
ON daily_log(user_id, date);

CREATE INDEX CONCURRENTLY idx_compliance_event_user_taken 
ON compliance_event(user_id, taken_at);
```

#### 3. API Performance Review
- Analyze endpoint response times
- Identify bottlenecks
- Review database query patterns
- Optimize slow endpoints

### Thursday: Infrastructure Review

#### 1. Resource Utilization
- Review CPU and memory usage trends
- Check disk space utilization
- Monitor network bandwidth
- Review auto-scaling events

#### 2. Cost Optimization
- Review cloud service costs
- Identify cost optimization opportunities
- Analyze resource utilization vs. cost
- Plan budget adjustments

#### 3. Dependency Updates
```bash
# Check for outdated dependencies
npm outdated

# Update dependencies in development
npm update

# Test updated dependencies
npm run test
npm run test:integration
```

### Friday: User Experience Review

#### 1. User Analytics Review
- Review user engagement metrics
- Analyze user journey patterns
- Identify drop-off points
- Review feature adoption rates

#### 2. App Store Review Monitoring
- Monitor app store ratings and reviews
- Respond to user feedback
- Identify common issues
- Plan improvements

#### 3. Support Ticket Analysis
- Categorize support tickets
- Identify recurring issues
- Plan documentation improvements
- Schedule training for support team

## Monthly Review Procedures

### 1. Comprehensive Security Audit

#### Vulnerability Assessment
- Run automated security scans
- Review penetration test results
- Check for new CVEs
- Update security policies

#### Access Control Audit
```sql
-- Review all user access
SELECT 
    u.id, 
    u.email, 
    u.role, 
    u.created_at,
    u.last_login_at,
    COUNT(a.id) as audit_events
FROM users u
LEFT JOIN audit_log a ON u.id = a.user_id
GROUP BY u.id
ORDER BY u.last_login_at DESC;
```

#### Data Access Audit
```sql
-- Review sensitive data access
SELECT 
    entity_type,
    action,
    COUNT(*) as access_count,
    COUNT(DISTINCT user_id) as unique_users
FROM audit_log 
WHERE created_at > NOW() - INTERVAL '30 days'
  AND entity_type IN ('LabReport', 'LabMarker', 'ProgressPhoto')
GROUP BY entity_type, action;
```

### 2. Performance Baseline Update

#### Performance Metrics Collection
- Collect performance baselines
- Compare with previous month
- Identify performance trends
- Update performance targets

#### Capacity Planning
- Review resource usage trends
- Plan for scaling requirements
- Update infrastructure capacity
- Plan hardware/software upgrades

### 3. Compliance Review

#### HIPAA Compliance Check
- Review audit log completeness
- Check data encryption status
- Verify access controls
- Review business associate agreements

#### Data Retention Review
```sql
-- Check data retention compliance
SELECT 
    table_name,
    COUNT(*) as record_count,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM information_schema.tables 
JOIN (
    SELECT 'audit_log' as table_name, created_at FROM audit_log
    UNION ALL
    SELECT 'daily_log' as table_name, created_at FROM daily_log
    UNION ALL
    SELECT 'compliance_event' as table_name, created_at FROM compliance_event
) data ON table_name = table_name
GROUP BY table_name;
```

### 4. Disaster Recovery Testing

#### Backup Restoration Test
- Test database backup restoration
- Verify S3 data integrity
- Test application recovery
- Document recovery procedures

#### Failover Testing
- Test database failover
- Verify load balancer configuration
- Test CDN failover
- Document failover procedures

## Quarterly Audit Preparation

### 1. Security Audit Preparation

#### Documentation Preparation
- Compile security policies
- Document incident response procedures
- Prepare access control matrices
- Compile vulnerability reports

#### Evidence Collection
- Collect audit log exports
- Prepare compliance reports
- Document security training records
- Compile incident reports

#### Third-Party Assessment
- Schedule penetration testing
- Arrange security audits
- Prepare for compliance audits
- Review vendor security

### 2. Financial Review

#### Cost Analysis
- Analyze infrastructure costs
- Review cloud service expenses
- Evaluate cost optimization efforts
- Plan budget for next quarter

#### ROI Assessment
- Calculate application ROI
- Analyze user growth vs. costs
- Review feature development costs
- Plan investment priorities

### 3. Strategic Planning

#### Technology Roadmap
- Review technology stack
- Plan framework updates
- Evaluate new technologies
- Plan migration strategies

#### Feature Planning
- Review user feedback
- Analyze market trends
- Plan feature development
- Prioritize development efforts

## Annual Compliance Review

### 1. Comprehensive Compliance Assessment

#### HIPAA Compliance Review
- Conduct comprehensive HIPAA audit
- Review all business associate agreements
- Assess data handling procedures
- Update privacy policies

#### Security Framework Review
- Review security frameworks (NIST, ISO 27001)
- Update security policies
- Conduct risk assessment
- Update incident response plans

#### Legal Compliance Review
- Review terms of service
- Update privacy policies
- Assess regulatory compliance
- Review data processing agreements

### 2. Infrastructure Architecture Review

#### Technology Stack Evaluation
- Evaluate current technology choices
- Assess performance and scalability
- Review security posture
- Plan technology updates

#### Infrastructure Assessment
- Review cloud architecture
- Assess disaster recovery capabilities
- Evaluate performance metrics
- Plan infrastructure improvements

### 3. Business Continuity Planning

#### Disaster Recovery Plan Update
- Test disaster recovery procedures
- Update recovery time objectives
- Test backup restoration
- Document lessons learned

#### Business Impact Analysis
- Assess critical business functions
- Identify single points of failure
- Update business continuity plans
- Conduct tabletop exercises

## Emergency Procedures

### 1. Service Outage Response

#### Immediate Response (0-15 minutes)
1. **Identify the Issue**
   ```bash
   # Check service status
   curl -f https://api.biopoint.com/health
   
   # Check database connectivity
   npm run health:database
   
   # Check infrastructure status
   npm run health:infrastructure
   ```

2. **Assess Impact**
   - Determine affected services
   - Identify user impact
   - Check error rates
   - Review monitoring alerts

3. **Initial Communication**
   - Post status update
   - Notify incident response team
   - Alert stakeholders
   - Document timeline

#### Investigation Phase (15-60 minutes)
1. **Root Cause Analysis**
   - Review recent deployments
   - Check infrastructure logs
   - Analyze error patterns
   - Review configuration changes

2. **Implement Temporary Fixes**
   - Restart services if needed
   - Scale infrastructure
   - Implement workarounds
   - Monitor recovery

#### Resolution Phase (60+ minutes)
1. **Implement Permanent Fix**
   - Deploy code fixes
   - Update infrastructure
   - Test thoroughly
   - Monitor stability

2. **Post-Incident Review**
   - Document incident
   - Analyze root cause
   - Identify improvements
   - Update procedures

### 2. Security Incident Response

#### Immediate Response
1. **Contain the Threat**
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Preserve evidence

2. **Assess the Damage**
   - Identify compromised data
   - Assess user impact
   - Determine breach scope
   - Document timeline

3. **Notification Requirements**
   - Notify legal team
   - Assess regulatory requirements
   - Prepare user notifications
   - Contact law enforcement if needed

#### Recovery Phase
1. **System Restoration**
   - Patch vulnerabilities
   - Update security measures
   - Restore from backups
   - Verify system integrity

2. **Compliance Activities**
   - Document incident
   - File required reports
   - Cooperate with investigations
   - Update security policies

## Contact Information

### Internal Team
- **On-call Engineer**: +1-555-0123
- **Security Team**: security@biopoint.com
- **DevOps Team**: devops@biopoint.com
- **Management**: management@biopoint.com

### External Vendors
- **Render Support**: support@render.com
- **Neon Support**: support@neon.tech
- **AWS Support**: AWS Support Center
- **Sentry Support**: support@sentry.io

### Emergency Contacts
- **Data Center**: +1-555-0456
- **Network Provider**: +1-555-0789
- **Security Incident**: incident@biopoint.com

## Documentation Maintenance

This runbook should be reviewed and updated:
- **Monthly**: Review procedures for accuracy
- **Quarterly**: Update based on lessons learned
- **Annually**: Comprehensive review and revision

Last Updated: January 2024
Next Review: February 2024