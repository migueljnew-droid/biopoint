# BioPoint Monitoring Setup Guide

## Overview

This document provides comprehensive instructions for setting up enterprise-grade monitoring and alerting for the BioPoint production environment. The monitoring stack is designed to be HIPAA-compliant and provides 24/7 observability for healthcare applications.

## Architecture

### Primary Monitoring (Datadog)
- **APM Tracing**: Application performance monitoring with distributed tracing
- **Infrastructure Monitoring**: Server, container, and cloud resource monitoring
- **Log Management**: Centralized log collection with PHI masking
- **Security Monitoring**: Runtime security and compliance monitoring
- **Custom Metrics**: Business and healthcare-specific metrics

### Backup Monitoring (Prometheus + Grafana)
- **Metrics Collection**: Time-series metrics as backup to Datadog
- **Dashboards**: Grafana dashboards for visualization
- **Alerting**: Prometheus Alertmanager for backup alerting
- **Log Aggregation**: Loki for log aggregation backup

### Error Tracking (Sentry)
- **Error Monitoring**: Real-time error tracking and reporting
- **Performance Monitoring**: Application performance insights
- **Release Tracking**: Deployment and version tracking
- **Source Maps**: JavaScript/React Native source map support

## Components

### 1. Datadog Integration

#### Installation
```bash
# Add Datadog Helm repository
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Install Datadog agent
helm install biopoint-datadog datadog/datadog \
  -f k8s/datadog-values.yaml \
  --namespace monitoring \
  --create-namespace
```

#### Configuration
- **API Key**: Set `DATADOG_API_KEY` environment variable
- **App Key**: Set `DATADOG_APP_KEY` environment variable
- **Service Name**: `biopoint-api` for API service
- **Environment**: `production` for production environment

#### Custom Metrics
The system tracks the following custom metrics:

| Metric | Type | Description | Tags |
|--------|------|-------------|------|
| `biopoint.phi.access` | Counter | PHI access events | `user`, `action`, `env` |
| `biopoint.auth.attempt` | Counter | Authentication attempts | `user`, `success`, `method` |
| `biopoint.s3.operation` | Counter | S3 operations | `operation`, `bucket`, `success` |
| `biopoint.s3.operation.duration` | Histogram | S3 operation duration | `operation`, `bucket` |
| `biopoint.database.query` | Counter | Database queries | `query_type`, `table`, `success` |
| `biopoint.database.query.duration` | Histogram | Database query duration | `query_type`, `table` |
| `biopoint.business.active_users` | Gauge | Active users | `env`, `service` |

### 2. Sentry Integration

#### API Configuration
```typescript
// apps/api/src/utils/sentry.ts
import { sentry } from './utils/sentry';

// Initialize Sentry
sentry.initializeSentry();

// Track errors
sentry.captureError(error, {
  user: { id: userId, email: userEmail },
  tags: {
    category: 'auth_failure',
    severity: 'high',
  },
});
```

#### Mobile App Configuration
```javascript
// apps/mobile/src/utils/sentry.js
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `biopoint-mobile@${version}`,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter out health check errors
    if (event.transaction?.includes('/health')) {
      return null;
    }
    return event;
  },
});
```

### 3. Health Checks

#### Endpoints
- **Basic Health**: `GET /health` - Overall service health
- **Database Health**: `GET /health/db` - Database connectivity
- **S3 Health**: `GET /health/s3` - S3 storage connectivity
- **External Services**: `GET /health/external` - External service dependencies

#### Access Notes
- `/health` is public and returns minimal status for load balancers/uptime checks.
- `/health` includes extra details (e.g., DB pool utilization) only when a valid `HEALTH_CHECK_TOKEN` is provided.
- `/health/db` requires `Authorization: Bearer $HEALTH_CHECK_TOKEN` (or `X-Health-Token`).

#### Implementation
```typescript
// apps/api/src/routes/health.ts
import { health } from '../config/monitoring';

// Register health checks
health.registerCheck('database', async () => {
  // Test database connection
  await db.query('SELECT 1');
  return true;
});

health.registerCheck('s3', async () => {
  // Test S3 connectivity
  await s3.headBucket({ Bucket: process.env.S3_BUCKET });
  return true;
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const result = await health.runHealthChecks();
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});
```

## Alerting Rules

### P0 Alerts (Page Immediately)
| Alert | Condition | Response Time |
|-------|-----------|---------------|
| API Down | API health check fails for > 1 minute | Immediate |
| Database Connection | Database connectivity fails | Immediate |
| PHI Data Breach | Unauthorized PHI access detected | Immediate |
| Admin Access | Unauthorized admin access attempt | Immediate |

### P1 Alerts (Alert within 5 minutes)
| Alert | Condition | Response Time |
|-------|-----------|---------------|
| Error Rate | Error rate > 5% for 5 minutes | 5 minutes |
| Response Time | p99 response time > 2 seconds | 5 minutes |
| S3 Failures | S3 upload failures > 10% | 5 minutes |
| Database Performance | Query time p99 > 1 second | 5 minutes |

