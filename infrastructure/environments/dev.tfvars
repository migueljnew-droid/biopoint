# Development Environment Variables
environment = "dev"

# Domain Configuration
domain_name = "dev.biopoint.app"

# Database Configuration
database_tier = "free"
database_version = "15"
enable_read_replicas = false
enable_auto_pause = true
auto_pause_delay_seconds = 300

# Storage Configuration
enable_storage_encryption = true
enable_versioning = true
phi_retention_days = 90    # 3 months for dev
non_phi_retention_days = 30  # 1 month for dev

# Security Configuration
enable_waf = true
rate_limit_per_minute = 200  # Higher limit for development
api_rate_limit_per_minute = 400
auth_rate_limit_per_minute = 40
enable_ddos_protection = false  # Disabled for cost savings in dev

# Monitoring Configuration
enable_datadog_monitoring = true
enable_slo_monitoring = false   # Disabled for cost savings in dev
datadog_site = "datadoghq.com"

# Backup Configuration
backup_schedule = "0 2 * * *"  # Daily at 2 AM UTC
backup_retention_days = 7      # 1 week for dev
enable_cross_region_backup = false

# Network Configuration
enable_private_network = false  # Disabled for simplicity in dev
vpc_cidr = "10.0.0.0/16"

# Development Configuration
enable_branching = true
dev_instance_count = 1

# Cost Optimization
enable_cost_optimization = true

# Compliance (relaxed for development)
hipaa_compliance = false
enable_audit_logging = true

# Allowed origins for CORS
allowed_origins = [
  "https://dev.biopoint.app",
  "https://app.dev.biopoint.app",
  "https://api.dev.biopoint.app",
  "https://localhost:3000",
  "https://localhost:8080",
  "https://localhost:19006",  # Expo development
  "http://localhost:3000",    # HTTP for local development
  "http://localhost:8080",
  "http://localhost:19006"
]

# AWS Configuration
aws_region = "us-east-1"
backup_regions = ["us-west-2"]