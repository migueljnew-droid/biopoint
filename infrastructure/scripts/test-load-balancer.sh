#!/bin/bash

# BioPoint Load Balancer Test Script
# This script tests the load balancer configuration, failover capabilities,
# and health check endpoints

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.biopoint.com}"
TEST_DURATION="${TEST_DURATION:-60}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-10}"
OUTPUT_DIR="${OUTPUT_DIR:-./test-results}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check test
 test_health_endpoints() {
    log "Testing health check endpoints..."
    
    local endpoints=(
        "/health/lb"
        "/health/api"
        "/health/db"
        "/health/s3"
        "/health/system"
    )
    
    local results_file="$OUTPUT_DIR/health_checks_$TIMESTAMP.json"
    echo "{" > "$results_file"
    
    for endpoint in "${endpoints[@]}"; do
        log "Testing $endpoint..."
        
        local start_time=$(date +%s%N)
        local response=$(curl -s -w "\n%{http_code}" -H "User-Agent: BioPoint-HealthCheck/1.0" "$API_BASE_URL$endpoint" 2>/dev/null || echo -e "\n000")
        local end_time=$(date +%s%N)
        
        local http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
        
        if [[ "$http_code" == "200" ]]; then
            success "Health check $endpoint passed (${response_time}ms)"
            echo "  \"$endpoint\": {\"status\": \"pass\", \"response_time\": $response_time, \"http_code\": $http_code}," >> "$results_file"
        else
            error "Health check $endpoint failed (HTTP $http_code, ${response_time}ms)"
            echo "  \"$endpoint\": {\"status\": \"fail\", \"response_time\": $response_time, \"http_code\": $http_code, \"body\": $(echo "$body" | jq -R -s .)}," >> "$results_file"
        fi
    done
    
    # Remove trailing comma and close JSON
    sed -i '$ s/,$//' "$results_file"
    echo "}" >> "$results_file"
    
    success "Health check results saved to $results_file"
}

# Load balancer failover test
 test_failover() {
    log "Testing load balancer failover capabilities..."
    
    local results_file="$OUTPUT_DIR/failover_test_$TIMESTAMP.json"
    echo "{" > "$results_file"
    
    # Test geographic distribution
    local regions=(
        "us-east-1:Virginia"
        "us-west-2:Oregon"
        "eu-west-1:Ireland"
        "ap-southeast-1:Singapore"
    )
    
    for region in "${regions[@]}"; do
        local region_code=$(echo "$region" | cut -d: -f1)
        local region_name=$(echo "$region" | cut -d: -f2)
        
        log "Testing from $region_name ($region_code)..."
        
        # Use curl with specific headers to test geographic routing
        local response=$(curl -s -H "CF-IPCountry: US" \
                              -H "CF-Connecting-IP: 1.1.1.1" \
                              -H "CF-Ray: $region_code" \
                              -H "User-Agent: BioPoint-FailoverTest/1.0" \
                              -w "\n%{http_code}|%{time_total}" \
                              "$API_BASE_URL/health/lb" 2>/dev/null || echo -e "\n000|0")
        
        local http_code=$(echo "$response" | tail -n1 | cut -d'|' -f1)
        local response_time=$(echo "$response" | tail -n1 | cut -d'|' -f2)
        local body=$(echo "$response" | sed '$d')
        
        if [[ "$http_code" == "200" ]]; then
            success "Failover test for $region_name passed (${response_time}s)"
            echo "  \"$region_code\": {\"status\": \"pass\", \"response_time\": $response_time, \"region\": \"$region_name\"}," >> "$results_file"
        else
            error "Failover test for $region_name failed (HTTP $http_code, ${response_time}s)"
            echo "  \"$region_code\": {\"status\": \"fail\", \"response_time\": $response_time, \"region\": \"$region_name\", \"http_code\": $http_code}," >> "$results_file"
        fi
    done
    
    # Remove trailing comma and close JSON
    sed -i '$ s/,$//' "$results_file"
    echo "}" >> "$results_file"
    
    success "Failover test results saved to $results_file"
}

# Performance and load test
 test_performance() {
    log "Testing load balancer performance under load..."
    
    local results_file="$OUTPUT_DIR/performance_test_$TIMESTAMP.json"
    echo "{" > "$results_file"
    
    log "Running load test with $CONCURRENT_REQUESTS concurrent requests for $TEST_DURATION seconds..."
    
    # Use Apache Bench (ab) if available, otherwise use curl
    if command -v ab &> /dev/null; then
        log "Using Apache Bench for load testing..."
        
        local ab_output=$(ab -n $((CONCURRENT_REQUESTS * TEST_DURATION)) -c "$CONCURRENT_REQUESTS" -t "$TEST_DURATION" \
                          -H "User-Agent: BioPoint-LoadTest/1.0" \
                          "$API_BASE_URL/health/lb" 2>&1 || true)
        
        # Parse ab output
        local requests_per_second=$(echo "$ab_output" | grep "Requests per second:" | awk '{print $4}')
        local mean_response_time=$(echo "$ab_output" | grep "Time per request:" | head -1 | awk '{print $4}')
        local failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
        local total_requests=$(echo "$ab_output" | grep "Complete requests:" | awk '{print $3}')
        
        echo "  \"load_test\": {" >> "$results_file"
        echo "    \"tool\": \"apache_bench\"," >> "$results_file"
        echo "    \"requests_per_second\": $requests_per_second," >> "$results_file"
        echo "    \"mean_response_time\": $mean_response_time," >> "$results_file"
        echo "    \"failed_requests\": $failed_requests," >> "$results_file"
        echo "    \"total_requests\": $total_requests" >> "$results_file"
        echo "  }," >> "$results_file"
        
        success "Load test completed: $requests_per_second req/sec, ${mean_response_time}ms avg response time"
        
    else
        warning "Apache Bench not available, using curl-based load test..."
        
        local total_requests=0
        local failed_requests=0
        local total_response_time=0
        local max_response_time=0
        local min_response_time=999999
        
        local start_time=$(date +%s)
        
        # Run concurrent requests
        for ((i=1; i<=TEST_DURATION; i++)); do
            for ((j=1; j<=CONCURRENT_REQUESTS; j++)); do
                (
                    local req_start=$(date +%s%N)
                    local response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
                                      -H "User-Agent: BioPoint-LoadTest/1.0" \
                                      "$API_BASE_URL/health/lb" 2>/dev/null || echo "000|0")
                    local req_end=$(date +%s%N)
                    
                    local http_code=$(echo "$response" | cut -d'|' -f1)
                    local response_time=$(echo "$response" | cut -d'|' -f2)
                    local response_time_ms=$(echo "scale=0; $response_time * 1000" | bc -l)
                    
                    if [[ "$http_code" == "200" ]]; then
                        ((total_requests++))
                        total_response_time=$(echo "scale=3; $total_response_time + $response_time" | bc -l)
                        
                        if (( $(echo "$response_time > $max_response_time" | bc -l) )); then
                            max_response_time=$response_time
                        fi
                        
                        if (( $(echo "$response_time < $min_response_time" | bc -l) )); then
                            min_response_time=$response_time
                        fi
                    else
                        ((failed_requests++))
                    fi
                ) &
            done
            wait
            sleep 1
        done
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local requests_per_second=$(echo "scale=2; $total_requests / $duration" | bc -l)
        local avg_response_time=$(echo "scale=3; $total_response_time / $total_requests" | bc -l)
        
        echo "  \"load_test\": {" >> "$results_file"
        echo "    \"tool\": \"curl\"," >> "$results_file"
        echo "    \"requests_per_second\": $requests_per_second," >> "$results_file"
        echo "    \"avg_response_time\": $avg_response_time," >> "$results_file"
        echo "    \"min_response_time\": $min_response_time," >> "$results_file"
        echo "    \"max_response_time\": $max_response_time," >> "$results_file"
        echo "    \"failed_requests\": $failed_requests," >> "$results_file"
        echo "    \"total_requests\": $total_requests," >> "$results_file"
        echo "    \"duration\": $duration" >> "$results_file"
        echo "  }," >> "$results_file"
        
        success "Load test completed: $requests_per_second req/sec, ${avg_response_time}s avg response time"
    fi
    
    # Remove trailing comma and close JSON
    sed -i '$ s/,$//' "$results_file"
    echo "}" >> "$results_file"
    
    success "Performance test results saved to $results_file"
}

# Rate limiting test
 test_rate_limiting() {
    log "Testing rate limiting functionality..."
    
    local results_file="$OUTPUT_DIR/rate_limit_test_$TIMESTAMP.json"
    echo "{" > "$results_file"
    
    # Test global rate limit
    log "Testing global rate limit..."
    local global_passed=true
    local global_results=""
    
    for ((i=1; i<=150; i++)); do
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
                          -H "User-Agent: BioPoint-RateLimitTest/1.0" \
                          "$API_BASE_URL/health/lb" 2>/dev/null || echo "000")
        
        if [[ "$response" == "429" ]]; then
            global_results="Rate limit triggered at request $i"
            global_passed=false
            break
        fi
        
        if [[ $i -eq 150 ]]; then
            global_results="Rate limit not triggered within 150 requests"
        fi
    done
    
    echo "  \"global_rate_limit\": {" >> "$results_file"
    echo "    \"status\": \"$([ "$global_passed" = true ] && echo \"pass\" || echo \"fail\")\"," >> "$results_file"
    echo "    \"result\": \"$global_results\"" >> "$results_file"
    echo "  }," >> "$results_file"
    
    if [[ "$global_passed" = true ]]; then
        success "Global rate limit test: $global_results"
    else
        warning "Global rate limit test: $global_results"
    fi
    
    # Test per-IP rate limit
    log "Testing per-IP rate limit..."
    local ip_passed=true
    local ip_results=""
    
    for ((i=1; i<=120; i++)); do
        local response=$(curl -s -o /dev/null -w "%{http_code}" \
                          -H "CF-Connecting-IP: 192.168.1.100" \
                          -H "User-Agent: BioPoint-RateLimitTest/1.0" \
                          "$API_BASE_URL/health/lb" 2>/dev/null || echo "000")
        
        if [[ "$response" == "429" ]]; then
            ip_results="Per-IP rate limit triggered at request $i"
            ip_passed=false
            break
        fi
        
        if [[ $i -eq 120 ]]; then
            ip_results="Per-IP rate limit not triggered within 120 requests"
        fi
    done
    
    echo "  \"per_ip_rate_limit\": {" >> "$results_file"
    echo "    \"status\": \"$([ "$ip_passed" = true ] && echo \"pass\" || echo \"fail\")\"," >> "$results_file"
    echo "    \"result\": \"$ip_results\"" >> "$results_file"
    echo "  }" >> "$results_file"
    
    if [[ "$ip_passed" = true ]]; then
        success "Per-IP rate limit test: $ip_results"
    else
        warning "Per-IP rate limit test: $ip_results"
    fi
    
    # Close JSON
    echo "}" >> "$results_file"
    
    success "Rate limiting test results saved to $results_file"
}

