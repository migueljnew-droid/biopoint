# BioPoint Terraform Variables
# Environment-specific and sensitive variables

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "domain_name" {
  description = "Primary domain name for BioPoint"
  type        = string
  default     = "biopoint.app"
}

variable "aws_region" {
  description = "AWS primary region"
  type        = string
  default     = "us-east-1"
}

variable "backup_regions" {
  description = "AWS backup regions for cross-region replication"
  type        = list(string)
  default     = ["us-west-2", "eu-central-1"]
}

# API Keys and Tokens (sensitive)
variable "cloudflare_api_token" {
  description = "Cloudflare API token for DNS and security configuration"
  type        = string
  sensitive   = true
}

variable "neon_api_key" {
  description = "Neon PostgreSQL API key"
  type        = string
  sensitive   = true
}

variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
}

variable "doppler_service_token" {
  description = "Doppler service token for secrets management"
  type        = string
  sensitive   = true
}

variable "doppler_project_name" {
  description = "Doppler project name"
  type        = string
  default     = "biopoint"
}

# Database Configuration
variable "database_tier" {
  description = "Neon database tier"
  type        = string
  default     = "launch"
  
  validation {
    condition = contains([
      "free",
      "launch", 
      "scale",
      "business",
      "enterprise"
    ], var.database_tier)
    error_message = "Database tier must be one of: free, launch, scale, business, enterprise."
  }
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "enable_read_replicas" {
  description = "Enable read replicas for multi-region deployment"
  type        = bool
  default     = true
}

# Storage Configuration
variable "enable_storage_encryption" {
  description = "Enable server-side encryption for S3/R2 buckets"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable object versioning for buckets"
  type        = bool
  default     = true
}

variable "phi_retention_days" {
  description = "Retention period for PHI data in days"
  type        = number
  default     = 2555  # 7 years for HIPAA compliance
}

variable "non_phi_retention_days" {
  description = "Retention period for non-PHI data in days"
  type        = number
  default     = 365  # 1 year
}

# Security Configuration
variable "enable_waf" {
  description = "Enable Cloudflare WAF"
  type        = bool
  default     = true
}

variable "rate_limit_per_minute" {
  description = "Rate limit per IP per minute"
  type        = number
  default     = 100
}

variable "enable_ddos_protection" {
  description = "Enable DDoS protection"
  type        = bool
  default     = true
}

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default = [
    "https://biopoint.app",
    "https://app.biopoint.app", 
    "https://api.biopoint.app",
    "https://localhost:3000",
    "https://localhost:8080"
  ]
}

# Monitoring Configuration
variable "enable_datadog_monitoring" {
  description = "Enable Datadog monitoring and alerting"
  type        = bool
  default     = true
}

variable "datadog_site" {
  description = "Datadog site region"
  type        = string
  default     = "datadoghq.com"
}

variable "enable_slo_monitoring" {
  description = "Enable SLO/SLI monitoring"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_schedule" {
  description = "Database backup schedule (cron expression)"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM UTC
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = true
}

# Network Configuration
variable "enable_private_network" {
  description = "Enable private network access for database"
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Compliance Configuration
variable "hipaa_compliance" {
  description = "Enable HIPAA compliance features"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging for compliance"
  type        = bool
  default     = true
}

# Development Configuration
variable "enable_branching" {
  description = "Enable database branching for development"
  type        = bool
  default     = true
}

variable "dev_instance_count" {
  description = "Number of development instances"
  type        = number
  default     = 1
}

# Cost Optimization
variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "auto_pause_delay_seconds" {
  description = "Auto-pause delay for serverless instances (seconds)"
  type        = number
  default     = 300  # 5 minutes
}