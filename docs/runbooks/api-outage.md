# API Outage Runbook

## Overview
This runbook provides step-by-step procedures for responding to API service outages in the BioPoint production environment.

## Severity Levels

### P0 - Critical Outage
- **Definition**: Complete API unavailability or core functionality failure
- **Impact**: All users unable to access system, PHI data at risk
- **Response Time**: Immediate (within 5 minutes)
- **Escalation**: Engineering Manager → CTO → CEO

### P1 - Major Outage
- **Definition**: Significant degradation or partial functionality loss
- **Impact**: Large number of users affected, some features unavailable
- **Response Time**: Within 15 minutes
- **Escalation**: Senior Engineer → Engineering Manager

### P2 - Minor Outage
- **Definition**: Limited functionality impact or performance degradation
- **Impact**: Small number of users affected, workarounds available
- **Response Time**: Within 30 minutes
- **Escalation**: On-call Engineer

## Immediate Response (First 5 Minutes)

### 1. Acknowledge Alert
- [ ] Acknowledge alert in PagerDuty
- [ ] Join #incident-response Slack channel
- [ ] Create incident in JIRA with label `api-outage`
- [ ] Notify stakeholders in #general Slack channel

### 2. Initial Assessment
- [ ] Check API health endpoint: `curl https://api.biopoint.com/health`
- [ ] Check status page: https://status.biopoint.com
- [ ] Review recent deployments in CI/CD pipeline
- [ ] Check Datadog APM for error spikes
- [ ] Check Sentry for new error patterns

### 3. Determine Scope
- [ ] Is this a complete outage or partial degradation?
- [ ] Which endpoints are affected?
- [ ] Are all regions impacted or specific ones?
- [ ] Is this affecting web app, mobile app, or both?

## Investigation Steps

### 4. Infrastructure Check
```bash
# Check Kubernetes pods
kubectl get pods -n biopoint-api
kubectl describe pods -n biopoint-api
kubectl logs -n biopoint-api deployment/biopoint-api --tail=100

# Check services
kubectl get services -n biopoint-api
kubectl describe service biopoint-api -n biopoint-api

# Check ingress
kubectl get ingress -n biopoint-api
kubectl describe ingress biopoint-api -n biopoint-api
```

### 5. Database Connectivity
```bash
# Check database connection
kubectl exec -it biopoint-api-pod -n biopoint-api -- node -e "
const db = require('./dist/config/database').default;
db.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"

# Check connection pool
kubectl exec -it biopoint-api-pod -n biopoint-api -- curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" http://localhost:3000/health/db
```

### 6. External Services
```bash
# Check S3 connectivity
kubectl exec -it biopoint-api-pod -n biopoint-api -- curl http://localhost:3000/health/s3

# Check external API dependencies
kubectl exec -it biopoint-api-pod -n biopoint-api -- curl http://localhost:3000/health/external
```

### 7. Resource Utilization
```bash
# Check resource usage
kubectl top pods -n biopoint-api
kubectl top nodes

# Check pod events
kubectl get events -n biopoint-api --sort-by='.lastTimestamp'
```

### 8. Network Connectivity
```bash
# Test internal connectivity
kubectl exec -it biopoint-api-pod -n biopoint-api -- nslookup biopoint-database
kubectl exec -it biopoint-api-pod -n biopoint-api -- ping -c 3 biopoint-database

# Check load balancer
kubectl get endpoints -n biopoint-api
```

## Common Issues and Solutions

### Issue 1: Database Connection Failure

**Symptoms:**
- `/health/db` endpoint returns 503
- Database connection errors in logs
- Query timeouts

**Diagnosis:**
```bash
# Check database status
kubectl get pods -n biopoint-database
kubectl logs -n biopoint-database deployment/biopoint-database --tail=50

# Test database connectivity
kubectl exec -it biopoint-api-pod -n biopoint-api -- nc -zv biopoint-database 5432
```

