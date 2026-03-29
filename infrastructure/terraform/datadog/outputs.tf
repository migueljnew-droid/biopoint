# Datadog Monitoring Module Outputs

# API Keys
output "api_key_id" {
  description = "Datadog API key ID"
  value       = datadog_api_key.main.id
}

output "api_key" {
  description = "Datadog API key"
  value       = random_password.api_key.result
  sensitive   = true
}

output "app_key_id" {
  description = "Datadog application key ID"
  value       = datadog_application_key.main.id
}

output "app_key" {
  description = "Datadog application key"
  value       = random_password.app_key.result
  sensitive   = true
}

# Dashboard Outputs
output "dashboard_id" {
  description = "Main dashboard ID"
  value       = datadog_dashboard.main.id
}

output "dashboard_url" {
  description = "Main dashboard URL"
  value       = "https://app.datadoghq.com/dashboard/${datadog_dashboard.main.id}"
}

output "dashboard_title" {
  description = "Main dashboard title"
  value       = datadog_dashboard.main.title
}

# Monitor Outputs
output "cpu_monitor_id" {
  description = "CPU monitor ID"
  value       = datadog_monitor.high_cpu.id
}

output "memory_monitor_id" {
  description = "Memory monitor ID"
  value       = datadog_monitor.high_memory.id
}

output "database_monitor_id" {
  description = "Database monitor ID"
  value       = datadog_monitor.database_down.id
}

output "error_rate_monitor_id" {
  description = "Error rate monitor ID"
  value       = datadog_monitor.high_error_rate.id
}

output "response_time_monitor_id" {
  description = "Response time monitor ID"
  value       = datadog_monitor.response_time_high.id
}

output "waf_monitor_id" {
  description = "WAF monitor ID"
  value       = datadog_monitor.waf_blocked_requests_high.id
}

output "storage_monitor_id" {
  description = "Storage monitor ID"
  value       = datadog_monitor.storage_usage_high.id
}

# SLO Outputs
output "availability_slo_id" {
  description = "Availability SLO ID"
  value       = datadog_service_level_objective.availability.id
}

output "response_time_slo_id" {
  description = "Response time SLO ID"
  value       = datadog_service_level_objective.response_time.id
}

output "availability_slo_target" {
  description = "Availability SLO target"
  value       = var.slo_availability_target
}

output "response_time_slo_target" {
  description = "Response time SLO target"
  value       = var.slo_response_time_target
}

# Synthetic Test Outputs
output "api_synthetic_test_id" {
  description = "API synthetic test ID"
  value       = datadog_synthetics_test.api_health.id
}

output "app_synthetic_test_id" {
  description = "Application synthetic test ID"
  value       = datadog_synthetics_test.app_health.id
}

output "api_synthetic_test_url" {
  description = "API synthetic test URL"
  value       = "https://app.datadoghq.com/synthetics/details/${datadog_synthetics_test.api_health.id}"
}

output "app_synthetic_test_url" {
  description = "Application synthetic test URL"
  value       = "https://app.datadoghq.com/synthetics/details/${datadog_synthetics_test.app_health.id}"
}

# Integration Outputs
output "aws_integration_id" {
  description = "AWS integration ID"
  value       = var.enable_aws_integration ? datadog_integration_aws.main.id : null
}

output "webhook_id" {
  description = "Webhook ID"
  value       = var.enable_webhooks ? datadog_webhook.pagerduty.id : null
}

# Log Pipeline Outputs
output "log_pipeline_id" {
  description = "Log pipeline ID"
  value       = var.enable_log_pipelines ? datadog_logs_custom_pipeline.biopoint_pipeline.id : null
}

# Monitoring Configuration
output "monitoring_enabled" {
  description = "Monitoring enabled"
  value       = true
}

output "synthetic_tests_enabled" {
  description = "Synthetic tests enabled"
  value       = var.enable_synthetic_tests
}

output "slo_monitoring_enabled" {
  description = "SLO monitoring enabled"
  value       = var.enable_slo_monitoring
}

output "aws_integration_enabled" {
  description = "AWS integration enabled"
  value       = var.enable_aws_integration
}

# Alert Configuration
output "alert_thresholds" {
  description = "Alert thresholds"
  value = {
    cpu         = var.alert_threshold_cpu
    memory      = var.alert_threshold_memory
    error_rate  = var.alert_threshold_error_rate
    response_time = var.alert_threshold_response_time
    storage     = var.alert_threshold_storage
  }
}

# Site Information
output "datadog_site" {
  description = "Datadog site region"
  value       = var.datadog_site
}

output "monitoring_interval" {
  description = "Monitoring interval in seconds"
  value       = var.monitoring_interval
}

# Health Check Endpoints
output "monitoring_endpoints" {
  description = "Monitoring endpoints"
  value = {
    api  = "https://${var.api_domain}/health"
    app  = "https://${var.app_domain}/health"
  }
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

output "log_retention_days" {
  description = "Log retention period in days"
  value       = var.log_retention_days
}

# Notification Configuration
output "notification_channels" {
  description = "Notification channels configured"
  value       = var.notification_channels
}

output "email_recipients" {
  description = "Email recipients for alerts"
  value       = var.email_recipients
}

# Custom Configuration
output "custom_metrics_count" {
  description = "Number of custom metrics"
  value       = length(var.custom_metrics)
}

output "custom_alerts_count" {
  description = "Number of custom alerts"
  value       = length(var.custom_alerts)
}