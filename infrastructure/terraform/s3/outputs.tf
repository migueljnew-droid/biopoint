# Cloudflare R2 Storage Module Outputs

output "phi_bucket_name" {
  description = "PHI storage bucket name"
  value       = cloudflare_r2_bucket.phi_storage.name
  sensitive   = true
}

output "phi_bucket_id" {
  description = "PHI storage bucket ID"
  value       = cloudflare_r2_bucket.phi_storage.id
}

output "non_phi_bucket_name" {
  description = "Non-PHI storage bucket name"
  value       = cloudflare_r2_bucket.non_phi_storage.name
}

output "non_phi_bucket_id" {
  description = "Non-PHI storage bucket ID"
  value       = cloudflare_r2_bucket.non_phi_storage.id
}

output "backup_bucket_name" {
  description = "Backup storage bucket name"
  value       = cloudflare_r2_bucket.backup_storage.name
}

output "backup_bucket_id" {
  description = "Backup storage bucket ID"
  value       = cloudflare_r2_bucket.backup_storage.id
}

output "phi_replica_bucket_name" {
  description = "PHI replica bucket name"
  value       = var.enable_cross_region_replication ? cloudflare_r2_bucket.phi_replica[0].name : null
}

output "phi_replica_bucket_id" {
  description = "PHI replica bucket ID"
  value       = var.enable_cross_region_replication ? cloudflare_r2_bucket.phi_replica[0].id : null
}

# Storage Endpoints
output "storage_endpoint" {
  description = "R2 storage endpoint URL"
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "phi_bucket_endpoint" {
  description = "PHI bucket endpoint URL"
  value       = "https://${cloudflare_r2_bucket.phi_storage.name}.${var.cloudflare_account_id}.r2.cloudflarestorage.com"
  sensitive   = true
}

output "non_phi_bucket_endpoint" {
  description = "Non-PHI bucket endpoint URL"
  value       = "https://${cloudflare_r2_bucket.non_phi_storage.name}.${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

# Access Keys
output "access_key_id" {
  description = "R2 access key ID"
  value       = cloudflare_r2_access_key.app_access.id
  sensitive   = true
}

output "secret_access_key" {
  description = "R2 secret access key"
  value       = cloudflare_r2_access_key.app_access.secret
  sensitive   = true
}

# Storage Configuration
output "versioning_enabled" {
  description = "Versioning enabled for buckets"
  value       = var.enable_versioning
}

output "encryption_enabled" {
  description = "Encryption enabled for buckets"
  value       = var.enable_storage_encryption
}

output "cross_region_replication_enabled" {
  description = "Cross-region replication enabled"
  value       = var.enable_cross_region_replication
}

# Lifecycle Policies
output "phi_retention_days" {
  description = "PHI retention period in days"
  value       = var.phi_retention_days
}

output "non_phi_retention_days" {
  description = "Non-PHI retention period in days"
  value       = var.non_phi_retention_days
}

output "backup_retention_days" {
  description = "Backup retention period in days"
  value       = var.backup_retention_days
}

# CORS Configuration
output "cors_origins" {
  description = "Allowed CORS origins"
  value       = var.allowed_origins
}

# Security Configuration
output "ssl_required" {
  description = "SSL required for connections"
  value       = var.require_ssl
}

output "public_access_blocked" {
  description = "Public access blocked"
  value       = var.block_public_access
}

# Presigned URL Configuration
output "presigned_url_enabled" {
  description = "Presigned URLs enabled"
  value       = var.enable_presigned_urls
}

output "presigned_url_expiry" {
  description = "Presigned URL expiry in seconds"
  value       = var.presigned_url_expiry
}

# Compliance Outputs
output "hipaa_compliance" {
  description = "HIPAA compliance enabled"
  value       = var.hipaa_compliance
}

output "audit_logging_enabled" {
  description = "Audit logging enabled"
  value       = var.enable_audit_logging
}

# Storage Metrics
output "bucket_sizes" {
  description = "Bucket names for monitoring"
  value = {
    phi       = cloudflare_r2_bucket.phi_storage.name
    non_phi   = cloudflare_r2_bucket.non_phi_storage.name
    backup    = cloudflare_r2_bucket.backup_storage.name
    phi_replica = var.enable_cross_region_replication ? cloudflare_r2_bucket.phi_replica[0].name : null
  }
}

# Health Check
output "storage_health_check" {
  description = "Storage health check endpoint"
  value       = "https://${cloudflare_r2_bucket.phi_storage.name}.${var.cloudflare_account_id}.r2.cloudflarestorage.com/health"
}