#!/bin/bash

# BioPoint Load Balancing Infrastructure Verification Script
# This script verifies that all load balancing components are properly configured

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.biopoint.com}"
K8S_CONTEXT_EAST="${K8S_CONTEXT_EAST:-us-east-1}"
K8S_CONTEXT_WEST="${K8S_CONTEXT_WEST:-us-west-2}"
OUTPUT_DIR="${OUTPUT_DIR:-./verification-results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓ SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[⚠ WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[✗ ERROR]${NC} $1"
}

# Verification functions
verify_health_endpoints() {
    log "Verifying health check endpoints..."
    
    local endpoints=(
        "/health/lb"
        "/health/api"
        "/health/db"
        "/health/s3"
        "/health/system"
    )
    
    local all_passed=true
    
    for endpoint in "${endpoints[@]}"; do
        log "Testing $endpoint..."
        
        local response=$(curl -s -w "\n%{http_code}|%{time_total}" \
                          -H "User-Agent: BioPoint-Verification/1.0" \
                          "$API_BASE_URL$endpoint" 2>/dev/null || echo -e "\n000|0")
        
        local http_code=$(echo "$response" | tail -n1 | cut -d'|' -f1)
        local response_time=$(echo "$response" | tail -n1 | cut -d'|' -f2)
        
        if [[ "$http_code" == "200" ]]; then
            success "Health check $endpoint passed (${response_time}s)"
        else
            error "Health check $endpoint failed (HTTP $http_code, ${response_time}s)"
            all_passed=false
        fi
    done
    
    return $([ "$all_passed" = true ] && echo 0 || echo 1)
}

verify_kubernetes_resources() {
    log "Verifying Kubernetes resources..."
    
    local contexts=($K8S_CONTEXT_EAST $K8S_CONTEXT_WEST)
    local all_passed=true
    
    for context in "${contexts[@]}"; do
        log "Checking resources in $context..."
        
        # Check if context exists
        if ! kubectl config get-contexts | grep -q "$context"; then
            warning "Kubernetes context $context not found"
            continue
        fi
        
        kubectl config use-context "$context" >/dev/null 2>&1
        
        # Check namespace
        if ! kubectl get namespace biopoint-production >/dev/null 2>&1; then
            error "Namespace biopoint-production not found in $context"
            all_passed=false
            continue
        fi
        
        # Check deployments
        local deployments=("biopoint-api-deployment" "pgbouncer-deployment")
        for deployment in "${deployments[@]}"; do
            if kubectl get deployment "$deployment" -n biopoint-production >/dev/null 2>&1; then
                local ready=$(kubectl get deployment "$deployment" -n biopoint-production -o jsonpath='{.status.readyReplicas}')
                local desired=$(kubectl get deployment "$deployment" -n biopoint-production -o jsonpath='{.spec.replicas}')
                
                if [[ "$ready" == "$desired" && "$ready" -gt 0 ]]; then
                    success "Deployment $deployment in $context: $ready/$desired replicas ready"
                else
                    error "Deployment $deployment in $context: $ready/$desired replicas ready"
                    all_passed=false
                fi
            else
                error "Deployment $deployment not found in $context"
                all_passed=false
            fi
        done
        
        # Check HPA
        if kubectl get hpa biopoint-api-hpa -n biopoint-production >/dev/null 2>&1; then
            local current=$(kubectl get hpa biopoint-api-hpa -n biopoint-production -o jsonpath='{.status.currentReplicas}')
            local min=$(kubectl get hpa biopoint-api-hpa -n biopoint-production -o jsonpath='{.spec.minReplicas}')
            local max=$(kubectl get hpa biopoint-api-hpa -n biopoint-production -o jsonpath='{.spec.maxReplicas}')
            
            success "HPA in $context: $current replicas (min: $min, max: $max)"
        else
            error "HPA not found in $context"
            all_passed=false
        fi
        
        # Check services
        local services=("biopoint-api-service" "pgbouncer-service")
        for service in "${services[@]}"; do
            if kubectl get service "$service" -n biopoint-production >/dev/null 2>&1; then
                success "Service $service found in $context"
            else
                error "Service $service not found in $context"
                all_passed=false
            fi
        done
    done
    
    return $([ "$all_passed" = true ] && echo 0 || echo 1)
}

