# Cloudflare Security and DNS Module for BioPoint
# HIPAA-compliant CDN, WAF, and DNS configuration

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Get zone information
data "cloudflare_zone" "main" {
  name = var.domain_name
}

# Create DNS records
resource "cloudflare_dns_record" "api" {
  zone_id = data.cloudflare_zone.main.id
  name    = var.api_subdomain
  type    = "A"
  value   = var.api_server_ip
  proxied = true  # Enable Cloudflare proxy
  ttl     = 1     # Auto TTL
  
  tags = var.tags
}

resource "cloudflare_dns_record" "app" {
  zone_id = data.cloudflare_zone.main.id
  name    = var.app_subdomain
  type    = "A"
  value   = var.app_server_ip
  proxied = true
  ttl     = 1
  
  tags = var.tags
}

resource "cloudflare_dns_record" "web" {
  zone_id = data.cloudflare_zone.main.id
  name    = var.web_subdomain
  type    = "A"
  value   = var.web_server_ip
  proxied = true
  ttl     = 1
  
  tags = var.tags
}

# Create load balancer for high availability
resource "cloudflare_load_balancer" "api" {
  zone_id          = data.cloudflare_zone.main.id
  name             = var.api_subdomain
  fallback_pool_id = cloudflare_load_balancer_pool.api_primary.id
  default_pool_ids = [
    cloudflare_load_balancer_pool.api_primary.id,
    cloudflare_load_balancer_pool.api_backup.id
  ]
  
  description = "BioPoint API Load Balancer"
  proxied     = true
  
  rules {
    name      = "health-check"
    condition = "cf.load_balancer.health_check"
    
    overrides {
      steering_policy = "least_connections"
    }
  }
  
  # Session affinity for API consistency
  session_affinity = "cookie"
  session_affinity_ttl = 1800  # 30 minutes
  
  # Health check configuration
  pop_pools {
    pop      = "LAX"  # Los Angeles
    pool_ids = [cloudflare_load_balancer_pool.api_primary.id]
  }
  
  pop_pools {
    pop      = "JFK"  # New York
    pool_ids = [cloudflare_load_balancer_pool.api_backup.id]
  }
}

# Create load balancer pools
resource "cloudflare_load_balancer_pool" "api_primary" {
  name     = "biopoint-api-primary"
  account_id = var.cloudflare_account_id
  
  origins {
    name    = "api-primary"
    address = var.api_server_ip
    enabled = true
    
    header {
      header = "Host"
      values = ["${var.api_subdomain}.${var.domain_name}"]
    }
  }
  
  # Health check
  monitor = cloudflare_load_balancer_monitor.api_health.id
  
  # Load balancing method
  steering_policy = "least_connections"
  
  # Session affinity
  session_affinity = "cookie"
  
  description = "Primary API server pool"
}

resource "cloudflare_load_balancer_pool" "api_backup" {
  name     = "biopoint-api-backup"
  account_id = var.cloudflare_account_id
  
  origins {
    name    = "api-backup"
    address = var.api_backup_ip
    enabled = true
    
    header {
      header = "Host"
      values = ["${var.api_subdomain}.${var.domain_name}"]
    }
  }
  
  monitor = cloudflare_load_balancer_monitor.api_health.id
  steering_policy = "least_connections"
  session_affinity = "cookie"
  
  description = "Backup API server pool"
}

# Health check monitor
resource "cloudflare_load_balancer_monitor" "api_health" {
  account_id     = var.cloudflare_account_id
  type           = "https"
  expected_codes = "200"
  method         = "GET"
  
  path      = "/health"
  interval  = 30
  timeout   = 5
  retries   = 2
  
  description = "API health check monitor"
  
  header {
    header = "Host"
    values = ["${var.api_subdomain}.${var.domain_name}"]
  }
  
  allow_insecure = false
  follow_redirects = true
}

# Create Web Application Firewall (WAF) rules
resource "cloudflare_ruleset" "waf_custom" {
  zone_id     = data.cloudflare_zone.main.id
  name        = "BioPoint Custom WAF Rules"
  description = "Custom WAF rules for BioPoint application"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  
  # Block known malicious IPs
  rules {
    action = "block"
    expression = "ip.geoip.country in {CN RU KP IR}"
    description = "Block countries with high malicious activity"
    enabled = true
  }
  
  # Rate limiting per IP
  rules {
    action = "rate_limit"
    expression = "true"
    description = "Rate limit requests per IP"
    enabled = true
    
    action_parameters {
      requests_per_period = var.rate_limit_per_minute
      period = 60  # 1 minute
      mitigation_timeout = 300  # 5 minutes
    }
  }
  
  # Block SQL injection attempts
  rules {
    action = "block"
    expression = <<EOF
      (
        http.request.uri.query contains "union" or
        http.request.uri.query contains "select" or
        http.request.uri.query contains "insert" or
        http.request.uri.query contains "update" or
        http.request.uri.query contains "delete" or
        http.request.uri.query contains "drop" or
        http.request.uri.query contains "create" or
        http.request.uri.query contains "alter" or
        http.request.uri.query contains "exec" or
        http.request.uri.query contains "script"
      )
    EOF
    description = "Block SQL injection attempts"
    enabled = true
  }
  
  # Block XSS attempts
  rules {
    action = "block"
    expression = <<EOF
      (
        http.request.uri.query contains "<script" or
        http.request.uri.query contains "javascript:" or
        http.request.uri.query contains "onload=" or
        http.request.uri.query contains "onerror=" or
        http.request.uri.query contains "onclick=" or
        http.request.body contains "<script" or
        http.request.body contains "javascript:"
      )
    EOF
    description = "Block XSS attempts"
    enabled = true
  }
  
  # Block path traversal attempts
  rules {
    action = "block"
    expression = <<EOF
      (
        http.request.uri.path contains ".." or
        http.request.uri.path contains "/etc/" or
        http.request.uri.path contains "/proc/" or
        http.request.uri.path contains "windows/system32"
      )
    EOF
    description = "Block path traversal attempts"
    enabled = true
  }
  
  # Block requests with suspicious headers
  rules {
    action = "block"
    expression = <<EOF
      (
        http.request.headers["user-agent"] contains "sqlmap" or
        http.request.headers["user-agent"] contains "nikto" or
        http.request.headers["user-agent"] contains "nessus" or
        http.request.headers["user-agent"] contains "burp" or
        http.request.headers["user-agent"] contains "zap"
      )
    EOF
    description = "Block known vulnerability scanners"
    enabled = true
  }
}

# Enable managed rulesets (OWASP Top 10, etc.)
resource "cloudflare_ruleset" "waf_managed" {
  zone_id     = data.cloudflare_zone.main.id
  name        = "BioPoint Managed WAF Rules"
  description = "Managed WAF rules for BioPoint"
  kind        = "zone"
  phase       = "http_request_firewall_managed"
  
  # Enable OWASP Core Rule Set
  rules {
    action = "execute"
    expression = "true"
    description = "OWASP Core Rule Set"
    enabled = true
    
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f"  # OWASP CRS ID
      overrides {
        categories {
          category = "paranoia-level-1"
          action   = "block"
          enabled  = true
        }
        categories {
          category = "paranoia-level-2"
          action   = "block"
          enabled  = true
        }
        categories {
          category = "paranoia-level-3"
          action   = "block"
          enabled  = true
        }
      }
    }
  }
  
  # Enable Cloudflare Managed Ruleset
  rules {
    action = "execute"
    expression = "true"
    description = "Cloudflare Managed Ruleset"
    enabled = true
    
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"  # Cloudflare Managed Ruleset ID
    }
  }
}

# Create rate limiting rules
resource "cloudflare_ruleset" "rate_limiting" {
  zone_id     = data.cloudflare_zone.main.id
  name        = "BioPoint Rate Limiting"
  description = "Rate limiting rules for BioPoint"
  kind        = "zone"
  phase       = "http_request_rate_limit"
  
  # Global rate limiting
  rules {
    action = "rate_limit"
    expression = "true"
    description = "Global rate limit"
    enabled = true
    
    action_parameters {
      requests_per_period = var.rate_limit_per_minute
      period = 60
      mitigation_timeout = 300
    }
  }
  
  # API endpoint rate limiting
  rules {
    action = "rate_limit"
    expression = "http.request.uri.path contains \"/api/\""
    description = "API endpoint rate limit"
    enabled = true
    
    action_parameters {
      requests_per_period = var.api_rate_limit_per_minute
      period = 60
      mitigation_timeout = 300
    }
  }
  
  # Authentication endpoint rate limiting
  rules {
    action = "rate_limit"
    expression = "http.request.uri.path contains \"/auth/\""
    description = "Authentication endpoint rate limit"
    enabled = true
    
    action_parameters {
      requests_per_period = var.auth_rate_limit_per_minute
      period = 60
      mitigation_timeout = 600  # 10 minutes for auth endpoints
    }
  }
}

