#!/bin/bash

# BioPoint Monitoring Setup Script
# Enterprise monitoring setup for HIPAA-compliant healthcare applications
# This script sets up Datadog, Sentry, and backup monitoring stack

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONITORING_DIR="${PROJECT_ROOT}/monitoring"
K8S_DIR="${PROJECT_ROOT}/k8s"
DOCKER_DIR="${PROJECT_ROOT}/docker"
DOCS_DIR="${PROJECT_ROOT}/docs"

# Required tools
REQUIRED_TOOLS=(
    "kubectl"
    "helm"
    "docker"
    "docker-compose"
    "curl"
    "jq"
)

# Check if required tools are installed
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install missing tools and try again."
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Check environment variables
check_environment() {
    log "Checking environment configuration..."
    
    local required_env_vars=(
        "DATADOG_API_KEY"
        "DATADOG_APP_KEY"
        "SENTRY_DSN"
        "DATABASE_URL"
        "S3_BUCKET"
        "AWS_REGION"
    )
    
    local missing_vars=()
    
    for var in "${required_env_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        warning "Missing environment variables: ${missing_vars[*]}"
        warning "Some features may not work properly."
        warning "Please set these variables in your .env file or environment."
    fi
    
    success "Environment check completed"
}

# Setup Kubernetes namespace
setup_namespace() {
    log "Setting up Kubernetes namespace..."
    
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace biopoint-monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    success "Kubernetes namespaces created"
}

# Install Datadog Agent
install_datadog() {
    log "Installing Datadog Agent..."
    
    # Add Datadog Helm repository
    helm repo add datadog https://helm.datadoghq.com
    helm repo update
    
    # Install Datadog agent
    helm upgrade --install biopoint-datadog datadog/datadog \
        -f "${K8S_DIR}/datadog-values.yaml" \
        --namespace monitoring \
        --set datadog.apiKey="${DATADOG_API_KEY:-}" \
        --set datadog.appKey="${DATADOG_APP_KEY:-}" \
        --wait \
        --timeout=10m
    
    success "Datadog Agent installed"
}

# Setup Prometheus and Grafana (backup monitoring)
setup_backup_monitoring() {
    log "Setting up backup monitoring stack..."
    
    # Create necessary directories
    mkdir -p "${MONITORING_DIR}/prometheus"
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/{dashboards,datasources}"
    mkdir -p "${MONITORING_DIR}/alertmanager"
    mkdir -p "${MONITORING_DIR}/loki"
    mkdir -p "${MONITORING_DIR}/blackbox"
    
    # Create Prometheus configuration
    cat > "${MONITORING_DIR}/prometheus/prometheus.yml" << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'biopoint-production'
    environment: 'production'

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'biopoint-api'
    static_configs:
      - targets: ['biopoint-api:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://api.biopoint.com/health
        - https://api.biopoint.com/health/db
        - https://api.biopoint.com/health/s3
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
EOF

    # Create alerting rules
    cat > "${MONITORING_DIR}/prometheus/alerts.yml" << EOF
groups:
  - name: biopoint-alerts
    rules:
      - alert: API_Down
        expr: up{job="biopoint-api"} == 0
        for: 1m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "BioPoint API is down"
          description: "BioPoint API has been down for more than 1 minute"

      - alert: High_Error_Rate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          team: sre
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for more than 5 minutes"

      - alert: High_Response_Time
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
          team: sre
        annotations:
          summary: "High response time detected"
          description: "99th percentile response time is above 2 seconds"

      - alert: Database_Connection_Failure
        expr: probe_success{instance="https://api.biopoint.com/health/db"} == 0
        for: 1m
        labels:
          severity: critical
          team: sre
        annotations:
          summary: "Database connection failure"
          description: "Database health check is failing"
EOF

    # Create Grafana datasources
    cat > "${MONITORING_DIR}/grafana/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    # Create Alertmanager configuration
    cat > "${MONITORING_DIR}/alertmanager/config.yml" << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@biopoint.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    email_configs:
      - to: 'sre-team@biopoint.com'
        subject: 'BioPoint Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL:-}'
        channel: '#incident-response'
        title: 'BioPoint Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'
EOF

    success "Backup monitoring configuration created"
}

# Deploy backup monitoring stack
deploy_backup_monitoring() {
    log "Deploying backup monitoring stack..."
    
    cd "${DOCKER_DIR}"
    
    # Start the monitoring stack
    docker-compose -f docker-compose.monitoring.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    curl -f http://localhost:9090/-/healthy || warning "Prometheus may not be ready"
    curl -f http://localhost:3000/api/health || warning "Grafana may not be ready"
    curl -f http://localhost:9093/-/healthy || warning "Alertmanager may not be ready"
    
    success "Backup monitoring stack deployed"
}

# Setup Sentry projects
setup_sentry() {
    log "Setting up Sentry projects..."
    
    # Create Sentry projects via API (requires Sentry auth token)
    if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
        # Create API project
        curl -X POST "https://sentry.io/api/0/teams/${SENTRY_ORG:-biopoint}/${SENTRY_TEAM:-engineering}/projects/" \
            -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "BioPoint API",
                "slug": "biopoint-api",
                "platform": "node"
            }' || warning "Failed to create Sentry API project"
        
        # Create mobile project
        curl -X POST "https://sentry.io/api/0/teams/${SENTRY_ORG:-biopoint}/${SENTRY_TEAM:-engineering}/projects/" \
            -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "BioPoint Mobile",
                "slug": "biopoint-mobile",
                "platform": "react-native"
            }' || warning "Failed to create Sentry mobile project"
    else
        warning "SENTRY_AUTH_TOKEN not set. Skipping Sentry project creation."
    fi
    
    success "Sentry setup completed"
}

# Configure API monitoring
configure_api_monitoring() {
    log "Configuring API monitoring..."
    
    # Install monitoring dependencies
    cd "${PROJECT_ROOT}/apps/api"
    
    npm install dd-trace @sentry/node pino pino-datadog
    
    # Create monitoring configuration if it doesn't exist
    if [ ! -f "src/config/monitoring.ts" ]; then
        warning "Monitoring configuration not found. Please ensure monitoring.ts is created."
    fi
    
    # Add monitoring environment variables to API deployment
    kubectl create secret generic biopoint-monitoring \
        --from-literal=datadog-api-key="${DATADOG_API_KEY:-}" \
        --from-literal=sentry-dsn="${SENTRY_DSN:-}" \
        --namespace biopoint-api \
        --dry-run=client -o yaml | kubectl apply -f -
    
    success "API monitoring configured"
}

# Create health check endpoints
setup_health_checks() {
    log "Setting up health check endpoints..."
    
    # Create health check configuration
    cat > "${PROJECT_ROOT}/apps/api/src/routes/health.ts" << EOF
import { Router } from 'express';
import { health } from '../config/monitoring';
import db from '../config/database';
import { s3Client } from '../config/aws';

const router = Router();

// Basic health check
router.get('/health', async (req, res) => {
  try {
    const result = await health.runHealthChecks();
    res.status(result.status === 'healthy' ? 200 : 503).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Database health check
router.get('/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'database',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// S3 health check
router.get('/health/s3', async (req, res) => {
  try {
    await s3Client.headBucket({ Bucket: process.env.S3_BUCKET });
    res.json({
      status: 'healthy',
      service: 's3',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 's3',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// External services health check
router.get('/health/external', async (req, res) => {
  try {
    // Check external dependencies
    const checks = await Promise.allSettled([
      // Add external service checks here
    ]);
    
    const failed = checks.filter(check => check.status === 'rejected');
    
    res.json({
      status: failed.length === 0 ? 'healthy' : 'degraded',
      service: 'external',
      failed: failed.length,
      total: checks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'external',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
EOF
    
    success "Health check endpoints configured"
}

# Create alerting rules
setup_alerting() {
    log "Setting up alerting rules..."
    
    # Create Datadog monitors via API
    if [ -n "${DATADOG_API_KEY:-}" ] && [ -n "${DATADOG_APP_KEY:-}" ]; then
        # API Down monitor
        curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: ${DATADOG_API_KEY}" \
            -H "DD-APPLICATION-KEY: ${DATADOG_APP_KEY}" \
            -d '{
                "name": "BioPoint API Down",
                "type": "metric alert",
                "query": "avg(last_1m):avg:biopoint.api.health{*} < 1",
                "message": "@pagerduty-biopoint BioPoint API is down. @slack-incident-response",
                "tags": ["team:sre", "service:api", "severity:critical"],
                "options": {
                    "notify_audit": false,
                    "locked": false,
                    "timeout_h": 0,
                    "silenced": {},
                    "include_tags": true,
                    "no_data_timeframe": 2,
                    "require_full_window": true,
                    "notify_no_data": false,
                    "renotify_interval": 5,
                    "evaluation_delay": 0,
                    "escalation_message": "",
                    "thresholds": {
                        "critical": 1,
                        "warning": 2
                    }
                }
            }' || warning "Failed to create API down monitor"
        
        # High error rate monitor
        curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: ${DATADOG_API_KEY}" \
            -H "DD-APPLICATION-KEY: ${DATADOG_APP_KEY}" \
            -d '{
                "name": "BioPoint High Error Rate",
                "type": "metric alert",
                "query": "avg(last_5m):sum:biopoint.api.errors{*}.as_rate() / sum:biopoint.api.requests{*}.as_rate() * 100 > 5",
                "message": "@slack-incident-error BioPoint API error rate is above 5%",
                "tags": ["team:sre", "service:api", "severity:warning"],
                "options": {
                    "notify_audit": false,
                    "locked": false,
                    "timeout_h": 0,
                    "silenced": {},
                    "include_tags": true,
                    "no_data_timeframe": 10,
                    "require_full_window": true,
                    "notify_no_data": false,
                    "renotify_interval": 10,
                    "evaluation_delay": 0,
                    "escalation_message": "",
                    "thresholds": {
                        "critical": 5,
                        "warning": 2
                    }
                }
            }' || warning "Failed to create high error rate monitor"
    else
        warning "Datadog API keys not set. Skipping monitor creation."
    fi
    
    success "Alerting rules configured"
}

# Create documentation
create_documentation() {
    log "Creating monitoring documentation..."
    
    # Create monitoring dashboard documentation
    cat > "${DOCS_DIR}/monitoring/dashboards.md" << EOF
# BioPoint Monitoring Dashboards

## Datadog Dashboards

### API Performance Dashboard
URL: https://app.datadoghq.com/dashboard/biopoint-api-performance
- Request rate and latency (p50, p95, p99)
- Error rate by endpoint
- Top 10 slowest endpoints
- Geographic request distribution

### Database Performance Dashboard
URL: https://app.datadoghq.com/dashboard/biopoint-database-performance
- Query execution time
- Connection pool usage
- Slow query analysis
- Database resource utilization

### Security Dashboard
URL: https://app.datadoghq.com/dashboard/biopoint-security
- Authentication failure rate
- PHI access audit log
- Rate limiting violations
- Suspicious activity alerts

### Business Metrics Dashboard
URL: https://app.datadoghq.com/dashboard/biopoint-business-metrics
- Daily/Monthly active users
- PHI access patterns
- User engagement metrics
- Compliance audit trail

## Grafana Dashboards (Backup)

### API Overview Dashboard
URL: http://localhost:3000/d/biopoint-api-overview
- HTTP request metrics
- Response time percentiles
- Error rate tracking
- Service availability

### Database Overview Dashboard
URL: http://localhost:3000/d/biopoint-database-overview
- PostgreSQL metrics
- Connection statistics
- Query performance
- Storage utilization

### Infrastructure Dashboard
URL: http://localhost:3000/d/biopoint-infrastructure
- Node metrics
- Container statistics
- Network throughput
- Resource utilization
EOF
    
    success "Monitoring documentation created"
}

# Verify deployment
verify_deployment() {
    log "Verifying monitoring deployment..."
    
    # Check Datadog agent
    kubectl get pods -n monitoring -l app.kubernetes.io/instance=biopoint-datadog
    
    # Check backup monitoring services
    docker-compose -f "${DOCKER_DIR}/docker-compose.monitoring.yml" ps
    
    # Test health endpoints
    curl -f http://localhost:8081/health || warning "Health check service not responding"
    curl -f http://localhost:9090/-/healthy || warning "Prometheus not responding"
    curl -f http://localhost:3000/api/health || warning "Grafana not responding"
    
    success "Deployment verification completed"
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary resources..."
    
    # Remove temporary files if any
    rm -f /tmp/biopoint-monitoring-*.tmp
    
    log "Cleanup completed"
}

# Main function
main() {
    log "Starting BioPoint monitoring setup..."
    
    # Trap cleanup function on exit
    trap cleanup EXIT
    
    # Run setup steps
    check_prerequisites
    check_environment
    setup_namespace
    install_datadog
    setup_backup_monitoring
    deploy_backup_monitoring
    setup_sentry
    configure_api_monitoring
    setup_health_checks
    setup_alerting
    create_documentation
    verify_deployment
    
    success "BioPoint monitoring setup completed successfully!"
    
    # Print summary
    echo ""
    log "Monitoring Setup Summary:"
    echo "========================"
    echo "Datadog Agent: Installed in monitoring namespace"
    echo "Prometheus: Running on http://localhost:9090"
    echo "Grafana: Running on http://localhost:3000 (admin/admin123)"
    echo "Alertmanager: Running on http://localhost:9093"
    echo "Health Check Service: Running on http://localhost:8081"
    echo ""
    echo "Next Steps:"
    echo "1. Configure PagerDuty integration"
    echo "2. Set up on-call rotation"
    echo "3. Test alerting rules"
    echo "4. Train team on monitoring tools"
    echo "5. Review and update runbooks"
    echo ""
    echo "Documentation: ${DOCS_DIR}/monitoring-setup.md"
    echo "Runbooks: ${DOCS_DIR}/runbooks/"
}

# Run main function
main "$@"