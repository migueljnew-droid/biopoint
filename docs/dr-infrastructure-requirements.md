# Disaster Recovery Infrastructure Requirements

**Classification:** L3-CONFIDENTIAL  
**Last Updated:** January 2026  
**Owner:** Cloud Infrastructure Engineer  
**Review Schedule:** Quarterly

---

## Overview

This document defines the infrastructure requirements for BioPoint's disaster recovery capabilities. These requirements ensure robust, scalable, and HIPAA-compliant disaster recovery across all system components.

**Infrastructure Principles:**
- **Redundancy:** No single points of failure
- **Geographic Distribution:** Multi-region deployment
- **Scalability:** Auto-scaling capabilities
- **Security:** HIPAA-compliant configurations
- **Cost Optimization:** Efficient resource utilization

---

## Multi-Region Architecture

### Primary Region: US-East-1 (N. Virginia)
**Purpose:** Production environment
**Availability Zones:** 3 minimum
**Services:** All production services

### Standby Region: US-West-2 (Oregon)
**Purpose:** Disaster recovery environment
**Availability Zones:** 3 minimum
**Services:** Scaled-down standby services

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Global Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐          ┌─────────────┐                      │
│  │ CloudFlare  │          │   Route53   │                      │
│  │    CDN      │          │     DNS     │                      │
│  └──────┬──────┘          └──────┬──────┘                      │
│         │                         │                             │
│         ▼                         ▼                             │
│  ┌─────────────────────────────────────────────────┐          │
│  │              Primary Region (us-east-1)         │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │          │
│  │  │   EKS       │  │   RDS       │  │   S3    │ │          │
│  │  │  Cluster    │  │  Primary    │  │ Primary │ │          │
│  │  │             │  │  Database   │  │ Bucket  │ │          │
│  │  └─────────────┘  └─────────────┘  └─────────┘ │          │
│  │                                                 │          │
│  └─────────────────────────────────────────────────┘          │
│                           │                                   │
│                           │ Replication                       │
│                           ▼                                   │
│  ┌─────────────────────────────────────────────────┐          │
│  │              Standby Region (us-west-2)         │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │          │
│  │  │   EKS       │  │   RDS       │  │   S3    │ │          │
│  │  │  Cluster    │  │  Standby    │  │ Standby │ │          │
│  │  │             │  │  Database   │  │ Bucket  │ │          │
│  │  └─────────────┘  └─────────────┘  └─────────┘ │          │
│  │                                                 │          │
│  └─────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Compute Infrastructure

### Kubernetes Clusters (EKS)

#### Primary Cluster Configuration
```yaml
# Primary EKS Cluster (us-east-1)
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: biopoint-primary
  region: us-east-1
  version: "1.28"

availabilityZones:
  - us-east-1a
  - us-east-1b
  - us-east-1c

nodeGroups:
  - name: api-nodes
    instanceType: t3.large
    desiredCapacity: 5
    minSize: 3
    maxSize: 20
    volumeSize: 100
    volumeType: gp3
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true
        efs: true
        albIngress: true
    labels:
      nodegroup-role: api
    taints:
      - key: api-only
        value: "true"
        effect: NoSchedule

  - name: worker-nodes
    instanceType: t3.medium
    desiredCapacity: 3
    minSize: 2
    maxSize: 10
    volumeSize: 50
    volumeType: gp3
    labels:
      nodegroup-role: worker
```

#### Standby Cluster Configuration
```yaml
# Standby EKS Cluster (us-west-2)
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: biopoint-standby
  region: us-west-2
  version: "1.28"

availabilityZones:
  - us-west-2a
  - us-west-2b
  - us-west-2c

nodeGroups:
  - name: api-nodes
    instanceType: t3.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 15
    volumeSize: 100
    volumeType: gp3
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true
        efs: true
        albIngress: true
    labels:
      nodegroup-role: api
    taints:
      - key: api-only
        value: "true"
        effect: NoSchedule

  - name: worker-nodes
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 1
    maxSize: 8
    volumeSize: 50
    volumeType: gp3
    labels:
      nodegroup-role: worker
```

