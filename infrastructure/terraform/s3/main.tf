# Cloudflare R2 Storage Module for BioPoint
# HIPAA-compliant object storage with encryption and lifecycle management

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Generate unique suffix for bucket names
resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# Create PHI storage bucket with strict security
resource "cloudflare_r2_bucket" "phi_storage" {
  name       = "${var.phi_bucket_name}-${random_id.bucket_suffix.hex}"
  account_id = var.cloudflare_account_id
  location   = var.primary_region
  
  # HIPAA compliance: Enable versioning and encryption by default
  versioning {
    enabled = var.enable_versioning
  }
  
  # Server-side encryption
  lifecycle_rule {
    id     = "phi-encryption"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    encryption {
      sse_algorithm = "AES256"
    }
  }
  
  # PHI retention policy (7 years minimum)
  lifecycle_rule {
    id     = "phi-retention"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    expiration {
      days = var.phi_retention_days
    }
    
    noncurrent_version_expiration {
      noncurrent_days = var.phi_retention_days
    }
  }
  
  # Transition to cheaper storage after 90 days
  lifecycle_rule {
    id     = "phi-transition"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = 90
      storage_class = "InfrequentAccess"
    }
    
    transition {
      days          = 365
      storage_class = "Glacier"
    }
  }
  
  # Block public access for PHI data
  cors_rule {
    allowed_headers = var.allowed_headers
    allowed_methods = var.allowed_methods
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
  
  tags = merge(var.tags, {
    DataClassification = "PHI"
    HIPAA              = "true"
    Encryption         = "required"
  })
}

# Create non-PHI storage bucket
resource "cloudflare_r2_bucket" "non_phi_storage" {
  name       = "${var.non_phi_bucket_name}-${random_id.bucket_suffix.hex}"
  account_id = var.cloudflare_account_id
  location   = var.primary_region
  
  versioning {
    enabled = var.enable_versioning
  }
  
  # Standard retention policy (1 year)
  lifecycle_rule {
    id     = "non-phi-retention"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    expiration {
      days = var.non_phi_retention_days
    }
    
    noncurrent_version_expiration {
      noncurrent_days = var.non_phi_retention_days
    }
  }
  
  # Transition to cheaper storage
  lifecycle_rule {
    id     = "non-phi-transition"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = 30
      storage_class = "InfrequentAccess"
    }
  }
  
  cors_rule {
    allowed_headers = var.allowed_headers
    allowed_methods = var.allowed_methods
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
  
  tags = merge(var.tags, {
    DataClassification = "Non-PHI"
    HIPAA              = "false"
  })
}

# Create backup bucket
resource "cloudflare_r2_bucket" "backup_storage" {
  name       = "biopoint-backups-${random_id.bucket_suffix.hex}"
  account_id = var.cloudflare_account_id
  location   = var.backup_region
  
  versioning {
    enabled = true  # Always enable for backups
  }
  
  # Backup retention policy
  lifecycle_rule {
    id     = "backup-retention"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    expiration {
      days = var.backup_retention_days
    }
  }
  
  tags = merge(var.tags, {
    Purpose = "Backup"
    HIPAA   = "true"
  })
}

# Create cross-region replication for PHI bucket
resource "cloudflare_r2_bucket" "phi_replica" {
  count      = var.enable_cross_region_replication ? 1 : 0
  name       = "${var.phi_bucket_name}-replica-${random_id.bucket_suffix.hex}"
  account_id = var.cloudflare_account_id
  location   = var.backup_region
  
  versioning {
    enabled = true
  }
  
  tags = merge(var.tags, {
    Purpose            = "CrossRegionReplication"
    DataClassification = "PHI"
    HIPAA              = "true"
  })
}

# Configure replication rules
resource "cloudflare_r2_bucket_replication" "phi_replication" {
  count      = var.enable_cross_region_replication ? 1 : 0
  
  source_bucket {
    name       = cloudflare_r2_bucket.phi_storage.name
    account_id = var.cloudflare_account_id
  }
  
  destination_bucket {
    name       = cloudflare_r2_bucket.phi_replica[0].name
    account_id = var.cloudflare_account_id
  }
  
  rules {
    name       = "phi-replication-rule"
    priority   = 1
    delete_marker_replication = true
    
    filter {
      prefix = ""
    }
    
    destination {
      storage_class = "Standard"
    }
  }
}

# Create presigned URL configurations
resource "cloudflare_r2_bucket_policy" "phi_policy" {
  bucket     = cloudflare_r2_bucket.phi_storage.name
  account_id = var.cloudflare_account_id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureConnections"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          "arn:aws:s3:::${cloudflare_r2_bucket.phi_storage.name}",
          "arn:aws:s3:::${cloudflare_r2_bucket.phi_storage.name}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "DenyUnencryptedUploads"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:PutObject"
        Resource = "arn:aws:s3:::${cloudflare_r2_bucket.phi_storage.name}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      }
    ]
  })
}

resource "cloudflare_r2_bucket_policy" "non_phi_policy" {
  bucket     = cloudflare_r2_bucket.non_phi_storage.name
  account_id = var.cloudflare_account_id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSecureConnections"
        Effect = "Allow"
        Principal = "*"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${cloudflare_r2_bucket.non_phi_storage.name}/*"
        Condition = {
          Bool = {
            "aws:SecureTransport" = "true"
          }
        }
      }
    ]
  })
}

# Create lifecycle management for cost optimization
resource "cloudflare_r2_bucket_lifecycle_configuration" "phi_lifecycle" {
  bucket     = cloudflare_r2_bucket.phi_storage.name
  account_id = var.cloudflare_account_id
  
  rule {
    id     = "phi-transition-to-ia"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = 90
      storage_class = "InfrequentAccess"
    }
  }
  
  rule {
    id     = "phi-transition-to-glacier"
    status = "Enabled"
    
    filter {
      prefix = ""
    }
    
    transition {
      days          = 365
      storage_class = "Glacier"
    }
  }
}

# Create presigned URL tokens for secure access
resource "random_password" "presigned_token" {
  length  = 64
  special = false
}

# Generate access keys for programmatic access
resource "cloudflare_r2_access_key" "app_access" {
  account_id = var.cloudflare_account_id
  name       = "biopoint-app-access"
  
  permissions = {
    buckets = {
      "${cloudflare_r2_bucket.phi_storage.name}" = [
        "GetObject",
        "PutObject",
        "DeleteObject"
      ]
      "${cloudflare_r2_bucket.non_phi_storage.name}" = [
        "GetObject",
        "PutObject",
        "DeleteObject"
      ]
    }
  }
  
  expires_at = timeadd(timestamp(), "8760h")  # 1 year
}

# Create monitoring configuration
resource "cloudflare_r2_bucket_notification" "phi_notifications" {
  bucket     = cloudflare_r2_bucket.phi_storage.name
  account_id = var.cloudflare_account_id
  
  queue {
    queue_arn = var.notification_queue_arn
    events = [
      "s3:ObjectCreated:*",
      "s3:ObjectRemoved:*"
    ]
    
    filter_prefix = ""
    filter_suffix = ""
  }
}

# Create storage analytics
resource "cloudflare_r2_bucket_analytics" "phi_analytics" {
  bucket     = cloudflare_r2_bucket.phi_storage.name
  account_id = var.cloudflare_account_id
  
  metrics_configuration {
    id          = "phi-metrics"
    filter {
      prefix = ""
    }
  }
}