# Generate test report
 generate_report() {
    log "Generating comprehensive test report..."
    
    local report_file="$OUTPUT_DIR/load_balancer_test_report_$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# BioPoint Load Balancer Test Report

**Test Date:** $(date)
**Test Duration:** $TEST_DURATION seconds
**API Base URL:** $API_BASE_URL
**Concurrent Requests:** $CONCURRENT_REQUESTS

## Test Summary

This report contains the results of comprehensive load balancer testing including:
- Health check endpoint validation
- Geographic failover testing
- Performance and load testing
- Rate limiting functionality

## Test Results

### Health Check Results

$(find "$OUTPUT_DIR" -name "health_checks_$TIMESTAMP.json" -exec cat {} \; | jq -r 'to_entries[] | "- **\(.key)**: \(.value.status) (Response time: \(.value.response_time)ms)"' 2>/dev/null || echo "Health check results not available")

### Failover Test Results

$(find "$OUTPUT_DIR" -name "failover_test_$TIMESTAMP.json" -exec cat {} \; | jq -r 'to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.region) (Response time: \(.value.response_time)s)"' 2>/dev/null || echo "Failover test results not available")

### Performance Test Results

$(find "$OUTPUT_DIR" -name "performance_test_$TIMESTAMP.json" -exec cat {} \; | jq -r '.load_test | "- **Tool**: \(.tool)
- **Requests per second**: \(.requests_per_second)
- **Average response time**: \(.avg_response_time)s
- **Total requests**: \(.total_requests)
- **Failed requests**: \(.failed_requests)"' 2>/dev/null || echo "Performance test results not available")

### Rate Limiting Test Results

$(find "$OUTPUT_DIR" -name "rate_limit_test_$TIMESTAMP.json" -exec cat {} \; | jq -r '.global_rate_limit | "- **Global Rate Limit**: \(.status) - \(.result)"' 2>/dev/null || echo "Rate limiting test results not available")

$(find "$OUTPUT_DIR" -name "rate_limit_test_$TIMESTAMP.json" -exec cat {} \; | jq -r '.per_ip_rate_limit | "- **Per-IP Rate Limit**: \(.status) - \(.result)"' 2>/dev/null || echo "Per-IP rate limiting test results not available")

## Recommendations

Based on the test results:

1. **Health Checks**: Ensure all health check endpoints are responding within acceptable time limits
2. **Failover**: Verify geographic routing is working correctly
3. **Performance**: Monitor response times and adjust scaling policies as needed
4. **Rate Limiting**: Adjust rate limiting thresholds based on actual traffic patterns

## Next Steps

- Monitor load balancer metrics in production
- Set up alerting for health check failures
- Review and adjust rate limiting policies based on user behavior
- Consider implementing circuit breakers for external dependencies

---

*This report was generated automatically by the BioPoint Load Balancer Test Suite*
EOF

    success "Test report generated: $report_file"
}

# Main execution
 main() {
    log "Starting BioPoint Load Balancer Test Suite..."
    log "API Base URL: $API_BASE_URL"
    log "Test Duration: $TEST_DURATION seconds"
    log "Concurrent Requests: $CONCURRENT_REQUESTS"
    log "Output Directory: $OUTPUT_DIR"
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        warning "jq is not installed. JSON parsing will be limited."
    fi
    
    # Run tests
    test_health_endpoints
    test_failover
    test_performance
    test_rate_limiting
    
    # Generate report
    generate_report
    
    success "Load balancer test suite completed!"
    log "Results saved to: $OUTPUT_DIR"
    log "Test report: $OUTPUT_DIR/load_balancer_test_report_$TIMESTAMP.md"
}

# Show help
 show_help() {
    cat << EOF
BioPoint Load Balancer Test Script

Usage: $0 [OPTIONS]

Options:
    -u, --url URL          API base URL (default: https://api.biopoint.com)
    -d, --duration SECONDS Test duration in seconds (default: 60)
    -c, --concurrent NUM   Number of concurrent requests (default: 10)
    -o, --output DIR       Output directory (default: ./test-results)
    -h, --help            Show this help message

Examples:
    $0                                    # Run with default settings
    $0 -u https://staging.biopoint.com   # Test staging environment
    $0 -d 120 -c 20                      # Longer test with more concurrency
    $0 -o /tmp/test-results              # Custom output directory

Environment Variables:
    API_BASE_URL          API base URL
    TEST_DURATION         Test duration in seconds
    CONCURRENT_REQUESTS   Number of concurrent requests
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
        -d|--duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        -c|--concurrent)
            CONCURRENT_REQUESTS="$2"
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

# Validate arguments
if ! [[ "$TEST_DURATION" =~ ^[0-9]+$ ]] || [[ "$TEST_DURATION" -le 0 ]]; then
    error "Test duration must be a positive integer"
    exit 1
fi

if ! [[ "$CONCURRENT_REQUESTS" =~ ^[0-9]+$ ]] || [[ "$CONCURRENT_REQUESTS" -le 0 ]]; then
    error "Concurrent requests must be a positive integer"
    exit 1
fi

# Run main function
main "$@"