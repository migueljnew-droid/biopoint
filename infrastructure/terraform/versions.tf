terraform {
  required_version = ">= 1.0"
  
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.6.0"
    }
    
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
    
    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.0"
    }
    
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "biopoint-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "biopoint-terraform-locks"
    
    # Use environment-specific state files
    workspace_key_prefix = "workspaces"
  }
}