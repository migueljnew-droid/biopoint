# BioPoint Scaling Configuration Guide

## Overview

This document provides detailed configuration and operational guidance for BioPoint's auto-scaling infrastructure, including horizontal pod autoscaling, database connection pooling, and load balancer scaling policies.

## Auto-scaling Architecture

### Horizontal Pod Autoscaler (HPA) Configuration

The HPA is configured with multiple scaling metrics to ensure responsive and efficient scaling based on actual load conditions.

#### Scaling Metrics

```yaml
# Primary Metrics
- CPU Utilization: 70% threshold
- Memory Utilization: 80% threshold
- HTTP Requests per Second: 100 req/sec per pod

# Scaling Behavior
- Scale Up: Maximum 4 pods per 30-second period
- Scale Down: Maximum 2 pods per 90-second period
- Stabilization Window: 5 minutes (scale down), 1 minute (scale up)
```

#### HPA Configuration Details

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biopoint-api-hpa
spec:
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
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

### Custom Metrics Configuration

To enable custom metrics (HTTP requests per second), install the Prometheus Adapter:

```bash
# Install Prometheus Adapter
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --set prometheus.url=http://prometheus-server.monitoring.svc.cluster.local \
  --set prometheus.port=80
```

Create custom metrics rules:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adapter-config
  namespace: monitoring
data:
  config.yaml: |
    rules:
    - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        matches: "^(.*)_total"
        as: "${1}_per_second"
      metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
```

### Vertical Pod Autoscaler (VPA) Configuration

VPA provides recommendations for optimal resource requests and limits:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: biopoint-api-vpa
  namespace: biopoint-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biopoint-api-deployment
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: biopoint-api
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2000m
        memory: 2Gi
      controlledResources: ["cpu", "memory"]
```

## Database Scaling

### PgBouncer Connection Pooling

PgBouncer configuration for optimal database connection management:

```ini
# pgbouncer.ini
[databases]
biopoint_production = host=neon-host port=5432 dbname=biopoint_production

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = plain
pool_mode = transaction
server_reset_query = DISCARD ALL

# Pool Configuration
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

# Connection Management
server_lifetime = 3600
server_idle_timeout = 600
server_connect_timeout = 15
server_login_retry = 3
```

### Database Connection Scaling

#### Connection Pool Hierarchy

```
Application (Prisma) → PgBouncer → PostgreSQL
     ↓                    ↓            ↓
   10 conn              20 conn      200 conn
```

#### Connection Pool Sizing Formula

```
Required Connections = (Max Pods × Connections per Pod) + Buffer

Example:
- Max Pods: 20
- Connections per Pod: 10
- Buffer: 20%
- Required Connections = (20 × 10) × 1.2 = 240 connections
```

### Database Read Replica Scaling

For read-heavy workloads, implement read replicas:

```yaml
# Read replica configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: database-config
  namespace: biopoint-production
data:
  DATABASE_URL: "postgresql://user:pass@neon-primary:5432/biopoint"
  DATABASE_READ_URL: "postgresql://user:pass@neon-replica:5432/biopoint"
```

## Load Balancer Scaling

### Cloudflare Load Balancer Configuration

#### Geographic Distribution

```hcl
# Primary regions
region_pools {
  region = "enam"  # Eastern North America
  pool_ids = [cloudflare_load_balancer_pool.us_east_pool.id]
}

region_pools {
  region = "wnam"  # Western North America
  pool_ids = [cloudflare_load_balancer_pool.us_west_pool.id]
}

# Point of Presence (POP) configuration
pop_pools {
  pop = "SJC"  # San Jose
  pool_ids = [cloudflare_load_balancer_pool.us_west_pool.id]
}

pop_pools {
  pop = "JFK"  # New York
  pool_ids = [cloudflare_load_balancer_pool.us_east_pool.id]
}
```

#### Load Balancing Policies

| Policy | Use Case | Configuration |
|--------|----------|---------------|
| Least Connections | General API traffic | `origin_steering { policy = "least_connections" }` |
| Geographic | User proximity | `steering_policy = "geo"` |
| Failover | Disaster recovery | `fallback_pool_id = backup_pool_id` |
| Random | Load distribution | `random_steering { default_weight = 0.5 }` |

### Rate Limiting Scaling

#### Adaptive Rate Limiting