# SSL/TLS configuration
resource "cloudflare_ssl_certificate" "main" {
  zone_id     = data.cloudflare_zone.main.id
  type        = "advanced"
  hosts       = [var.domain_name, "*.${var.domain_name}"]
  
  validation_method     = "txt"
  certificate_authority = "lets_encrypt"
  
  # Enable HSTS
  settings {
    http2 = "on"
    tls_1_3 = "on"
    min_tls_version = "1.2"
    
    security_headers {
      strict_transport_security = {
        enabled    = true
        max_age    = 31536000  # 1 year
        include_subdomains = true
        nosniff = true
      }
    }
  }
}

# DDoS protection
resource "cloudflare_ruleset" "ddos_protection" {
  count = var.enable_ddos_protection ? 1 : 0
  
  zone_id     = data.cloudflare_zone.main.id
  name        = "BioPoint DDoS Protection"
  description = "DDoS protection rules"
  kind        = "zone"
  phase       = "ddos_l7"
  
  rules {
    action = "execute"
    expression = "true"
    description = "Enable DDoS protection"
    enabled = true
    
    action_parameters {
      id = "4d21379b4f9f4bb088e096996d6d90b4"  # DDoS protection ruleset ID
    }
  }
}

# Create custom security headers
resource "cloudflare_ruleset" "security_headers" {
  zone_id     = data.cloudflare_zone.main.id
  name        = "BioPoint Security Headers"
  description = "Security headers for BioPoint"
  kind        = "zone"
  phase       = "http_response_headers_transform"
  
  rules {
    action = "rewrite"
    expression = "true"
    description = "Add security headers"
    enabled = true
    
    action_parameters {
      headers {
        name       = "X-Content-Type-Options"
        value      = "nosniff"
        operation  = "set"
      }
      headers {
        name       = "X-Frame-Options"
        value      = "DENY"
        operation  = "set"
      }
      headers {
        name       = "X-XSS-Protection"
        value      = "1; mode=block"
        operation  = "set"
      }
      headers {
        name       = "Referrer-Policy"
        value      = "strict-origin-when-cross-origin"
        operation  = "set"
      }
      headers {
        name       = "Content-Security-Policy"
        value      = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.biopoint.app;"
        operation  = "set"
      }
      headers {
        name       = "Strict-Transport-Security"
        value      = "max-age=31536000; includeSubDomains; preload"
        operation  = "set"
      }
    }
  }
}

# Bot management
resource "cloudflare_bot_management" "main" {
  zone_id = data.cloudflare_zone.main.id
  
  enable_js = true
  fight_mode = true
  
  # Auto-update bot definitions
  auto_update_model = true
}

# Page rules for caching and optimization
resource "cloudflare_page_rule" "api_cache" {
  zone_id = data.cloudflare_zone.main.id
  target  = "${var.api_subdomain}.${var.domain_name}/api/*"
  
  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 300  # 5 minutes
    browser_cache_ttl = 300
    
    # Security headers
    security_level = "high"
    ssl = "strict"
  }
  
  priority = 1
}

resource "cloudflare_page_rule" "static_assets" {
  zone_id = data.cloudflare_zone.main.id
  target  = "${var.app_subdomain}.${var.domain_name}/static/*"
  
  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 86400  # 24 hours
    browser_cache_ttl = 86400
  }
  
  priority = 2
}

# Analytics and monitoring
resource "cloudflare_zone_settings_override" "analytics" {
  zone_id = data.cloudflare_zone.main.id
  
  settings {
    # Enable analytics
    analytics_engine = "on"
    
    # Security settings
    security_level = "high"
    challenge_ttl = 1800
    
    # Performance settings
    minify = {
      css = "on"
      js  = "on"
      html = "on"
    }
    
    # Brotli compression
    brotli = "on"
    
    # HTTP/2 and HTTP/3
    http2 = "on"
    http3 = "on"
    
    # 0-RTT
    zero_rtt = "on"
  }
}