**Resolution:**
1. [ ] Check database credentials in Kubernetes secrets
2. [ ] Verify database is running and accepting connections
3. [ ] Check database connection pool configuration
4. [ ] Restart database if necessary
5. [ ] Scale database if connection limit reached

### Issue 2: Memory Exhaustion

**Symptoms:**
- High memory usage in `kubectl top pods`
- Out of memory errors in logs
- Pod restarts due to OOMKilled

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n biopoint-api --containers
kubectl describe pod biopoint-api-pod -n biopoint-api | grep -A 5 "Last State"

# Check for memory leaks
kubectl logs -n biopoint-api deployment/biopoint-api | grep -i "memory\|heap\|leak"
```

**Resolution:**
1. [ ] Increase memory limits in deployment
2. [ ] Restart pods to clear memory
3. [ ] Investigate memory leak in application code
4. [ ] Enable garbage collection profiling
5. [ ] Scale horizontally to distribute load

### Issue 3: High CPU Usage

**Symptoms:**
- High CPU usage in `kubectl top pods`
- Slow response times
- Request timeouts

**Diagnosis:**
```bash
# Check CPU usage
kubectl top pods -n biopoint-api --containers

# Check for CPU-intensive operations
kubectl logs -n biopoint-api deployment/biopoint-api | grep -i "timeout\|slow\|cpu"
```

**Resolution:**
1. [ ] Increase CPU limits in deployment
2. [ ] Scale horizontally to distribute load
3. [ ] Optimize database queries
4. [ ] Enable request caching
5. [ ] Review recent code changes

### Issue 4: Network Issues

**Symptoms:**
- Connection timeouts
- DNS resolution failures
- Intermittent connectivity

**Diagnosis:**
```bash
# Check network policies
kubectl get networkpolicies -n biopoint-api

# Test connectivity
kubectl exec -it biopoint-api-pod -n biopoint-api -- nslookup google.com
kubectl exec -it biopoint-api-pod -n biopoint-api -- curl -I https://api.biopoint.com
```

**Resolution:**
1. [ ] Check network policies for blocking rules
2. [ ] Verify DNS configuration
3. [ ] Check load balancer health
4. [ ] Review ingress configuration
5. [ ] Test connectivity to external services

### Issue 5: Application Errors

**Symptoms:**
- 5xx HTTP status codes
- Error spikes in Datadog/Sentry
- Unhandled exceptions in logs

**Diagnosis:**
```bash
# Check error logs
kubectl logs -n biopoint-api deployment/biopoint-api | grep -i "error\|exception"

# Check Sentry for recent errors
open https://sentry.io/organizations/biopoint/issues/
```

**Resolution:**
1. [ ] Review recent deployments
2. [ ] Check for configuration changes
3. [ ] Verify environment variables
4. [ ] Roll back recent deployment if necessary
5. [ ] Fix application code issues

## Recovery Procedures

### Rolling Back Deployments
```bash
# List recent deployments
kubectl rollout history deployment/biopoint-api -n biopoint-api

# Roll back to previous version
kubectl rollout undo deployment/biopoint-api -n biopoint-api --to-revision=PREVIOUS_REVISION

# Monitor rollback progress
kubectl rollout status deployment/biopoint-api -n biopoint-api
```

### Scaling Resources
```bash
# Scale API deployment
kubectl scale deployment biopoint-api -n biopoint-api --replicas=10

# Scale database (if applicable)
kubectl scale deployment biopoint-database -n biopoint-database --replicas=3

# Check scaling status
kubectl get pods -n biopoint-api
```

### Restarting Services
```bash
# Restart API deployment
kubectl rollout restart deployment/biopoint-api -n biopoint-api

# Restart database
kubectl rollout restart deployment/biopoint-database -n biopoint-database

# Check restart status
kubectl get pods -n biopoint-api
```

## Communication

### Internal Communication
1. **Slack Channels**:
   - `#incident-response` - Primary incident coordination
   - `#engineering` - Technical updates
   - `#general` - Company-wide updates
   - `#customer-success` - Customer communication

