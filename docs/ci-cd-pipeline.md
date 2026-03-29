# BioPoint CI/CD Pipeline Documentation

## Overview

The BioPoint CI/CD pipeline is a comprehensive, automated deployment system designed for healthcare applications with strict security and compliance requirements. The pipeline implements industry best practices including blue-green deployments, automated testing, security scanning, and HIPAA compliance validation.

## Architecture

### Pipeline Components

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   CI Pipeline   │    │ Staging Deploy   │    │ Production Deploy│
│                 │    │                  │    │                  │
│ • Lint          │───▶│ • Build & Push   │───▶│ • Pre-validation │
│ • Test          │    │ • Deploy K8s     │    │ • Blue-Green     │
│ • Security Scan │    │ • Smoke Tests    │    │ • Traffic Switch │
│ • Build         │    │ • Health Checks  │    │ • Post-validation│
└─────────────────┘    └──────────────────┘    └──────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Quality Gates   │    │ Performance Test │    │ Rollback Capable │
│                 │    │                  │    │                  │
│ • Coverage 80%+ │    │ • Load Testing   │    │ • Automatic      │
│ • TypeScript    │    │ • DB Performance │    │ • Manual Trigger │
│ • Compliance    │    │ • Metrics Check  │    │ • One-Click      │
└─────────────────┘    └──────────────────┘    └──────────────────┘
```

### Technology Stack

- **CI/CD Platform**: GitHub Actions
- **Container Registry**: Amazon ECR
- **Orchestration**: Kubernetes (EKS)
- **Secrets Management**: Doppler
- **Monitoring**: CloudWatch, DataDog
- **Security Scanning**: Snyk, OWASP ZAP, Trivy
- **Compliance**: HIPAA, SOC2, GDPR

## Pipeline Workflows

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers**: Push to `main`/`develop`, Pull Requests

**Jobs** (Parallel Execution):

#### Lint Job
- **Purpose**: Code quality validation
- **Tools**: ESLint, Prettier
- **Configuration**: TypeScript-aware linting
- **Artifacts**: Lint results cache

#### Test Job
- **Test Types**: Unit, Integration, E2E
- **Coverage Requirement**: 80% minimum
- **Database**: Isolated test database
- **Tools**: Jest, Supertest, Playwright
- **Parallelization**: Matrix strategy

#### Security Scan Job
- **Dependency Scanning**: npm audit, Snyk
- **Code Scanning**: Semgrep, ESLint security rules
- **Secret Detection**: Gitleaks
- **Encryption Validation**: PHI encryption checks
- **Container Scanning**: Trivy (in build job)

#### Build Job
- **Prerequisites**: All previous jobs must pass
- **Build Strategy**: Turborepo with caching
- **Artifacts**: Docker images, build outputs
- **Multi-platform**: AMD64, ARM64 support

#### Type Check Job
- **Validation**: TypeScript compilation
- **Strict Mode**: Enabled
- **No Emit**: Type checking only

#### Quality Gates Job
- **Coverage Check**: Enforces 80% threshold
- **Compliance Tests**: HIPAA validation
- **Migration Validation**: Database schema checks
- **Final Validation**: Pre-deployment readiness

### 2. Staging Deployment (`.github/workflows/deploy-staging.yml`)

**Triggers**: Push to `main`, Manual dispatch

**Environment**: Staging (AWS EKS)

**Process**:

1. **Docker Build & Push**
   ```bash
   docker build -t biopoint-api:$SHA -f apps/api/Dockerfile .
   docker push $ECR/biopoint-api:$SHA
   ```

2. **Database Migration**
   ```bash
   doppler run -- npm run db:migrate
   ```

3. **Kubernetes Deployment**
   ```bash
   kubectl apply -f k8s/staging/
   kubectl rollout status deployment/biopoint-api
   ```

4. **Smoke Tests**
   - Health endpoint validation
   - Database connectivity
   - API functionality
   - Security headers

5. **Performance Tests**
   - Load testing (k6)
   - Database performance
   - Response time validation

6. **Security Scan**
   - OWASP ZAP baseline
   - SSL/TLS validation
   - Vulnerability assessment

### 3. Production Deployment (`.github/workflows/deploy-production.yml`)

**Triggers**: Version tags (`v*`), Manual dispatch

**Environment**: Production (AWS EKS)

**Approval Process**: Required reviewers

**Blue-Green Deployment Process**:

1. **Pre-deployment Validation**
   - Full test suite execution
   - Security validation
   - Compliance checks
   - Database migration dry-run

2. **Build & Push**
   - Production-tagged images
   - Multi-architecture support
   - ECR vulnerability scanning

3. **Blue-Green Deployment**
   ```bash
   # Deploy to inactive environment
   kubectl apply -f k8s/production/api-deployment-${COLOR}.yaml
   
   # Validate new deployment
   ./scripts/run-smoke-tests.sh production ${NEW_URL}
   
   # Switch traffic
   kubectl patch service biopoint-production-service \
     -p '{"spec":{"selector":{"color":"${COLOR}"}}}'
   ```

4. **Post-deployment Validation**
   - Comprehensive health checks
   - Error rate monitoring
   - Performance validation
   - Security verification

5. **Rollback Capability**
   - One-click rollback
   - Automatic on failure
   - Traffic switch reversal

### 4. Security Scan (`.github/workflows/security-scan.yml`)

**Schedule**: Daily at 2 AM

**Additional Triggers**: Dependency changes

**Scan Types**:

#### Dependency Scan
- **npm audit**: Known vulnerabilities
- **Snyk**: Comprehensive vulnerability database
- **License Check**: OSS compliance

#### Code Security
- **Semgrep**: Static analysis
- **Gitleaks**: Secret detection
- **ESLint**: Security rules
- **Custom Rules**: Healthcare-specific

#### Container Security
- **Trivy**: Vulnerability scanner
- **Docker Bench**: Security best practices
- **Image Signing**: Supply chain security

#### Infrastructure Security
- **Checkov**: Terraform scanning
- **tfsec**: Security misconfigurations
- **CloudTrail**: Audit logging

#### Web Security
- **OWASP ZAP**: Dynamic scanning
- **SSL Labs**: SSL/TLS validation
- **Security Headers**: HTTP security

#### Compliance Scan
- **HIPAA**: Healthcare compliance
- **PHI Encryption**: Data protection
- **Audit Logging**: Activity tracking
- **Data Retention**: Policy validation

## Deployment Scripts

### Staging Deployment (`scripts/deploy-staging.sh`)

**Features**:
- Automated Docker build and push
- Database migration with backup
- Kubernetes deployment with rollback
- Health check validation
- Slack notifications

**Usage**:
```bash
./scripts/deploy-staging.sh [environment]
```

**Environment Variables**:
```bash
export DOPPLER_TOKEN="your-doppler-token"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