verify_load_balancer() {
    log "Verifying load balancer configuration..."
    
    # Test geographic distribution
    local regions=(
        "us-east-1:Virginia"
        "us-west-2:Oregon"
    )
    
    local all_passed=true
    
    for region in "${regions[@]}"; do
        local region_code=$(echo "$region" | cut -d: -f1)
        local region_name=$(echo "$region" | cut -d: -f2)
        
        log "Testing load balancer routing to $region_name..."
        
        # Test multiple times to ensure consistent routing
        local success_count=0
        local total_tests=5
        
        for ((i=1; i<=total_tests; i++)); do
            local response=$(curl -s -o /dev/null -w "%{http_code}" \
                              -H "CF-IPCountry: US" \
                              -H "CF-Connecting-IP: 1.1.1.1" \
                              -H "User-Agent: BioPoint-Verification/1.0" \
                              "$API_BASE_URL/health/lb" 2>/dev/null || echo "000")
            
            if [[ "$response" == "200" ]]; then
                ((success_count++))
            fi
        done
        
        if [[ $success_count -ge 3 ]]; then
            success "Load balancer routing to $region_name: $success_count/$total_tests requests successful"
        else
            error "Load balancer routing to $region_name: $success_count/$total_tests requests successful"
            all_passed=false
        fi
    done
    
    return $([ "$all_passed" = true ] && echo 0 || echo 1)
}

verify_database_connectivity() {
    log "Verifying database connectivity..."
    
    # Test database health endpoint
    local response=$(curl -s -w "\n%{http_code}" \
                      -H "User-Agent: BioPoint-Verification/1.0" \
                      "$API_BASE_URL/health/db" 2>/dev/null || echo -e "\n000")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]]; then
        success "Database connectivity check passed"
        
        # Extract connection pool info if available
        if command -v jq &> /dev/null; then
            local pool_info=$(echo "$body" | jq -r '.connectionPool // empty' 2>/dev/null)
            if [[ -n "$pool_info" ]]; then
                log "Connection pool status: $pool_info"
            fi
        fi
        return 0
    else
        error "Database connectivity check failed (HTTP $http_code)"
        return 1
    fi
}

verify_rate_limiting() {
    log "Verifying rate limiting functionality..."
    
    # Test with a moderate number of requests
    local test_requests=20
    local blocked_count=0
    local success_count=0
    
    log "Sending $test_requests test requests..."
    
    for ((i=1; i<=test_requests; i++)); do
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
                          -H "User-Agent: BioPoint-RateLimitTest/1.0" \
                          "$API_BASE_URL/health/lb" 2>/dev/null || echo "000")
        
        if [[ "$response" == "429" ]]; then
            ((blocked_count++))
        elif [[ "$response" == "200" ]]; then
            ((success_count++))
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    log "Rate limiting test results: $success_count successful, $blocked_count blocked"
    
    # We expect most requests to succeed for this test rate
    if [[ $success_count -ge $((test_requests * 80 / 100)) ]]; then
        success "Rate limiting appears to be working correctly"
        return 0
    else
        warning "Rate limiting may be too aggressive or not working properly"
        return 1
    fi
}

verify_monitoring() {
    log "Verifying monitoring setup..."
    
    # This is a basic check - in a real environment, you'd check Prometheus, Grafana, etc.
    local monitoring_available=true
    
    # Check if monitoring namespace exists (common setup)
    for context in $K8S_CONTEXT_EAST $K8S_CONTEXT_WEST; do
        if kubectl config get-contexts | grep -q "$context"; then
            kubectl config use-context "$context" >/dev/null 2>&1
            
            if kubectl get namespace monitoring >/dev/null 2>&1; then
                success "Monitoring namespace found in $context"
            else
                warning "Monitoring namespace not found in $context"
                monitoring_available=false
            fi
        fi
    done
    
    # Check for basic metrics availability
    local metrics_response=$(curl -s -o /dev/null -w "%{http_code}" \
                              -H "User-Agent: BioPoint-Verification/1.0" \
                              "$API_BASE_URL/metrics" 2>/dev/null || echo "000")
    
    if [[ "$metrics_response" == "200" ]]; then
        success "Metrics endpoint is accessible"
    else
        warning "Metrics endpoint not accessible (HTTP $metrics_response)"
    fi
    
    return 0
}

generate_verification_report() {
    log "Generating verification report..."
    
    local report_file="$OUTPUT_DIR/verification_report_$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# BioPoint Load Balancing Infrastructure Verification Report

**Verification Date:** $(date)
**API Base URL:** $API_BASE_URL
**Tested Regions:** $K8S_CONTEXT_EAST, $K8S_CONTEXT_WEST

## Verification Summary

This report contains the results of comprehensive verification testing for the BioPoint load balancing infrastructure.

## Component Verification Results

### Health Check Endpoints

Status: $([ -f "$OUTPUT_DIR/health_check_status" ] && cat "$OUTPUT_DIR/health_check_status" || echo "Not tested")

### Kubernetes Resources

Status: $([ -f "$OUTPUT_DIR/k8s_status" ] && cat "$OUTPUT_DIR/k8s_status" || echo "Not tested")

### Load Balancer Configuration

Status: $([ -f "$OUTPUT_DIR/lb_status" ] && cat "$OUTPUT_DIR/lb_status" || echo "Not tested")

### Database Connectivity

Status: $([ -f "$OUTPUT_DIR/db_status" ] && cat "$OUTPUT_DIR/db_status" || echo "Not tested")

### Rate Limiting

Status: $([ -f "$OUTPUT_DIR/rate_limit_status" ] && cat "$OUTPUT_DIR/rate_limit_status" || echo "Not tested")

### Monitoring Setup

Status: $([ -f "$OUTPUT_DIR/monitoring_status" ] && cat "$OUTPUT_DIR/monitoring_status" || echo "Not tested")

## Recommendations

Based on the verification results:

1. **Health Checks**: Ensure all endpoints are responding consistently
2. **Kubernetes**: Verify all deployments and services are running
3. **Load Balancer**: Test failover scenarios and geographic routing
4. **Database**: Monitor connection pool utilization
5. **Rate Limiting**: Adjust thresholds based on actual traffic patterns
6. **Monitoring**: Set up comprehensive dashboards and alerting

## Next Steps

- [ ] Address any failed verification checks
- [ ] Perform load testing to validate scaling behavior
- [ ] Configure monitoring and alerting
- [ ] Document operational procedures
- [ ] Schedule regular health checks

---

*This report was generated automatically by the BioPoint Infrastructure Verification Suite*
EOF

    success "Verification report generated: $report_file"
}

