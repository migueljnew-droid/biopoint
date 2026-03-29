#!/bin/bash

# BioPoint Production Deployment Script
# Usage: ./scripts/deploy-production.sh [blue|green] [version]

set -euo pipefail

# Configuration
DEPLOYMENT_COLOR=${1:-}
VERSION=${2:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="biopoint-production"
CLUSTER="biopoint-production"
REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed"; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "docker is required but not installed"; exit 1; }
    command -v aws >/dev/null 2>&1 || { log_error "aws cli is required but not installed"; exit 1; }
    command -v doppler >/dev/null 2>&1 || { log_error "doppler is required but not installed"; exit 1; }
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { log_error "AWS credentials are not configured"; exit 1; }
    
    # Check Doppler authentication
    doppler configs list >/dev/null 2>&1 || { log_error "Doppler authentication failed"; exit 1; }
    
    # Check kubectl context
    kubectl cluster-info >/dev/null 2>&1 || { log_error "kubectl is not connected to a cluster"; exit 1; }
    
    # Verify production access
    kubectl auth can-i create deployments -n "$NAMESPACE" >/dev/null 2>&1 || { log_error "Insufficient permissions for production deployment"; exit 1; }
    
    log_success "Prerequisites check passed"
}

# Pre-deployment validation
pre_deployment_validation() {
    log_info "Running pre-deployment validation..."
    
    cd "$PROJECT_ROOT"
    
    # Run all tests
    log_info "Running test suite..."
    npm run test:all
    
    # Validate database migrations
    log_info "Validating database migrations..."
    doppler run -- npm run db:generate
    doppler run -- npm run db:migrate -- --dry-run
    
    # Security validation
    log_info "Running security validation..."
    npm run encryption:validate
    npm run encryption:check
    
    # Compliance check
    log_info "Running compliance check..."
    npm run test:compliance
    
    log_success "Pre-deployment validation completed"
}

# Determine deployment color
determine_deployment_color() {
    if [[ -z "$DEPLOYMENT_COLOR" ]]; then
        log_info "Determining deployment color..."
        
        # Get current active color
        CURRENT_ACTIVE=$(kubectl get service biopoint-production-service -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")
        
        if [[ "$CURRENT_ACTIVE" == "blue" ]]; then
            DEPLOYMENT_COLOR="green"
        else
            DEPLOYMENT_COLOR="blue"
        fi
        
        log_info "Deploying to $DEPLOYMENT_COLOR environment"
    fi
    
    echo "DEPLOYMENT_COLOR=$DEPLOYMENT_COLOR" > "$SCRIPT_DIR/.deployment-env"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Get current Git commit SHA
    COMMIT_SHA=$(git rev-parse --short HEAD)
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    IMAGE_TAG="${TIMESTAMP}-${COMMIT_SHA}"
    
    if [[ -n "$VERSION" ]]; then
        IMAGE_TAG="$VERSION"
    fi
    
    # Build API image
    log_info "Building API image..."
    docker build -t "biopoint-api:${IMAGE_TAG}" -f apps/api/Dockerfile .
    docker tag "biopoint-api:${IMAGE_TAG}" "biopoint-api:production"
    
    # Build mobile image
    log_info "Building mobile image..."
    docker build -t "biopoint-mobile:${IMAGE_TAG}" -f apps/mobile/Dockerfile .
    docker tag "biopoint-mobile:${IMAGE_TAG}" "biopoint-mobile:production"
    
    log_success "Docker images built successfully"
    echo "IMAGE_TAG=${IMAGE_TAG}" >> "$SCRIPT_DIR/.deployment-env"
}

# Push images to registry
push_images() {
    log_info "Pushing images to registry..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Get ECR login token
    ECR_REGISTRY="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${REGION}.amazonaws.com"
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
    
    # Tag and push API image
    docker tag "biopoint-api:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-api:${IMAGE_TAG}"
    docker tag "biopoint-api:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-api:production"
    docker push "${ECR_REGISTRY}/biopoint-api:${IMAGE_TAG}"
    docker push "${ECR_REGISTRY}/biopoint-api:production"
    
    # Tag and push mobile image
    docker tag "biopoint-mobile:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-mobile:${IMAGE_TAG}"
    docker tag "biopoint-mobile:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-mobile:production"
    docker push "${ECR_REGISTRY}/biopoint-mobile:${IMAGE_TAG}"
    docker push "${ECR_REGISTRY}/biopoint-mobile:production"
    
    log_success "Images pushed to registry successfully"
    echo "ECR_REGISTRY=${ECR_REGISTRY}" >> "$SCRIPT_DIR/.deployment-env"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Generate Prisma client
    doppler run -- npm run db:generate
    
    # Run migrations with backup first
    log_info "Creating database backup before migration..."
    doppler run -- npm run db:backup || log_warning "Database backup failed, continuing with migration"
    
    # Run migrations
    doppler run -- npm run db:migrate
    
    # Verify migrations
    doppler run -- npm run db:health
    
    log_success "Database migrations completed"
}

# Deploy to Kubernetes (Blue-Green)
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes ($DEPLOYMENT_COLOR)..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER"
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply environment-specific configurations
    if [[ -f "k8s/production/configmap-${DEPLOYMENT_COLOR}.yaml" ]]; then
        envsubst < "k8s/production/configmap-${DEPLOYMENT_COLOR}.yaml" | kubectl apply -f -
    fi
    
    if [[ -f "k8s/production/secrets-${DEPLOYMENT_COLOR}.yaml" ]]; then
        envsubst < "k8s/production/secrets-${DEPLOYMENT_COLOR}.yaml" | kubectl apply -f -
    fi
    
    # Apply deployments
    if [[ -f "k8s/production/api-deployment-${DEPLOYMENT_COLOR}.yaml" ]]; then
        envsubst < "k8s/production/api-deployment-${DEPLOYMENT_COLOR}.yaml" | kubectl apply -f -
    fi
    
    if [[ -f "k8s/production/api-service-${DEPLOYMENT_COLOR}.yaml" ]]; then
        envsubst < "k8s/production/api-service-${DEPLOYMENT_COLOR}.yaml" | kubectl apply -f -
    fi
    
    # Wait for deployment to be ready
    kubectl rollout status deployment/biopoint-api-${DEPLOYMENT_COLOR} -n "$NAMESPACE" --timeout=600s
    
    log_success "Kubernetes deployment completed"
}

