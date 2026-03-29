# Cloudflare R2 Storage Module Variables

variable "phi_bucket_name" {
  description = "Name for PHI storage bucket"
  type        = string
}

variable "non_phi_bucket_name" {
  description = "Name for non-PHI storage bucket"
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

variable "primary_region" {
  description = "Primary region for storage"
  type        = string
  default     = "us-east-1"
}

variable "backup_region" {
  description = "Backup region for cross-region replication"
  type        = string
  default     = "us-west-2"
}

variable "enable_versioning" {
  description = "Enable object versioning"
  type        = bool
  default     = true
}

variable "enable_storage_encryption" {
  description = "Enable server-side encryption"
  type        = bool
  default     = true
}

variable "enable_cross_region_replication" {
  description = "Enable cross-region replication"
  type        = bool
  default     = true
}

variable "phi_retention_days" {
  description = "Retention period for PHI data in days"
  type        = number
  default     = 2555  # 7 years
}

variable "non_phi_retention_days" {
  description = "Retention period for non-PHI data in days"
  type        = number
  default     = 365  # 1 year
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 90
}

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default = [
    "https://biopoint.app",
    "https://app.biopoint.app",
    "https://api.biopoint.app",
    "https://localhost:3000"
  ]
}

variable "allowed_methods" {
  description = "Allowed CORS methods"
  type        = list(string)
  default = [
    "GET",
    "PUT",
    "POST",
    "DELETE",
    "HEAD"
  ]
}

variable "allowed_headers" {
  description = "Allowed CORS headers"
  type        = list(string)
  default = [
    "*"
  ]
}

variable "notification_queue_arn" {
  description = "SQS queue ARN for notifications"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Security Variables
variable "require_ssl" {
  description = "Require SSL for all connections"
  type        = bool
  default     = true
}

variable "block_public_access" {
  description = "Block public access to buckets"
  type        = bool
  default     = true
}

# Cost Optimization Variables
variable "transition_to_ia_days" {
  description = "Days before transitioning to Infrequent Access"
  type        = number
  default     = 90
}

variable "transition_to_glacier_days" {
  description = "Days before transitioning to Glacier"
  type        = number
  default     = 365
}

# Compliance Variables
variable "hipaa_compliance" {
  description = "Enable HIPAA compliance features"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging for bucket access"
  type        = bool
  default     = true
}

# Access Control Variables
variable "enable_presigned_urls" {
  description = "Enable presigned URL support"
  type        = bool
  default     = true
}

variable "presigned_url_expiry" {
  description = "Presigned URL expiry time in seconds"
  type        = number
  default     = 3600  # 1 hour
}