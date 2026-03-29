#!/bin/bash

# BioPoint Staging Deployment Script
# Usage: ./scripts/deploy-staging.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="biopoint-staging"
CLUSTER="biopoint-staging"
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
    
    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Get current Git commit SHA
    COMMIT_SHA=$(git rev-parse --short HEAD)
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    IMAGE_TAG="${TIMESTAMP}-${COMMIT_SHA}"
    
    # Build API image
    log_info "Building API image..."
    docker build -t "biopoint-api:${IMAGE_TAG}" -f apps/api/Dockerfile .
    docker tag "biopoint-api:${IMAGE_TAG}" "biopoint-api:latest"
    
    # Build mobile image
    log_info "Building mobile image..."
    docker build -t "biopoint-mobile:${IMAGE_TAG}" -f apps/mobile/Dockerfile .
    docker tag "biopoint-mobile:${IMAGE_TAG}" "biopoint-mobile:latest"
    
    log_success "Docker images built successfully"
    echo "IMAGE_TAG=${IMAGE_TAG}" > "$SCRIPT_DIR/.deployment-env"
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
    docker tag "biopoint-api:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-api:latest"
    docker push "${ECR_REGISTRY}/biopoint-api:${IMAGE_TAG}"
    docker push "${ECR_REGISTRY}/biopoint-api:latest"
    
    # Tag and push mobile image
    docker tag "biopoint-mobile:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-mobile:${IMAGE_TAG}"
    docker tag "biopoint-mobile:${IMAGE_TAG}" "${ECR_REGISTRY}/biopoint-mobile:latest"
    docker push "${ECR_REGISTRY}/biopoint-mobile:${IMAGE_TAG}"
    docker push "${ECR_REGISTRY}/biopoint-mobile:latest"
    
    log_success "Images pushed to registry successfully"
    echo "ECR_REGISTRY=${ECR_REGISTRY}" >> "$SCRIPT_DIR/.deployment-env"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    # Generate Prisma client
    doppler run -- npm run db:generate
    
    # Run migrations
    doppler run -- npm run db:migrate
    
    # Verify migrations
    doppler run -- npm run db:health
    
    log_success "Database migrations completed"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    source "$SCRIPT_DIR/.deployment-env"
    
    # Update kubeconfig
    aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER"
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply environment-specific configurations
    if [[ -f "k8s/${ENVIRONMENT}/configmap.yaml" ]]; then
        envsubst < "k8s/${ENVIRONMENT}/configmap.yaml" | kubectl apply -f -
    fi
    
    if [[ -f "k8s/${ENVIRONMENT}/secrets.yaml" ]]; then
        envsubst < "k8s/${ENVIRONMENT}/secrets.yaml" | kubectl apply -f -
    fi
    
    # Apply deployments
    if [[ -f "k8s/${ENVIRONMENT}/api-deployment.yaml" ]]; then
        envsubst < "k8s/${ENVIRONMENT}/api-deployment.yaml" | kubectl apply -f -
    fi
    
    if [[ -f "k8s/${ENVIRONMENT}/api-service.yaml" ]]; then
        envsubst < "k8s/${ENVIRONMENT}/api-service.yaml" | kubectl apply -f -
    fi
    
    if [[ -f "k8s/${ENVIRONMENT}/ingress.yaml" ]]; then
        envsubst < "k8s/${ENVIRONMENT}/ingress.yaml" | kubectl apply -f -
    fi
    
    # Wait for deployment to be ready
    kubectl rollout status deployment/biopoint-api -n "$NAMESPACE" --timeout=300s
    
    log_success "Kubernetes deployment completed"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Wait for services to be ready
    sleep 30
    
    # Run smoke tests script
    chmod +x "$SCRIPT_DIR/run-smoke-tests.sh"
    "$SCRIPT_DIR/run-smoke-tests.sh" "$ENVIRONMENT"
    
    log_success "Smoke tests passed"
}

# Health checks
health_checks() {
    log_info "Running health checks..."
    
    # Get service endpoint
    SERVICE_URL=$(kubectl get ingress biopoint-ingress -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "localhost")
    
    if [[ "$SERVICE_URL" != "localhost" ]]; then
        SERVICE_URL="https://${SERVICE_URL}"
        
        # Basic health check
        for i in {1..10}; do
            if curl -f "${SERVICE_URL}/health" >/dev/null 2>&1; then
                log_success "Service health check passed"
                break
            fi
            if [[ $i -eq 10 ]]; then
                log_error "Service health check failed after 10 attempts"
                exit 1
            fi
            sleep 10
        done
        
        # Database health check
        doppler run -- npm run db:health
        
        log_success "Health checks completed"
    else
        log_warning "Could not determine service URL, skipping external health checks"
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Remove temporary files
    rm -f "$SCRIPT_DIR/.deployment-env"
    
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
    
    # Get previous deployment
    PREVIOUS_REVISION=$(kubectl rollout history deployment/biopoint-api -n "$NAMESPACE" | tail -3 | head -1 | awk '{print $1}')
    
    if [[ -n "$PREVIOUS_REVISION" ]]; then
        log_info "Rolling back to revision $PREVIOUS_REVISION"
        kubectl rollout undo deployment/biopoint-api -n "$NAMESPACE" --to-revision="$PREVIOUS_REVISION"
        kubectl rollout status deployment/biopoint-api -n "$NAMESPACE" --timeout=300s
        log_success "Rollback completed"
    else
        log_error "Could not determine previous revision for rollback"
    fi
}

# Main deployment function
main() {
    log_info "Starting BioPoint staging deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Cluster: $CLUSTER"
    
    # Set up error handling
    trap rollback ERR
    
    # Run deployment steps
    check_prerequisites
    build_images
    push_images
    run_migrations
    deploy_to_kubernetes
    run_smoke_tests
    health_checks
    
    log_success "BioPoint staging deployment completed successfully!"
    
    # Cleanup
    cleanup
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi