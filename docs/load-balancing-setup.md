# BioPoint Load Balancing Setup Guide

## Overview

This document provides comprehensive instructions for setting up and configuring the load balancing infrastructure for BioPoint's production environment. The setup includes Cloudflare Load Balancing, Kubernetes Horizontal Pod Autoscaler (HPA), database connection pooling, and comprehensive monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Load Balancer (api.biopoint.com)           │  │
│  │  ┌─────────────────┐    ┌─────────────────┐             │  │
│  │  │  US-East Pool   │    │  US-West Pool   │             │  │
│  │  │  (Primary)      │    │  (Failover)     │             │  │
│  │  └────────┬────────┘    └────────┬────────┘             │  │
│  │           │                      │                       │  │
│  │           └──────────────────────┼───────────────────────┘  │
│  │                                  │                         │
│  └──────────────────────────────────┼─────────────────────────┘
│                                     │
└─────────────────────────────────────┼───────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
            ┌───────▼────┐     ┌──────▼────┐     ┌─────▼────┐
            │K8s Cluster │     │K8s Cluster│     │K8s Cluster│
            │US-East-1   │     │US-West-2  │     │(Future)  │
            └────────────┘     └───────────┘     └──────────┘
```

## Components

### 1. Cloudflare Load Balancer
- **Geographic Distribution**: US-East-1 (primary), US-West-2 (failover)
- **Health Checks**: GET /health/lb every 30 seconds
- **Failover Policy**: Least connections
- **Session Affinity**: JWT-based for authenticated users
- **Rate Limiting**: Global, per-IP, and per-user limits

### 2. Kubernetes Horizontal Pod Autoscaler
- **Min Pods**: 3
- **Max Pods**: 20
- **Scaling Triggers**: CPU > 70%, Memory > 80%, Request rate > 100 req/sec
- **Stabilization**: 5-minute scale-down window, 1-minute scale-up window

### 3. Database Connection Pooling
- **PgBouncer**: Transaction-level pooling
- **Neon Pool**: 20 connections
- **Prisma Pool**: 10 connections
- **Circuit Breaker**: Automatic failover on database failures

### 4. Health Check Endpoints
- `/health/lb`: Load balancer health check (lightweight)
- `/health/api`: Comprehensive API health check
- `/health/db`: Database connectivity check
- `/health/s3`: Storage system health check
- `/health/system`: Complete system health assessment

## Setup Instructions

### Prerequisites

1. **Cloudflare Account** with appropriate permissions
2. **Kubernetes Clusters** in US-East-1 and US-West-2
3. **Terraform** installed (version >= 1.0)
4. **kubectl** configured for both clusters
5. **Database** (Neon PostgreSQL) accessible from both regions

### Step 1: Cloudflare Load Balancer Setup

1. **Configure Terraform Variables**
   ```bash
   # Create terraform.tfvars file
   cat > infrastructure/cloudflare/terraform.tfvars << EOF
   cloudflare_zone_id = "your-zone-id"
   cloudflare_account_id = "your-account-id"
   cloudflare_api_token = "your-api-token"
   origin_server_east = "api-east.biopoint.com"
   origin_server_west = "api-west.biopoint.com"
   EOF
   ```

2. **Deploy Load Balancer**
   ```bash
   cd infrastructure/cloudflare
   terraform init
   terraform plan
   terraform apply
   ```

3. **Verify Configuration**
   ```bash
   # Check load balancer status
   curl -H "Authorization: Bearer YOUR_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/load_balancers"
   ```

### Step 2: Kubernetes Configuration

1. **Create Namespace and Secrets**
   ```bash
   # US-East-1 Cluster
   kubectl config use-context us-east-1
   kubectl create namespace biopoint-production
   
   # Create secrets
   kubectl create secret generic biopoint-secrets \
     --from-literal=database-url="postgresql://user:pass@host:5432/biopoint" \
     --from-literal=redis-url="redis://redis-cluster:6379" \
     --from-literal=database-host="your-neon-host" \
     --from-literal=database-user="your-user" \
     --from-literal=database-password="your-password" \
     --namespace=biopoint-production
   
   # US-West-2 Cluster
   kubectl config use-context us-west-2
   kubectl create namespace biopoint-production
   kubectl create secret generic biopoint-secrets \
     --from-literal=database-url="postgresql://user:pass@host:5432/biopoint" \
     --from-literal=redis-url="redis://redis-cluster:6379" \
     --from-literal=database-host="your-neon-host" \
     --from-literal=database-user="your-user" \
     --from-literal=database-password="your-password" \
     --namespace=biopoint-production
   ```

2. **Deploy PgBouncer (Database Connection Pooling)**
   ```bash
   # Deploy to both clusters
   kubectl apply -f infrastructure/k8s/hpa-pgbouncer.yaml
   
   # Verify deployment
   kubectl get pods -n biopoint-production -l app=pgbouncer
   kubectl get svc -n biopoint-production pgbouncer-service
   ```

3. **Deploy API with HPA**
   ```bash
   # Deploy to both clusters
   kubectl apply -f infrastructure/k8s/hpa.yaml
   
   # Verify deployment
   kubectl get pods -n biopoint-production -l app=biopoint-api
   kubectl get hpa -n biopoint-production biopoint-api-hpa
   ```

### Step 3: Health Check Implementation

1. **Add Health Routes to API**
   ```bash
   # Health routes should already be implemented in
   # apps/api/src/routes/health.routes.ts
   ```

2. **Update Main Application**
   ```typescript
   // In your main app file (e.g., app.ts or index.ts)
   import healthRoutes from './routes/health.routes';
   
   // Add health check routes
   app.use('/health', healthRoutes);
   ```

3. **Test Health Endpoints**
   ```bash
   # Test all health endpoints
   curl https://api.biopoint.com/health/lb
   curl https://api.biopoint.com/health/api
   curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" https://api.biopoint.com/health/db
   curl https://api.biopoint.com/health/s3
   curl https://api.biopoint.com/health/system
   ```

### Step 4: Monitoring and Alerting

1. **Set Up Prometheus/Grafana**
   ```bash
   # Install Prometheus Operator
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm install prometheus prometheus-community/kube-prometheus-stack \
     --namespace monitoring --create-namespace
   
   # Configure ServiceMonitor for BioPoint API
   kubectl apply -f - << EOF
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: biopoint-api
     namespace: monitoring
   spec:
     selector:
       matchLabels:
         app: biopoint-api
     endpoints:
     - port: http
       path: /metrics
       interval: 30s
   EOF
   ```

2. **Configure Alerts**
   ```yaml
   # Create alert rules
   apiVersion: monitoring.coreos.com/v1
   kind: PrometheusRule
   metadata:
     name: biopoint-alerts
     namespace: monitoring
   spec:
     groups:
     - name: biopoint-load-balancer
       interval: 30s
       rules:
       - alert: LoadBalancerHealthCheckFailed
         expr: up{job="biopoint-api"} == 0
         for: 2m
         labels:
           severity: critical
         annotations:
           summary: "Load balancer health check failed"
           description: "Health check has been failing for 2+ minutes"
       
       - alert: HighResponseTime
         expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
         for: 5m
         labels:
           severity: warning
         annotations:
           summary: "High response time detected"
           description: "P99 response time is above 1 second"
       
       - alert: DatabaseConnectionFailure
         expr: biopoint_db_health_check == 0
         for: 1m
         labels:
           severity: critical
         annotations:
           summary: "Database connection failure"
           description: "Cannot connect to database"
   ```

### Step 5: Testing and Validation

1. **Run Load Balancer Tests**
   ```bash
   # Make test script executable
   chmod +x infrastructure/scripts/test-load-balancer.sh
   
   # Run comprehensive tests
   ./infrastructure/scripts/test-load-balancer.sh \
     -u https://api.biopoint.com \
     -d 120 \
     -c 20 \
     -o ./test-results
   ```

2. **Test Failover Scenarios**
   ```bash
   # Simulate region failure
   # 1. Scale down US-East deployment
   kubectl scale deployment biopoint-api-deployment --replicas=0 -n biopoint-production
   
   # 2. Verify traffic routes to US-West
   curl -H "CF-IPCountry: US" https://api.biopoint.com/health/lb
   
   # 3. Restore US-East
   kubectl scale deployment biopoint-api-deployment --replicas=3 -n biopoint-production
   ```

3. **Test Auto-scaling**
   ```bash
   # Generate load to trigger scaling
   for i in {1..1000}; do
     curl -s -o /dev/null -w "%{http_code}" https://api.biopoint.com/health/api &
   done
   wait
   
   # Check HPA status
   kubectl get hpa biopoint-api-hpa -n biopoint-production -w
   ```

## Configuration Details

### Rate Limiting

| Limit Type | Threshold | Window | Action |
|------------|-----------|---------|---------|
| Global | 1000 req/sec | 1 second | Temporary block (5 min) |
| Per-IP | 100 req/sec | 1 second | Temporary block (5 min) |
| Per-User | 50 req/sec | 1 second | Temporary block (5 min) |

### Auto-scaling Parameters

| Metric | Threshold | Scale Action |
|--------|-----------|--------------|
| CPU | 70% | Scale up by 100% or 4 pods |
| Memory | 80% | Scale up by 100% or 4 pods |
| Request Rate | 100 req/sec/pod | Scale up by 100% or 4 pods |

### Health Check Intervals

| Endpoint | Interval | Timeout | Retries |
|----------|----------|---------|---------|
| /health/lb | 30s | 10s | 3 |
| /health/api | 60s | 15s | 3 |
| /health/db | 60s | 10s | 3 |
| /health/s3 | 120s | 15s | 2 |

## Monitoring Dashboards

### Key Metrics to Monitor

1. **Load Balancer Metrics**
   - Request distribution across regions
   - Health check success rates
   - Failover events
   - Response times by region

2. **Application Metrics**
   - Pod count and auto-scaling events
   - CPU and memory utilization
   - Request rate and latency
   - Error rates

3. **Database Metrics**
   - Connection pool usage
   - Query performance
   - Connection errors
   - Circuit breaker status

4. **Infrastructure Metrics**
   - Node resource utilization
   - Network throughput
   - Storage I/O
   - Regional availability

## Troubleshooting

### Common Issues

1. **Health Check Failures**
   ```bash
   # Check endpoint directly
   curl -v https://api.biopoint.com/health/lb
   
   # Check pod logs
   kubectl logs -n biopoint-production -l app=biopoint-api --tail=100
   
   # Check service endpoints
   kubectl get endpoints -n biopoint-production
   ```

2. **Auto-scaling Not Working**
   ```bash
   # Check HPA status
   kubectl describe hpa biopoint-api-hpa -n biopoint-production
   
   # Check metrics server
   kubectl top pods -n biopoint-production
   
   # Check HPA events
   kubectl get events -n biopoint-production --field-selector involvedObject.name=biopoint-api-hpa
   ```

3. **Database Connection Issues**
   ```bash
   # Check PgBouncer status
   kubectl logs -n biopoint-production -l app=pgbouncer
   
   # Test database connection
   kubectl exec -it deployment/biopoint-api-deployment -n biopoint-production -- \
     node -e "console.log('Testing DB connection...')"
   ```

4. **Rate Limiting Issues**
   ```bash
   # Check Cloudflare rate limiting rules
   curl -H "Authorization: Bearer YOUR_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/rate_limits"
   ```

## Security Considerations

1. **Network Security**
   - Use private subnets for application pods
   - Implement network policies
   - Enable TLS termination at load balancer
   - Use VPN for administrative access

2. **Access Control**
   - Implement RBAC for Kubernetes
   - Use service accounts with minimal permissions
   - Enable audit logging
   - Regular security reviews

3. **Data Protection**
   - Encrypt data in transit and at rest
   - Implement backup strategies
   - Use secrets management
   - Regular security assessments

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review monitoring dashboards
   - Check health check logs
   - Verify auto-scaling events
   - Review rate limiting logs

2. **Monthly**
   - Test failover scenarios
   - Update health check configurations
   - Review and optimize scaling parameters
   - Performance testing

3. **Quarterly**
   - Security audit
   - Capacity planning review
   - Disaster recovery testing
   - Documentation updates

### Updates and Patches

1. **Kubernetes Updates**
   ```bash
   # Check available updates
   kubectl version --short
   
   # Update node groups
   # Follow your cloud provider's update process
   ```

2. **Application Updates**
   ```bash
   # Update deployment
   kubectl set image deployment/biopoint-api-deployment \
     biopoint-api=biopoint/api:new-version \
     -n biopoint-production
   
   # Monitor rollout
   kubectl rollout status deployment/biopoint-api-deployment -n biopoint-production
   ```

## Support and Contacts

- **Infrastructure Team**: infrastructure@biopoint.com
- **DevOps Team**: devops@biopoint.com
- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Emergency**: Follow incident response procedures

## References

- [Cloudflare Load Balancing Documentation](https://developers.cloudflare.com/load-balancing/)
- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [PgBouncer Configuration](https://www.pgbouncer.org/config.html)
- [BioPoint Architecture Document](./architecture.md)
- [BioPoint Security Guidelines](./security.md)