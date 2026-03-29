#!/bin/bash

# BioPoint Smoke Tests Script
# Usage: ./scripts/run-smoke-tests.sh [environment] [base-url]

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-staging}
BASE_URL=${2:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

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

# Test result tracking
test_passed() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_success "✓ $1"
}

test_failed() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_error "✗ $1"
}

# Determine base URL
determine_base_url() {
    if [[ -n "$BASE_URL" ]]; then
        log_info "Using provided base URL: $BASE_URL"
        return
    fi
    
    case "$ENVIRONMENT" in
        staging)
            BASE_URL="https://api-staging.biopoint.health"
            ;;
        production)
            BASE_URL="https://api.biopoint.health"
            ;;
        *)
            if [[ -n "${SMOKE_TEST_URL:-}" ]]; then
                BASE_URL="$SMOKE_TEST_URL"
            else
                log_error "Unknown environment: $ENVIRONMENT"
                exit 1
            fi
            ;;
    esac
    
    log_info "Using base URL for $ENVIRONMENT: $BASE_URL"
}

# Health endpoint test
test_health_endpoint() {
    log_info "Testing health endpoint..."
    
    if curl -f -s "${BASE_URL}/health" >/dev/null 2>&1; then
        test_passed "Health endpoint is accessible"
        
        # Get detailed health info
        HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
        if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
            test_passed "Health endpoint reports healthy status"
        else
            test_failed "Health endpoint reports unhealthy status"
        fi
    else
        test_failed "Health endpoint is not accessible"
    fi
}

# Database connectivity test
test_database_connectivity() {
    log_info "Testing database connectivity..."
    
    if curl -f -s "${BASE_URL}/health/db" >/dev/null 2>&1; then
        DB_RESPONSE=$(curl -s "${BASE_URL}/health/db")
        if echo "$DB_RESPONSE" | jq -e '.connected == true' >/dev/null 2>&1; then
            test_passed "Database connectivity is working"
        else
            test_failed "Database connectivity is not working"
        fi
    else
        test_failed "Database health endpoint is not accessible"
    fi
}

# API endpoints test
test_api_endpoints() {
    log_info "Testing API endpoints..."
    
    # Test basic API endpoints
    endpoints=(
        "/api/v1/status"
        "/api/v1/info"
        "/api/docs"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "${BASE_URL}${endpoint}" >/dev/null 2>&1; then
            test_passed "API endpoint $endpoint is accessible"
        else
            test_failed "API endpoint $endpoint is not accessible"
        fi
    done
}

# Authentication test
test_authentication() {
    log_info "Testing authentication..."
    
    # Test unauthenticated access to protected endpoint
    if curl -f -s "${BASE_URL}/api/v1/users/me" >/dev/null 2>&1; then
        test_failed "Protected endpoint is accessible without authentication"
    else
        test_passed "Protected endpoint requires authentication"
    fi
    
    # Test authentication endpoint
    if curl -f -s -X POST "${BASE_URL}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"invalid"}' >/dev/null 2>&1; then
        test_passed "Authentication endpoint is accessible"
    else
        # Check if it's a 401 (which is expected for invalid credentials)
        RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"test@example.com","password":"invalid"}')
        
        if [[ "$RESPONSE_CODE" == "401" ]]; then
            test_passed "Authentication endpoint properly rejects invalid credentials"
        else
            test_failed "Authentication endpoint returned unexpected status: $RESPONSE_CODE"
        fi
    fi
}

# Security headers test
test_security_headers() {
    log_info "Testing security headers..."
    
    # Get headers from main endpoint
    HEADERS=$(curl -s -I "${BASE_URL}/health")
    
    required_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
    )
    
    for header in "${required_headers[@]}"; do
        if echo "$HEADERS" | grep -q "$header"; then
            test_passed "Security header $header is present"
        else
            test_failed "Security header $header is missing"
        fi
    done
}