### Production Deployment (`scripts/deploy-production.sh`)

**Features**:
- Blue-green deployment strategy
- Pre-deployment validation
- Automated rollback on failure
- Traffic switching with verification
- Deployment record creation

**Usage**:
```bash
./scripts/deploy-production.sh [blue|green] [version]
```

**Rollback**:
```bash
# Automatic on failure
# Manual: kubectl rollout undo deployment/biopoint-api
```

### Smoke Tests (`scripts/run-smoke-tests.sh`)

**Test Coverage**:
- Health endpoint validation
- Database connectivity
- API endpoint accessibility
- Authentication mechanisms
- Security headers
- SSL/TLS configuration
- Performance baseline
- Error handling

**Usage**:
```bash
./scripts/run-smoke-tests.sh [environment] [base-url]
```

## Environment Configuration

### GitHub Environments

#### Staging Environment
- **Name**: `staging`
- **Protection Rules**: None
- **Secrets**: Doppler, AWS, Slack
- **Variables**: Cluster name, region

#### Production Environment
- **Name**: `production`
- **Protection Rules**: Required reviewers
- **Reviewers**: DevOps team, Security team
- **Secrets**: Doppler, AWS, Slack
- **Variables**: Cluster name, region

### Doppler Configuration

#### Staging Config
```yaml
# doppler.yaml
staging:
  database:
    url: "postgresql://..."
  api:
    jwt_secret: "..."
  monitoring:
    datadog_api_key: "..."
```