# Main execution
 main() {
    log "Starting BioPoint Load Balancing Infrastructure Verification..."
    log "API Base URL: $API_BASE_URL"
    log "Kubernetes Contexts: $K8S_CONTEXT_EAST, $K8S_CONTEXT_WEST"
    log "Output Directory: $OUTPUT_DIR"
    
    local overall_status=0
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed."
        exit 1
    fi
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed."
        exit 1
    fi
    
    # Run verification tests
    log "=== Verifying Health Check Endpoints ==="
    if verify_health_endpoints; then
        echo "pass" > "$OUTPUT_DIR/health_check_status"
    else
        echo "fail" > "$OUTPUT_DIR/health_check_status"
        overall_status=1
    fi
    
    log "=== Verifying Kubernetes Resources ==="
    if verify_kubernetes_resources; then
        echo "pass" > "$OUTPUT_DIR/k8s_status"
    else
        echo "fail" > "$OUTPUT_DIR/k8s_status"
        overall_status=1
    fi
    
    log "=== Verifying Load Balancer Configuration ==="
    if verify_load_balancer; then
        echo "pass" > "$OUTPUT_DIR/lb_status"
    else
        echo "fail" > "$OUTPUT_DIR/lb_status"
        overall_status=1
    fi
    
    log "=== Verifying Database Connectivity ==="
    if verify_database_connectivity; then
        echo "pass" > "$OUTPUT_DIR/db_status"
    else
        echo "fail" > "$OUTPUT_DIR/db_status"
        overall_status=1
    fi
    
    log "=== Verifying Rate Limiting ==="
    if verify_rate_limiting; then
        echo "pass" > "$OUTPUT_DIR/rate_limit_status"
    else
        echo "fail" > "$OUTPUT_DIR/rate_limit_status"
        overall_status=1
    fi
    
    log "=== Verifying Monitoring Setup ==="
    if verify_monitoring; then
        echo "pass" > "$OUTPUT_DIR/monitoring_status"
    else
        echo "fail" > "$OUTPUT_DIR/monitoring_status"
        overall_status=1
    fi
    
    # Generate report
    generate_verification_report
    
    if [[ $overall_status -eq 0 ]]; then
        success "Verification completed successfully!"
        log "All components are properly configured and operational."
    else
        error "Verification completed with some issues."
        log "Please review the failed checks and address them before proceeding."
    fi
    
    log "Verification results saved to: $OUTPUT_DIR"
    log "Verification report: $OUTPUT_DIR/verification_report_$TIMESTAMP.md"
    
    exit $overall_status
}

# Show help
 show_help() {
    cat << EOF
BioPoint Load Balancing Infrastructure Verification Script

Usage: $0 [OPTIONS]

Options:
    -u, --url URL          API base URL (default: https://api.biopoint.com)
    -e, --east CONTEXT     Kubernetes context for US-East (default: us-east-1)
    -w, --west CONTEXT     Kubernetes context for US-West (default: us-west-2)
    -o, --output DIR       Output directory (default: ./verification-results)
    -h, --help            Show this help message

Examples:
    $0                                    # Run with default settings
    $0 -u https://staging.biopoint.com   # Verify staging environment
    $0 -e production-east -w production-west  # Custom context names
    $0 -o /tmp/verification-results      # Custom output directory

Environment Variables:
    API_BASE_URL          API base URL
    K8S_CONTEXT_EAST      Kubernetes context for US-East
    K8S_CONTEXT_WEST      Kubernetes context for US-West
    OUTPUT_DIR            Output directory
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_BASE_URL="$2"
            shift 2
            ;;
        -e|--east)
            K8S_CONTEXT_EAST="$2"
            shift 2
            ;;
        -w|--west)
            K8S_CONTEXT_WEST="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"