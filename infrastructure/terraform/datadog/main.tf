# Datadog Monitoring Module for BioPoint
# Comprehensive monitoring, alerting, and observability for HIPAA-compliant infrastructure

terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Generate API keys for different environments
resource "random_password" "api_key" {
  length  = 32
  special = false
}

resource "random_password" "app_key" {
  length  = 32
  special = false
}

# Create Datadog API key
resource "datadog_api_key" "main" {
  name = "biopoint-${var.environment}-api-key"
}

# Create Datadog application key
resource "datadog_application_key" "main" {
  name      = "biopoint-${var.environment}-app-key"
  api_key   = datadog_api_key.main.id
}

# Create Datadog dashboard
resource "datadog_dashboard" "main" {
  title       = "BioPoint ${title(var.environment)} Infrastructure Dashboard"
  description = "Comprehensive monitoring dashboard for BioPoint ${var.environment} environment"
  layout_type = "ordered"
  
  # Database metrics
  widget {
    group_definition {
      title       = "Database Performance"
      layout_type = "ordered"
      
      widget {
        timeseries_definition {
          title = "Database CPU Usage"
          request {
            q = "avg:postgresql.cpu.utilization{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Database Memory Usage"
          request {
            q = "avg:postgresql.memory.utilization{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Database Connections"
          request {
            q = "avg:postgresql.connections.active{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Query Performance"
          request {
            q = "avg:postgresql.query.time{project:biopoint,environment:${var.environment}}"
          }
        }
      }
    }
  }
  
  # Storage metrics
  widget {
    group_definition {
      title       = "Storage Performance"
      layout_type = "ordered"
      
      widget {
        timeseries_definition {
          title = "Storage Usage"
          request {
            q = "avg:cloudflare.r2.bucket.size{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Storage Requests"
          request {
            q = "sum:cloudflare.r2.bucket.requests{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Storage Bandwidth"
          request {
            q = "sum:cloudflare.r2.bucket.bandwidth{project:biopoint,environment:${var.environment}}"
          }
        }
      }
    }
  }
  
  # Application metrics
  widget {
    group_definition {
      title       = "Application Performance"
      layout_type = "ordered"
      
      widget {
        timeseries_definition {
          title = "Request Rate"
          request {
            q = "sum:biopoint.requests.count{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Response Time"
          request {
            q = "avg:biopoint.response.time{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Error Rate"
          request {
            q = "sum:biopoint.errors.count{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        query_value_definition {
          title = "Availability"
          request {
            q = "avg:biopoint.availability{project:biopoint,environment:${var.environment}}"
          }
          precision = 2
        }
      }
    }
  }
  
  # Security metrics
  widget {
    group_definition {
      title       = "Security Metrics"
      layout_type = "ordered"
      
      widget {
        timeseries_definition {
          title = "WAF Blocked Requests"
          request {
            q = "sum:cloudflare.waf.blocked{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Rate Limited Requests"
          request {
            q = "sum:cloudflare.rate_limit.blocked{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Bot Traffic"
          request {
            q = "sum:cloudflare.bot.traffic{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Failed Authentication Attempts"
          request {
            q = "sum:biopoint.auth.failures{project:biopoint,environment:${var.environment}}"
          }
        }
      }
    }
  }
  
  # Infrastructure metrics
  widget {
    group_definition {
      title       = "Infrastructure Health"
      layout_type = "ordered"
      
      widget {
        timeseries_definition {
          title = "CPU Usage"
          request {
            q = "avg:system.cpu.utilization{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Memory Usage"
          request {
            q = "avg:system.memory.utilization{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Disk Usage"
          request {
            q = "avg:system.disk.utilization{project:biopoint,environment:${var.environment}}"
          }
        }
      }
      
      widget {
        timeseries_definition {
          title = "Network Traffic"
          request {
            q = "sum:system.network.bytes{project:biopoint,environment:${var.environment}}"
          }
        }
      }
    }
  }
  
  tags = var.tags
}

# Create monitors (alerts)
resource "datadog_monitor" "high_cpu" {
  name    = "BioPoint ${title(var.environment)} - High CPU Usage"
  type    = "metric alert"
  message = "CPU usage is above 80% for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):avg:system.cpu.utilization{project:biopoint,environment:${var.environment}} > 80"
  
  thresholds = {
    warning  = 70
    critical = 80
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "critical"
    team     = "infrastructure"
  })
}

resource "datadog_monitor" "high_memory" {
  name    = "BioPoint ${title(var.environment)} - High Memory Usage"
  type    = "metric alert"
  message = "Memory usage is above 85% for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):avg:system.memory.utilization{project:biopoint,environment:${var.environment}} > 85"
  
  thresholds = {
    warning  = 75
    critical = 85
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "critical"
    team     = "infrastructure"
  })
}

resource "datadog_monitor" "database_down" {
  name    = "BioPoint ${title(var.environment)} - Database Down"
  type    = "service check"
  message = "Database is down for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "\"postgresql.can_connect\".over(\"project:biopoint,environment:${var.environment}\").by(\"host\").last(2).count_by_status()"
  
  thresholds = {
    critical = 1
  }
  
  notify_audit = false
  notify_no_data = true
  no_data_timeframe = 5
  
  tags = merge(var.tags, {
    severity = "critical"
    team     = "database"
  })
}

resource "datadog_monitor" "high_error_rate" {
  name    = "BioPoint ${title(var.environment)} - High Error Rate"
  type    = "metric alert"
  message = "Error rate is above 5% for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):sum:biopoint.errors.count{project:biopoint,environment:${var.environment}}.as_rate() / sum:biopoint.requests.count{project:biopoint,environment:${var.environment}}.as_rate() * 100 > 5"
  
  thresholds = {
    warning  = 2
    critical = 5
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "warning"
    team     = "application"
  })
}

resource "datadog_monitor" "response_time_high" {
  name    = "BioPoint ${title(var.environment)} - High Response Time"
  type    = "metric alert"
  message = "Average response time is above 2 seconds for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):avg:biopoint.response.time{project:biopoint,environment:${var.environment}} > 2000"
  
  thresholds = {
    warning  = 1000
    critical = 2000
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "warning"
    team     = "application"
  })
}

resource "datadog_monitor" "waf_blocked_requests_high" {
  name    = "BioPoint ${title(var.environment)} - High WAF Block Rate"
  type    = "metric alert"
  message = "WAF is blocking more than 10 requests per minute for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):sum:cloudflare.waf.blocked{project:biopoint,environment:${var.environment}}.as_rate() > 10"
  
  thresholds = {
    warning  = 5
    critical = 10
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "warning"
    team     = "security"
  })
}

resource "datadog_monitor" "storage_usage_high" {
  name    = "BioPoint ${title(var.environment)} - High Storage Usage"
  type    = "metric alert"
  message = "Storage usage is above 80% for ${var.environment} environment. @pagerduty-biopoint"
  
  query = "avg(last_5m):avg:cloudflare.r2.bucket.size{project:biopoint,environment:${var.environment}} > 80"
  
  thresholds = {
    warning  = 70
    critical = 80
  }
  
  notify_audit = false
  notify_no_data = false
  
  tags = merge(var.tags, {
    severity = "warning"
    team     = "infrastructure"
  })
}

# Create SLOs (Service Level Objectives)
resource "datadog_service_level_objective" "availability" {
  name        = "BioPoint ${title(var.environment)} - Availability SLO"
  description = "99.9% availability target for BioPoint ${var.environment}"
  type        = "metric"
  
  query {
    numerator   = "sum:biopoint.requests.success{project:biopoint,environment:${var.environment}}"
    denominator = "sum:biopoint.requests.total{project:biopoint,environment:${var.environment}}"
  }
  
  thresholds {
    timeframe = "30d"
    target    = 99.9
    warning   = 99.95
  }
  
  thresholds {
    timeframe = "7d"
    target    = 99.5
    warning   = 99.75
  }
  
  tags = merge(var.tags, {
    slo_type = "availability"
    team     = "sre"
  })
}

resource "datadog_service_level_objective" "response_time" {
  name        = "BioPoint ${title(var.environment)} - Response Time SLO"
  description = "95th percentile response time under 1 second for BioPoint ${var.environment}"
  type        = "metric"
  
  query {
    numerator   = "sum:biopoint.response.time.p95{project:biopoint,environment:${var.environment}}"
    denominator = "1"
  }
  
  thresholds {
    timeframe = "30d"
    target    = 1000  # 1 second
    warning   = 800   # 800ms
  }
  
  tags = merge(var.tags, {
    slo_type = "latency"
    team     = "sre"
  })
}

# Create synthetic tests
resource "datadog_synthetics_test" "api_health" {
  name    = "BioPoint ${title(var.environment)} - API Health Check"
  type    = "api"
  subtype = "http"
  
  request_definition {
    method = "GET"
    url    = "https://${var.api_domain}/health"
  }
  
  request_headers = {
    "User-Agent" = "Datadog/Synthetic"
  }
  
  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }
  
  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "5000"  # 5 seconds
  }
  
  locations = var.synthetic_test_locations
  
  options_list {
    tick_every = 300  # 5 minutes
    retry {
      count    = 2
      interval = 30
    }
    
    monitor_options {
      renotify_interval = 60
    }
  }
  
  tags = merge(var.tags, {
    test_type = "health_check"
    component = "api"
  })
}

resource "datadog_synthetics_test" "app_health" {
  name    = "BioPoint ${title(var.environment)} - App Health Check"
  type    = "api"
  subtype = "http"
  
  request_definition {
    method = "GET"
    url    = "https://${var.app_domain}/health"
  }
  
  request_headers = {
    "User-Agent" = "Datadog/Synthetic"
  }
  
  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }
  
  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "10000"  # 10 seconds
  }
  
  locations = var.synthetic_test_locations
  
  options_list {
    tick_every = 300  # 5 minutes
    retry {
      count    = 2
      interval = 30
    }
    
    monitor_options {
      renotify_interval = 60
    }
  }
  
  tags = merge(var.tags, {
    test_type = "health_check"
    component = "app"
  })
}

# Create log configuration
resource "datadog_logs_custom_pipeline" "biopoint_pipeline" {
  name       = "BioPoint ${title(var.environment)} - Log Pipeline"
  is_enabled = true
  
  filter {
    query = "source:biopoint OR service:biopoint"
  }
  
  processor {
    grok_parser {
      source = "message"
      grok {
        support_rules = ""
        match_rules   = "%%{date(\"yyyy-MM-dd HH:mm:ss\"):timestamp} %%{word:level} %%{word:service} - %%{greedydata:message}"
      }
      is_enabled = true
    }
  }
  
  processor {
    date_remapper {
      sources    = ["timestamp"]
      is_enabled = true
    }
  }
  
  processor {
    status_remapper {
      sources    = ["level"]
      is_enabled = true
    }
  }
  
  processor {
    service_remapper {
      sources    = ["service"]
      is_enabled = true
    }
  }
  
  processor {
    message_remapper {
      sources    = ["message"]
      is_enabled = true
    }
  }
}

# Create integration configurations
resource "datadog_integration_aws" "main" {
  account_id  = var.aws_account_id
  role_name   = "DatadogIntegrationRole"
  
  account_specific_namespace_rules = {
    auto_scaling = true
    ec2          = true
    rds          = true
    s3           = true
    elb          = true
    cloudfront   = true
    route53      = true
  }
  
  excluded_regions = []
  filter_tags      = ["env:${var.environment}"]
  host_tags        = ["env:${var.environment}", "project:biopoint"]
}

# Create webhooks for external integrations
resource "datadog_webhook" "pagerduty" {
  name = "BioPoint ${title(var.environment)} - PagerDuty"
  url  = var.pagerduty_webhook_url
  
  custom_headers = {
    "Content-Type" = "application/json"
  }
  
  payload = jsonencode({
    routing_key  = var.pagerduty_routing_key
    event_action = "trigger"
    dedup_key    = "{{alert_id}}"
    payload = {
      summary   = "{{alert_title}}"
      source    = "Datadog"
      severity  = "{{alert_severity}}"
      timestamp = "{{alert_date}}"
      component = "{{alert_metric}}"
      group     = "{{alert_scope}}"
      class     = "Infrastructure"
    }
  })
}