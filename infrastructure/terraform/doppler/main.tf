# Doppler Secrets Management Module for BioPoint
# HIPAA-compliant secrets management with rotation and audit logging

terraform {
  required_providers {
    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Create Doppler project
resource "doppler_project" "main" {
  name        = var.project_name
  description = "BioPoint ${title(var.environment)} environment secrets"
}

# Create environments within the project
resource "doppler_environment" "dev" {
  project = doppler_project.main.name
  name    = "dev"
  slug    = "dev"
}

resource "doppler_environment" "staging" {
  project = doppler_project.main.name
  name    = "staging"
  slug    = "staging"
}

resource "doppler_environment" "production" {
  project = doppler_project.main.name
  name    = "production"
  slug    = "production"
}

# Create config for the current environment
resource "doppler_config" "main" {
  project = doppler_project.main.name
  environment = var.environment
  name    = var.environment
  slug    = var.environment
}

# Generate secure secrets
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "encryption_key" {
  length  = 32
  special = true
}

resource "random_password" "api_secret" {
  length  = 32
  special = true
}

resource "random_password" "session_secret" {
  length  = 48
  special = true
}

resource "random_password" "webhook_secret" {
  length  = 32
  special = true
}

# Create secrets in Doppler
resource "doppler_secret" "jwt_secret" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "JWT_SECRET"
  value   = random_password.jwt_secret.result
  
  lifecycle {
    ignore_changes = [
      value  # Allow manual updates through Doppler UI
    ]
  }
}

resource "doppler_secret" "encryption_key" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "ENCRYPTION_KEY"
  value   = random_password.encryption_key.result
  
  lifecycle {
    ignore_changes = [
      value  # Allow manual updates through Doppler UI
    ]
  }
}

resource "doppler_secret" "api_secret" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "API_SECRET"
  value   = random_password.api_secret.result
  
  lifecycle {
    ignore_changes = [
      value  # Allow manual updates through Doppler UI
    ]
  }
}

resource "doppler_secret" "session_secret" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "SESSION_SECRET"
  value   = random_password.session_secret.result
  
  lifecycle {
    ignore_changes = [
      value  # Allow manual updates through Doppler UI
    ]
  }
}

resource "doppler_secret" "webhook_secret" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "WEBHOOK_SECRET"
  value   = random_password.webhook_secret.result
  
  lifecycle {
    ignore_changes = [
      value  # Allow manual updates through Doppler UI
    ]
  }
}

# Database connection secrets (populated from Neon module)
resource "doppler_secret" "database_url" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "DATABASE_URL"
  value   = var.database_url
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

resource "doppler_secret" "database_read_replica_url" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "DATABASE_READ_REPLICA_URL"
  value   = var.database_read_replica_url
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# Storage secrets
resource "doppler_secret" "storage_endpoint" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "STORAGE_ENDPOINT"
  value   = var.storage_endpoint
}

resource "doppler_secret" "storage_access_key_id" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "STORAGE_ACCESS_KEY_ID"
  value   = var.storage_access_key_id
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

resource "doppler_secret" "storage_secret_access_key" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "STORAGE_SECRET_ACCESS_KEY"
  value   = var.storage_secret_access_key
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# PHI bucket secrets
resource "doppler_secret" "phi_bucket_name" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "PHI_BUCKET_NAME"
  value   = var.phi_bucket_name
}

resource "doppler_secret" "non_phi_bucket_name" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "NON_PHI_BUCKET_NAME"
  value   = var.non_phi_bucket_name
}

# Monitoring secrets
resource "doppler_secret" "datadog_api_key" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "DATADOG_API_KEY"
  value   = var.datadog_api_key
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

resource "doppler_secret" "datadog_app_key" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "DATADOG_APP_KEY"
  value   = var.datadog_app_key
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# Cloudflare secrets
resource "doppler_secret" "cloudflare_api_token" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "CLOUDFLARE_API_TOKEN"
  value   = var.cloudflare_api_token
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# Email configuration
resource "doppler_secret" "smtp_host" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "SMTP_HOST"
  value   = var.smtp_host
}

resource "doppler_secret" "smtp_port" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "SMTP_PORT"
  value   = var.smtp_port
}

resource "doppler_secret" "smtp_user" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "SMTP_USER"
  value   = var.smtp_user
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