### Auto-scaling Configuration

#### Horizontal Pod Autoscaler (HPA)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biopoint-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biopoint-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

#### Vertical Pod Autoscaler (VPA)
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: biopoint-api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biopoint-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      maxAllowed:
        cpu: 2
        memory: 4Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

---

## Database Infrastructure

### Primary Database (Neon PostgreSQL)

#### Configuration
```sql
-- Primary Database Configuration
-- Location: us-east-1
-- Instance Type: Neon Pro
-- Storage: 500GB minimum

-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- WAL configuration for replication
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET wal_keep_segments = 64;

-- Performance tuning
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
```

#### Cross-Region Replication Setup
```bash
#!/bin/bash
# Configure cross-region replication

# Primary region (us-east-1)
echo "Configuring primary database replication..."

# Create replication slot
psql "$DATABASE_PRIMARY" -c "
SELECT pg_create_physical_replication_slot('standby_slot_1', true);"

# Configure standby region (us-west-2)
echo "Configuring standby database replication..."

# Promote standby to readable replica
psql "$DATABASE_STANDBY" -c "
SELECT pg_wal_replay_resume();"

# Verify replication lag
psql "$DATABASE_STANDBY" -c "
SELECT 
    now() - pg_last_xact_replay_timestamp() as replication_lag,
    pg_is_in_recovery() as is_standby;"
```

### Database Backup Strategy

#### Automated Backup Configuration
```bash
#!/bin/bash
# Database Backup Configuration

# Daily backups at 02:00 UTC
0 2 * * * /opt/biopoint/scripts/backup-database.sh

# Weekly full backups (Sundays)
0 3 * * 0 /opt/biopoint/scripts/backup-database-full.sh

# Monthly retention cleanup
0 4 1 * * /opt/biopoint/scripts/cleanup-old-backups.sh
```

#### Backup Script
```bash
#!/bin/bash
# Database Backup Script

set -euo pipefail

BACKUP_BUCKET="biopoint-db-backups"
BACKUP_PREFIX="$(date +%Y/%m/%d)"
RETENTION_DAYS=30

echo "Starting database backup: $(date)"

# Create compressed backup
pg_dump "$DATABASE_URL" | gzip > "/tmp/backup-$(date +%Y%m%d_%H%M%S).sql.gz"

# Upload to S3 with encryption
aws s3 cp "/tmp/backup-*.sql.gz" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" \
  --server-side-encryption AES256 \
  --storage-class STANDARD_IA

# Verify backup integrity
aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/backup-$(date +%Y%m%d_%H%M%S).sql.gz" - | \
  gunzip | head -c 1024 > /dev/null

# Cleanup local files
rm -f /tmp/backup-*.sql.gz

# Remove old backups
aws s3 rm "s3://${BACKUP_BUCKET}/" --recursive --exclude "*" \
  --include "$(date -d "${RETENTION_DAYS} days ago" +%Y/%m/%d)/*"

echo "Database backup completed: $(date)"
```

---

## Storage Infrastructure

### S3 Storage Configuration

#### Primary Bucket (us-east-1)
```json
{
  "Bucket": "biopoint-uploads",
  "Region": "us-east-1",
  "Versioning": {
    "Status": "Enabled"
  },
  "Encryption": {
    "ServerSideEncryptionConfiguration": {
      "Rules": [
        {
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"
          }
        }
      ]
    }
  },
  "PublicAccessBlock": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  },
  "Logging": {
    "LoggingEnabled": {
      "TargetBucket": "biopoint-access-logs",
      "TargetPrefix": "s3-access-logs/biopoint-uploads/"
    }
  },
  "Lifecycle": {
    "Rules": [
      {
        "ID": "Transition to IA",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 30,
            "StorageClass": "STANDARD_IA"
          },
          {
            "Days": 90,
            "StorageClass": "GLACIER"
          }
        ]
      }
    ]
  }
}
```