#### Production Config
```yaml
# doppler.yaml
production:
  database:
    url: "postgresql://..."
    backup_enabled: true
  api:
    jwt_secret: "..."
    rate_limit: 1000
  security:
    encryption_key: "..."
  monitoring:
    datadog_api_key: "..."
    alerts_enabled: true
```

## Quality Gates

### Security Requirements

1. **Vulnerability Scanning**
   - No critical vulnerabilities
   - No high-severity vulnerabilities
   - Medium vulnerabilities reviewed

2. **Code Security**
   - No hardcoded secrets
   - Security headers present
   - Input validation
   - SQL injection prevention

3. **Container Security**
   - Base image scanning
   - Minimal attack surface
   - Non-root user
   - Security context

### Test Requirements

1. **Coverage**
   - Minimum 80% code coverage
   - Critical paths 100% covered
   - Integration tests passing

2. **Test Types**
   - Unit tests (Jest)
   - Integration tests (Supertest)
   - E2E tests (Playwright)
   - Security tests
   - Compliance tests

### Compliance Requirements

1. **HIPAA Compliance**
   - PHI encryption validated
   - Audit logging enabled
   - Access controls
   - Data retention policies

2. **Security Standards**
   - SOC 2 Type II
   - GDPR compliance
   - OWASP Top 10
   - CWE/SANS Top 25

## Monitoring and Alerting

### Metrics Collection

#### Application Metrics
- Response time
- Error rate
- Request volume
- Database performance
- Queue depth

#### Infrastructure Metrics
- CPU utilization
- Memory usage
- Disk I/O
- Network throughput
- Pod health

#### Security Metrics
- Failed authentication attempts
- Vulnerability count
- Security scan results
- Compliance status

### Alerting Rules

#### Critical Alerts
- Application down
- Database unavailable
- High error rate (>5%)
- Security breach detected

#### Warning Alerts
- Performance degradation
- High resource usage
- Failed deployments
- Vulnerability discovered

#### Notification Channels
- Slack: #devops-alerts
- PagerDuty: Critical incidents
- Email: Daily summaries
- SMS: Production outages

## Rollback Procedures

### Automatic Rollback

**Triggers**:
- Deployment failure
- Health check failure
- Smoke test failure
- Error rate threshold exceeded

**Process**:
1. Traffic switch to previous version
2. Scale down new deployment
3. Alert team
4. Create incident report

### Manual Rollback

**One-Click Rollback**:
```bash
# GitHub Actions
gh workflow run rollback-production.yml

# Kubernetes
kubectl rollout undo deployment/biopoint-api
```

**Database Rollback**:
```bash
# Restore from backup
doppler run -- npm run db:restore -- --backup-id=latest
```

### Rollback Validation

1. **Health Check**
   ```bash
   curl -f https://api.biopoint.health/health
   ```

2. **Database Connectivity**
   ```bash
   doppler run -- npm run db:health
   ```

3. **Smoke Tests**
   ```bash
   ./scripts/run-smoke-tests.sh production
   ```

## Troubleshooting

### Common Issues

#### Deployment Failures

**Issue**: Image pull errors
```bash
# Check image availability
docker pull $ECR/biopoint-api:latest

# Verify ECR permissions
aws ecr describe-images --repository-name biopoint-api
```

**Issue**: Database migration failures
```bash
# Check migration status
doppler run -- npm run db:migrate:status

# Rollback migration
doppler run -- npm run db:migrate:rollback
```

**Issue**: Kubernetes resource limits
```bash
# Check resource usage
kubectl top pods -n biopoint-production

# Increase limits
kubectl edit deployment biopoint-api
```

