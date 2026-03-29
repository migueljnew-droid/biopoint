# Cloudflare Module Outputs

# DNS Records
output "api_dns_record" {
  description = "API DNS record"
  value = {
    name = cloudflare_dns_record.api.name
    type = cloudflare_dns_record.api.type
    value = cloudflare_dns_record.api.value
  }
}

output "app_dns_record" {
  description = "Application DNS record"
  value = {
    name = cloudflare_dns_record.app.name
    type = cloudflare_dns_record.app.type
    value = cloudflare_dns_record.app.value
  }
}

output "web_dns_record" {
  description = "Web DNS record"
  value = {
    name = cloudflare_dns_record.web.name
    type = cloudflare_dns_record.web.type
    value = cloudflare_dns_record.web.value
  }
}

# Load Balancer Outputs
output "load_balancer_ip" {
  description = "Load balancer IP address"
  value       = cloudflare_load_balancer.api.default_pool_ids[0]
}

output "load_balancer_id" {
  description = "Load balancer ID"
  value       = cloudflare_load_balancer.api.id
}

output "load_balancer_pools" {
  description = "Load balancer pool IDs"
  value = {
    primary = cloudflare_load_balancer_pool.api_primary.id
    backup  = cloudflare_load_balancer_pool.api_backup.id
  }
}

# WAF Outputs
output "waf_id" {
  description = "WAF ruleset ID"
  value       = cloudflare_ruleset.waf_custom.id
}

output "waf_managed_id" {
  description = "Managed WAF ruleset ID"
  value       = cloudflare_ruleset.waf_managed.id
}

output "rate_limiting_id" {
  description = "Rate limiting ruleset ID"
  value       = cloudflare_ruleset.rate_limiting.id
}

# SSL Certificate Outputs
output "ssl_certificate_id" {
  description = "SSL certificate ID"
  value       = cloudflare_ssl_certificate.main.id
}

output "ssl_status" {
  description = "SSL certificate status"
  value       = cloudflare_ssl_certificate.main.status
}

output "ssl_expires_on" {
  description = "SSL certificate expiration date"
  value       = cloudflare_ssl_certificate.main.expires_on
}

# Security Outputs
output "security_headers_id" {
  description = "Security headers ruleset ID"
  value       = cloudflare_ruleset.security_headers.id
}

output "bot_management_enabled" {
  description = "Bot management enabled"
  value       = var.enable_bot_management
}

output "ddos_protection_enabled" {
  description = "DDoS protection enabled"
  value       = var.enable_ddos_protection
}

# Zone Information
output "zone_id" {
  description = "Cloudflare zone ID"
  value       = data.cloudflare_zone.main.id
}

output "zone_name" {
  description = "Cloudflare zone name"
  value       = data.cloudflare_zone.main.name
}

# DNS Information
output "dns_servers" {
  description = "Cloudflare DNS servers"
  value       = data.cloudflare_zone.main.name_servers
}

# Health Check Outputs
output "health_check_monitor_id" {
  description = "Health check monitor ID"
  value       = cloudflare_load_balancer_monitor.api_health.id
}

output "health_check_status" {
  description = "Health check status"
  value       = cloudflare_load_balancer_monitor.api_health.status
}

# Analytics Outputs
output "analytics_enabled" {
  description = "Analytics enabled"
  value       = var.enable_analytics
}

# Security Configuration
output "security_level" {
  description = "Security level"
  value       = var.security_level
}

output "rate_limit_per_minute" {
  description = "Rate limit per minute"
  value       = var.rate_limit_per_minute
}

# SSL Configuration
output "min_tls_version" {
  description = "Minimum TLS version"
  value       = var.min_tls_version
}

output "certificate_authority" {
  description = "Certificate authority"
  value       = var.certificate_authority
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

output "ssl_required" {
  description = "SSL required for all connections"
  value       = var.require_ssl
}

# Page Rules
output "page_rule_ids" {
  description = "Page rule IDs"
  value = {
    api_cache = cloudflare_page_rule.api_cache.id
    static_assets = cloudflare_page_rule.static_assets.id
  }
}

# Settings Override
output "zone_settings_override_id" {
  description = "Zone settings override ID"
  value       = cloudflare_zone_settings_override.analytics.id
}

# Health Check Endpoints
output "health_check_endpoints" {
  description = "Health check endpoints"
  value = {
    api = "https://${var.api_subdomain}.${var.domain_name}${var.health_check_path}"
    app = "https://${var.app_subdomain}.${var.domain_name}${var.health_check_path}"
    web = "https://${var.web_subdomain}.${var.domain_name}${var.health_check_path}"
  }
}