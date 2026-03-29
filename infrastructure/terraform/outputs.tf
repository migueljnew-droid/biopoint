# BioPoint Terraform Outputs
# Key infrastructure outputs for application configuration

# Database Outputs
output "database_host" {
  description = "Primary database hostname"
  value       = module.neon.primary_host
}

output "database_port" {
  description = "Database port"
  value       = 5432
}

output "database_name" {
  description = "Database name"
  value       = local.db_name
}

output "database_user" {
  description = "Database username"
  value       = module.neon.primary_user
}

output "database_read_replica_hosts" {
  description = "Read replica hostnames"
  value       = module.neon.read_replica_hosts
}

# Storage Outputs
output "phi_bucket_name" {
  description = "PHI storage bucket name"
  value       = module.s3.phi_bucket_name
  sensitive   = true
}

output "non_phi_bucket_name" {
  description = "Non-PHI storage bucket name"
  value       = module.s3.non_phi_bucket_name
}

output "storage_endpoint" {
  description = "Cloudflare R2 storage endpoint"
  value       = module.s3.storage_endpoint
}

# Domain Outputs
output "api_domain" {
  description = "API subdomain"
  value       = local.api_domain
}

output "app_domain" {
  description = "Application subdomain"
  value       = local.app_domain
}

output "web_domain" {
  description = "Web subdomain"
  value       = local.web_domain
}

output "load_balancer_ip" {
  description = "Cloudflare load balancer IP"
  value       = module.cloudflare.load_balancer_ip
}

# Monitoring Outputs
output "datadog_api_key" {
  description = "Datadog API key"
  value       = var.datadog_api_key
  sensitive   = true
}

output "datadog_site" {
  description = "Datadog site region"
  value       = var.datadog_site
}

output "monitoring_dashboard_url" {
  description = "Datadog dashboard URL"
  value       = module.datadog.dashboard_url
}

# Security Outputs
output "waf_id" {
  description = "Cloudflare WAF ID"
  value       = module.cloudflare.waf_id
}

output "ssl_certificate_status" {
  description = "SSL certificate status"
  value       = module.cloudflare.ssl_status
}

# Network Outputs
output "vpc_id" {
  description = "VPC ID for private networking"
  value       = module.neon.vpc_id
}

output "security_group_ids" {
  description = "Security group IDs"
  value       = module.neon.security_group_ids
}

# Doppler Outputs
output "doppler_project_name" {
  description = "Doppler project name"
  value       = var.doppler_project_name
}

output "doppler_config_name" {
  description = "Doppler configuration name"
  value       = var.environment
}

# Application Configuration
output "environment_variables" {
  description = "Environment variables for application"
  value = {
    DATABASE_URL            = "postgresql://${module.neon.primary_user}:${random_password.db_password.result}@${module.neon.primary_host}:5432/${local.db_name}"
    REDIS_URL               = module.neon.redis_url
    STORAGE_ENDPOINT        = module.s3.storage_endpoint
    PHI_BUCKET_NAME         = module.s3.phi_bucket_name
    NON_PHI_BUCKET_NAME     = module.s3.non_phi_bucket_name
    API_DOMAIN              = local.api_domain
    APP_DOMAIN              = local.app_domain
    DATADOG_API_KEY         = var.datadog_api_key
    DATADOG_SITE            = var.datadog_site
    DOPPLER_PROJECT_NAME    = var.doppler_project_name
    ENVIRONMENT             = var.environment
  }
  sensitive = true
}

# Compliance Outputs
output "hipaa_compliance_enabled" {
  description = "HIPAA compliance features enabled"
  value       = var.hipaa_compliance
}

output "audit_logging_enabled" {
  description = "Audit logging enabled"
  value       = var.enable_audit_logging
}

output "encryption_enabled" {
  description = "Encryption enabled for all services"
  value       = var.enable_storage_encryption
}

# Backup Outputs
output "backup_schedule" {
  description = "Database backup schedule"
  value       = var.backup_schedule
}

output "backup_retention_days" {
  description = "Backup retention period in days"
  value       = var.backup_retention_days
}

# Cost Optimization Outputs
output "auto_pause_enabled" {
  description = "Auto-pause enabled for serverless instances"
  value       = var.auto_pause_delay_seconds > 0
}

# Health Check Outputs
output "health_check_endpoints" {
  description = "Health check endpoints"
  value = {
    api_health   = "https://${local.api_domain}/health"
    app_health   = "https://${local.app_domain}/health"
    db_health    = module.neon.health_check_url
    storage_health = "${module.s3.storage_endpoint}/health"
  }
}