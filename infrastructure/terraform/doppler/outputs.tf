# Doppler Secrets Management Module Outputs

# Project Information
output "project_name" {
  description = "Doppler project name"
  value       = doppler_project.main.name
}

output "project_id" {
  description = "Doppler project ID"
  value       = doppler_project.main.id
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "config_name" {
  description = "Doppler config name"
  value       = doppler_config.main.name
}

output "config_slug" {
  description = "Doppler config slug"
  value       = doppler_config.main.slug
}

# Service Tokens
output "api_service_token" {
  description = "API service token"
  value       = doppler_service_token.api_token.key
  sensitive   = true
}

output "app_service_token" {
  description = "Application service token"
  value       = doppler_service_token.app_token.key
  sensitive   = true
}

output "worker_service_token" {
  description = "Worker service token"
  value       = doppler_service_token.worker_token.key
  sensitive   = true
}

# Secret Names (for reference)
output "secret_names" {
  description = "Names of all secrets"
  value = [
    doppler_secret.jwt_secret.name,
    doppler_secret.encryption_key.name,
    doppler_secret.api_secret.name,
    doppler_secret.session_secret.name,
    doppler_secret.webhook_secret.name,
    doppler_secret.database_url.name,
    doppler_secret.database_read_replica_url.name,
    doppler_secret.storage_endpoint.name,
    doppler_secret.storage_access_key_id.name,
    doppler_secret.storage_secret_access_key.name,
    doppler_secret.phi_bucket_name.name,
    doppler_secret.non_phi_bucket_name.name,
    doppler_secret.datadog_api_key.name,
    doppler_secret.datadog_app_key.name,
    doppler_secret.cloudflare_api_token.name,
    doppler_secret.smtp_host.name,
    doppler_secret.smtp_port.name,
    doppler_secret.smtp_user.name,
    doppler_secret.smtp_password.name,
    doppler_secret.oauth_client_id.name,
    doppler_secret.oauth_client_secret.name,
    doppler_secret.audit_log_endpoint.name,
    doppler_secret.encryption_algorithm.name,
    doppler_secret.environment.name,
    doppler_secret.api_domain.name,
    doppler_secret.app_domain.name,
    doppler_secret.web_domain.name
  ]
}

# Configuration URLs
output "doppler_dashboard_url" {
  description = "Doppler dashboard URL"
  value       = "https://dashboard.doppler.com/workplace/${doppler_project.main.workplace}/projects/${doppler_project.main.name}"
}

output "config_url" {
  description = "Doppler config URL"
  value       = "https://dashboard.doppler.com/workplace/${doppler_project.main.workplace}/projects/${doppler_project.main.name}/configs/${doppler_config.main.slug}"
}

# Service Token Information
output "service_tokens" {
  description = "Service token information"
  value = {
    api = {
      name = doppler_service_token.api_token.name
      slug = doppler_service_token.api_token.slug
    }
    app = {
      name = doppler_service_token.app_token.name
      slug = doppler_service_token.app_token.slug
    }
    worker = {
      name = doppler_service_token.worker_token.name
      slug = doppler_service_token.worker_token.slug
    }
  }
}

# Environment Information
output "environments" {
  description = "Available environments"
  value = {
    dev     = doppler_environment.dev.slug
    staging = doppler_environment.staging.slug
    production = doppler_environment.production.slug
  }
}

# Secret Rotation
output "secret_rotation_enabled" {
  description = "Secret rotation enabled"
  value       = var.enable_secret_rotation
}

output "rotation_schedule" {
  description = "Secret rotation schedule"
  value = var.enable_secret_rotation ? {
    jwt_secret = "0 0 */30 * *"   # Every 30 days
    api_secret = "0 0 */60 * *"   # Every 60 days
  } : null
}

# Audit Logging
output "audit_logging_enabled" {
  description = "Audit logging enabled"
  value       = var.enable_audit_logging
}

output "audit_log_destination" {
  description = "Audit log destination"
  value       = var.audit_log_destination
}

# Access Controls
output "access_controls_enabled" {
  description = "Access controls enabled"
  value       = var.enable_access_controls
}

output "access_groups" {
  description = "Access groups"
  value = var.enable_access_controls ? {
    developers = doppler_access_group.developers.name
    ops_team   = doppler_access_group.ops_team.name
  } : null
}

# Integration Information
output "aws_integration_enabled" {
  description = "AWS integration enabled"
  value       = var.enable_aws_integration
}

output "aws_integration_id" {
  description = "AWS integration ID"
  value       = var.enable_aws_integration ? doppler_integration_aws_secrets_manager.main[0].id : null
}

# Backup Information
output "backup_enabled" {
  description = "Backup enabled"
  value       = var.enable_backup
}

output "backup_schedule" {
  description = "Backup schedule"
  value       = var.enable_backup ? doppler_backup.main[0].schedule : null
}

# Compliance Information
output "hipaa_compliance" {
  description = "HIPAA compliance enabled"
  value       = var.hipaa_compliance
}

output "encryption_required" {
  description = "Encryption required for all secrets"
  value       = var.encryption_required
}

# Secret Categories
output "secret_categories" {
  description = "Secret categories"
  value       = var.secret_categories
}

# Custom Secrets
output "custom_secrets_count" {
  description = "Number of custom secrets"
  value       = length(var.custom_secrets)
}

# Integration Configs
output "integration_configs" {
  description = "Integration configurations"
  value       = var.integration_configs
}

# Notification Information
output "notification_channels" {
  description = "Notification channels"
  value       = var.notification_channels
}

output "email_notifications" {
  description = "Email notification recipients"
  value       = var.email_notifications
}

# CLI Commands for Setup
output "cli_setup_commands" {
  description = "CLI commands for setting up Doppler"
  value = {
    install = "curl -Ls https://cli.doppler.com/install.sh | sh"
    login   = "doppler login"
    setup   = "doppler setup -p ${doppler_project.main.name} -c ${doppler_config.main.slug}"
    run     = "doppler run -- your-command"
  }
}

# Environment Variables Export
output "environment_variables" {
  description = "Environment variables for application"
  value = {
    DOPPLER_PROJECT = doppler_project.main.name
    DOPPLER_CONFIG  = doppler_config.main.slug
    DOPPLER_TOKEN   = doppler_service_token.api_token.key
  }
  sensitive = true
}