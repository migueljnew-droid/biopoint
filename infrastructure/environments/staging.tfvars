# Staging Environment Variables
environment = "staging"

# Domain Configuration
domain_name = "staging.biopoint.app"

# Database Configuration
database_tier = "launch"
database_version = "15"
enable_read_replicas = true
enable_auto_pause = true
auto_pause_delay_seconds = 600

# Storage Configuration
enable_storage_encryption = true
enable_versioning = true
phi_retention_days = 365   # 1 year for staging
non_phi_retention_days = 90  # 3 months for staging

# Security Configuration
enable_waf = true
rate_limit_per_minute = 150
api_rate_limit_per_minute = 300
auth_rate_limit_per_minute = 30
enable_ddos_protection = true

# Monitoring Configuration
enable_datadog_monitoring = true
enable_slo_monitoring = true
datadog_site = "datadoghq.com"

# Backup Configuration
backup_schedule = "0 2 * * *"  # Daily at 2 AM UTC
backup_retention_days = 14     # 2 weeks for staging
enable_cross_region_backup = true

# Network Configuration
enable_private_network = true
vpc_cidr = "10.1.0.0/16"

# Development Configuration
enable_branching = true
dev_instance_count = 1

# Cost Optimization
enable_cost_optimization = true

# Compliance (full compliance for staging)
hipaa_compliance = true
enable_audit_logging = true

# Allowed origins for CORS
allowed_origins = [
  "https://staging.biopoint.app",
  "https://app.staging.biopoint.app",
  "https://api.staging.biopoint.app",
  "https://localhost:3000",
  "https://localhost:8080"
]

# AWS Configuration
aws_region = "us-east-1"
backup_regions = ["us-west-2", "eu-central-1"]