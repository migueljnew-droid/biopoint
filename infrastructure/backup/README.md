# BioPoint Backup Infrastructure

## Overview

This directory contains the complete automated backup and disaster recovery infrastructure for BioPoint's critical systems, including PostgreSQL databases, S3 storage, and application data. The solution is designed with HIPAA compliance, security, and reliability as primary concerns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BioPoint Backup Architecture                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│  │   Daily     │     │   Weekly    │     │   Monthly   │      │
│  │  Backups    │     │  Backups    │     │  Backups    │      │
│  │  (2 AM)     │     │  (Sun 3AM)  │     │  (1st 4AM)  │      │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘      │
│         │                    │                    │             │
│         └────────────────────┴────────────────────┘             │
│                            │                                    │
│  ┌─────────────────────────┴────────────────────────────┐       │
│  │              Encryption & Compression                │       │
│  │                  (AES-256-CBC)                      │       │
│  └─────────────────────────┬────────────────────────────┘       │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────────┐       │
│  │              S3 Storage (Multi-Region)               │       │
│  ├─────────────────────────┬────────────────────────────┤       │
│  │    Primary (us-east-1)  │  Secondary (us-west-2)   │       │
│  │    ├─ Standard (0-30d)  │    ├─ Standard (0-30d)   │       │
│  │    ├─ Glacier (30-90d)  │    ├─ Glacier (30-90d)   │       │
│  │    └─ Deep Archive      │    └─ Deep Archive       │       │
│  └─────────────────────────┴────────────────────────────┘       │
│                            │                                    │
│  ┌─────────────────────────▼────────────────────────────┐       │
│  │              Verification & Monitoring               │       │
│  │  ├─ Daily: Basic checks                              │       │
│  │  ├─ Weekly: Restore testing                          │       │
│  │  ├─ Monthly: Full DR drill                           │       │
│  │  └─ Quarterly: Compliance audit                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Database Backups (`scripts/backup-database.sh`)
- **Schedule**: Daily at 2 AM UTC, Weekly on Sundays, Monthly on 1st
- **Type**: Full database dumps with custom PostgreSQL format
- **Encryption**: AES-256-CBC with unique keys per backup
- **Retention**: 7 days (daily), 4 weeks (weekly), 12 months (monthly)
- **Features**: Point-in-time recovery, integrity verification

### 2. S3 Storage Backups (`scripts/backup-s3.sh`)
- **Schedule**: Daily incremental at 4 AM UTC
- **Type**: Incremental sync with full backup option
- **Storage**: Cross-region replication (primary + DR regions)
- **Lifecycle**: Standard → Glacier (90 days) → Deep Archive (1 year)
- **Features**: Object versioning, integrity checksums

### 3. Backup Verification (`scripts/verify-backups.sh`)
- **Schedule**: Weekly comprehensive verification
- **Tests**: Backup existence, encryption verification, integrity checks
- **Reports**: Detailed markdown reports with metrics
- **Alerts**: Automated notifications for failures

### 4. Disaster Recovery (`scripts/restore-database.sh`, `scripts/restore-s3.sh`)
- **Database Recovery**: Automated restore with verification
- **S3 Recovery**: Object-level and bucket-level restoration
- **Testing**: Dry-run mode for validation
- **Safety**: Multiple confirmation prompts for production

## Quick Start

### Prerequisites
```bash
# Required tools
postgresql-client  # pg_dump, pg_restore, psql
aws-cli           # AWS S3 operations
openssl           # Encryption/decryption
jq                # JSON processing
bc                # Mathematical calculations
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure required variables
export DATABASE_URL="postgresql://user:pass@host:5432/biopoint"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export S3_BUCKET_NAME="biopoint-uploads"
export ENCRYPTION_KEY="your-encryption-key"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."  # Optional
export ALERT_EMAIL="infrastructure@biopoint.com"        # Optional
```

### Running Backups Manually
```bash
# Database backup
./scripts/backup-database.sh daily

# S3 backup
./scripts/backup-s3.sh incremental

# Verify backups
./scripts/verify-backups.sh weekly
```

### Disaster Recovery
```bash
# Restore database (test mode)
./scripts/restore-database.sh latest-daily $DATABASE_URL --test-only

# Restore database (production)
./scripts/restore-database.sh latest-daily $DATABASE_URL --force

# Restore S3 objects (dry run)
./scripts/restore-s3.sh latest-incremental $S3_BUCKET_NAME --dry-run
```

## Kubernetes Deployment

### Deploy CronJobs
```bash
# Apply all backup cronjobs
kubectl apply -f k8s/cronjobs/backup-cronjob.yaml

# Apply ConfigMap with scripts
kubectl apply -f k8s/configmap-backup-scripts.yaml

# Verify deployment
kubectl get cronjobs -n biopoint
kubectl get configmaps -n biopoint
```

### Monitoring CronJobs
```bash
# Check cronjob status
kubectl describe cronjob biopoint-database-backup-daily -n biopoint

# View recent job executions
kubectl get jobs -n biopoint | grep backup

# Check logs
kubectl logs -n biopoint -l app=biopoint-backup --tail=100
```

## GitHub Actions Integration

### Automated Verification
The workflow runs automatically:
- **Daily**: Basic verification at 8 AM UTC
- **Weekly**: Full verification + DR test on Mondays
- **Monthly**: Comprehensive audit
- **On-demand**: Manual trigger with options

