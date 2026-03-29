# Production Environment Variables
environment = "production"

# Domain Configuration
domain_name = "biopoint.app"

# Database Configuration
database_tier = "business"
database_version = "15"
enable_read_replicas = true
enable_auto_pause = false  # Keep always on for production

# Storage Configuration
enable_storage_encryption = true
enable_versioning = true
phi_retention_days = 2555   # 7 years for HIPAA compliance
non_phi_retention_days = 365  # 1 year for production

# Security Configuration
enable_waf = true
rate_limit_per_minute = 100  # Strict rate limiting
api_rate_limit_per_minute = 200
auth_rate_limit_per_minute = 20
enable_ddos_protection = true

# Monitoring Configuration
enable_datadog_monitoring = true
enable_slo_monitoring = true
datadog_site = "datadoghq.com"

# Backup Configuration
backup_schedule = "0 2 * * *"  # Daily at 2 AM UTC
backup_retention_days = 30     # 30 days for production
enable_cross_region_backup = true

# Network Configuration
enable_private_network = true
vpc_cidr = "10.2.0.0/16"

# Development Configuration
enable_branching = false  # Disabled for production stability
dev_instance_count = 0

# Cost Optimization (balanced for production)
enable_cost_optimization = false  # Disabled for maximum performance

# Compliance (full HIPAA compliance)
hipaa_compliance = true
enable_audit_logging = true

# Allowed origins for CORS (strict for production)
allowed_origins = [
  "https://biopoint.app",
  "https://app.biopoint.app",
  "https://api.biopoint.app",
  "https://www.biopoint.app"
]

# AWS Configuration
aws_region = "us-east-1"
backup_regions = ["us-west-2", "eu-central-1"]