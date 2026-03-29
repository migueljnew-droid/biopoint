# Cloudflare Module Variables

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

variable "api_subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}

variable "app_subdomain" {
  description = "Application subdomain"
  type        = string
  default     = "app"
}

variable "web_subdomain" {
  description = "Web subdomain"
  type        = string
  default     = "www"
}

variable "api_server_ip" {
  description = "Primary API server IP address"
  type        = string
}

variable "app_server_ip" {
  description = "Primary application server IP address"
  type        = string
}

variable "web_server_ip" {
  description = "Primary web server IP address"
  type        = string
}

variable "api_backup_ip" {
  description = "Backup API server IP address"
  type        = string
  default     = ""
}

variable "app_backup_ip" {
  description = "Backup application server IP address"
  type        = string
  default     = ""
}

variable "web_backup_ip" {
  description = "Backup web server IP address"
  type        = string
  default     = ""
}

variable "rate_limit_per_minute" {
  description = "Rate limit per IP per minute"
  type        = number
  default     = 100
}

variable "api_rate_limit_per_minute" {
  description = "API endpoint rate limit per IP per minute"
  type        = number
  default     = 200
}

variable "auth_rate_limit_per_minute" {
  description = "Authentication endpoint rate limit per IP per minute"
  type        = number
  default     = 20
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "enable_ddos_protection" {
  description = "Enable DDoS protection"
  type        = bool
  default     = true
}

variable "enable_bot_management" {
  description = "Enable bot management"
  type        = bool
  default     = true
}

variable "ssl_validation_method" {
  description = "SSL certificate validation method"
  type        = string
  default     = "txt"
  
  validation {
    condition     = contains(["txt", "http", "email"], var.ssl_validation_method)
    error_message = "SSL validation method must be one of: txt, http, email."
  }
}

variable "certificate_authority" {
  description = "Certificate authority"
  type        = string
  default     = "lets_encrypt"
  
  validation {
    condition     = contains(["lets_encrypt", "digicert", "sectigo"], var.certificate_authority)
    error_message = "Certificate authority must be one of: lets_encrypt, digicert, sectigo."
  }
}

variable "min_tls_version" {
  description = "Minimum TLS version"
  type        = string
  default     = "1.2"
  
  validation {
    condition     = contains(["1.0", "1.1", "1.2", "1.3"], var.min_tls_version)
    error_message = "Minimum TLS version must be one of: 1.0, 1.1, 1.2, 1.3."
  }
}

variable "security_level" {
  description = "Security level"
  type        = string
  default     = "high"
  
  validation {
    condition     = contains(["essentially_off", "low", "medium", "high", "under_attack"], var.security_level)
    error_message = "Security level must be one of: essentially_off, low, medium, high, under_attack."
  }
}

variable "challenge_ttl" {
  description = "Challenge TTL in seconds"
  type        = number
  default     = 1800  # 30 minutes
}

variable "browser_cache_ttl" {
  description = "Browser cache TTL in seconds"
  type        = number
  default     = 14400  # 4 hours
}

variable "edge_cache_ttl" {
  description = "Edge cache TTL in seconds"
  type        = number
  default     = 7200  # 2 hours
}

variable "enable_caching" {
  description = "Enable caching"
  type        = bool
  default     = true
}

variable "enable_compression" {
  description = "Enable compression"
  type        = bool
  default     = true
}

variable "enable_http2" {
  description = "Enable HTTP/2"
  type        = bool
  default     = true
}

variable "enable_http3" {
  description = "Enable HTTP/3"
  type        = bool
  default     = true
}

variable "enable_brotli" {
  description = "Enable Brotli compression"
  type        = bool
  default     = true
}

variable "enable_minify" {
  description = "Enable minification"
  type        = bool
  default     = true
}

variable "blocked_countries" {
  description = "List of countries to block"
  type        = list(string)
  default = [
    "CN",  # China
    "RU",  # Russia
    "KP",  # North Korea
    "IR"   # Iran
  ]
}

variable "allowed_countries" {
  description = "List of countries to allow (if specified, only these countries are allowed)"
  type        = list(string)
  default     = []
}

variable "blocked_user_agents" {
  description = "List of user agents to block"
  type        = list(string)
  default = [
    "sqlmap",
    "nikto",
    "nessus",
    "burp",
    "zap",
    "acunetix"
  ]
}

variable "enable_analytics" {
  description = "Enable analytics"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
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

variable "require_ssl" {
  description = "Require SSL for all connections"
  type        = bool
  default     = true
}

# Content Security Policy Variables
variable "csp_default_src" {
  description = "CSP default-src directive"
  type        = list(string)
  default     = ["'self'"]
}

variable "csp_script_src" {
  description = "CSP script-src directive"
  type        = list(string)
  default     = ["'self'", "'unsafe-inline'"]
}

variable "csp_style_src" {
  description = "CSP style-src directive"
  type        = list(string)
  default     = ["'self'", "'unsafe-inline'"]
}

variable "csp_img_src" {
  description = "CSP img-src directive"
  type        = list(string)
  default     = ["'self'", "data:", "https:"]
}

variable "csp_connect_src" {
  description = "CSP connect-src directive"
  type        = list(string)
  default     = ["'self'", "https://api.biopoint.app"]
}

# Health Check Variables
variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Number of health check retries"
  type        = number
  default     = 2
}