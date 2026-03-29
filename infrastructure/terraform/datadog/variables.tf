# Datadog Monitoring Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "datadog_site" {
  description = "Datadog site region"
  type        = string
  default     = "datadoghq.com"
}

variable "api_domain" {
  description = "API domain for health checks"
  type        = string
}

variable "app_domain" {
  description = "Application domain for health checks"
  type        = string
}

variable "api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
}

variable "app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
}

variable "aws_account_id" {
  description = "AWS account ID for integration"
  type        = string
  default     = ""
}

variable "pagerduty_webhook_url" {
  description = "PagerDuty webhook URL"
  type        = string
  default     = ""
}

variable "pagerduty_routing_key" {
  description = "PagerDuty routing key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "synthetic_test_locations" {
  description = "Locations for synthetic tests"
  type        = list(string)
  default = [
    "aws:us-east-1",
    "aws:us-west-2",
    "aws:eu-central-1"
  ]
}

variable "monitoring_interval" {
  description = "Monitoring interval in seconds"
  type        = number
  default     = 300  # 5 minutes
}

variable "alert_threshold_cpu" {
  description = "CPU usage alert threshold (%)"
  type        = number
  default     = 80
}

variable "alert_threshold_memory" {
  description = "Memory usage alert threshold (%)"
  type        = number
  default     = 85
}

variable "alert_threshold_error_rate" {
  description = "Error rate alert threshold (%)"
  type        = number
  default     = 5
}

variable "alert_threshold_response_time" {
  description = "Response time alert threshold (ms)"
  type        = number
  default     = 2000
}

variable "alert_threshold_storage" {
  description = "Storage usage alert threshold (%)"
  type        = number
  default     = 80
}

variable "slo_availability_target" {
  description = "SLO availability target (%)"
  type        = number
  default     = 99.9
}

variable "slo_response_time_target" {
  description = "SLO response time target (ms)"
  type        = number
  default     = 1000
}

variable "enable_aws_integration" {
  description = "Enable AWS integration"
  type        = bool
  default     = true
}

variable "enable_synthetic_tests" {
  description = "Enable synthetic tests"
  type        = bool
  default     = true
}

variable "enable_slo_monitoring" {
  description = "Enable SLO monitoring"
  type        = bool
  default     = true
}

variable "enable_log_pipelines" {
  description = "Enable log pipelines"
  type        = bool
  default     = true
}

variable "enable_webhooks" {
  description = "Enable webhook integrations"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Notification Variables
variable "notification_channels" {
  description = "Notification channels for alerts"
  type        = list(string)
  default     = []
}

variable "email_recipients" {
  description = "Email recipients for alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "teams_webhook_url" {
  description = "Microsoft Teams webhook URL for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

# Compliance Variables
variable "hipaa_compliance" {
  description = "Enable HIPAA compliance features"
  type        = bool
  default     = true
}

variable "enable_audit_logging" {
  description = "Enable audit logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 90
}

# Advanced Variables
variable "custom_metrics" {
  description = "Custom metrics to monitor"
  type        = list(object({
    name        = string
    query       = string
    type        = string
    description = string
  }))
  default = []
}

variable "custom_alerts" {
  description = "Custom alerts to create"
  type        = list(object({
    name        = string
    query       = string
    message     = string
    type        = string
    thresholds  = map(number)
    tags        = map(string)
  }))
  default = []
}

variable "dashboard_filters" {
  description = "Dashboard filters"
  type        = list(object({
    name   = string
    values = list(string)
  }))
  default = []
}