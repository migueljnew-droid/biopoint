# BioPoint Secrets Management with Doppler

## Overview

This document outlines the comprehensive secrets management system for BioPoint using Doppler, replacing the previous `.env` file-based approach which posed significant security risks.

## 🚨 Security Alert

**CRITICAL**: The previous system stored all secrets in `.env` files, creating multiple security vulnerabilities:
- Secrets committed to version control
- Plaintext storage of sensitive credentials
- No audit trail or access control
- Difficult secret rotation
- Environment-specific configuration drift

## Doppler Benefits

- **Secure Storage**: Encrypted at rest with hardware security modules
- **Access Control**: Role-based permissions and audit logging
- **Version History**: Track all secret changes with rollback capability
- **Environment Sync**: Consistent secrets across development teams
- **CI/CD Integration**: Native GitHub Actions and deployment platform support
- **Secret Rotation**: Automated rotation capabilities
- **Compliance**: SOC 2 Type II, HIPAA, and GDPR compliant

## Architecture

### Project Structure
```
biopoint/
├── doppler.yaml              # Doppler project configuration
├── .doppler/
│   └── .gitignore           # Protect Doppler tokens
├── docs/
│   └── secrets-management.md # This documentation
├── scripts/
│   └── migrate-to-doppler.sh # Migration script
└── .github/
    └── workflows/
        └── secrets-audit.yml  # GitHub Action for secret auditing
```

### Environment Hierarchy
- **Development** (`dev`): Local development and testing
- **Staging** (`staging`): Pre-production testing
- **Production** (`production`): Live application environment

## Setup Instructions

### Prerequisites

1. **Doppler CLI Installation**
   ```bash
   # macOS
   brew install dopplerhq/cli/doppler

   # Linux
   sudo apt-get update && sudo apt-get install -y doppler

   # Windows
   scoop install doppler
   ```

2. **Doppler Account Setup**
   - Create account at [doppler.com](https://doppler.com)
   - Create a new project named `biopoint`
   - Set up the three environments: dev, staging, production

### Initial Configuration

1. **Authenticate with Doppler**
   ```bash
   doppler login
   ```

2. **Setup Project**
   ```bash
   # Navigate to project root
   cd /Users/GRAMMY/biopoint

   # Setup Doppler project
   doppler setup
   
   # Select the biopoint project and appropriate environment
   ```

3. **Configure Service Tokens** (for CI/CD)
   ```bash
   # Create service tokens for each environment
   doppler configs tokens create dev-service-token --config dev --project biopoint
   doppler configs tokens create staging-service-token --config staging --project biopoint
   doppler configs tokens create prod-service-token --config production --project biopoint
   ```

## Usage

### Local Development

1. **Start Development Server**
   ```bash
   # Using Doppler to inject secrets
   doppler run -- npm run dev:api
   
   # For mobile app
   doppler run -- npm run dev:mobile
   ```

2. **Database Operations**
   ```bash
   # All database commands now use Doppler
   doppler run -- npm run db:generate
   doppler run -- npm run db:migrate
   doppler run -- npm run db:seed
   ```

### Environment-Specific Commands

```bash
# Development
doppler run --config dev -- npm run dev:api

# Staging
doppler run --config staging -- npm run build:api

# Production
doppler run --config production -- npm run build:api
```

## Secret Categories

### Database Secrets
- `DATABASE_URL`: Neon PostgreSQL connection string
- Rotation frequency: 90 days
- Access level: Database administrators only

### Authentication Secrets
- `JWT_SECRET`: JSON Web Token signing key
- `JWT_ACCESS_EXPIRES`: Access token expiration (15m)
- `JWT_REFRESH_EXPIRES`: Refresh token expiration (7d)
- Rotation frequency: 30 days
- Access level: Backend developers only

### Cloud Storage Secrets
- `AWS_ACCESS_KEY_ID`: Cloudflare R2 access key
- `AWS_SECRET_ACCESS_KEY`: Cloudflare R2 secret key
- `S3_BUCKET`: Storage bucket name
- `S3_ENDPOINT`: R2 endpoint URL
- Rotation frequency: 60 days
- Access level: DevOps team only

### Application Configuration
- `PORT`: Server port (3000)
- `NODE_ENV`: Environment mode
- `CORS_ORIGIN`: Allowed CORS origins
- `RATE_LIMIT_MAX`: Rate limiting threshold
- `RATE_LIMIT_WINDOW`: Rate limiting time window
- Access level: All developers

## Migration from .env Files

### Automated Migration

Run the migration script:
```bash
./scripts/migrate-to-doppler.sh
```

This script will:
1. Detect existing `.env` files
2. Prompt for Doppler authentication
3. Import secrets to Doppler
4. Verify import success
5. Provide rollback instructions

### Manual Migration Steps

1. **Backup Current Secrets**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Create Doppler Projects**
   ```bash
   doppler projects create biopoint
   doppler configs create dev --project biopoint
   doppler configs create staging --project biopoint
   doppler configs create production --project biopoint
   ```

3. **Import Secrets**
   ```bash
   # For each environment
   doppler secrets upload --config dev --project biopoint < .env
   ```

4. **Verify Import**
   ```bash
   doppler secrets --config dev --project biopoint
   ```

## Security Best Practices

### Access Control

1. **Principle of Least Privilege**
   - Developers: Read access to dev environment only
   - DevOps: Read/write access to staging
   - Production: Restricted to senior DevOps only

2. **Service Token Management**
   - Rotate service tokens quarterly
   - Use separate tokens for each service
   - Never commit tokens to code

### Secret Rotation

1. **Automated Rotation Schedule**
   - Database credentials: Every 90 days
   - JWT secrets: Every 30 days
   - API keys: Every 60 days
   - Service tokens: Every 90 days

2. **Manual Rotation Process**
   ```bash
   # 1. Generate new secret
   # 2. Update in Doppler
   doppler secrets set JWT_SECRET "new-secret-value" --config production
   
   # 3. Restart services
   # 4. Verify functionality
   # 5. Remove old secret after verification
   ```

### Audit and Monitoring

1. **Secret Audit Log**
   - All secret access is logged
   - Changes are tracked with user attribution
   - Failed access attempts trigger alerts

2. **GitHub Actions Integration**
   - Automated secret scanning on commits
   - Block commits containing secrets
   - Alert on suspicious secret usage

## Troubleshooting

### Common Issues

1. **Doppler CLI Not Authenticated**
   ```bash
   doppler login
   doppler setup
   ```

2. **Secrets Not Loading**
   ```bash
   # Verify project configuration
   doppler configs
   
   # Check secret values
   doppler secrets
   ```

3. **Service Token Expired**
   ```bash
   # Generate new service token
   doppler configs tokens create <token-name> --config <env>
   ```

### Emergency Procedures

1. **Secret Compromise**
   - Immediately rotate compromised secrets
   - Review access logs for unauthorized access
   - Update all dependent services
   - Notify security team

2. **Service Outage**
   - Check Doppler service status
   - Verify service token validity
   - Review application logs
   - Contact Doppler support if needed

## Compliance and Auditing

### HIPAA Compliance
- All PHI-related secrets encrypted at rest
- Access logging for audit trails
- Role-based access control
- Regular security assessments

### SOC 2 Type II
- Automated compliance reporting
- Change management procedures
- Access control verification
- Incident response protocols

## Integration Examples

### GitHub Actions
```yaml
name: Deploy API
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Doppler
        uses: dopplerhq/cli-action@v3
        with:
          doppler-token: ${{ secrets.DOPPLER_PRODUCTION_TOKEN }}
      
      - name: Deploy with secrets
        run: doppler run -- npm run deploy
```

### Docker Integration
```dockerfile
FROM node:20-alpine

# Install Doppler CLI
RUN wget -qO- https://cli.doppler.com/install.sh | sh

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Use Doppler to inject secrets
CMD ["doppler", "run", "--", "npm", "start"]
```

### Kubernetes Integration
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: doppler-service-token
type: Opaque
stringData:
  serviceToken: doppler_service_token_value
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: biopoint-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: biopoint/api:latest
        env:
        - name: DOPPLER_TOKEN
          valueFrom:
            secretKeyRef:
              name: doppler-service-token
              key: serviceToken
```

## Migration Checklist

### Pre-Migration
- [ ] Backup all existing `.env` files
- [ ] Create Doppler account and project
- [ ] Install Doppler CLI on all development machines
- [ ] Document current secret inventory
- [ ] Identify service dependencies

### Migration
- [ ] Run migration script
- [ ] Verify secret import accuracy
- [ ] Test all environments
- [ ] Update CI/CD pipelines
- [ ] Train development team

### Post-Migration
- [ ] Remove `.env` files from version control
- [ ] Update `.gitignore` to exclude `.env` files
- [ ] Enable secret scanning in GitHub
- [ ] Set up monitoring and alerting
- [ ] Schedule regular secret rotation

## Support and Resources

### Doppler Documentation
- [Official Documentation](https://docs.doppler.com/)
- [CLI Reference](https://docs.doppler.com/docs/cli)
- [API Reference](https://docs.doppler.com/reference)

### BioPoint Security Team
- Security incidents: security@biopoint.health
- DevOps support: devops@biopoint.health
- Access requests: access@biopoint.health

### Emergency Contacts
- Doppler Support: support@doppler.com
- Security Hotline: +1-XXX-XXX-XXXX
- On-call DevOps: +1-XXX-XXX-XXXX

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Owner**: DevOps Security Team  
**Review Frequency**: Quarterly