2. **Status Page**:
   - Update https://status.biopoint.com
   - Post incident updates every 30 minutes
   - Mark as resolved when service is restored

3. **Incident Commander**:
   - Designate incident commander
   - Coordinate response efforts
   - Make go/no-go decisions
   - Communicate with stakeholders

### External Communication
1. **Customer Notification**:
   - Send email to affected customers
   - Post on status page
   - Update customer support team

2. **Regulatory Notification** (if applicable):
   - HIPAA breach notification if PHI involved
   - Customer notification within required timeframes
   - Document all communications

## Post-Incident Actions

### 1. Service Restoration Verification
- [ ] Verify all health checks are passing
- [ ] Run full system tests
- [ ] Monitor for 30 minutes post-restoration
- [ ] Confirm with customer support team

### 2. Incident Documentation
- [ ] Update JIRA incident ticket
- [ ] Document root cause analysis
- [ ] Record timeline of events
- [ ] Note lessons learned

### 3. Post-Mortem Meeting
- [ ] Schedule post-mortem within 24 hours
- [ ] Invite all stakeholders
- [ ] Prepare timeline and analysis
- [ ] Create action items for prevention

### 4. Process Improvement
- [ ] Update runbooks based on learnings
- [ ] Implement preventive measures
- [ ] Update monitoring and alerting
- [ ] Train team on new procedures

## Escalation Procedures

### Tier 1: On-Call Engineer (0-15 minutes)
- Initial assessment and response
- Basic troubleshooting
- Communication to team

### Tier 2: Senior Engineer (15-30 minutes)
- Advanced troubleshooting
- Architecture decisions
- Vendor escalation

### Tier 3: Engineering Manager (30-60 minutes)
- Business impact assessment
- Customer communication
- Resource allocation

### Tier 4: CTO (60+ minutes)
- Executive decision making
- External communication
- Regulatory compliance

## Contact Information

### Internal Contacts
- **On-Call Engineer**: Via PagerDuty
- **SRE Team**: sre-team@biopoint.com
- **Engineering Manager**: eng-manager@biopoint.com
- **CTO**: cto@biopoint.com

### External Vendors
- **AWS Support**: Premium support case
- **Datadog Support**: support@datadoghq.com
- **Sentry Support**: support@sentry.io
- **Cloud Provider**: Emergency contact

### Emergency Contacts
- **AWS Emergency**: +1-206-266-4064
- **Security Team**: security-team@biopoint.com
- **Legal Team**: legal@biopoint.com

## Tools and Resources

### Monitoring Tools
- **Datadog**: https://app.datadoghq.com
- **Sentry**: https://sentry.io/organizations/biopoint
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090

### AWS Tools
- **CloudWatch**: https://console.aws.amazon.com/cloudwatch
- **ECS Console**: https://console.aws.amazon.com/ecs
- **RDS Console**: https://console.aws.amazon.com/rds

### Kubernetes Tools
- **Cluster Dashboard**: https://kubernetes-dashboard.biopoint.com
- **Lens**: Desktop Kubernetes IDE
- **kubectl**: Command-line tool

## Appendices

### Appendix A: Common Commands
```bash
# Quick health check
curl -I https://api.biopoint.com/health

# Check recent logs
kubectl logs -n biopoint-api deployment/biopoint-api --tail=100

# Check service status
kubectl get services -n biopoint-api

# Check pod status
kubectl get pods -n biopoint-api -o wide

# Check events
kubectl get events -n biopoint-api --sort-by='.lastTimestamp'
```

### Appendix B: Error Codes
| Code | Description | Action |
|------|-------------|--------|
| 500 | Internal Server Error | Check application logs |
| 502 | Bad Gateway | Check upstream services |
| 503 | Service Unavailable | Check service health |
| 504 | Gateway Timeout | Check network connectivity |

### Appendix C: Recovery Time Objectives
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **MTTR (Mean Time To Recovery)**: 2 hours

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Owner**: SRE Team  
**Review Schedule**: Quarterly