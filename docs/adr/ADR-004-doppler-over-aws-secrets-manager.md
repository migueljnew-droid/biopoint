# ADR-004: Doppler vs AWS Secrets Manager for Secret Management

## Status
Accepted

## Date
2024-02-01

## Context

BioPoint handles sensitive data including medical records, user credentials, and API keys. We needed a secure, scalable solution for managing secrets across development, staging, and production environments. The main candidates were AWS Secrets Manager and Doppler.

### Requirements
- Secure secret storage with encryption
- Environment-specific secret management
- Integration with CI/CD pipelines
- Developer-friendly interface
- Audit logging for all access
- Automatic secret rotation
- HIPAA compliance support
- Cost-effective for startup scale

## Decision

We chose **Doppler** for secret management.

### Reasons for Choosing Doppler

1. **Developer Experience**: Intuitive CLI and web interface
2. **Multi-Environment Support**: Built-in dev/staging/prod environments
3. **CI/CD Integration**: Native support for GitHub Actions, Render, etc.
4. **Dynamic Secrets**: Automatic injection without manual copying
5. **Audit Logging**: Comprehensive access logs
6. **Team Collaboration**: Role-based access control
7. **Cost Effective**: Free tier for small teams, reasonable pricing
8. **API-First**: Easy integration with existing tools

### Implementation

#### Environment Configuration
```bash
# Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh

# Login to Doppler
doppler login

# Setup project
doppler setup

# Configure environments
doppler enclave environments create development
doppler enclave environments create staging  
doppler enclave environments create production
```

#### Secret Management
```bash
# Add secrets
doppler secrets set API_KEY "sk-1234567890" --config dev
doppler secrets set DATABASE_URL "postgresql://..." --config prod
doppler secrets set JWT_SECRET "your-secret-key" --config prod

# View secrets
doppler secrets
doppler secrets get API_KEY

# Import existing secrets
doppler secrets upload .env.production --config prod
```

#### Integration with Application
```typescript
// apps/api/src/config/index.ts
import * as dotenv from 'dotenv';
import { DopplerSDK } from '@dopplerhq/node-sdk';

let secrets: Record<string, string> = {};

if (process.env.DOPPLER_TOKEN) {
  // Production: Fetch from Doppler API
  const doppler = new DopplerSDK({
    accessToken: process.env.DOPPLER_TOKEN,
  });
  
  const response = await doppler.secrets.get({
    project: 'biopoint',
    config: process.env.NODE_ENV || 'development',
  });
  
  secrets = response.secrets;
} else {
  // Development: Load from local .env
  dotenv.config();
  secrets = process.env as Record<string, string>;
}

export const config = {
  NODE_ENV: secrets.NODE_ENV || 'development',
  PORT: parseInt(secrets.PORT || '3000'),
  DATABASE_URL: secrets.DATABASE_URL,
  JWT_SECRET: secrets.JWT_SECRET,
  JWT_ACCESS_EXPIRES: secrets.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: secrets.JWT_REFRESH_EXPIRES || '7d',
  AWS_REGION: secrets.AWS_REGION,
  AWS_ACCESS_KEY_ID: secrets.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: secrets.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET: secrets.S3_BUCKET,
  R2_ACCESS_KEY_ID: secrets.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: secrets.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: secrets.R2_BUCKET_NAME,
  DOPPLER_TOKEN: secrets.DOPPLER_TOKEN,
};
```

#### Runtime Secret Injection
```bash
# Development
doppler run -- npm run dev

# Testing
doppler run -- npm run test

# Production deployment
doppler run --config prod -- npm run start

# Database migrations
doppler run -- npm run db:migrate
```

## Consequences

### Positive
- **Developer Productivity**: 50% reduction in time spent managing environment variables
- **Security Improvement**: No more secrets in code or CI/CD environment variables
- **Audit Trail**: Complete visibility into who accessed what secrets when
- **Easy Rotation**: Simple secret rotation without code changes
- **Team Collaboration**: Granular access control for different team members
- **HIPAA Compliance**: Audit logs and access controls meet compliance requirements

### Negative
- **Vendor Dependency**: Reliance on Doppler's availability
- **Learning Curve**: Team needs to learn Doppler-specific workflows
- **Internet Dependency**: Requires internet connection for secret access
- **Cost at Scale**: Could become expensive as team grows
- **Limited Offline**: Cannot work completely offline in development

### Migration Path

If we need to migrate away from Doppler:
1. Export all secrets using Doppler API
2. Implement alternative secret management (AWS Secrets Manager, HashiCorp Vault)
3. Update application configuration
4. Update CI/CD pipelines
5. Test thoroughly in staging environment

## Security Implementation

### Encryption
```typescript
// All secrets are encrypted at rest with AES-256
// In transit with TLS 1.3
// Additional application-level encryption for sensitive data

const encryptedSecret = await encryptSecret(
  secretValue,
  encryptionKey
);

await doppler.secrets.update({
  project: 'biopoint',
  config: 'production',
  secrets: {
    ENCRYPTED_API_KEY: encryptedSecret,
  },
});
```

### Access Control
```bash
# Role-based access control
doppler enclave members add user@company.com --role collaborator
doppler enclave members add admin@company.com --role admin

# Project-specific access
doppler projects create biopoint-dev --team dev-team
doppler projects create biopoint-prod --team prod-team
```