# Run production smoke tests
run_smoke_tests() {
    log_info "Running production smoke tests..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Get service endpoint for new deployment
    SMOKE_TEST_URL=$(kubectl get service biopoint-api-${DEPLOYMENT_COLOR} -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [[ -n "$SMOKE_TEST_URL" ]]; then
        # Run smoke tests against new deployment
        chmod +x "$SCRIPT_DIR/run-smoke-tests.sh"
        DEPLOYMENT_COLOR="${DEPLOYMENT_COLOR}" SMOKE_TEST_URL="${SMOKE_TEST_URL}" "$SCRIPT_DIR/run-smoke-tests.sh" production
    else
        log_warning "Could not determine service URL for smoke tests, skipping"
    fi
    
    log_success "Production smoke tests completed"
}

# Switch traffic (Blue-Green)
switch_traffic() {
    log_info "Switching traffic to $DEPLOYMENT_COLOR deployment..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Update the main service to point to new deployment
    kubectl patch service biopoint-production-service -n "$NAMESPACE" -p '{"spec":{"selector":{"color":"'${DEPLOYMENT_COLOR}'"}}}'
    
    # Wait for traffic switch
    sleep 30
    
    # Verify traffic is flowing
    PRODUCTION_URL="https://api.biopoint.health"
    
    log_info "Verifying traffic switch..."
    for i in {1..10}; do
        if curl -f "${PRODUCTION_URL}/health" >/dev/null 2>&1; then
            log_success "Traffic switch successful"
            break
        fi
        if [[ $i -eq 10 ]]; then
            log_error "Traffic switch failed"
            exit 1
        fi
        sleep 10
    done
    
    log_success "Traffic switched successfully"
}

# Cleanup old deployment
cleanup_old_deployment() {
    log_info "Cleaning up old deployment..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Determine which color to cleanup (the inactive one)
    if [[ "$DEPLOYMENT_COLOR" == "blue" ]]; then
        CLEANUP_COLOR="green"
    else
        CLEANUP_COLOR="blue"
    fi
    
    # Scale down old deployment
    kubectl scale deployment/biopoint-api-${CLEANUP_COLOR} -n "$NAMESPACE" --replicas=0
    
    log_success "Old deployment cleaned up"
}

# Post-deployment validation
post_deployment_validation() {
    log_info "Running post-deployment validation..."
    
    # Comprehensive health checks
    PRODUCTION_URL="https://api.biopoint.health"
    
    # Basic health check
    curl -f "${PRODUCTION_URL}/health" || { log_error "Health check failed"; exit 1; }
    
    # Database health check
    doppler run -- npm run db:health || { log_error "Database health check failed"; exit 1; }
    
    # Security validation
    npm run encryption:validate || { log_error "Encryption validation failed"; exit 1; }
    
    # Run critical E2E tests
    npm run test:e2e -- --grep "@critical" || { log_error "Critical E2E tests failed"; exit 1; }
    
    log_success "Post-deployment validation completed"
}

# Create deployment record
create_deployment_record() {
    log_info "Creating deployment record..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    DEPLOYMENT_ID=$(date +%s)
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    COMMIT_SHA=$(git rev-parse HEAD)
    COMMIT_MESSAGE=$(git log -1 --pretty=%B)
    
    cat > production-deployment-record.json << EOF
{
  "deploymentId": "$DEPLOYMENT_ID",
  "timestamp": "$TIMESTAMP",
  "environment": "production",
  "commitSha": "$COMMIT_SHA",
  "commitMessage": "$COMMIT_MESSAGE",
  "deployedBy": "$(whoami)",
  "status": "success",
  "imageTag": "$IMAGE_TAG",
  "version": "$VERSION",
  "deploymentColor": "$DEPLOYMENT_COLOR",
  "rollbackAvailable": true
}
EOF
    
    # Store deployment record in S3
    aws s3 cp production-deployment-record.json "s3://biopoint-deployments/production/${COMMIT_SHA}.json"
    
    log_success "Deployment record created"
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -f "$SCRIPT_DIR/.deployment-env"
    rm -f production-deployment-record.json
    
    # Cleanup old Docker images (keep last 5)
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" | \
        grep "biopoint-" | \
        tail -n +6 | \
        awk '{print $3}' | \
        xargs -r docker rmi -f 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Rollback function
rollback() {
    log_error "Deployment failed. Initiating rollback..."
    
    source "$SCRIPT_DIR/.deployment-env" 2>/dev/null || return
    
    # Switch traffic back to previous deployment
    if [[ "${DEPLOYMENT_COLOR:-}" == "blue" ]]; then
        ROLLBACK_COLOR="green"
    else
        ROLLBACK_COLOR="blue"
    fi
    
    log_info "Rolling back to $ROLLBACK_COLOR deployment..."
    kubectl patch service biopoint-production-service -n "$NAMESPACE" -p '{"spec":{"selector":{"color":"'${ROLLBACK_COLOR}'"}}}'
    
    # Wait for rollback to complete
    sleep 30
    
    # Verify rollback
    PRODUCTION_URL="https://api.biopoint.health"
    if curl -f "${PRODUCTION_URL}/health" >/dev/null 2>&1; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback verification failed"
    fi
    
    exit 1
}

# Main deployment function
main() {
    log_info "Starting BioPoint production deployment..."
    log_info "Deployment Color: $DEPLOYMENT_COLOR"
    log_info "Version: ${VERSION:-latest}"
    log_info "Namespace: $NAMESPACE"
    log_info "Cluster: $CLUSTER"
    
    # Set up error handling
    trap rollback ERR
    
    # Run deployment steps
    check_prerequisites
    pre_deployment_validation
    determine_deployment_color
    build_images
    push_images
    run_migrations
    deploy_to_kubernetes
    run_smoke_tests
    switch_traffic
    cleanup_old_deployment
    post_deployment_validation
    create_deployment_record
    
    log_success "BioPoint production deployment completed successfully!"
    log_info "Deployment Color: $DEPLOYMENT_COLOR"
    log_info "Version: ${VERSION:-latest}"
    
    # Cleanup
    cleanup
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi