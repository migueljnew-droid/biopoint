# BioPoint Terraform Infrastructure Setup

## Overview

This document provides comprehensive instructions for setting up and managing BioPoint's HIPAA-compliant infrastructure using Terraform. The infrastructure includes PostgreSQL databases (Neon), Cloudflare R2 storage, DNS management, WAF, monitoring (Datadog), and secrets management (Doppler).

## Prerequisites

### Required Accounts and API Keys

1. **Cloudflare Account**
   - API Token with Zone:Edit and Account:Edit permissions
   - Account ID

2. **Neon Database Account**
   - API Key
   - Organization ID

3. **Datadog Account**
   - API Key
   - Application Key

4. **Doppler Account**
   - Service Token with full project access

5. **AWS Account** (for Terraform state backend)
   - Access Key ID
   - Secret Access Key
   - Account ID

### Local Development Tools

```bash
# Install Terraform
brew install terraform

# Install AWS CLI
brew install awscli

# Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh

# Install Checkov (for security scanning)
pip install checkov

# Install tfsec (for security scanning)
brew install tfsec
```

## Initial Setup

### 1. Clone Repository and Navigate to Infrastructure

```bash
cd biopoint/infrastructure
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID and Secret Access Key
# Set region to us-east-1
```

### 3. Set Up Doppler

```bash
# Login to Doppler
doppler login

# Setup project
doppler setup -p biopoint -c dev
```

### 4. Set Environment Variables

Create a `.env` file in the infrastructure directory:

```bash
# Cloudflare
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"

# Neon
export NEON_API_KEY="your-neon-api-key"

# Datadog
export DATADOG_API_KEY="your-datadog-api-key"
export DATADOG_APP_KEY="your-datadog-app-key"

# Doppler
export DOPPLER_SERVICE_TOKEN="your-doppler-service-token"

# AWS
export AWS_ACCESS_KEY_ID="your-aws-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
```

Load the environment variables:
```bash
source .env
```

## Terraform Workflow

### 1. Initialize Terraform

```bash
cd terraform
terraform init -backend=true
```

### 2. Select or Create Workspace

```bash
# For development
terraform workspace new dev

# For staging
terraform workspace new staging

# For production
terraform workspace new production
```

### 3. Plan Infrastructure Changes

```bash
# For development environment
terraform plan -var-file=../environments/dev.tfvars

# For staging environment
terraform plan -var-file=../environments/staging.tfvars

# For production environment
terraform plan -var-file=../environments/production.tfvars
```

### 4. Apply Infrastructure Changes

```bash
# For development (auto-approve)
terraform apply -var-file=../environments/dev.tfvars -auto-approve

# For staging (manual approval recommended)
terraform apply -var-file=../environments/staging.tfvars

# For production (always manual approval)
terraform apply -var-file=../environments/production.tfvars
```

## Module Configuration

### Neon PostgreSQL Module

The Neon module provides HIPAA-compliant PostgreSQL databases with:

- **Primary database** in US-East-1
- **Read replicas** in US-West-2 and EU-Central-1
- **Automated backups** with configurable retention
- **Connection pooling** for performance
- **Private network access** via AWS PrivateLink

Key variables:
```hcl
database_tier = "business"  # free, launch, scale, business, enterprise
enable_read_replicas = true
enable_auto_pause = false   # Keep always on for production
backup_retention_days = 30
```

### Cloudflare R2 Storage Module

The R2 module provides HIPAA-compliant object storage with:

- **PHI storage bucket** with encryption and 7-year retention
- **Non-PHI storage bucket** with 1-year retention
- **Cross-region replication** for disaster recovery
- **Lifecycle policies** for cost optimization
- **CORS configuration** for web applications

Key variables:
```hcl
enable_storage_encryption = true
enable_versioning = true
phi_retention_days = 2555     # 7 years for HIPAA
non_phi_retention_days = 365  # 1 year
```

### Cloudflare Security Module

The Cloudflare module provides:

- **DNS management** for all subdomains
- **Load balancing** with health checks
- **WAF rules** (OWASP Top 10, custom rules)
- **Rate limiting** and DDoS protection
- **SSL/TLS certificates** with HSTS

Key variables:
```hcl
enable_waf = true
rate_limit_per_minute = 100
enable_ddos_protection = true
security_level = "high"
```

### Datadog Monitoring Module

The Datadog module provides comprehensive monitoring:

- **Infrastructure metrics** (CPU, memory, disk, network)
- **Application performance monitoring** (APM)
- **Synthetic tests** for health checks
- **SLO/SLI tracking** for reliability
- **Security monitoring** and alerting

Key variables:
```hcl
enable_datadog_monitoring = true
enable_slo_monitoring = true
slo_availability_target = 99.9
slo_response_time_target = 1000
```

### Doppler Secrets Module

The Doppler module provides secrets management:

- **Environment-specific secrets** for each deployment
- **Automatic secret rotation** for enhanced security
- **Audit logging** for compliance
- **Integration with external secret stores**

