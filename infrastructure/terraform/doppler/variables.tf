# Doppler Secrets Management Module Variables

variable "project_name" {
  description = "Doppler project name"
  type        = string
  default     = "biopoint"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "database_read_replica_url" {
  description = "Database read replica connection URL"
  type        = string
  sensitive   = true
}

variable "storage_endpoint" {
  description = "Storage endpoint URL"
  type        = string
}

variable "storage_access_key_id" {
  description = "Storage access key ID"
  type        = string
  sensitive   = true
}

variable "storage_secret_access_key" {
  description = "Storage secret access key"
  type        = string
  sensitive   = true
}

variable "phi_bucket_name" {
  description = "PHI bucket name"
  type        = string
}

variable "non_phi_bucket_name" {
  description = "Non-PHI bucket name"
  type        = string
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

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "api_domain" {
  description = "API domain"
  type        = string
}

variable "app_domain" {
  description = "Application domain"
  type        = string
}

variable "web_domain" {
  description = "Web domain"
  type        = string
}

variable "smtp_host" {
  description = "SMTP host"
  type        = string
  default     = "smtp.gmail.com"
}

variable "smtp_port" {
  description = "SMTP port"
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oauth_client_id" {
  description = "OAuth client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oauth_client_secret" {
  description = "OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "audit_log_endpoint" {
  description = "Audit log endpoint"
  type        = string
  default     = "https://audit.biopoint.app"
}

variable "encryption_algorithm" {
  description = "Encryption algorithm"
  type        = string
  default     = "aes-256-gcm"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = ""
}

variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable secret backup"
  type        = bool
  default     = true
}

variable "enable_aws_integration" {
  description = "Enable AWS integration"
  type        = bool
  default     = true
}

variable "rotation_webhook_url" {
  description = "Webhook URL for rotation notifications"
  type        = string
  default     = ""
}

variable "audit_log_destination" {
  description = "Audit log destination"
  type        = string
  default     = "https://logs.biopoint.app"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Security Variables
variable "require_approval" {
  description = "Require approval for secret changes"
  type        = bool
  default     = true
}

variable "enable_access_controls" {
  description = "Enable access controls"
  type        = bool
  default     = true
}

variable "enable_ip_whitelist" {
  description = "Enable IP whitelisting"
  type        = bool
  default     = true
}

variable "allowed_ips" {
  description = "Allowed IP addresses"
  type        = list(string)
  default = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16"
  ]
}

# Compliance Variables
variable "hipaa_compliance" {
  description = "Enable HIPAA compliance features"
  type        = bool
  default     = true
}

variable "encryption_required" {
  description = "Require encryption for all secrets"
  type        = bool
  default     = true
}

variable "minimum_secret_length" {
  description = "Minimum secret length"
  type        = number
  default     = 16
}

# Advanced Variables
variable "custom_secrets" {
  description = "Custom secrets to create"
  type = list(object({
    name        = string
    value       = string
    description = string
  }))
  default = []
}

variable "secret_categories" {
  description = "Secret categories for organization"
  type = list(object({
    name        = string
    description = string
    color       = string
  }))
  default = [
    {
      name        = "database"
      description = "Database connection secrets"
      color       = "blue"
    },
    {
      name        = "storage"
      description = "Storage access secrets"
      color       = "green"
    },
    {
      name        = "api"
      description = "API authentication secrets"
      color       = "purple"
    },
    {
      name        = "encryption"
      description = "Encryption keys"
      color       = "red"
    }
  ]
}

variable "integration_configs" {
  description = "Integration configurations"
  type = list(object({
    name        = string
    type        = string
    config      = map(string)
    enabled     = bool
  }))
  default = []
}

# Notification Variables
variable "notification_channels" {
  description = "Notification channels for secret events"
  type        = list(string)
  default     = []
}

variable "email_notifications" {
  description = "Email addresses for notifications"
  type        = list(string)
  default     = []
}

variable "slack_webhook" {
  description = "Slack webhook for notifications"
  type        = string
  sensitive   = true
  default     = ""
}