# SSL/TLS test
test_ssl_tls() {
    log_info "Testing SSL/TLS configuration..."
    
    # Extract domain from URL
    DOMAIN=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)
    
    # Test SSL certificate
    if echo | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates >/dev/null 2>&1; then
        test_passed "SSL certificate is valid"
        
        # Check certificate expiration
        CERT_END_DATE=$(echo | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
        CERT_END_TIMESTAMP=$(date -d "$CERT_END_DATE" +%s)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (CERT_END_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
        
        if [[ $DAYS_UNTIL_EXPIRY -gt 30 ]]; then
            test_passed "SSL certificate expires in $DAYS_UNTIL_EXPIRY days (more than 30 days)"
        else
            test_warning "SSL certificate expires in $DAYS_UNTIL_EXPIRY days (less than 30 days)"
        fi
    else
        test_failed "SSL certificate is not valid"
    fi
}

# Performance test
test_performance() {
    log_info "Testing performance..."
    
    # Test response time for health endpoint
    START_TIME=$(date +%s%N)
    if curl -f -s "${BASE_URL}/health" >/dev/null 2>&1; then
        END_TIME=$(date +%s%N)
        RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds
        
        if [[ $RESPONSE_TIME -lt 1000 ]]; then
            test_passed "Health endpoint responds in ${RESPONSE_TIME}ms (under 1 second)"
        else
            test_warning "Health endpoint responds in ${RESPONSE_TIME}ms (over 1 second)"
        fi
    else
        test_failed "Health endpoint is not accessible for performance test"
    fi
}

# Content test
test_content() {
    log_info "Testing content..."
    
    # Test that API returns JSON
    if RESPONSE=$(curl -s "${BASE_URL}/health"); then
        if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
            test_passed "API returns valid JSON"
        else
            test_failed "API does not return valid JSON"
        fi
    else
        test_failed "Cannot test content - endpoint not accessible"
    fi
}

# Error handling test
test_error_handling() {
    log_info "Testing error handling..."
    
    # Test 404 handling
    RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/nonexistent-endpoint")
    
    if [[ "$RESPONSE_CODE" == "404" ]]; then
        test_passed "404 errors are handled correctly"
    else
        test_failed "404 errors are not handled correctly (got $RESPONSE_CODE)"
    fi
    
    # Test method not allowed
    RESPONSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BASE_URL}/health")
    
    if [[ "$RESPONSE_CODE" == "405" ]]; then
        test_passed "Method not allowed errors are handled correctly"
    else
        test_failed "Method not allowed errors are not handled correctly (got $RESPONSE_CODE)"
    fi
}

# Environment-specific tests
run_environment_tests() {
    case "$ENVIRONMENT" in
        staging)
            log_info "Running staging-specific tests..."
            
            # Test that staging has staging-specific configurations
            if curl -s "${BASE_URL}/health" | jq -e '.environment == "staging"' >/dev/null 2>&1; then
                test_passed "Environment is correctly identified as staging"
            else
                test_failed "Environment is not correctly identified as staging"
            fi
            ;;
            
        production)
            log_info "Running production-specific tests..."
            
            # Test that production has production-specific configurations
            if curl -s "${BASE_URL}/health" | jq -e '.environment == "production"' >/dev/null 2>&1; then
                test_passed "Environment is correctly identified as production"
            else
                test_failed "Environment is not correctly identified as production"
            fi
            
            # Test rate limiting
            log_info "Testing rate limiting..."
            for i in {1..10}; do
                curl -s "${BASE_URL}/health" >/dev/null 2>&1
            done
            
            RATE_LIMIT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
            if [[ "$RATE_LIMIT_RESPONSE" == "429" ]]; then
                test_passed "Rate limiting is working"
            else
                test_warning "Rate limiting may not be working (got $RATE_LIMIT_RESPONSE)"
            fi
            ;;
    esac
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    REPORT_FILE="smoke-test-report-${ENVIRONMENT}-${TIMESTAMP}.json"
    
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "baseUrl": "$BASE_URL",
  "summary": {
    "total": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "successRate": $(( TESTS_PASSED * 100 / TESTS_RUN ))
  },
  "status": "$([ $TESTS_FAILED -eq 0 ] && echo "PASSED" || echo "FAILED")"
}
EOF
    
    log_info "Test report generated: $REPORT_FILE"
    
    # Print summary
    echo ""
    echo "========================================="
    echo "           SMOKE TEST SUMMARY"
    echo "========================================="
    echo "Environment: $ENVIRONMENT"
    echo "Base URL: $BASE_URL"
    echo "Tests Run: $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Success Rate: $(( TESTS_PASSED * 100 / TESTS_RUN ))%"
    echo "========================================="
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All smoke tests passed!"
        return 0
    else
        log_error "$TESTS_FAILED smoke tests failed!"
        return 1
    fi
}

# Main test function
main() {
    log_info "Starting BioPoint smoke tests..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Base URL: ${BASE_URL:-not set}"
    
    # Determine base URL
    determine_base_url
    
    # Run tests
    test_health_endpoint
    test_database_connectivity
    test_api_endpoints
    test_authentication
    test_security_headers
    test_ssl_tls
    test_performance
    test_content
    test_error_handling
    run_environment_tests
    
    # Generate report
    generate_report
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi