# Cloudflare Load Balancer Configuration for BioPoint Production
# This configuration creates a highly available load balancing setup
# with geographic failover and health monitoring

terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for biopoint.com"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token with appropriate permissions"
  type        = string
  sensitive   = true
}

variable "origin_server_east" {
  description = "US-East-1 origin server IP/hostname"
  type        = string
  default     = "api-east.biopoint.com"
}

variable "origin_server_west" {
  description = "US-West-2 origin server IP/hostname"
  type        = string
  default     = "api-west.biopoint.com"
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Random identifier for resources
resource "random_id" "load_balancer" {
  byte_length = 4
}

# Cloudflare Load Monitor - Health check configuration
resource "cloudflare_load_balancer_monitor" "biopoint_health_check" {
  account_id = var.cloudflare_account_id
  
  expected_body = "healthy"
  expected_codes = "200"
  method = "GET"
  timeout = 10
  path = "/health/lb"
  interval = 30
  retries = 3
  description = "BioPoint API health check monitor"
  
  header {
    header = "Host"
    values = ["api.biopoint.com"]
  }
  
  header {
    header = "User-Agent"
    values = ["Cloudflare-Health-Check/1.0"]
  }
  
  allow_insecure = false
  follow_redirects = true
  probe_zone = "us-east-1"
}

# US-East-1 Origin Pool
resource "cloudflare_load_balancer_pool" "us_east_pool" {
  account_id = var.cloudflare_account_id
  
  name = "biopoint-us-east-pool"
  description = "BioPoint US-East-1 origin pool"
  
  origins {
    name    = "biopoint-us-east-1"
    address = var.origin_server_east
    enabled = true
    
    header {
      header = "Origin-Region"
      values = ["us-east-1"]
    }
    
    weight = 1
  }
  
  monitor = cloudflare_load_balancer_monitor.biopoint_health_check.id
  
  # Notification settings
  notification_email = "ops@biopoint.com"
  notification_filter {
    healthy = true
    sick    = true
  }
  
  # Load balancing policy
  load_shedding {
    default_percent = 0
    default_policy = ""
    session_percent = 0
    session_policy = ""
  }
  
  # Origin steering
  origin_steering {
    policy = "least_connections"
  }
  
  # Health check regions
  check_regions = [
    "WNAM",  # Western North America
    "ENAM"   # Eastern North America
  ]
}

# US-West-2 Origin Pool
resource "cloudflare_load_balancer_pool" "us_west_pool" {
  account_id = var.cloudflare_account_id
  
  name = "biopoint-us-west-pool"
  description = "BioPoint US-West-2 origin pool"
  
  origins {
    name    = "biopoint-us-west-2"
    address = var.origin_server_west
    enabled = true
    
    header {
      header = "Origin-Region"
      values = ["us-west-2"]
    }
    
    weight = 1
  }
  
  monitor = cloudflare_load_balancer_monitor.biopoint_health_check.id
  
  # Notification settings
  notification_email = "ops@biopoint.com"
  notification_filter {
    healthy = true
    sick    = true
  }
  
  # Load balancing policy
  load_shedding {
    default_percent = 0
    default_policy = ""
    session_percent = 0
    session_policy = ""
  }
  
  # Origin steering
  origin_steering {
    policy = "least_connections"
  }
  
  # Health check regions
  check_regions = [
    "WNAM",  # Western North America
    "ENAM"   # Eastern North America
  ]
}

# Main Load Balancer
resource "cloudflare_load_balancer" "biopoint_api" {
  zone_id = var.cloudflare_zone_id
  
  name        = "api.biopoint.com"
  description = "BioPoint API Load Balancer"
  
  # Enable session affinity for authenticated users
  session_affinity = "cookie"
  session_affinity_attributes {
    samesite = "Auto"
    secure   = "Auto"
    drain_duration = 300
    headers = ["Authorization", "Cookie"]
  }
  
  # Session affinity TTL (24 hours)
  session_affinity_ttl = 86400
  
  # Default pools (primary)
  default_pool_ids = [
    cloudflare_load_balancer_pool.us_east_pool.id
  ]
  
  # Fallback pools (secondary)
  fallback_pool_id = cloudflare_load_balancer_pool.us_west_pool.id
  
  # Geographic steering
  steering_policy = "geo"
  
  # Region pools for geographic failover
  region_pools {
    region = "enam"  # Eastern North America
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  region_pools {
    region = "wnam"  # Western North America
    pool_ids = [
      cloudflare_load_balancer_pool.us_west_pool.id
    ]
  }
  
  # Global pools for other regions
  pop_pools {
    pop = "SJC"  # San Jose
    pool_ids = [
      cloudflare_load_balancer_pool.us_west_pool.id
    ]
  }
  
  pop_pools {
    pop = "LAX"  # Los Angeles
    pool_ids = [
      cloudflare_load_balancer_pool.us_west_pool.id
    ]
  }
  
  pop_pools {
    pop = "SEA"  # Seattle
    pool_ids = [
      cloudflare_load_balancer_pool.us_west_pool.id
    ]
  }
  
  pop_pools {
    pop = "DEN"  # Denver
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "ORD"  # Chicago
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "IAD"  # Washington DC
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "ATL"  # Atlanta
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "MIA"  # Miami
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "JFK"  # New York
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  pop_pools {
    pop = "BOS"  # Boston
    pool_ids = [
      cloudflare_load_balancer_pool.us_east_pool.id
    ]
  }
  
  # Enable proxy protocol for client IP preservation
  proxy_protocol = "off"
  
  # TTL settings
  ttl = 300
  
  # Enable load balancer
  enabled = true
  
  # Preserve client IP
  preserve_client_ip = true
  
  # Adaptive routing
  adaptive_routing {
    failover_across_pools = true
  }
  
  # Location steering
  location_strategy {
    mode    = "resolver_ip"
    prefer_ecs = "always"
  }
  
  # Random steering
  random_steering {
    default_weight = 0.5
    pool_weights = {
      (cloudflare_load_balancer_pool.us_east_pool.id) = 0.5
      (cloudflare_load_balancer_pool.us_west_pool.id) = 0.5
    }
  }
}

# DNS Record for Load Balancer
resource "cloudflare_record" "api_biopoint_com" {
  zone_id = var.cloudflare_zone_id
  
  name    = "api"
  value   = cloudflare_load_balancer.biopoint_api.name
  type    = "CNAME"
  proxied = true
  ttl     = 1  # Auto
  
  comment = "BioPoint API Load Balancer"
}

# Rate Limiting Rules
resource "cloudflare_rate_limit" "global_rate_limit" {
  zone_id = var.cloudflare_zone_id
  
  threshold = 1000  # 1000 requests per second globally
  period    = 1
  
  match {
    request {
      url_pattern = "api.biopoint.com/*"
      schemes     = ["HTTP", "HTTPS"]
      methods     = ["POST", "GET", "PUT", "DELETE", "PATCH"]
    }
    response {
      statuses = [200, 201, 202, 204, 400, 401, 403, 404, 500, 502, 503]
    }
  }
  
  action {
    mode    = "simulate"
    timeout = 300
    response {
      content_type = "application/json"
      body = jsonencode({
        error = "Rate limit exceeded"
        message = "Too many requests. Please try again later."
        retry_after = 300
      })
    }
  }
  
  disabled = false
  description = "Global API rate limiting - 1000 req/sec"
}

resource "cloudflare_rate_limit" "per_ip_rate_limit" {
  zone_id = var.cloudflare_zone_id
  
  threshold = 100  # 100 requests per second per IP
  period    = 1
  
  match {
    request {
      url_pattern = "api.biopoint.com/*"
      schemes     = ["HTTP", "HTTPS"]
      methods     = ["POST", "GET", "PUT", "DELETE", "PATCH"]
    }
    response {
      statuses = [200, 201, 202, 204, 400, 401, 403, 404, 500, 502, 503]
    }
  }
  
  action {
    mode    = "ban"
    timeout = 300
    response {
      content_type = "application/json"
      body = jsonencode({
        error = "IP rate limit exceeded"
        message = "Too many requests from this IP. Please try again later."
        retry_after = 300
      })
    }
  }
  
  disabled = false
  description = "Per-IP API rate limiting - 100 req/sec"
}

# Custom Rules for Authenticated Users
resource "cloudflare_ruleset" "authenticated_user_rate_limit" {
  zone_id = var.cloudflare_zone_id
  name    = "Authenticated User Rate Limit"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
  
  rules {
    action = "rate_limit"
    action_parameters {
      requests_per_period = 50
      period = 1
      mitigation_timeout = 300
      
      response {
        status_code = 429
        content = jsonencode({
          error = "User rate limit exceeded"
          message = "Too many requests for this user. Please try again later."
          retry_after = 300
        })
        content_type = "application/json"
      }
    }
    
    expression = "(http.host eq \"api.biopoint.com\" and http.request.uri.path eq \"/api/*\" and http.request.headers[\"authorization\"] ne \"\")"
    description = "Rate limit authenticated users to 50 req/sec"
    enabled = true
  }
}

# Outputs
output "load_balancer_id" {
  description = "ID of the Cloudflare Load Balancer"
  value       = cloudflare_load_balancer.biopoint_api.id
}

output "us_east_pool_id" {
  description = "ID of the US-East-1 origin pool"
  value       = cloudflare_load_balancer_pool.us_east_pool.id
}

output "us_west_pool_id" {
  description = "ID of the US-West-2 origin pool"
  value       = cloudflare_load_balancer_pool.us_west_pool.id
}

output "health_check_id" {
  description = "ID of the health check monitor"
  value       = cloudflare_load_balancer_monitor.biopoint_health_check.id
}