Implement adaptive rate limiting based on system load:

```yaml
# Adaptive rate limiting rules
- name: "adaptive_rate_limit"
  condition: "http.request.uri.path eq \"/api/*\""
  action: "rate_limit"
  rate_limit:
    requests_per_period: |
      if (cpu_utilization > 80) then 25
      else if (cpu_utilization > 60) then 50
      else 100
    period: 1
    mitigation_timeout: 300
```

## Scaling Triggers and Thresholds

### Scaling Decision Matrix

| Metric | Current Value | Threshold | Action | Priority |
|--------|---------------|-----------|---------|----------|
| CPU | > 70% | 70% | Scale Up | High |
| Memory | > 80% | 80% | Scale Up | High |
| Request Rate | > 100 req/sec/pod | 100 req/sec | Scale Up | Medium |
| Response Time | > 1s (p99) | 1s | Scale Up | High |
| Error Rate | > 5% | 5% | Scale Up | Critical |
| CPU | < 30% | 30% | Scale Down | Low |
| Memory | < 40% | 40% | Scale Down | Low |
| Request Rate | < 20 req/sec/pod | 20 req/sec | Scale Down | Low |

### Scaling Velocity

#### Scale-Up Velocity

```
Max Scale-Up Rate: 4 pods per 30 seconds
Emergency Scale-Up: 100% increase allowed
Stabilization Window: 60 seconds
```

#### Scale-Down Velocity

```
Max Scale-Down Rate: 2 pods per 90 seconds
Conservative Scale-Down: 10% decrease maximum
Stabilization Window: 300 seconds (5 minutes)
```

## Performance Optimization

### Resource Requests and Limits

```yaml
resources:
  requests:
    cpu: 200m      # 0.2 CPU cores
    memory: 256Mi  # 256 MB RAM
  limits:
    cpu: 1000m     # 1 CPU core
    memory: 1Gi    # 1 GB RAM
```

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: biopoint-api-pdb
  namespace: biopoint-production
spec:
  minAvailable: 2  # Minimum pods available during disruptions
  selector:
    matchLabels:
      app: biopoint-api
```

### Node Affinity and Anti-Affinity

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
        - key: app
          operator: In
          values:
          - biopoint-api
      topologyKey: kubernetes.io/hostname
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
        - key: node-type
          operator: In
          values:
          - compute-optimized
```

## Monitoring and Observability

### Key Scaling Metrics

#### Application Metrics

```
- http_requests_total (Counter)
- http_request_duration_seconds (Histogram)
- process_cpu_seconds_total (Counter)
- process_resident_memory_bytes (Gauge)
- nodejs_heap_size_used_bytes (Gauge)
```

#### Infrastructure Metrics

```
- kube_deployment_status_replicas (Gauge)
- kube_deployment_status_replicas_available (Gauge)
- kube_hpa_status_current_replicas (Gauge)
- kube_hpa_status_desired_replicas (Gauge)
- kube_pod_container_resource_requests (Gauge)
- kube_pod_container_resource_limits (Gauge)
```

#### Business Metrics

```
- biopoint_active_users (Gauge)
- biopoint_api_errors_total (Counter)
- biopoint_database_connections (Gauge)
- biopoint_external_api_calls (Counter)
```

### Alerting Rules

```yaml
# Scaling-related alerts
groups:
- name: scaling_alerts
  rules:
  - alert: HighCPUUtilization
    expr: avg(rate(container_cpu_usage_seconds_total[5m])) by (pod) > 0.8
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU utilization detected"
      description: "Pod {{ $labels.pod }} CPU usage is above 80%"
  
  - alert: HPAScalingLimitReached
    expr: kube_hpa_status_desired_replicas == kube_hpa_spec_max_replicas
    for: 10m
    labels:
      severity: critical
    annotations:
      summary: "HPA scaling limit reached"
      description: "HPA {{ $labels.hpa }} has reached maximum replicas"
  
  - alert: DatabaseConnectionPoolExhausted
    expr: pgbouncer_pools_client_active_connections / pgbouncer_pools_client_max_connections > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Database connection pool nearly exhausted"
      description: "PgBouncer pool is 90% utilized"
```

## Scaling Policies

### Predictive Scaling

Implement predictive scaling based on historical patterns:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biopoint-api-predictive-hpa
spec:
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 4
        periodSeconds: 30
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      selectPolicy: Min
```

### Scheduled Scaling

For predictable traffic patterns (e.g., business hours):

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: biopoint-scheduled-scale-up
  namespace: biopoint-production
spec:
  schedule: "0 8 * * 1-5"  # 8 AM on weekdays
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl:latest
            command:
            - kubectl
            - patch
            - hpa
            - biopoint-api-hpa
            - --type=merge
            - --patch={"spec":{"minReplicas":5}}
          restartPolicy: OnFailure
```

## Cost Optimization

### Resource Right-Sizing

#### Initial Sizing

```
Development: 0.1 CPU, 128Mi memory
Staging: 0.2 CPU, 256Mi memory
Production: 0.5 CPU, 512Mi memory (minimum)
```

#### Continuous Optimization

```bash
# Use VPA recommendations
kubectl get vpa biopoint-api-vpa -o yaml | \
  yq eval '.status.recommendation.containerRecommendations[0]' -

# Analyze resource usage
kubectl top pods -n biopoint-production --sort-by=cpu
kubectl top pods -n biopoint-production --sort-by=memory
```

### Spot Instance Integration

```yaml
# Mixed instance policy
nodeGroups:
  - name: biopoint-spot-nodes
    instanceType: mixed
    instancesDistribution:
      onDemandBaseCapacity: 2
      onDemandPercentageAboveBaseCapacity: 20
      spotInstancePools: 3
      instanceTypes:
        - c5.large
        - c5.xlarge
        - c5a.large
        - c5a.xlarge
```

## Disaster Recovery

### Multi-Region Failover

```yaml
# Regional deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: biopoint-api-deployment
  namespace: biopoint-production
  labels:
    app: biopoint-api
    region: us-east-1
    tier: primary
spec:
  replicas: 5  # Primary region has more replicas
  selector:
    matchLabels:
      app: biopoint-api
      region: us-east-1
```

### Database Failover

```yaml
# Database connection with failover
apiVersion: v1
kind: ConfigMap
metadata:
  name: database-failover-config
data:
  DATABASE_PRIMARY_URL: "postgresql://user:pass@neon-primary:5432/biopoint"
  DATABASE_STANDBY_URL: "postgresql://user:pass@neon-standby:5432/biopoint"
  DATABASE_FAILOVER_TIMEOUT: "30s"
  DATABASE_RETRY_ATTEMPTS: "3"
```

## Testing and Validation

### Load Testing

```bash
# Using k6 for load testing
k6 run --vus 100 --duration 5m --rps 1000 load-test.js

# Load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};

export default function() {
  let response = http.get('https://api.biopoint.com/health/api');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### Chaos Engineering

```yaml
# Chaos experiment configuration
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: biopoint-pod-failure
  namespace: biopoint-production
spec:
  action: pod-failure
  mode: random-max-percent
  value: "30"
  duration: "60s"
  selector:
    namespaces:
      - biopoint-production
    labelSelectors:
      app: biopoint-api
```

## Operational Procedures

### Scaling Events Response

#### High Traffic Event Checklist

1. **Pre-event (24 hours)**
   - [ ] Verify current scaling limits
   - [ ] Check resource quotas
   - [ ] Review monitoring dashboards
   - [ ] Prepare manual scaling commands

2. **During event**
   - [ ] Monitor HPA behavior
   - [ ] Watch for scaling limits
   - [ ] Check database connection pools
   - [ ] Monitor error rates

3. **Post-event**
   - [ ] Analyze scaling patterns
   - [ ] Review performance metrics
   - [ ] Document lessons learned
   - [ ] Update scaling parameters if needed

### Manual Scaling Commands

```bash
# Emergency scale-up
kubectl scale deployment biopoint-api-deployment --replicas=50 -n biopoint-production

# Emergency scale-down
kubectl scale deployment biopoint-api-deployment --replicas=3 -n biopoint-production

# Update HPA limits
kubectl patch hpa biopoint-api-hpa -n biopoint-production --type='json' \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 50}]'

# Disable HPA temporarily
kubectl patch hpa biopoint-api-hpa -n biopoint-production --type='json' \
  -p='[{"op": "replace", "path": "/spec/minReplicas", "value": 10}]'
```

This scaling configuration provides a robust, automated scaling system that can handle varying loads while maintaining cost efficiency and performance standards.