### P2 Alerts (Alert within 15 minutes)
| Alert | Condition | Response Time |
|-------|-----------|---------------|
| Rate Limit | Rate limit violations spike | 15 minutes |
| Auth Patterns | Suspicious authentication patterns | 15 minutes |
| User Activity | Daily active users drop > 20% | 15 minutes |
| Memory Usage | Memory usage > 90% for 15 minutes | 15 minutes |

## Dashboards

### API Performance Dashboard
- Request rate and latency (p50, p95, p99)
- Error rate by endpoint
- Top 10 slowest endpoints
- Request distribution by HTTP method
- Geographic request distribution

### Database Performance Dashboard
- Query execution time (p50, p95, p99)
- Active connections and connection pool usage
- Slow query log analysis
- Database CPU and memory usage
- Query type distribution

### Security Dashboard
- Authentication failure rate
- Authorization error rate
- PHI access audit log
- Rate limiting violations
- Suspicious activity alerts

### Business Metrics Dashboard
- Daily/Monthly active users
- PHI access patterns
- User engagement metrics
- Feature adoption rates
- Compliance audit trail

## On-Call Rotation

### PagerDuty Integration
1. **Escalation Policy**: 3-tier escalation
   - Tier 1: Primary on-call engineer (15 minutes)
   - Tier 2: Senior engineer (30 minutes)
   - Tier 3: Engineering manager (60 minutes)

2. **On-Call Schedule**: Weekly rotation
   - Monday 9 AM - Next Monday 9 AM
   - Handoff procedures documented
   - Shadowing for new team members

3. **Alert Routing**:
   - P0 alerts: Page immediately
   - P1 alerts: Slack + SMS
   - P2 alerts: Slack + Email

### Incident Response
1. **Acknowledge**: Acknowledge alert within 5 minutes
2. **Assess**: Determine severity and impact
3. **Communicate**: Update stakeholders via Slack
4. **Resolve**: Fix issue and document resolution
5. **Post-mortem**: Conduct post-mortem within 24 hours

## Logging

### Log Levels
- **ERROR**: System errors, security incidents
- **WARN**: Warnings, deprecated usage
- **INFO**: Business operations, user actions
- **DEBUG**: Detailed debugging information

### PHI Masking
All logs are automatically scrubbed for PHI:
- Email addresses → `[EMAIL_MASKED]`
- SSN → `[SSN_MASKED]`
- Phone numbers → `[PHONE_MASKED]`
- Medical record numbers → `[MRN_MASKED]`

### Audit Logging
- User authentication events
- PHI access events
- Administrative actions
- Configuration changes
- Security incidents

## Setup Instructions

### Prerequisites
- Kubernetes cluster (v1.20+)
- Helm 3.x
- Docker and Docker Compose
- Datadog account with API keys
- Sentry account with DSN
- PagerDuty account

### Quick Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd biopoint

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration

# 3. Deploy monitoring stack
./scripts/setup-monitoring.sh

# 4. Verify deployment
kubectl get pods -n monitoring
kubectl get services -n monitoring

# 5. Access dashboards
# Datadog: https://app.datadoghq.com
# Grafana: http://localhost:3000 (admin/admin123)
# Prometheus: http://localhost:9090
```

### Manual Setup
See individual component documentation:
- [Datadog Setup](monitoring/datadog-setup.md)
- [Sentry Setup](monitoring/sentry-setup.md)
- [Health Checks](monitoring/health-checks.md)
- [Alerting Rules](monitoring/alerting-rules.md)

## Security Considerations

### HIPAA Compliance
1. **Data Masking**: All PHI is masked in logs and metrics
2. **Access Control**: Role-based access to monitoring data
3. **Encryption**: All data encrypted in transit and at rest
4. **Audit Trail**: Complete audit trail for compliance
5. **Data Retention**: 90-day retention for most logs, 7 years for audit logs

### Network Security
1. **Network Policies**: Restricted network access between services
2. **TLS**: All communications encrypted with TLS 1.3
3. **Secrets Management**: All secrets stored in Kubernetes secrets
4. **RBAC**: Role-based access control for all components

## Troubleshooting

### Common Issues
1. **Datadog Agent Not Starting**: Check API key and network connectivity
2. **High Memory Usage**: Adjust resource limits in values.yaml
3. **Missing Metrics**: Verify service discovery and annotations
4. **Alert Fatigue**: Tune alert thresholds and conditions

### Debug Commands
```bash
# Check Datadog agent status
kubectl exec -it datadog-agent-xxx -n monitoring -- agent status

# View Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Sentry issues
curl -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/
```

## Maintenance

### Regular Tasks
- **Weekly**: Review alert frequency and tune thresholds
- **Monthly**: Update monitoring dashboards and documentation
- **Quarterly**: Review and update alerting rules
- **Annually**: Audit monitoring setup for compliance

### Updates
- Keep monitoring components updated to latest versions
- Test updates in staging environment first
- Document all changes and configurations
- Backup configurations before updates

## Support

### Internal Contacts
- **SRE Team**: sre-team@biopoint.com
- **Security Team**: security-team@biopoint.com
- **On-Call Engineer**: Use PagerDuty escalation

### External Vendors
- **Datadog Support**: support@datadoghq.com
- **Sentry Support**: support@sentry.io
- **PagerDuty Support**: support@pagerduty.com

## References

- [Datadog Documentation](https://docs.datadoghq.com/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