resource "doppler_secret" "smtp_password" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "SMTP_PASSWORD"
  value   = var.smtp_password
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# OAuth secrets
resource "doppler_secret" "oauth_client_id" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "OAUTH_CLIENT_ID"
  value   = var.oauth_client_id
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

resource "doppler_secret" "oauth_client_secret" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "OAUTH_CLIENT_SECRET"
  value   = var.oauth_client_secret
  
  lifecycle {
    ignore_changes = [
      value  # Will be updated by external process
    ]
  }
}

# Environment-specific configuration
resource "doppler_secret" "environment" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "ENVIRONMENT"
  value   = var.environment
}

resource "doppler_secret" "api_domain" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "API_DOMAIN"
  value   = var.api_domain
}

resource "doppler_secret" "app_domain" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "APP_DOMAIN"
  value   = var.app_domain
}

resource "doppler_secret" "web_domain" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "WEB_DOMAIN"
  value   = var.web_domain
}

# HIPAA compliance secrets
resource "doppler_secret" "audit_log_endpoint" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "AUDIT_LOG_ENDPOINT"
  value   = var.audit_log_endpoint
}

resource "doppler_secret" "encryption_algorithm" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "ENCRYPTION_ALGORITHM"
  value   = var.encryption_algorithm
}

# Create service tokens for different services
resource "doppler_service_token" "api_token" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "biopoint-api-token"
  
  access = "read"
}

resource "doppler_service_token" "app_token" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "biopoint-app-token"
  
  access = "read"
}

resource "doppler_service_token" "worker_token" {
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  name    = "biopoint-worker-token"
  
  access = "read"
}

# Create audit logging configuration
resource "doppler_audit_log" "main" {
  count = var.enable_audit_logging ? 1 : 0
  
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  
  # Log all secret access events
  events = ["secrets.access", "secrets.update", "config.sync"]
  
  # Send to external logging service
  destination = var.audit_log_destination
}

# Create secret rotation configuration
resource "doppler_secret_rotation" "jwt_secret" {
  count = var.enable_secret_rotation ? 1 : 0
  
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  secret  = doppler_secret.jwt_secret.name
  
  # Rotate every 30 days
  schedule = "0 0 */30 * *"
  
  # Keep old secret for 7 days (grace period)
  retention_days = 7
  
  # Notify on rotation
  webhook_url = var.rotation_webhook_url
}

resource "doppler_secret_rotation" "api_secret" {
  count = var.enable_secret_rotation ? 1 : 0
  
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  secret  = doppler_secret.api_secret.name
  
  schedule = "0 0 */60 * *"  # Every 60 days
  retention_days = 7
  webhook_url = var.rotation_webhook_url
}

# Create access controls
resource "doppler_access_group" "developers" {
  project = doppler_project.main.name
  name    = "BioPoint Developers"
  
  # Read access to all configs
  permissions = ["read"]
  
  # Include all environments for developers
  environments = ["dev", "staging"]
}

resource "doppler_access_group" "ops_team" {
  project = doppler_project.main.name
  name    = "BioPoint Operations Team"
  
  # Full access to production
  permissions = ["read", "write", "admin"]
  
  environments = ["production"]
}

# Create integration with external secret stores
resource "doppler_integration_aws_secrets_manager" "main" {
  count = var.enable_aws_integration ? 1 : 0
  
  name        = "biopoint-aws-secrets"
  description = "AWS Secrets Manager integration for BioPoint"
  
  # Sync secrets to AWS Secrets Manager
  sync_enabled = true
  
  # AWS configuration
  aws_region     = var.aws_region
  aws_account_id = var.aws_account_id
  
  # Map Doppler secrets to AWS secrets
  secret_mappings = [
    {
      doppler_secret = doppler_secret.jwt_secret.name
      aws_secret     = "biopoint/jwt-secret"
    },
    {
      doppler_secret = doppler_secret.encryption_key.name
      aws_secret     = "biopoint/encryption-key"
    }
  ]
}

# Create backup configuration
resource "doppler_backup" "main" {
  count = var.enable_backup ? 1 : 0
  
  project = doppler_project.main.name
  config  = doppler_config.main.slug
  
  # Daily backups
  schedule = "0 2 * * *"
  
  # Keep 30 days of backups
  retention_days = 30
  
  # Encrypt backups
  encryption_key = doppler_secret.encryption_key.value
}