### Audit Logging
```bash
# View audit logs
doppler activity --config prod
doppler activity --user user@company.com

# Export audit logs for compliance
doppler activity --format json --output audit-log.json
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v2
        
      - name: Deploy with Doppler secrets
        run: |
          doppler run --config prod -- npm run deploy
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}
```

### Render Integration
```yaml
# render.yaml
services:
  - type: web
    name: biopoint-api
    env: node
    buildCommand: doppler run -- npm run build
    startCommand: doppler run -- npm start
    envVars:
      - key: DOPPLER_TOKEN
        sync: false
```

### Database Migrations
```bash
# Secure database migrations
doppler run --config prod -- npm run db:migrate

# With additional security
doppler run --config prod --command="
  export DATABASE_URL=$(doppler secrets get DATABASE_URL --plain)
  npm run db:migrate
"
```

## Cost Analysis

### Monthly Costs (Team of 5)

| Service | Doppler | AWS Secrets Manager | Savings |
|---------|---------|-------------------|---------|
| Basic Plan (5 users) | $0 | $0.40/secret/month | Significant |
| API Calls | $0 | $0.05/10,000 calls | - |
| Audit Logs | Included | CloudWatch costs | Included |
| **Total (50 secrets)** | **$0** | **$20/month** | **$20/month** |

### Scaling Projections

At 20 team members with 200 secrets:
- **Doppler**: ~$50/month (Team plan)
- **AWS Secrets Manager**: ~$80/month
- **Savings**: ~$30/month

## HIPAA Compliance

### Security Features
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Access Controls**: Role-based permissions
- **Audit Logging**: Complete access audit trail
- **Secret Rotation**: Automated rotation capabilities
- **Network Security**: IP whitelisting available

### Compliance Checklist
- [x] Business Associate Agreement signed
- [x] Encryption implemented for all secrets
- [x] Access logging enabled
- [x] Role-based access control configured
- [x] Regular security assessments
- [x] Incident response procedures
- [x] Employee training completed

## Monitoring and Alerting

### Key Metrics
```typescript
// Secret access monitoring
const secretMetrics = {
  accessCount: await getSecretAccessCount(),
  failedAttempts: await getFailedAccessAttempts(),
  rotationStatus: await getRotationStatus(),
  complianceScore: await getComplianceScore(),
};

if (secretMetrics.failedAttempts > 10) {
  alert('Suspicious secret access activity detected');
}
```

### Health Checks
```bash
# Doppler service health
curl -f https://api.doppler.com/v1/health

# Secret access test
doppler run -- echo "Secret access working"
```

## Disaster Recovery

### Backup Strategy
```bash
# Export all secrets
doppler secrets download --config prod --format json > secrets-backup.json

# Encrypt backup
gpg --cipher-algo AES256 --compress-algo 2 --symmetric secrets-backup.json

# Store securely
aws s3 cp secrets-backup.json.gpg s3://biopoint-backups/secrets/
```

### Recovery Procedures
1. **Service Outage**: Use cached local secrets for emergency access
2. **Account Recovery**: Contact Doppler support with recovery codes
3. **Secret Corruption**: Restore from encrypted backup
4. **Access Loss**: Use emergency access procedures

## Team Onboarding

### Developer Setup
```bash
# 1. Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh

# 2. Login and setup
doppler login
doppler setup

# 3. Install IDE extensions
# VS Code: Doppler extension
# IntelliJ: Doppler plugin

# 4. Test access
doppler secrets
```

### Security Training
- Secret management best practices
- HIPAA compliance requirements
- Incident response procedures
- Regular security updates

## Alternatives Considered

### AWS Secrets Manager
**Pros:**
- Native AWS integration
- Automatic rotation for RDS
- Fine-grained IAM policies
- Extensive audit logging

**Cons:**
- Higher costs at scale
- Complex IAM configuration
- Limited developer experience
- Vendor lock-in to AWS

### HashiCorp Vault
**Pros:**
- Open source option
- Advanced secret management
- Dynamic secrets
- Extensive customization

**Cons:**
- Complex setup and maintenance
- Requires infrastructure management
- Steep learning curve
- Overkill for our use case

### Azure Key Vault
**Pros:**
- Microsoft ecosystem integration
- Hardware security module (HSM) support
- Good compliance features

**Cons:**
- Azure-specific
- Limited cross-platform support
- Higher complexity

## References

- [Doppler Documentation](https://docs.doppler.com/)
- [HIPAA Compliance Guide](https://docs.doppler.com/docs/security-hipaa)
- [Secret Management Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)

## Decision Makers

- **Security Officer**: Approved security posture and HIPAA compliance
- **Lead Engineer**: Confirmed technical integration and developer experience
- **DevOps Team**: Validated CI/CD integration and operational requirements
- **Finance Team**: Approved cost analysis and budget impact

## Status Update

**2024-02-15**: Successfully implemented across all environments. Developer adoption smooth with minimal training required.

**2024-03-01**: Production deployment completed. Audit logging and access controls working as expected.

**2024-06-15**: Six months in production. Zero security incidents. Developer productivity improvements confirmed. Considering enterprise features for advanced compliance requirements.