#### Cross-Region Replication Configuration
```json
{
  "Role": "arn:aws:iam::123456789012:role/biopoint-s3-replication",
  "Rules": [
    {
      "ID": "biopoint-cross-region-replication",
      "Status": "Enabled",
      "Priority": 1,
      "DeleteMarkerReplication": {
        "Status": "Enabled"
      },
      "Filter": {
        "Prefix": ""
      },
      "Destination": {
        "Bucket": "arn:aws:s3:::biopoint-uploads-west",
        "StorageClass": "STANDARD",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {
            "Minutes": 15
          }
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": {
            "Minutes": 15
          }
        }
      }
    }
  ]
}
```

### Cloudflare R2 Configuration

#### R2 Bucket Setup
```bash
#!/bin/bash
# R2 Bucket Configuration

# Create R2 bucket
wrangler r2 bucket create biopoint-r2-backup

# Configure bucket policies
wrangler r2 bucket policy set biopoint-r2-backup << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::biopoint-r2-backup/*"
    }
  ]
}
EOF

# Configure lifecycle rules
wrangler r2 bucket lifecycle set biopoint-r2-backup << 'EOF'
{
  "Rules": [
    {
      "ID": "TransitionOldFiles",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "InfrequentAccess"
        }
      ]
    }
  ]
}
EOF
```

---

## Network Infrastructure

### VPC Configuration

#### Primary VPC (us-east-1)
```yaml
# Primary VPC Configuration
VPC:
  CidrBlock: 10.0.0.0/16
  EnableDnsHostnames: true
  EnableDnsSupport: true

Subnets:
  Public:
    - CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
      MapPublicIpOnLaunch: true
    - CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-east-1b
      MapPublicIpOnLaunch: true
    - CidrBlock: 10.0.3.0/24
      AvailabilityZone: us-east-1c
      MapPublicIpOnLaunch: true
  
  Private:
    - CidrBlock: 10.0.10.0/24
      AvailabilityZone: us-east-1a
    - CidrBlock: 10.0.20.0/24
      AvailabilityZone: us-east-1b
    - CidrBlock: 10.0.30.0/24
      AvailabilityZone: us-east-1c

InternetGateway: true
NATGateways:
  - Subnet: Public-1a
  - Subnet: Public-1b
```

#### Security Groups
```yaml
# API Security Group
APIGatewaySecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for API servers
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0
        Description: HTTPS from anywhere
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0
        Description: HTTP from anywhere
    SecurityGroupEgress:
      - IpProtocol: -1
        CidrIp: 0.0.0.0/0
        Description: Allow all outbound traffic

# Database Security Group
DatabaseSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for database access
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 5432
        ToPort: 5432
        SourceSecurityGroupId: !Ref APIGatewaySecurityGroup
        Description: PostgreSQL from API servers
    SecurityGroupEgress:
      - IpProtocol: -1
        CidrIp: 0.0.0.0/0
        Description: Allow all outbound traffic
```

### Load Balancer Configuration

#### Application Load Balancer
```yaml
# Primary ALB Configuration
ApplicationLoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Name: biopoint-primary-alb
    Type: application
    Scheme: internet-facing
    IpAddressType: ipv4
    Subnets:
      - !Ref PublicSubnet1a
      - !Ref PublicSubnet1b
      - !Ref PublicSubnet1c
    SecurityGroups:
      - !Ref ALBSecurityGroup

# Target Group Configuration
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Name: biopoint-api-tg
    Port: 3000
    Protocol: HTTP
    VpcId: !Ref VPC
    HealthCheckPath: /health
    HealthCheckProtocol: HTTP
    HealthCheckIntervalSeconds: 30
    HealthCheckTimeoutSeconds: 10
    HealthyThresholdCount: 3
    UnhealthyThresholdCount: 3
    TargetType: ip

# Listener Configuration
Listener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref TargetGroup
    LoadBalancerArn: !Ref ApplicationLoadBalancer
    Port: 443
    Protocol: HTTPS
    Certificates:
      - CertificateArn: !Ref SSLCertificate
```

---

## Security Infrastructure

### WAF Configuration

