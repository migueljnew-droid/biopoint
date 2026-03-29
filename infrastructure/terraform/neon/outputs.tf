# Neon PostgreSQL Module Outputs

output "project_id" {
  description = "Neon project ID"
  value       = neon_project.main.id
}

output "primary_host" {
  description = "Primary database hostname"
  value       = neon_endpoint.pooled.host
}

output "primary_port" {
  description = "Primary database port"
  value       = 5432
}

output "primary_user" {
  description = "Primary database user"
  value       = neon_role.app_user.name
}

output "primary_password" {
  description = "Primary database password"
  value       = random_password.app_user.result
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = neon_database.main.name
}

output "connection_uri" {
  description = "Primary database connection URI"
  value       = "postgresql://${neon_role.app_user.name}:${random_password.app_user.result}@${neon_endpoint.pooled.host}:5432/${neon_database.main.name}"
  sensitive   = true
}

output "direct_connection_uri" {
  description = "Direct database connection URI (non-pooled)"
  value       = "postgresql://${neon_role.app_user.name}:${random_password.app_user.result}@${neon_endpoint.direct.host}:5432/${neon_database.main.name}"
  sensitive   = true
}

# Read Replica Outputs
output "read_replica_hosts" {
  description = "Read replica hostnames"
  value = {
    us_west = var.enable_read_replicas ? neon_endpoint.read_replica_us_west[0].host : null
    eu      = var.enable_read_replicas ? neon_endpoint.read_replica_eu[0].host : null
  }
}

output "read_replica_connection_uris" {
  description = "Read replica connection URIs"
  value = {
    us_west = var.enable_read_replicas ? "postgresql://${neon_role.app_user.name}:${random_password.app_user.result}@${neon_endpoint.read_replica_us_west[0].host}:5432/${neon_database.main.name}" : null
    eu      = var.enable_read_replicas ? "postgresql://${neon_role.app_user.name}:${random_password.app_user.result}@${neon_endpoint.read_replica_eu[0].host}:5432/${neon_database.main.name}" : null
  }
  sensitive = true
}

# User Outputs
output "app_user" {
  description = "Application database user"
  value       = neon_role.app_user.name
}

output "readonly_user" {
  description = "Read-only database user"
  value       = neon_role.readonly_user.name
}

output "datadog_user" {
  description = "Datadog monitoring user"
  value       = neon_role.datadog_user.name
}

output "datadog_password" {
  description = "Datadog user password"
  value       = random_password.datadog_user.result
  sensitive   = true
}

# Branch Outputs
output "main_branch_id" {
  description = "Main branch ID"
  value       = neon_branch.main.id
}

output "development_branch_id" {
  description = "Development branch ID"
  value       = var.enable_branching ? neon_branch.development[0].id : null
}

output "staging_branch_id" {
  description = "Staging branch ID"
  value       = var.enable_branching ? neon_branch.staging[0].id : null
}

# Endpoint Outputs
output "pooled_endpoint_host" {
  description = "Pooled endpoint hostname"
  value       = neon_endpoint.pooled.host
}

output "direct_endpoint_host" {
  description = "Direct endpoint hostname"
  value       = neon_endpoint.direct.host
}

output "endpoint_ids" {
  description = "Endpoint IDs"
  value = {
    pooled = neon_endpoint.pooled.id
    direct = neon_endpoint.direct.id
  }
}

# Private Network Outputs
output "vpc_id" {
  description = "VPC ID for private networking"
  value       = var.enable_private_network ? neon_privatelink.main[0].id : null
}

output "security_group_ids" {
  description = "Security group IDs"
  value       = var.enable_private_network ? [neon_privatelink.main[0].id] : []
}

output "privatelink_service_name" {
  description = "PrivateLink service name"
  value       = var.enable_private_network ? neon_privatelink.main[0].aws_service_name : null
}

# Health Check
output "health_check_url" {
  description = "Database health check URL"
  value       = "https://console.neon.tech/api/v2/projects/${neon_project.main.id}/branches/${neon_branch.main.id}/health"
}

# Redis Output (if using Neon with Redis support)
output "redis_url" {
  description = "Redis connection URL (if available)"
  value       = "redis://${neon_endpoint.pooled.host}:6379"  # Placeholder for Redis
}

# Backup Configuration
output "backup_schedule" {
  description = "Backup schedule"
  value       = "0 2 * * *"  # Daily at 2 AM UTC
}

output "backup_retention_days" {
  description = "Backup retention period"
  value       = var.backup_retention_days
}

# Cost Optimization
output "auto_pause_enabled" {
  description = "Auto-pause enabled"
  value       = var.enable_auto_pause
}

output "auto_pause_delay_seconds" {
  description = "Auto-pause delay in seconds"
  value       = var.auto_pause_delay_seconds
}