#### Performance Issues

**Issue**: High response times
```bash
# Check application metrics
curl https://api.biopoint.health/metrics

# Analyze logs
kubectl logs -f deployment/biopoint-api -n biopoint-production
```

**Issue**: Database performance
```bash
# Check database metrics
doppler run -- npm run db:performance

# Analyze slow queries
kubectl exec -it postgres-pod -- psql -c "SELECT * FROM pg_stat_activity;"
```

#### Security Issues

**Issue**: Vulnerability scan failures
```bash
# Check scan results
npm audit
snyk test

# Update dependencies
npm update
```

**Issue**: Compliance violations
```bash
# Run compliance tests
npm run test:compliance

# Check encryption status
npm run encryption:validate
```

### Debug Commands

#### CI/CD Debugging
```bash
# Check workflow status
gh run list --workflow=ci.yml

# View logs
gh run view --log --job=12345
```

#### Kubernetes Debugging
```bash
# Pod status
kubectl get pods -n biopoint-production

# Service endpoints
kubectl get endpoints -n biopoint-production

# Ingress status
kubectl get ingress -n biopoint-production
```

#### Database Debugging
```bash
# Connection test
doppler run -- npm run db:health

# Migration status
doppler run -- npm run db:migrate:status

# Performance metrics
doppler run -- npm run db:performance
```

## Best Practices

### Security

1. **Least Privilege**: Minimal permissions for CI/CD
2. **Secret Rotation**: Regular rotation of credentials
3. **Audit Logging**: All actions logged
4. **Encryption**: All data encrypted in transit and at rest
5. **Compliance**: Regular compliance audits

### Reliability

1. **Idempotent Operations**: Scripts can be run multiple times
2. **Graceful Degradation**: Service continues with reduced functionality
3. **Circuit Breakers**: Prevent cascade failures
4. **Retry Logic**: Automatic retry with exponential backoff
5. **Health Checks**: Comprehensive health monitoring

### Performance

1. **Parallel Execution**: Jobs run in parallel where possible
2. **Caching**: Aggressive caching strategy
3. **Incremental Builds**: Only build changed components
4. **Resource Optimization**: Right-sized resources
5. **Monitoring**: Performance metrics collection

### Maintainability

1. **Documentation**: Comprehensive documentation
2. **Modular Design**: Reusable components
3. **Version Control**: All configurations versioned
4. **Testing**: Automated testing of pipeline
5. **Review Process**: Code review for all changes

## Compliance

### HIPAA Compliance

- **PHI Encryption**: All PHI encrypted at rest and in transit
- **Access Controls**: Role-based access control
- **Audit Logging**: Comprehensive audit trail
- **Data Retention**: Configured retention policies
- **Breach Notification**: Automated breach detection

### SOC 2 Type II

- **Security**: Encryption, access controls, monitoring
- **Availability**: High availability, disaster recovery
- **Processing Integrity**: Data validation, error handling
- **Confidentiality**: Access controls, encryption
- **Privacy**: Data handling, consent management

### GDPR Compliance

- **Data Minimization**: Minimal data collection
- **Consent Management**: User consent tracking
- **Right to be Forgotten**: Data deletion capabilities
- **Data Portability**: Export functionality
- **Privacy by Design**: Privacy considerations in design

## Support and Maintenance

### Regular Maintenance

- **Weekly**: Security scan review
- **Monthly**: Performance optimization
- **Quarterly**: Compliance audit
- **Annually**: Architecture review

### Emergency Contacts

- **DevOps Team**: devops@biopoint.health
- **Security Team**: security@biopoint.health
- **On-Call Engineer**: +1-XXX-XXX-XXXX

### Documentation Updates

This documentation is updated automatically when:
- Pipeline configuration changes
- New security requirements
- Compliance updates
- Best practice evolution

---

**Last Updated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Version**: 1.0.0
**Maintained By**: DevOps Team