#### Web ACL Rules
```json
{
  "Name": "biopoint-web-acl",
  "Scope": "REGIONAL",
  "DefaultAction": {
    "Allow": {}
  },
  "Rules": [
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "GeoBlockRule",
      "Priority": 2,
      "Statement": {
        "GeoMatchStatement": {
          "CountryCodes": ["CN", "RU", "KP", "IR"]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "SQLiProtectionRule",
      "Priority": 3,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "OverrideAction": {
        "None": {}
      }
    },
    {
      "Name": "PHIProtectionRule",
      "Priority": 4,
      "Statement": {
        "RegexPatternSetReferenceStatement": {
          "ARN": "arn:aws:wafv2:us-east-1:123456789012:regional/regexpatternset/phi-patterns/id",
          "FieldToMatch": {
            "Body": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "NONE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

### Secrets Management

#### AWS Secrets Manager Configuration
```bash
#!/bin/bash
# Secrets Manager Configuration

# Database credentials
aws secretsmanager create-secret \
  --name biopoint/database-credentials \
  --description "Database connection credentials" \
  --secret-string '{
    "username": "biopoint",
    "password": "'$(openssl rand -base64 32)'",
    "host": "ep-biopoint-primary.us-east-1.aws.neon.tech",
    "port": "5432",
    "database": "biopoint"
  }'

# JWT secrets
aws secretsmanager create-secret \
  --name biopoint/jwt-secrets \
  --description "JWT signing secrets" \
  --secret-string '{
    "access_secret": "'$(openssl rand -base64 64)'",
    "refresh_secret": "'$(openssl rand -base64 64)'",
    "algorithm": "HS256",
    "expires_in": "15m"
  }'

# API keys
aws secretsmanager create-secret \
  --name biopoint/api-keys \
  --description "Third-party API keys" \
  --secret-string '{
    "sendgrid_api_key": "'$(openssl rand -hex 32)'",
    "stripe_secret_key": "'$(openssl rand -hex 32)'",
    "twilio_auth_token": "'$(openssl rand -hex 32)'"
  }'
```

---

## Monitoring Infrastructure

### Prometheus Configuration

#### Primary Prometheus Setup
```yaml
# prometheus-primary.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    region: us-east-1
    cluster: primary

scrape_configs:
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

  - job_name: 'biopoint-api'
    static_configs:
      - targets: ['api.biopoint.com:9090']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'biopoint-database'
    static_configs:
      - targets: ['postgres-exporter.biopoint.com:9187']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager.biopoint.com:9093']
```

#### Critical Alerts Configuration
```yaml
# alerts-critical.yml
groups:
- name: biopoint-critical
  rules:
  - alert: DatabaseDown
    expr: up{job="biopoint-database"} == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "BioPoint database is down"
      description: "Database has been down for more than 2 minutes"

  - alert: APIHighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "BioPoint API high error rate"
      description: "API error rate is above 10% for 5 minutes"

  - alert: ReplicationLagHigh
    expr: pg_replication_lag_seconds > 300
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database replication lag is high"
      description: "Replication lag is above 5 minutes"

  - alert: S3BucketDown
    expr: s3_bucket_available == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "S3 bucket is unavailable"
      description: "Primary S3 bucket has been unavailable for 5 minutes"
```

### Grafana Dashboard Configuration

#### DR Monitoring Dashboard
```json
{
  "dashboard": {
    "title": "BioPoint DR Monitoring",
    "panels": [
      {
        "title": "System Health Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=~\"biopoint-.*\"}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              {
                "options": {
                  "0": {
                    "text": "Down",
                    "color": "red"
                  },
                  "1": {
                    "text": "Up",
                    "color": "green"
                  }
                }
              }
            ]
          }
        }
      },
      {
        "title": "Database Replication Lag",
        "type": "timeseries",
        "targets": [
          {
            "expr": "pg_replication_lag_seconds"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {
                  "color": "green",
                  "value": null
                },
                {
                  "color": "yellow",
                  "value": 60
                },
                {
                  "color": "red",
                  "value": 300
                }
              ]
            }
          }
        }
      },
      {
        "title": "API Response Time",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {
                  "color": "green",
                  "value": null
                },
                {
                  "color": "yellow",
                  "value": 1
                },
                {
                  "color": "red",
                  "value": 2
                }
              ]
            }
          }
        }
      }
    ]
  }
}
```

---

## Disaster Recovery Automation

### Infrastructure as Code

#### Terraform Configuration
```hcl
# main.tf - Infrastructure as Code
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.primary_region
  
  default_tags {
    tags = {
      Environment = "production"
      Project     = "biopoint"
      ManagedBy   = "terraform"
    }
  }
}

# Primary infrastructure
module "primary_infrastructure" {
  source = "./modules/primary"
  
  region           = var.primary_region
  vpc_cidr         = var.primary_vpc_cidr
  cluster_name     = "biopoint-primary"
  database_version = "15.4"
  
  tags = {
    Environment = "production"
    Region      = "primary"
  }
}

# Standby infrastructure
module "standby_infrastructure" {
  source = "./modules/standby"
  
  region           = var.standby_region
  vpc_cidr         = var.standby_vpc_cidr
  cluster_name     = "biopoint-standby"
  database_version = "15.4"
  
  tags = {
    Environment = "production"
    Region      = "standby"
  }
}

# Cross-region resources
module "cross_region" {
  source = "./modules/cross-region"
  
  primary_region = var.primary_region
  standby_region = var.standby_region
  
  depends_on = [
    module.primary_infrastructure,
    module.standby_infrastructure
  ]
}
```

#### Automated Recovery Scripts
```bash
#!/bin/bash
# Automated Disaster Recovery Script

set -euo pipefail

# Configuration
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
STANDBY_REGION="${STANDBY_REGION:-us-west-2}"
LOG_FILE="/var/log/automated-dr-$(date +%Y%m%d_%H%M%S).log"

# Function to log and execute commands
log_exec() {
    echo "$(date): Executing: $*" >> "$LOG_FILE"
    "$@" >> "$LOG_FILE" 2>&1
    return $?
}

# Function to check service health
check_service_health() {
    local service=$1
    local url=$2
    local timeout=${3:-10}
    
    local status=$(curl -f -s -o /dev/null -w "%{http_code}" "$url" --max-time "$timeout" || echo "000")
    
    if [ "$status" = "200" ]; then
        echo "HEALTHY"
    else
        echo "UNHEALTHY"
    fi
}

# Main disaster recovery function
execute_automated_recovery() {
    echo "$(date): Starting automated disaster recovery" | tee -a "$LOG_FILE"
    
    # Step 1: Assess current situation
    echo "$(date): Assessing current infrastructure status" | tee -a "$LOG_FILE"
    
    PRIMARY_STATUS=$(check_service_health "Primary API" "https://api.biopoint.com/health")
    STANDBY_STATUS=$(check_service_health "Standby API" "https://api-west.biopoint.com/health")
    
    echo "$(date): Primary region status: $PRIMARY_STATUS" | tee -a "$LOG_FILE"
    echo "$(date): Standby region status: $STANDBY_STATUS" | tee -a "$LOG_FILE"
    
    # Step 2: Determine recovery action
    if [ "$PRIMARY_STATUS" = "UNHEALTHY" ] && [ "$STANDBY_STATUS" = "HEALTHY" ]; then
        echo "$(date): Executing failover to standby region" | tee -a "$LOG_FILE"
        execute_regional_failover
    elif [ "$PRIMARY_STATUS" = "HEALTHY" ] && [ "$STANDBY_STATUS" = "UNHEALTHY" ]; then
        echo "$(date): Primary healthy, standby unhealthy - monitoring" | tee -a "$LOG_FILE"
    else
        echo "$(date): Both regions unhealthy - escalating to manual intervention" | tee -a "$LOG_FILE"
        exit 1
    fi
}