Key variables:
```hcl
enable_secret_rotation = true
enable_audit_logging = true
hipaa_compliance = true
```

## Security Best Practices

### 1. Secret Management

- Never commit secrets to version control
- Use Doppler for all secret management
- Rotate secrets regularly
- Use strong, unique passwords

### 2. Network Security

- Enable private networking where possible
- Use SSL/TLS for all connections
- Implement proper firewall rules
- Enable DDoS protection

### 3. Access Control

- Implement least privilege access
- Use service accounts for automation
- Enable audit logging
- Monitor access patterns

### 4. Data Protection

- Encrypt data at rest and in transit
- Implement proper backup strategies
- Use HIPAA-compliant services
- Regular security assessments

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Infrastructure Metrics**
   - CPU utilization (< 80%)
   - Memory utilization (< 85%)
   - Disk utilization (< 90%)
   - Network throughput

2. **Application Metrics**
   - Request rate and response time
   - Error rate (< 5%)
   - Database query performance
   - API endpoint health

3. **Security Metrics**
   - WAF blocked requests
   - Rate limiting triggers
   - Failed authentication attempts
   - Suspicious activity patterns

### Alert Channels

- **Critical alerts**: PagerDuty integration
- **Warning alerts**: Slack notifications
- **Info alerts**: Email summaries

## Backup and Disaster Recovery

### Database Backups

- **Automated daily backups** at 2 AM UTC
- **Cross-region replication** for disaster recovery
- **Point-in-time recovery** capabilities
- **Backup retention**: 30 days (configurable)

### Storage Backups

- **Versioning enabled** for all buckets
- **Cross-region replication** for PHI data
- **Lifecycle policies** for cost optimization
- **Immutable backups** for compliance

### Disaster Recovery Plan

1. **Primary Region Failure**:
   - Automatic failover to read replicas
   - RTO: < 1 hour
   - RPO: < 15 minutes

2. **Complete Infrastructure Failure**:
   - Restore from backups
   - RTO: < 4 hours
   - RPO: < 1 hour

## Cost Optimization

### Development Environment

- **Auto-pause enabled** for cost savings
- **Smaller instance sizes**
- **Shorter backup retention**
- **Reduced monitoring frequency**

### Staging Environment

- **Balanced configuration**
- **Moderate instance sizes**
- **Standard backup retention**
- **Full monitoring enabled**

### Production Environment

- **High availability configuration**
- **Performance-optimized instances**
- **Extended backup retention**
- **Comprehensive monitoring**

## Troubleshooting

### Common Issues

1. **Terraform State Lock**
   ```bash
   # Force unlock (use with caution)
   terraform force-unlock <LOCK_ID>
   ```

2. **AWS Credentials**
   ```bash
   # Verify AWS credentials
   aws sts get-caller-identity
   ```

3. **Provider Authentication**
   ```bash
   # Test Cloudflare API
   curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        https://api.cloudflare.com/client/v4/user/tokens/verify
   ```

### Debug Mode

Enable Terraform debug logging:
```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform-debug.log
```

### State Management

View and manage Terraform state:
```bash
# List resources in state
terraform state list

# Show specific resource
terraform state show <RESOURCE_ADDRESS>

# Remove resource from state (dangerous)
terraform state rm <RESOURCE_ADDRESS>
```

## Compliance

### HIPAA Requirements

1. **Data Encryption**: All PHI data encrypted at rest and in transit
2. **Access Controls**: Role-based access with audit logging
3. **Audit Trails**: Comprehensive logging of all access and changes
4. **Business Associate Agreements**: In place with all service providers
5. **Risk Assessments**: Regular security and compliance assessments

### Security Scanning

Automated security scanning includes:

- **Checkov**: Infrastructure as Code security scanning
- **tfsec**: Terraform security analysis
- **OWASP compliance**: Web application security standards
- **HIPAA compliance**: Healthcare data protection requirements

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review monitoring dashboards and alerts
2. **Monthly**: Update Terraform providers and modules
3. **Quarterly**: Security assessment and penetration testing
4. **Annually**: Compliance audit and certification renewal

### Getting Help

- **Documentation**: Check this guide and module READMEs
- **GitHub Issues**: Create an issue in the repository
- **Slack**: Post in #infrastructure channel
- **Email**: infrastructure@biopoint.app

## Appendix

### Useful Commands

```bash
# Format Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate

# Show current state
terraform show

# Refresh state
terraform refresh

# Import existing resources
terraform import <ADDRESS> <ID>

# Taint resources for recreation
terraform taint <ADDRESS>
```

### Environment URLs

- **Development**: https://dev.biopoint.app
- **Staging**: https://staging.biopoint.app
- **Production**: https://biopoint.app

### Service Documentation

- [Terraform Documentation](https://www.terraform.io/docs/)
- [Cloudflare API Docs](https://api.cloudflare.com/)
- [Neon Documentation](https://neon.tech/docs/)
- [Datadog Documentation](https://docs.datadoghq.com/)
- [Doppler Documentation](https://docs.doppler.com/)