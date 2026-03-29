# BioPoint Infrastructure as Code
# Terraform configuration for HIPAA-compliant healthcare application

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "datadog" {
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

provider "doppler" {
  doppler_token = var.doppler_service_token
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "biopoint"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops"
      HIPAA       = "true"
    }
  }
}

# Data sources
data "cloudflare_zone" "main" {
  name = var.domain_name
}

data "doppler_secrets" "terraform" {
  project = var.doppler_project_name
  config  = var.environment
}

# Random password for database users
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "datadog_db_password" {
  length  = 32
  special = true
}

# Local values for common configurations
locals {
  common_tags = {
    Project     = "biopoint"
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = "devops"
    HIPAA       = "true"
  }
  
  # Environment-specific configurations
  env_suffix = var.environment == "production" ? "" : "-${var.environment}"
  
  # Domain configurations
  api_domain  = "api${local.env_suffix}.${var.domain_name}"
  app_domain  = "app${local.env_suffix}.${var.domain_name}"
  web_domain  = "www${local.env_suffix}.${var.domain_name}"
  
  # Database configurations
  db_name = "biopoint${local.env_suffix}"
  
  # Bucket configurations
  phi_bucket_name    = "biopoint-phi${local.env_suffix}"
  non_phi_bucket_name = "biopoint-data${local.env_suffix}"
}