# Function to execute regional failover
execute_regional_failover() {
    echo "$(date): Initiating regional failover" | tee -a "$LOG_FILE"
    
    # Promote standby database
    echo "$(date): Promoting standby database" | tee -a "$LOG_FILE"
    log_exec curl -X POST "https://console.neon.tech/api/v2/projects/biopoint/endpoints/ep-biopoint-standby/promote" \
         -H "Authorization: Bearer ${NEON_API_KEY}" \
         -H "Content-Type: application/json"
    
    # Update DNS records
    echo "$(date): Updating DNS records" | tee -a "$LOG_FILE"
    log_exec aws route53 change-resource-record-sets \
        --hosted-zone-id "Z123456789ABC" \
        --change-batch file://dns-failover.json
    
    # Scale up standby infrastructure
    echo "$(date): Scaling up standby infrastructure" | tee -a "$LOG_FILE"
    log_exec kubectl config use-context biopoint-west
    log_exec kubectl scale deployment biopoint-api --replicas=5
    log_exec kubectl scale deployment biopoint-api-standby --replicas=3
    
    # Verify recovery
    echo "$(date): Verifying recovery completion" | tee -a "$LOG_FILE"
    sleep 120
    
    FINAL_STATUS=$(check_service_health "Standby API" "https://api-west.biopoint.com/health")
    
    if [ "$FINAL_STATUS" = "HEALTHY" ]; then
        echo "$(date): Regional failover completed successfully" | tee -a "$LOG_FILE"
    else
        echo "$(date): ERROR: Regional failover failed" | tee -a "$LOG_FILE"
        exit 1
    fi
}

# Execute automated recovery
execute_automated_recovery
```

---

## Capacity Planning

### Resource Requirements

#### Primary Region Capacity
| Component | Current | Peak | DR Standby |
|-----------|---------|------|------------|
| API Servers | 5 pods | 20 pods | 3 pods |
| Database | 4 vCPU, 16GB | 16 vCPU, 64GB | 4 vCPU, 16GB |
| Storage | 500GB | 2TB | 500GB |
| Network | 1Gbps | 10Gbps | 1Gbps |

#### Growth Projections
```
Year 1: 100% growth in users
Year 2: 200% growth in data volume
Year 3: 300% growth in API calls
```

### Auto-scaling Triggers
```yaml
# Auto-scaling Configuration
scaling_policies:
  api_servers:
    min_replicas: 3
    max_replicas: 20
    cpu_threshold: 70%
    memory_threshold: 80%
    scale_up_cooldown: 60s
    scale_down_cooldown: 300s
    
  database:
    min_cpu: 4
    max_cpu: 16
    min_memory: 16GB
    max_memory: 64GB
    connection_threshold: 150
    
  storage:
    auto_expand: true
    max_size: 2TB
    warning_threshold: 80%
    critical_threshold: 90%
```

---

## Cost Optimization

### Resource Optimization
- **Reserved Instances:** 70% of baseline capacity
- **Spot Instances:** 30% of scalable workload
- **Storage Lifecycle:** Automated tier transitions
- **Network Optimization:** CDN and edge caching

### Cost Monitoring
```bash
#!/bin/bash
# Monthly Cost Analysis

echo "Monthly Infrastructure Cost Report: $(date)"

# Calculate current costs
PRIMARY_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://primary-region-filter.json | \
  jq -r '.ResultsByTime[0].Total.BlendedCost.Amount')

STANDBY_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://standby-region-filter.json | \
  jq -r '.ResultsByTime[0].Total.BlendedCost.Amount')

TOTAL_COST=$(echo "$PRIMARY_COST + $STANDBY_COST" | bc -l)

echo "Primary Region Cost: \$$PRIMARY_COST"
echo "Standby Region Cost: \$$STANDBY_COST"
echo "Total Monthly Cost: \$$TOTAL_COST"
echo "Cost per User: \$(echo "scale=2; $TOTAL_COST / $USER_COUNT" | bc -l)"
```

### Budget Alerts
```yaml
# Budget Configuration
Budget:
  BudgetName: biopoint-dr-budget
  BudgetLimit:
    Amount: 5000
    Unit: USD
  TimeUnit: MONTHLY
  BudgetType: COST
  NotificationsWithSubscribers:
    - Notification:
        NotificationType: ACTUAL
        ComparisonOperator: GREATER_THAN
        Threshold: 80
        ThresholdType: PERCENTAGE
      Subscribers:
        - SubscriptionType: EMAIL
          Address: finance@biopoint.com
        - SubscriptionType: EMAIL
          Address: ops@biopoint.com
