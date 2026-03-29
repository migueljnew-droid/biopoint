# BioPoint Terraform Variable Reference

This document provides a comprehensive reference for all Terraform variables used in the BioPoint infrastructure configuration.

## Global Variables

### Environment Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `environment` | string | - | **Required**. Environment name (dev, staging, production) |
| `domain_name` | string | "biopoint.app" | Primary domain name for BioPoint |
| `aws_region` | string | "us-east-1" | AWS primary region |
| `backup_regions` | list(string) | ["us-west-2", "eu-central-1"] | AWS backup regions for cross-region replication |

### API Keys and Tokens (Sensitive)

| Variable | Type | Description |
|----------|------|-------------|
| `cloudflare_api_token` | string (sensitive) | **Required**. Cloudflare API token for DNS and security configuration |
| `neon_api_key` | string (sensitive) | **Required**. Neon PostgreSQL API key |
| `datadog_api_key` | string (sensitive) | **Required**. Datadog API key |
| `datadog_app_key` | string (sensitive) | **Required**. Datadog application key |
| `doppler_service_token` | string (sensitive) | **Required**. Doppler service token for secrets management |

## Database Variables (Neon Module)

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `database_tier` | string | "launch" | Neon database tier (free, launch, scale, business, enterprise) |
| `database_version` | string | "15" | PostgreSQL version |
| `enable_read_replicas` | bool | true | Enable read replicas for multi-region deployment |
| `enable_branching` | bool | true | Enable database branching for development/staging |
| `enable_private_network` | bool | true | Enable private network access for database |
| `enable_auto_pause` | bool | true | Enable auto-pause for cost optimization |
| `auto_pause_delay_seconds` | number | 300 | Auto-pause delay for serverless instances (seconds) |
| `backup_retention_days` | number | 30 | Number of days to retain backups |
| `backup_schedule` | string | "0 2 * * *" | Database backup schedule (cron expression) |

### Resource Limits

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `active_time_quota` | number | 3600 | Active time quota in seconds |
| `cpu_quota_sec` | number | 3600 | CPU quota in seconds |

### Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `aws_account_id` | string | "" | AWS account ID for PrivateLink |
| `allowed_aws_principals` | list(string) | [] | Allowed AWS principals for PrivateLink |
| `enable_encryption` | bool | true | Enable encryption at rest |
| `enable_audit_logging` | bool | true | Enable audit logging |
| `require_ssl` | bool | true | Require SSL connections |

## Storage Variables (R2 Module)

### Bucket Configuration

| Variable | Type | Description |
|----------|------|-------------|
| `phi_bucket_name` | string | **Required**. Name for PHI storage bucket |
| `non_phi_bucket_name` | string | **Required**. Name for non-PHI storage bucket |
| `cloudflare_account_id` | string (sensitive) | **Required**. Cloudflare account ID |

### Storage Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `primary_region` | string | "us-east-1" | Primary region for storage |
| `backup_region` | string | "us-west-2" | Backup region for cross-region replication |
| `enable_versioning` | bool | true | Enable object versioning |
| `enable_storage_encryption` | bool | true | Enable server-side encryption |
| `enable_cross_region_replication` | bool | true | Enable cross-region replication |

### Retention Policies

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `phi_retention_days` | number | 2555 | Retention period for PHI data in days (7 years for HIPAA) |
| `non_phi_retention_days` | number | 365 | Retention period for non-PHI data in days (1 year) |
| `backup_retention_days` | number | 90 | Backup retention period in days |

### CORS Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `allowed_origins` | list(string) | ["https://biopoint.app", ...] | Allowed CORS origins |
| `allowed_methods` | list(string) | ["GET", "PUT", "POST", "DELETE", "HEAD"] | Allowed CORS methods |
| `allowed_headers` | list(string) | ["*"] | Allowed CORS headers |

### Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `require_ssl` | bool | true | Require SSL for all connections |
| `block_public_access` | bool | true | Block public access to buckets |
| `hipaa_compliance` | bool | true | Enable HIPAA compliance features |
| `enable_audit_logging` | bool | true | Enable audit logging for bucket access |

## Cloudflare Variables

### Domain Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `api_subdomain` | string | "api" | API subdomain |
| `app_subdomain` | string | "app" | Application subdomain |
| `web_subdomain` | string | "www" | Web subdomain |

### Server Configuration

| Variable | Type | Description |
|----------|------|-------------|
| `api_server_ip` | string | **Required**. Primary API server IP address |
| `app_server_ip` | string | **Required**. Primary application server IP address |
| `web_server_ip` | string | **Required**. Primary web server IP address |
| `api_backup_ip` | string | "" | Backup API server IP address |
| `app_backup_ip` | string | "" | Backup application server IP address |
| `web_backup_ip` | string | "" | Backup web server IP address |

### Security Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `rate_limit_per_minute` | number | 100 | Rate limit per IP per minute |
| `api_rate_limit_per_minute` | number | 200 | API endpoint rate limit per IP per minute |
| `auth_rate_limit_per_minute` | number | 20 | Authentication endpoint rate limit per IP per minute |
| `enable_waf` | bool | true | Enable Web Application Firewall |
| `enable_ddos_protection` | bool | true | Enable DDoS protection |
| `enable_bot_management` | bool | true | Enable bot management |
| `security_level` | string | "high" | Security level (essentially_off, low, medium, high, under_attack) |

### SSL/TLS Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ssl_validation_method` | string | "txt" | SSL certificate validation method (txt, http, email) |
| `certificate_authority` | string | "lets_encrypt" | Certificate authority (lets_encrypt, digicert, sectigo) |
| `min_tls_version` | string | "1.2" | Minimum TLS version (1.0, 1.1, 1.2, 1.3) |

### Caching and Performance

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `browser_cache_ttl` | number | 14400 | Browser cache TTL in seconds (4 hours) |
| `edge_cache_ttl` | number | 7200 | Edge cache TTL in seconds (2 hours) |
| `enable_caching` | bool | true | Enable caching |
| `enable_compression` | bool | true | Enable compression |
| `enable_http2` | bool | true | Enable HTTP/2 |
| `enable_http3` | bool | true | Enable HTTP/3 |
| `enable_brotli` | bool | true | Enable Brotli compression |
| `enable_minify` | bool | true | Enable minification |

### Content Security Policy

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `csp_default_src` | list(string) | ["'self'"] | CSP default-src directive |
| `csp_script_src` | list(string) | ["'self'", "'unsafe-inline'"] | CSP script-src directive |
| `csp_style_src` | list(string) | ["'self'", "'unsafe-inline'"] | CSP style-src directive |
| `csp_img_src` | list(string) | ["'self'", "data:", "https:"] | CSP img-src directive |
| `csp_connect_src` | list(string) | ["'self'", "https://api.biopoint.app"] | CSP connect-src directive |

## Monitoring Variables (Datadog Module)

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `datadog_site` | string | "datadoghq.com" | Datadog site region |
| `api_key` | string (sensitive) | **Required**. Datadog API key |
| `app_key` | string (sensitive) | **Required**. Datadog application key |
| `api_domain` | string | **Required**. API domain for health checks |
| `app_domain` | string | **Required**. Application domain for health checks |

### Alert Thresholds

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `monitoring_interval` | number | 300 | Monitoring interval in seconds |
| `alert_threshold_cpu` | number | 80 | CPU usage alert threshold (%) |
| `alert_threshold_memory` | number | 85 | Memory usage alert threshold (%) |
| `alert_threshold_error_rate` | number | 5 | Error rate alert threshold (%) |
| `alert_threshold_response_time` | number | 2000 | Response time alert threshold (ms) |
| `alert_threshold_storage` | number | 80 | Storage usage alert threshold (%) |

### SLO Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `slo_availability_target` | number | 99.9 | SLO availability target (%) |
| `slo_response_time_target` | number | 1000 | SLO response time target (ms) |

### Integration Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `aws_account_id` | string | "" | AWS account ID for integration |
| `pagerduty_webhook_url` | string | "" | PagerDuty webhook URL |
| `pagerduty_routing_key` | string (sensitive) | "" | PagerDuty routing key |
| `synthetic_test_locations` | list(string) | ["aws:us-east-1", ...] | Locations for synthetic tests |
| `enable_aws_integration` | bool | true | Enable AWS integration |
| `enable_synthetic_tests` | bool | true | Enable synthetic tests |
| `enable_slo_monitoring` | bool | true | Enable SLO monitoring |
| `enable_log_pipelines` | bool | true | Enable log pipelines |
| `enable_webhooks` | bool | true | Enable webhook integrations |

## Secrets Management Variables (Doppler Module)

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `project_name` | string | "biopoint" | Doppler project name |
| `database_url` | string (sensitive) | **Required**. Database connection URL |
| `database_read_replica_url` | string (sensitive) | **Required**. Database read replica connection URL |
| `storage_endpoint` | string | **Required**. Storage endpoint URL |
| `storage_access_key_id` | string (sensitive) | **Required**. Storage access key ID |
| `storage_secret_access_key` | string (sensitive) | **Required**. Storage secret access key |
| `phi_bucket_name` | string | **Required**. PHI bucket name |
| `non_phi_bucket_name` | string | **Required**. Non-PHI bucket name |
| `datadog_api_key` | string (sensitive) | **Required**. Datadog API key |
| `datadog_app_key` | string (sensitive) | **Required**. Datadog application key |
| `cloudflare_api_token` | string (sensitive) | **Required**. Cloudflare API token |

### Email Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `smtp_host` | string | "smtp.gmail.com" | SMTP host |
| `smtp_port` | string | "587" | SMTP port |
| `smtp_user` | string (sensitive) | "" | SMTP username |
| `smtp_password` | string (sensitive) | "" | SMTP password |

### OAuth Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `oauth_client_id` | string (sensitive) | "" | OAuth client ID |
| `oauth_client_secret` | string (sensitive) | "" | OAuth client secret |

### Security Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `audit_log_endpoint` | string | "https://audit.biopoint.app" | Audit log endpoint |
| `encryption_algorithm` | string | "aes-256-gcm" | Encryption algorithm |
| `aws_region` | string | "us-east-1" | AWS region |
| `aws_account_id` | string | "" | AWS account ID |
| `enable_secret_rotation` | bool | true | Enable automatic secret rotation |
| `enable_audit_logging` | bool | true | Enable audit logging |
| `enable_backup` | bool | true | Enable secret backup |
| `enable_aws_integration` | bool | true | Enable AWS integration |
| `rotation_webhook_url` | string | "" | Webhook URL for rotation notifications |
| `audit_log_destination` | string | "https://logs.biopoint.app" | Audit log destination |

### Access Control

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `require_approval` | bool | true | Require approval for secret changes |
| `enable_access_controls` | bool | true | Enable access controls |
| `enable_ip_whitelist` | bool | true | Enable IP whitelisting |
| `allowed_ips` | list(string) | ["10.0.0.0/8", ...] | Allowed IP addresses |

## Environment-Specific Variables

### Development Environment (dev.tfvars)

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `environment` | string | "dev" | Development environment |
| `domain_name` | string | "dev.biopoint.app" | Development domain |
| `database_tier` | string | "free" | Free tier for cost savings |
| `enable_read_replicas` | bool | false | Disabled for cost savings |
| `enable_auto_pause` | bool | true | Enabled for cost savings |
| `auto_pause_delay_seconds` | number | 300 | 5 minute delay |
| `phi_retention_days` | number | 90 | 3 months for dev |
| `non_phi_retention_days` | number | 30 | 1 month for dev |
| `rate_limit_per_minute` | number | 200 | Higher limit for development |
| `enable_ddos_protection` | bool | false | Disabled for cost savings |
| `enable_slo_monitoring` | bool | false | Disabled for cost savings |
| `backup_retention_days` | number | 7 | 1 week for dev |
| `enable_cross_region_backup` | bool | false | Disabled for cost savings |
| `enable_private_network` | bool | false | Disabled for simplicity |
| `hipaa_compliance` | bool | false | Relaxed for development |

### Staging Environment (staging.tfvars)

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `environment` | string | "staging" | Staging environment |
| `domain_name` | string | "staging.biopoint.app" | Staging domain |
| `database_tier` | string | "launch" | Launch tier for staging |
| `enable_read_replicas` | bool | true | Enabled for testing |
| `enable_auto_pause` | bool | true | Enabled for cost savings |
| `auto_pause_delay_seconds` | number | 600 | 10 minute delay |
| `phi_retention_days` | number | 365 | 1 year for staging |
| `non_phi_retention_days` | number | 90 | 3 months for staging |
| `rate_limit_per_minute` | number | 150 | Moderate rate limiting |
| `enable_ddos_protection` | bool | true | Enabled for security |
| `enable_slo_monitoring` | bool | true | Enabled for monitoring |
| `backup_retention_days` | number | 14 | 2 weeks for staging |
| `enable_cross_region_backup` | bool | true | Enabled for testing |
| `enable_private_network` | bool | true | Enabled for security |
| `hipaa_compliance` | bool | true | Full compliance for staging |

### Production Environment (production.tfvars)

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `environment` | string | "production" | Production environment |
| `domain_name` | string | "biopoint.app" | Production domain |
| `database_tier` | string | "business" | Business tier for production |
| `enable_read_replicas` | bool | true | Enabled for high availability |
| `enable_auto_pause` | bool | false | Disabled for always-on |
| `phi_retention_days` | number | 2555 | 7 years for HIPAA compliance |
| `non_phi_retention_days` | number | 365 | 1 year for production |
| `rate_limit_per_minute` | number | 100 | Strict rate limiting |
| `enable_ddos_protection` | bool | true | Enabled for security |
| `enable_slo_monitoring` | bool | true | Enabled for monitoring |
| `backup_retention_days` | number | 30 | 30 days for production |
| `enable_cross_region_backup` | bool | true | Enabled for disaster recovery |
| `enable_private_network` | bool | true | Enabled for security |
| `enable_branching` | bool | false | Disabled for stability |
| `enable_cost_optimization` | bool | false | Disabled for performance |
| `hipaa_compliance` | bool | true | Full HIPAA compliance |

## Sensitive Variables

The following variables are marked as sensitive and should be handled with extra care:

### API Keys and Tokens
- `cloudflare_api_token`
- `neon_api_key`
- `datadog_api_key`
- `datadog_app_key`
- `doppler_service_token`
- `storage_secret_access_key`
- `smtp_password`
- `oauth_client_secret`

### Database Credentials
- `database_url`
- `database_read_replica_url`

### Encryption Keys
- All secrets managed by Doppler module

## Variable Validation

### Built-in Validation Rules

1. **Environment Validation**
   ```hcl
   validation {
     condition     = contains(["dev", "staging", "production"], var.environment)
     error_message = "Environment must be one of: dev, staging, production."
   }
   ```

2. **Database Tier Validation**
   ```hcl
   validation {
     condition = contains(["free", "launch", "scale", "business", "enterprise"], var.database_tier)
     error_message = "Database tier must be one of: free, launch, scale, business, enterprise."
   }
   ```

3. **SSL Validation Method**
   ```hcl
   validation {
     condition     = contains(["txt", "http", "email"], var.ssl_validation_method)
     error_message = "SSL validation method must be one of: txt, http, email."
   }
   ```

## Environment Variables vs Terraform Variables

### Terraform Variables
- Defined in `.tfvars` files
- Used for infrastructure configuration
- Version controlled (except sensitive values)
- Applied during `terraform plan/apply`

### Environment Variables
- Set in shell or CI/CD environment
- Used for provider authentication
- Not version controlled
- Required for Terraform execution

### Doppler Secrets
- Managed by Doppler service
- Used for application secrets
- Not version controlled
- Injected at runtime

## Best Practices

### 1. Variable Naming
- Use descriptive names
- Follow snake_case convention
- Include units in variable names when applicable
- Group related variables with common prefixes

### 2. Default Values
- Provide sensible defaults
- Document the rationale for defaults
- Consider environment-specific requirements
- Test defaults in all environments

### 3. Sensitive Variables
- Always mark sensitive variables
- Use environment variables for sensitive data
- Implement proper secret rotation
- Audit access to sensitive variables

### 4. Documentation
- Document all variables
- Include examples and use cases
- Specify validation rules
- Provide environment-specific guidance

This variable reference provides comprehensive documentation for all configuration options available in the BioPoint Terraform infrastructure. Always refer to the specific environment files for actual values used in each deployment environment.