### Workflow Features
- Backup integrity verification
- Disaster recovery testing
- Cost analysis reporting
- Automated issue creation
- Slack notifications

### Manual Trigger
```bash
# Trigger via GitHub UI or API
github.com/biopoint/biopoint/actions/workflows/backup-verification.yml
```

## Configuration

### Backup Retention
| Type | Frequency | Retention | Storage Class |
|------|-----------|-----------|---------------|
| Daily | 2 AM UTC | 7 days | S3 Standard |
| Weekly | Sun 3 AM | 4 weeks | S3 Standard → Glacier |
| Monthly | 1st 4 AM | 12 months | Glacier Deep Archive |
| S3 Incremental | 4 AM UTC | 30 days | S3 Standard → Glacier |

### Encryption Settings
```bash
# Encryption algorithm
ENCRYPTION_ALGORITHM="AES-256-CBC"

# Key rotation frequency
KEY_ROTATION="per-backup"

# Key storage
KEY_STORAGE="separate-s3-location"
```

### Monitoring Configuration
```bash
# Alert thresholds
MAX_BACKUP_AGE_DAYS=2
MIN_BACKUP_SIZE_MB=1
MAX_VERIFICATION_TIME_MINUTES=30

# Notification channels
SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
ALERT_EMAIL="infrastructure@biopoint.com"
```

## Security

### Encryption
- **At Rest**: AES-256-CBC with unique keys
- **In Transit**: TLS 1.3 minimum
- **Key Management**: AWS KMS with rotation
- **Access Control**: IAM roles and policies

### Access Control
- **Principle of Least Privilege**: Minimal required access
- **Service Accounts**: Dedicated Kubernetes service accounts
- **RBAC**: Role-based access control
- **Audit Logging**: Complete activity tracking

### Compliance
- **HIPAA**: Encrypted backups, audit trails, access controls
- **SOC 2**: Security controls and monitoring
- **Data Residency**: Multi-region compliance
- **Retention**: Policy-based data lifecycle

## Monitoring and Alerting

### Success Criteria
- ✅ Backup completion within time window
- ✅ Backup size within expected range
- ✅ Encryption successful
- ✅ S3 upload verified
- ✅ Integrity check passed

### Alert Conditions
- ❌ Backup job failure (immediate)
- ❌ Backup delay >1 hour (warning)
- ❌ Verification failure (immediate)
- ❌ DR test failure (critical)

### Metrics
- Backup success rate
- Recovery time performance
- Storage cost trends
- Compliance score

## Troubleshooting

### Common Issues

#### Backup Script Failures
```bash
# Check logs
tail -f /tmp/biopoint-backups/daily/backup-*.log

# Verify connectivity
psql $DATABASE_URL -c "SELECT 1;"
aws s3 ls s3://$S3_BUCKET_NAME

# Check permissions
aws sts get-caller-identity
```

#### Encryption Issues
```bash
# Verify OpenSSL
openssl version

# Test encryption
echo "test" | openssl enc -AES-256-CBC -salt -pass pass:test
```

#### S3 Access Problems
```bash
# Check bucket policies
aws s3api get-bucket-policy --bucket $S3_BUCKET_NAME

# Verify lifecycle rules
aws s3api get-bucket-lifecycle-configuration --bucket $S3_BUCKET_NAME
```

### Recovery Procedures
See [disaster-recovery.md](docs/disaster-recovery.md) for detailed recovery procedures.

## Performance Optimization

### Backup Performance
- **Parallel Processing**: Multiple backup streams
- **Compression**: Optimal compression ratios
- **Scheduling**: Off-peak backup windows
- **Resource Monitoring**: CPU, memory, I/O

### Cost Optimization
- **Storage Tiers**: Automated lifecycle policies
- **Compression**: Reduced storage costs
- **Deduplication**: Eliminate redundant data
- **Retention Policies**: Cost-effective retention

## Compliance

### HIPAA Requirements
- ✅ Encrypted backups (AES-256)
- ✅ Access logging and monitoring
- ✅ Regular backup testing
- ✅ Data retention policies
- ✅ Incident response procedures

### Audit Preparation
- Complete backup activity logs
- Access control records
- Encryption key management
- Incident documentation

## Maintenance

### Regular Tasks
- **Weekly**: Review verification reports
- **Monthly**: Update documentation
- **Quarterly**: DR testing and training
- **Annually**: Full compliance audit

### Updates
- Script updates via GitOps
- Dependency vulnerability scanning
- Performance optimization
- Security patch management

## Support

### Emergency Contacts
- **Infrastructure Team**: infrastructure@biopoint.com
- **Database Team**: dba@biopoint.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Security Team**: security@biopoint.com

### Documentation
- [Disaster Recovery Procedures](docs/disaster-recovery.md)
- [Backup Strategy](docs/backup-strategy.md)
- [Runbooks](docs/runbooks/)
- [Architecture Diagrams](docs/architecture/)

### Getting Help
1. Check this README first
2. Review logs and error messages
3. Consult documentation
4. Contact support team
5. Escalate if needed

---

**Document Information:**
- **Version**: 1.0
- **Last Updated**: January 2026
- **Maintainer**: Infrastructure Team
- **Next Review**: April 2026

**Related Documents:**
- [Disaster Recovery Plan](docs/disaster-recovery.md)
- [Backup Strategy](docs/backup-strategy.md)
- [Security Policies](../security/)
- [Compliance Documentation](../compliance/)