```

---

## Compliance and Security

### HIPAA Compliance Requirements
- **Encryption at Rest:** AES-256 for all data
- **Encryption in Transit:** TLS 1.3 minimum
- **Access Controls:** Role-based access control
- **Audit Logging:** Complete audit trail
- **Data Backup:** Encrypted backups with retention

### Security Controls
```yaml
# Security Baseline
security_controls:
  network_security:
    - vpc_isolation: true
    - security_groups: strict
    - nacl_rules: restrictive
    - flow_logs: enabled
    
  compute_security:
    - imdsv2: required
    - encryption: enabled
    - patching: automated
    - vulnerability_scanning: continuous
    
  data_security:
    - encryption_at_rest: aes256
    - encryption_in_transit: tls13
    - access_logging: comprehensive
    - retention_policy: defined
    
  identity_security:
    - mfa: required
    - password_policy: strict
    - access_review: quarterly
    - privilege_escalation: monitored
```

### Audit and Compliance Monitoring
```bash
#!/bin/bash
# Compliance Audit Script

echo "Starting compliance audit: $(date)"

# Check encryption status
aws s3api get-bucket-encryption --bucket biopoint-uploads --region us-east-1
aws rds describe-db-instances --db-instance-identifier biopoint-primary --region us-east-1

# Check access controls
aws iam get-account-authorization-details
aws iam list-attached-user-policies --user-name biopoint-admin

# Check audit logging
aws cloudtrail describe-trails
aws config describe-configuration-recorders

# Generate compliance report
echo "Compliance audit completed: $(date)"
```

---

## Infrastructure Testing

### Infrastructure Validation Tests
```bash
#!/bin/bash
# Infrastructure Validation Test Suite

echo "Starting infrastructure validation tests: $(date)"

# Test 1: Multi-region connectivity
echo "Testing multi-region connectivity..."
ping -c 4 api.biopoint.com
ping -c 4 api-west.biopoint.com

# Test 2: Database replication
echo "Testing database replication..."
psql "$DATABASE_PRIMARY" -c "SELECT now() - pg_last_xact_replay_timestamp();"
psql "$DATABASE_STANDBY" -c "SELECT pg_is_in_recovery();"

# Test 3: S3 cross-region replication
echo "Testing S3 cross-region replication..."
aws s3api get-bucket-replication --bucket biopoint-uploads --region us-east-1
aws s3 ls s3://biopoint-uploads-west/ --region us-west-2

# Test 4: Load balancer health
echo "Testing load balancer health..."
curl -s -o /dev/null -w "%{http_code}" https://api.biopoint.com/health
curl -s -o /dev/null -w "%{http_code}" https://api-west.biopoint.com/health

# Test 5: Security controls
echo "Testing security controls..."
aws wafv2 list-web-acls --scope REGIONAL --region us-east-1
aws iam get-account-summary

echo "Infrastructure validation tests completed: $(date)"
```

### Performance Benchmarking
```bash
#!/bin/bash
# Performance Benchmarking Script

echo "Starting performance benchmarks: $(date)"

# Database performance
pgbench -h "$DATABASE_HOST" -U biopoint -d biopoint -c 10 -j 2 -t 1000

# API performance
ab -n 10000 -c 100 https://api.biopoint.com/health

# Network performance
iperf3 -c api.biopoint.com -p 5201 -t 60

# Storage performance
aws s3 cp large-file.bin s3://biopoint-uploads/performance-test/
aws s3 cp s3://biopoint-uploads/performance-test/large-file.bin /tmp/

echo "Performance benchmarks completed: $(date)"
```

---

**Document Control:**
- **Version:** 1.0
- **Last Review:** January 2026
- **Next Review:** April 2026
- **Owner:** Cloud Infrastructure Engineer
- **Classification:** L3-CONFIDENTIAL

**Training Requirements:**
- Infrastructure team must review quarterly
- Vendor-specific training as required
- Annual infrastructure certification