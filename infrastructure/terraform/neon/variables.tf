# Neon PostgreSQL Module Variables

variable "project_name" {
  description = "Neon project name"
  type        = string
}

variable "primary_region" {
  description = "Primary region for Neon database"
  type        = string
  default     = "us-east-1"
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "database_name" {
  description = "Name of the main database"
  type        = string
  default     = "biopoint"
}

variable "database_tier" {
  description = "Neon database tier"
  type        = string
  default     = "launch"
}

variable "active_time_quota" {
  description = "Active time quota in seconds"
  type        = number
  default     = 3600  # 1 hour
}

variable "cpu_quota_sec" {
  description = "CPU quota in seconds"
  type        = number
  default     = 3600  # 1 hour
}

variable "enable_read_replicas" {
  description = "Enable read replicas"
  type        = bool
  default     = true
}

variable "enable_branching" {
  description = "Enable database branching"
  type        = bool
  default     = true
}

variable "enable_private_network" {
  description = "Enable private network access"
  type        = bool
  default     = true
}

variable "enable_auto_pause" {
  description = "Enable auto-pause for cost optimization"
  type        = bool
  default     = true
}

variable "auto_pause_delay_seconds" {
  description = "Auto-pause delay in seconds"
  type        = number
  default     = 300  # 5 minutes
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "aws_account_id" {
  description = "AWS account ID for PrivateLink"
  type        = string
  default     = ""
}

variable "allowed_aws_principals" {
  description = "Allowed AWS principals for PrivateLink"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# HIPAA Compliance Variables
variable "enable_encryption" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging"
  type        = bool
  default     = true
}

variable "require_ssl" {
  description = "Require SSL connections"
  type        = bool
  default     = true
}