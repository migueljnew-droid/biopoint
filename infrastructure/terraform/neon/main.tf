# Neon PostgreSQL Module for BioPoint
# HIPAA-compliant database infrastructure with multi-region support

terraform {
  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Generate secure passwords for database users
resource "random_password" "app_user" {
  length  = 32
  special = true
}

resource "random_password" "readonly_user" {
  length  = 32
  special = true
}

resource "random_password" "datadog_user" {
  length  = 32
  special = true
}

# Create Neon project
resource "neon_project" "main" {
  name   = var.project_name
  region = var.primary_region
  
  pg_version = var.postgres_version
  
  settings {
    quota {
      active_time_seconds = var.active_time_quota
      cpu_quota_sec       = var.cpu_quota_sec
    }
  }
  
  tags = var.tags
}

# Create primary database branch (main)
resource "neon_branch" "main" {
  project_id = neon_project.main.id
  name       = "main"
  
  # Use the default parent branch (main)
  parent_id = neon_project.main.default_branch_id
}

# Create development branches
resource "neon_branch" "development" {
  count      = var.enable_branching ? 1 : 0
  project_id = neon_project.main.id
  name       = "development"
  parent_id  = neon_branch.main.id
}

resource "neon_branch" "staging" {
  count      = var.enable_branching ? 1 : 0
  project_id = neon_project.main.id
  name       = "staging"
  parent_id  = neon_branch.main.id
}

# Create database
resource "neon_database" "main" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = var.database_name
  owner_name = neon_role.app_user.name
}

# Create database roles (users)
resource "neon_role" "app_user" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "app_user"
  password   = random_password.app_user.result
  
  settings {
    login = true
  }
}

resource "neon_role" "readonly_user" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "readonly_user"
  password   = random_password.readonly_user.result
  
  settings {
    login = true
  }
}

resource "neon_role" "datadog_user" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  name       = "datadog"
  password   = random_password.datadog_user.result
  
  settings {
    login = true
  }
}

# Create read replicas in different regions
resource "neon_branch" "read_replica_us_west" {
  count      = var.enable_read_replicas ? 1 : 0
  project_id = neon_project.main.id
  name       = "read-replica-us-west"
  parent_id  = neon_branch.main.id
  
  # Configure as read replica
  settings {
    read_only = true
  }
  
  region = "us-west-2"
}

resource "neon_branch" "read_replica_eu" {
  count      = var.enable_read_replicas ? 1 : 0
  project_id = neon_project.main.id
  name       = "read-replica-eu"
  parent_id  = neon_branch.main.id
  
  # Configure as read replica
  settings {
    read_only = true
  }
  
  region = "eu-central-1"
}

# Create connection pooling
resource "neon_endpoint" "pooled" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  
  type = "read_write"
  
  settings {
    pooled = true
  }
}

# Create direct connection endpoint (for admin operations)
resource "neon_endpoint" "direct" {
  project_id = neon_project.main.id
  branch_id  = neon_branch.main.id
  
  type = "read_write"
  
  settings {
    pooled = false
  }
}

# Create read replica endpoints
resource "neon_endpoint" "read_replica_us_west" {
  count      = var.enable_read_replicas ? 1 : 0
  project_id = neon_project.main.id
  branch_id  = neon_branch.read_replica_us_west[0].id
  
  type = "read_only"
  
  settings {
    pooled = true
  }
}

resource "neon_endpoint" "read_replica_eu" {
  count      = var.enable_read_replicas ? 1 : 0
  project_id = neon_project.main.id
  branch_id  = neon_branch.read_replica_eu[0].id
  
  type = "read_only"
  
  settings {
    pooled = true
  }
}

# Configure backup settings
resource "neon_project_settings" "backup" {
  project_id = neon_project.main.id
  
  backup_settings {
    backup_hour           = 2  # 2 AM UTC
    backup_days_of_week   = [0, 1, 2, 3, 4, 5, 6]  # Daily
    backup_retention_days = var.backup_retention_days
  }
}

# Configure auto-pause for cost optimization
resource "neon_project_settings" "auto_pause" {
  count      = var.enable_auto_pause ? 1 : 0
  project_id = neon_project.main.id
  
  settings {
    suspend_timeout_seconds = var.auto_pause_delay_seconds
  }
}

# Create VPC for private networking (if enabled)
resource "neon_privatelink" "main" {
  count      = var.enable_private_network ? 1 : 0
  project_id = neon_project.main.id
  
  # AWS PrivateLink configuration
  aws_account_id = var.aws_account_id
  vpc_endpoint_service_name = "com.amazonaws.vpce.${var.primary_region}.vpce-svc-${random_id.vpc_endpoint_suffix[0].hex}"
  
  # Allowed principals (AWS account IDs that can access)
  allowed_principals = var.allowed_aws_principals
}

resource "random_id" "vpc_endpoint_suffix" {
  count       = var.enable_private_network ? 1 : 0
  byte_length = 8
}

# Database schema and permissions (executed via SQL)
resource "null_resource" "setup_permissions" {
  depends_on = [
    neon_database.main,
    neon_role.app_user,
    neon_role.readonly_user,
    neon_role.datadog_user
  ]

  provisioner "local-exec" {
    command = <<-EOT
      psql "${neon_endpoint.direct.connection_uri}" -c "
        -- Grant permissions to app user
        GRANT ALL PRIVILEGES ON DATABASE ${neon_database.main.name} TO ${neon_role.app_user.name};
        GRANT ALL PRIVILEGES ON SCHEMA public TO ${neon_role.app_user.name};
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${neon_role.app_user.name};
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${neon_role.app_user.name};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${neon_role.app_user.name};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${neon_role.app_user.name};
        
        -- Grant read-only permissions to readonly user
        GRANT CONNECT ON DATABASE ${neon_database.main.name} TO ${neon_role.readonly_user.name};
        GRANT USAGE ON SCHEMA public TO ${neon_role.readonly_user.name};
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${neon_role.readonly_user.name};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${neon_role.readonly_user.name};
        
        -- Grant monitoring permissions to datadog user
        GRANT CONNECT ON DATABASE ${neon_database.main.name} TO ${neon_role.datadog_user.name};
        GRANT USAGE ON SCHEMA public TO ${neon_role.datadog_user.name};
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${neon_role.datadog_user.name};
        GRANT pg_monitor TO ${neon_role.datadog_user.name};
      "
    EOT
    
    environment = {
      PGPASSWORD = random_password.app_user.result
    }
  }
  
  triggers = {
    always_run = timestamp()
  }
}