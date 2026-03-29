# BioPoint Load Balancing Infrastructure - Deployment Checklist

## 🚀 Quick Deployment Guide

### Prerequisites ✅
- [ ] Cloudflare account with appropriate permissions
- [ ] Kubernetes clusters in US-East-1 and US-West-2
- [ ] Terraform installed (>= 1.0)
- [ ] kubectl configured for both clusters
- [ ] Database (Neon PostgreSQL) accessible from both regions
- [ ] Redis cluster accessible from both regions
- [ ] S3 bucket configured for storage

### Step 1: Cloudflare Load Balancer (5 minutes)
```bash
cd infrastructure/cloudflare
# Edit terraform.tfvars with your credentials
terraform init
terraform plan
terraform apply
```

### Step 2: Kubernetes Deployment (10 minutes)
```bash
# US-East-1 Cluster
kubectl config use-context us-east-1
kubectl create namespace biopoint-production
kubectl apply -f infrastructure/k8s/hpa-pgbouncer.yaml
kubectl apply -f infrastructure/k8s/hpa.yaml

# US-West-2 Cluster
kubectl config use-context us-west-2
kubectl create namespace biopoint-production
kubectl apply -f infrastructure/k8s/hpa-pgbouncer.yaml
kubectl apply -f infrastructure/k8s/hpa.yaml
```

### Step 3: Verification (5 minutes)
```bash
chmod +x infrastructure/scripts/verify-deployment.sh
./infrastructure/scripts/verify-deployment.sh
```

### Step 4: Load Testing (Optional, 10 minutes)
```bash
chmod +x infrastructure/scripts/test-load-balancer.sh
./infrastructure/scripts/test-load-balancer.sh -d 60 -c 10
```

## 📋 Pre-Deployment Checklist

### Infrastructure ✅
- [ ] Cloudflare API credentials configured
- [ ] Kubernetes contexts accessible
- [ ] Database connection strings available
- [ ] S3 bucket name confirmed
- [ ] Redis connection strings available

### Configuration ✅
- [ ] Domain name confirmed (api.biopoint.com)
- [ ] SSL certificates configured
- [ ] Environment variables set
- [ ] Secrets created in Kubernetes
- [ ] Monitoring tools configured

### Security ✅
- [ ] Network policies reviewed
- [ ] RBAC permissions verified
- [ ] Secrets encryption enabled
- [ ] Audit logging configured
- [ ] Access controls validated

## 🔧 Component Status

### Cloudflare Load Balancer
- **Status**: ✅ Ready to deploy
- **Location**: `infrastructure/cloudflare/load-balancer.tf`
- **Features**: Geographic failover, health checks, rate limiting

### Kubernetes HPA
- **Status**: ✅ Ready to deploy
- **Location**: `infrastructure/k8s/hpa.yaml`
- **Features**: Auto-scaling 3-20 pods, CPU/memory/request rate triggers

### PgBouncer (Database Pooling)
- **Status**: ✅ Ready to deploy
- **Location**: `infrastructure/k8s/hpa-pgbouncer.yaml`
- **Features**: Connection pooling, auto-scaling, circuit breaker

### Health Checks
- **Status**: ✅ Ready to deploy
- **Location**: `apps/api/src/routes/health.routes.ts`
- **Endpoints**: `/health/lb`, `/health/api`, `/health/db`, `/health/s3`, `/health/system`

### Testing Scripts
- **Status**: ✅ Ready to use
- **Location**: `infrastructure/scripts/`
- **Features**: Health verification, load testing, failover validation

## 📊 Key Configuration Values

### Scaling Parameters
```yaml
Min Replicas: 3
Max Replicas: 20
CPU Threshold: 70%
Memory Threshold: 80%
Request Rate: 100 req/sec/pod
```

### Rate Limiting
```yaml
Global: 1000 req/sec
Per-IP: 100 req/sec
Per-User: 50 req/sec
```

### Health Checks
```yaml
Load Balancer: /health/lb (30s interval)
API Health: /health/api (60s interval)
Database: /health/db (60s interval)
Storage: /health/s3 (120s interval)
```

## 🎯 Deployment Verification

### Quick Health Check
```bash
# Test all health endpoints
curl https://api.biopoint.com/health/lb
curl https://api.biopoint.com/health/api
curl https://api.biopoint.com/health/db
curl https://api.biopoint.com/health/s3
curl https://api.biopoint.com/health/system
```

### Kubernetes Status
```bash
# Check deployments
kubectl get deployments -n biopoint-production

# Check HPA
kubectl get hpa -n biopoint-production

# Check pods
kubectl get pods -n biopoint-production
```

### Load Balancer Status
```bash
# Check via Cloudflare API
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/load_balancers"
```

## 🚨 Common Issues and Solutions

### Issue: Health checks failing
**Solution**: Check pod logs and service endpoints
```bash
kubectl logs -n biopoint-production -l app=biopoint-api
kubectl get endpoints -n biopoint-production
```

### Issue: HPA not scaling
**Solution**: Check metrics server and resource usage
```bash
kubectl top pods -n biopoint-production
kubectl describe hpa biopoint-api-hpa -n biopoint-production
```

### Issue: Rate limiting too aggressive
**Solution**: Adjust Cloudflare rate limiting rules in Terraform
```hcl
# Update threshold values in load-balancer.tf
resource "cloudflare_rate_limit" "global_rate_limit" {
  threshold = 2000  # Increase from 1000
  # ...
}
```

### Issue: Database connection errors
**Solution**: Check PgBouncer status and connection pools
```bash
kubectl logs -n biopoint-production -l app=pgbouncer
kubectl get svc pgbouncer-service -n biopoint-production
```

## 📞 Emergency Contacts

- **Infrastructure Team**: infrastructure@biopoint.com
- **DevOps On-call**: Follow incident response procedures
- **Cloudflare Support**: Available via dashboard
- **Kubernetes Support**: Cloud provider support channels

## 📚 Documentation

- **Setup Guide**: `docs/load-balancing-setup.md`
- **Scaling Guide**: `docs/scaling-configuration.md`
- **Implementation Summary**: `infrastructure/IMPLEMENTATION_SUMMARY.md`
- **Verification Script**: `infrastructure/scripts/verify-deployment.sh`

## ✅ Post-Deployment Verification

### Immediate (within 5 minutes)
- [ ] All health check endpoints responding
- [ ] Kubernetes pods running in both regions
- [ ] Load balancer showing healthy status
- [ ] No error spikes in monitoring

### Short-term (within 1 hour)
- [ ] Auto-scaling events working
- [ ] Geographic routing functioning
- [ ] Rate limiting appropriate
- [ ] Database connections stable

### Long-term (within 24 hours)
- [ ] Performance metrics baseline established
- [ ] Alerting rules validated
- [ ] Failover scenarios tested
- [ ] Documentation updated

---

**Total Estimated Deployment Time**: **20-30 minutes**

**Next Steps After Deployment**:
1. Monitor metrics and alerts
2. Perform load testing
3. Train team on new procedures
4. Schedule regular health checks
5. Document any customizations

**Support**: Contact infrastructure team for any issues or questions