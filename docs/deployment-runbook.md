# BioPoint Deployment Runbook

## Quick Reference

### Emergency Contacts
- **DevOps On-Call**: +1-XXX-XXX-XXXX
- **Security Team**: security@biopoint.health
- **Platform Team**: platform@biopoint.health

### Important URLs
- **Production**: https://api.biopoint.health
- **Staging**: https://api-staging.biopoint.health
- **Status Page**: https://status.biopoint.health
- **Metrics Dashboard**: https://metrics.biopoint.health

## Pre-Deployment Checklist

### 1. Code Readiness
- [ ] All tests passing in CI
- [ ] Code review completed
- [ ] Security scan clean
- [ ] Database migrations tested
- [ ] Documentation updated

### 2. Environment Validation
- [ ] Staging deployment successful
- [ ] Smoke tests passing
- [ ] Performance tests acceptable
- [ ] Security validation complete

### 3. Communication
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled
- [ ] Rollback plan prepared
- [ ] Support team briefed

## Deployment Procedures

### Standard Deployment (Staging)

```bash
# 1. Trigger staging deployment
gh workflow run deploy-staging.yml

# 2. Monitor deployment
gh run watch --workflow=deploy-staging.yml

# 3. Verify deployment
curl https://api-staging.biopoint.health/health
```

### Production Deployment

#### Option 1: GitHub Actions (Recommended)

```bash
# 1. Create and push version tag
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# 2. Monitor deployment
gh run watch --workflow=deploy-production.yml

# 3. Verify deployment
curl https://api.biopoint.health/health
```

#### Option 2: Manual Deployment

```bash
# 1. Run deployment script
./scripts/deploy-production.sh blue v1.2.3

# 2. Monitor progress
kubectl rollout status deployment/biopoint-api-blue -n biopoint-production

# 3. Verify deployment
./scripts/run-smoke-tests.sh production
```

### Blue-Green Deployment Process

1. **Determine Active Environment**
   ```bash
   # Check current active color
   kubectl get service biopoint-production-service -n biopoint-production -o jsonpath='{.spec.selector.color}'
   ```

2. **Deploy to Inactive Environment**
   ```bash
   # Deploy to green (if blue is active)
   ./scripts/deploy-production.sh green v1.2.3
   ```

3. **Validate New Deployment**
   ```bash
   # Run smoke tests
   ./scripts/run-smoke-tests.sh production
   
   # Check health
   curl https://api.biopoint.health/health
   ```

4. **Switch Traffic**
   ```bash
   # Switch to green
   kubectl patch service biopoint-production-service -n biopoint-production -p '{"spec":{"selector":{"color":"green"}}}'
   ```

5. **Verify Traffic Switch**
   ```bash
   # Monitor for 5 minutes
   watch -n 30 'curl -s https://api.biopoint.health/health | jq .'
   ```

## Deployment Verification

### Health Checks

```bash
# Application health
curl -f https://api.biopoint.health/health

# Database connectivity
curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" -f https://api.biopoint.health/health/db

# Overall system health
curl -f https://api.biopoint.health/health/system
```

### Performance Validation

```bash
# Response time check
curl -w "@curl-format.txt" -o /dev/null -s https://api.biopoint.health/health

# Load test (light)
k6 run --vus 10 --duration 30s load-test-smoke.js

# Database performance
doppler run -- npm run db:performance
```

### Security Validation

```bash
# Security headers
curl -I https://api.biopoint.health | grep -E "(X-Content-Type-Options|X-Frame-Options|Strict-Transport-Security)"

# SSL certificate
echo | openssl s_client -connect api.biopoint.health:443 -servername api.biopoint.health | openssl x509 -noout -dates

# Encryption validation
doppler run -- npm run encryption:validate
```

## Troubleshooting

### Common Deployment Issues

#### 1. Image Pull Errors

**Symptoms**: Pods stuck in `ImagePullBackOff` or `ErrImagePull`

**Diagnosis**:
```bash
# Check pod events
kubectl describe pod <pod-name> -n biopoint-production

# Verify image exists
docker pull $ECR/biopoint-api:v1.2.3

# Check ECR permissions
aws ecr describe-images --repository-name biopoint-api
```

**Resolution**:
```bash
# Re-push image
docker push $ECR/biopoint-api:v1.2.3

# Update image in deployment
kubectl set image deployment/biopoint-api biopoint-api=$ECR/biopoint-api:v1.2.3 -n biopoint-production
```

#### 2. Database Migration Failures

**Symptoms**: Migration job failed, application not starting

**Diagnosis**:
```bash
# Check migration job logs
kubectl logs job/biopoint-migration -n biopoint-production

# Check database connectivity
doppler run -- npm run db:health

# Verify migration status
doppler run -- npm run db:migrate:status
```

**Resolution**:
```bash
# Rollback migration
doppler run -- npm run db:migrate:rollback

# Fix migration issue and redeploy
# ... fix migration ...
kubectl delete job biopoint-migration -n biopoint-production
```

#### 3. Resource Constraints

**Symptoms**: Pods stuck in `Pending`, `CrashLoopBackOff`

**Diagnosis**:
```bash
# Check node resources
kubectl top nodes

# Check pod resource usage
kubectl top pods -n biopoint-production

# Check events
kubectl get events -n biopoint-production --sort-by='.lastTimestamp'
```

**Resolution**:
```bash
# Scale up cluster
aws eks update-nodegroup-config --cluster-name biopoint-production --nodegroup-name biopoint-ng --scaling-config minSize=3,maxSize=10,desiredSize=5

# Adjust resource limits
kubectl edit deployment biopoint-api -n biopoint-production
```

#### 4. Service Discovery Issues

**Symptoms**: 503 errors, connection refused

**Diagnosis**:
```bash
# Check service endpoints
kubectl get endpoints -n biopoint-production

# Check service configuration
kubectl get service biopoint-production-service -o yaml

# Check ingress configuration
kubectl get ingress -n biopoint-production
```

**Resolution**:
```bash
# Restart service
kubectl delete pods -l app=biopoint-api -n biopoint-production

# Check network policies
kubectl get networkpolicies -n biopoint-production
```

### Performance Issues

#### High Response Times

**Diagnosis**:
```bash
# Check application metrics
curl https://api.biopoint.health/metrics | jq

# Check database performance
doppler run -- npm run db:performance

# Analyze slow queries
kubectl exec -it postgres-pod -- psql -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

**Resolution**:
```bash
# Scale application
kubectl scale deployment biopoint-api --replicas=10 -n biopoint-production

# Optimize database
# ... database optimization ...

# Add caching
# ... implement caching ...
```

#### High Error Rates

**Diagnosis**:
```bash
# Check error logs
kubectl logs -f deployment/biopoint-api -n biopoint-production | grep ERROR

# Check error metrics
curl https://api.biopoint.health/metrics | jq '.error_rate'

# Analyze error patterns
# ... error analysis ...
```

**Resolution**:
```bash
# Rollback if necessary
./scripts/rollback-production.sh

# Fix application issues
# ... application fixes ...

# Redeploy
# ... redeployment ...
```

### Security Issues

#### Vulnerability Discovery

**Immediate Actions**:
1. Assess severity and impact
2. Determine if rollback is necessary
3. Implement temporary mitigations
4. Plan permanent fix

**Process**:
```bash
# Run security scan
npm audit
snyk test

# Check for immediate threats
# ... threat assessment ...

# Implement temporary fix if needed
# ... temporary mitigation ...
```

#### Compliance Violations

**Immediate Actions**:
1. Identify scope of violation
2. Assess data exposure
3. Implement containment
4. Notify compliance team

**Process**:
```bash
# Run compliance check
npm run test:compliance

# Check audit logs
# ... audit log analysis ...

# Implement corrective measures
# ... compliance fixes ...
```

## Rollback Procedures

### Automatic Rollback

**Triggers**:
- Health check failure
- Smoke test failure
- Error rate > 5%
- Response time > 5s

**Process**:
1. Traffic automatically switched
2. New deployment scaled down
3. Alert sent to team
4. Incident created

### Manual Rollback

#### Quick Rollback (One-Click)
```bash
# Using GitHub Actions
gh workflow run rollback-production.yml

# Using kubectl
kubectl rollout undo deployment/biopoint-api -n biopoint-production
```

#### Detailed Rollback

1. **Identify Current State**
   ```bash
   # Check current deployment
   kubectl get deployment biopoint-api -n biopoint-production
   
   # Check current color
   kubectl get service biopoint-production-service -o jsonpath='{.spec.selector.color}'
   ```

2. **Switch Traffic to Previous Version**
   ```bash
   # If blue is current, switch to green
   kubectl patch service biopoint-production-service -p '{"spec":{"selector":{"color":"green"}}}'
   ```

3. **Verify Rollback**
   ```bash
   # Check health
   curl -f https://api.biopoint.health/health
   
   # Run smoke tests
   ./scripts/run-smoke-tests.sh production
   ```

4. **Scale Down Failed Deployment**
   ```bash
   # Scale down the failed deployment
   kubectl scale deployment biopoint-api-blue --replicas=0 -n biopoint-production
   ```

### Database Rollback

**Warning**: Database rollback should be done with extreme caution

1. **Assess Impact**
   ```bash
   # Check migration status
   doppler run -- npm run db:migrate:status
   
   # Identify problematic migrations
   # ... migration analysis ...
   ```

2. **Create Backup** (if not exists)
   ```bash
   # Create database backup
   doppler run -- npm run db:backup
   ```

3. **Rollback Migration**
   ```bash
   # Rollback specific migration
   doppler run -- npm run db:migrate:rollback -- --to 20231201120000
   ```

4. **Verify Data Integrity**
   ```bash
   # Run data validation
   doppler run -- npm run db:validate
   
   # Check application functionality
   ./scripts/run-smoke-tests.sh production
   ```

## Communication Templates

### Pre-Deployment Notification

```
Subject: [SCHEDULED] BioPoint Production Deployment - v1.2.3

Team,

We are scheduled to deploy BioPoint v1.2.3 to production today at 2:00 PM EST.

**Deployment Details:**
- Version: v1.2.3
- Changes: [Link to changelog]
- Estimated Duration: 30 minutes
- Rollback Plan: Available (rollback time: 5 minutes)

**What's New:**
- Feature A: Description
- Bug Fix B: Description
- Security Update C: Description

**Potential Impact:**
- Brief service interruption (2-3 minutes)
- Database migration (5 minutes)

**Monitoring:**
- Status Page: https://status.biopoint.health
- Metrics: https://metrics.biopoint.health

Please direct any questions to the DevOps team.

Best regards,
DevOps Team
```

### Post-Deployment Notification

```
Subject: [COMPLETED] BioPoint Production Deployment - v1.2.3 - SUCCESS

Team,

The deployment of BioPoint v1.2.3 to production has been completed successfully.

**Deployment Summary:**
- Status: SUCCESS
- Duration: 25 minutes
- Downtime: 2 minutes
- All systems operational

**Verification:**
- Health checks: ✅ PASSED
- Smoke tests: ✅ PASSED
- Performance tests: ✅ PASSED
- Security validation: ✅ PASSED

**Monitoring:**
- All metrics within normal range
- No errors detected
- Response times normal

The deployment is considered complete and successful.

Best regards,
DevOps Team
```

### Rollback Notification

```
Subject: [ROLLBACK] BioPoint Production Deployment - v1.2.3 - ROLLBACK INITIATED

Team,

We have initiated a rollback of BioPoint v1.2.3 due to [reason].

**Rollback Details:**
- Original Version: v1.2.3
- Rolled Back To: v1.2.2
- Rollback Start Time: 2:15 PM EST
- Current Status: In Progress

**Reason for Rollback:**
[Detailed explanation of the issue]

**Impact:**
- Service restored to previous version
- No data loss
- All functionality restored

**Next Steps:**
1. Investigate root cause
2. Implement fixes
3. Plan re-deployment

We will provide updates as the situation develops.

Best regards,
DevOps Team
```

## Emergency Procedures

### Production Outage

1. **Immediate Response (0-5 minutes)**
   - Acknowledge incident
   - Assess scope and impact
   - Initiate incident response

2. **Assessment (5-15 minutes)**
   - Identify root cause
   - Determine if rollback needed
   - Communicate with stakeholders

3. **Resolution (15-60 minutes)**
   - Implement fix or rollback
   - Verify system functionality
   - Monitor for stability

4. **Post-Incident (60+ minutes)**
   - Conduct post-mortem
   - Document lessons learned
   - Implement preventive measures

### Security Incident

1. **Containment**
   - Isolate affected systems
   - Preserve evidence
   - Prevent further damage

2. **Assessment**
   - Determine scope of breach
   - Identify compromised data
   - Assess ongoing risk

3. **Notification**
   - Notify security team
   - Inform stakeholders
   - Comply with regulations

4. **Recovery**
   - Implement security fixes
   - Restore services
   - Monitor for threats

### Data Breach

1. **Immediate Actions**
   - Contain breach
   - Preserve evidence
   - Assess data involved

2. **Notification Requirements**
   - HIPAA: Notify within 60 days
   - State laws: Varies by jurisdiction
   - Patients: Individual notification

3. **Investigation**
   - Root cause analysis
   - Impact assessment
   - Preventive measures

---

**Document Version**: 1.0.0
**Last Updated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Next Review**: $(date -d '+3 months' -u +%Y-%m-%dT%H:%M:%SZ)