#!/bin/bash

# BioPoint Comprehensive Load Testing Script
# This script executes all load tests and generates comprehensive reports

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_RESULTS_DIR="./test-results"
REPORTS_DIR="../../docs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if API is running
check_api_status() {
    print_status "Checking API status at $API_BASE_URL..."
    
    if curl -f -s "$API_BASE_URL/health" > /dev/null; then
        print_success "API is running and responsive"
        return 0
    else
        print_error "API is not responding at $API_BASE_URL"
        print_error "Please ensure BioPoint API is running before executing tests"
        return 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing test dependencies..."
    
    if command -v k6 &> /dev/null; then
        print_success "k6 is already installed"
    else
        print_status "Installing k6..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install k6
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            sudo gpg -k
            sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
            echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        else
            print_error "Unsupported operating system. Please install k6 manually."
            exit 1
        fi
    fi
    
    # Install Node.js dependencies
    if [ -f "package.json" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    fi
}

# Function to create directories
setup_directories() {
    print_status "Setting up test directories..."
    
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$REPORTS_DIR"
    
    print_success "Test directories created"
}

# Function to run individual test
run_test() {
    local test_name=$1
    local test_file=$2
    local output_file="$TEST_RESULTS_DIR/${test_name}_${TIMESTAMP}.json"
    
    print_status "Running $test_name test..."
    
    # Set environment variables
    export BASE_URL="$API_BASE_URL"
    export K6_OUT="json=$output_file"
    
    # Run the test
    if k6 run "$test_file" --summary-trend-stats="avg,min,med,max,p(50),p(95),p(99),count"; then
        print_success "$test_name test completed successfully"
        
        # Generate summary
        if [ -f "$output_file" ]; then
            generate_test_summary "$test_name" "$output_file"
        fi
        
        return 0
    else
        print_error "$test_name test failed"
        return 1
    fi
}

# Function to generate test summary
generate_test_summary() {
    local test_name=$1
    local results_file=$2
    local summary_file="$TEST_RESULTS_DIR/${test_name}_${TIMESTAMP}_summary.json"
    
    print_status "Generating summary for $test_name..."
    
    # Extract key metrics from k6 JSON output
    node -e "
        const fs = require('fs');
        const results = JSON.parse(fs.readFileSync('$results_file', 'utf8'));
        
        // Extract metrics
        const metrics = results.metrics;
        const summary = {
            testName: '$test_name',
            timestamp: new Date().toISOString(),
            duration: metrics.iteration_duration?.values?.avg || 0,
            vusMax: metrics.vus_max?.value || 0,
            totalRequests: metrics.http_reqs?.values?.count || 0,
            avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
            p95ResponseTime: metrics.http_req_duration?.values['p(95)'] || 0,
            p99ResponseTime: metrics.http_req_duration?.values['p(99)'] || 0,
            errorRate: metrics.http_req_failed?.values?.rate || 0,
            throughput: metrics.http_reqs?.values?.rate || 0,
            dataReceived: metrics.data_received?.values?.count || 0,
            dataSent: metrics.data_sent?.values?.count || 0
        };
        
        fs.writeFileSync('$summary_file', JSON.stringify(summary, null, 2));
        console.log('Summary generated:', JSON.stringify(summary, null, 2));
    "
    
    print_success "Summary generated for $test_name"
}

# Function to run all tests
run_all_tests() {
    print_status "Starting comprehensive load testing suite..."
    
    local tests=(
        "baseline:baseline-test.js"
        "load:load-test.js"
        "stress:stress-test.js"
        "spike:spike-test.js"
        "database:database-test.js"
    )
    
    local failed_tests=()
    local passed_tests=()
    
    for test_config in "${tests[@]}"; do
        IFS=':' read -r test_name test_file <<< "$test_config"
        
        if run_test "$test_name" "$test_file"; then
            passed_tests+=("$test_name")
        else
            failed_tests+=("$test_name")
        fi
        
        # Brief pause between tests
        sleep 10
    done
    
    print_status "Test execution completed"
    print_success "Passed tests: ${passed_tests[*]}"
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        print_error "Failed tests: ${failed_tests[*]}"
    fi
    
    # Save test results summary
    save_test_results_summary passed_tests failed_tests
}

# Function to save overall test results summary
save_test_results_summary() {
    local passed_tests=($1)
    local failed_tests=($2)
    local summary_file="$TEST_RESULTS_DIR/test_results_summary_${TIMESTAMP}.json"
    
    print_status "Saving overall test results summary..."
    
    cat > "$summary_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "testRunId": "$TIMESTAMP",
    "apiBaseUrl": "$API_BASE_URL",
    "summary": {
        "totalTests": $((${#passed_tests[@]} + ${#failed_tests[@]})),
        "passedTests": ${#passed_tests[@]},
        "failedTests": ${#failed_tests[@]},
        "successRate": $(echo "scale=2; ${#passed_tests[@]} / (${#passed_tests[@]} + ${#failed_tests[@]}) * 100" | bc -l)
    },
    "passedTests": [$(printf '"%s",' "${passed_tests[@]}" | sed 's/,$//')],
    "failedTests": [$(printf '"%s",' "${failed_tests[@]}" | sed 's/,$//')],
    "testResultsDirectory": "$TEST_RESULTS_DIR"
}
EOF
    
    print_success "Test results summary saved to $summary_file"
}

# Function to run endurance test separately (due to long duration)
run_endurance_test() {
    print_status "Starting 24-hour endurance test..."
    print_warning "This test will run for 24 hours. Press Ctrl+C to cancel."
    
    read -p "Are you sure you want to run the 24-hour endurance test? (yes/no): " -r
    if [[ $REPLY =~ ^yes$ ]]; then
        run_test "endurance" "endurance-test.js"
    else
        print_status "Endurance test skipped"
    fi
}

# Function to generate comprehensive report
generate_comprehensive_report() {
    print_status "Generating comprehensive test report..."
    
    # Check if report generator exists
    if [ -f "report-generator.js" ]; then
        node report-generator.js
        print_success "Comprehensive report generated"
    else
        print_warning "Report generator not found, skipping report generation"
    fi
    
    # Export metrics
    if [ -f "metrics-exporter.js" ]; then
        node metrics-exporter.js
        print_success "Metrics exported"
    fi
}

# Function to display test results summary
display_results_summary() {
    print_status "Load Testing Results Summary"
    print_status "================================"
    
    local summary_file=$(find "$TEST_RESULTS_DIR" -name "test_results_summary_*.json" | head -1)
    
    if [ -f "$summary_file" ]; then
        node -e "
            const fs = require('fs');
            const summary = JSON.parse(fs.readFileSync('$summary_file', 'utf8'));
            console.log('Test Run ID:', summary.testRunId);
            console.log('Total Tests:', summary.summary.totalTests);
            console.log('Passed Tests:', summary.summary.passedTests);
            console.log('Failed Tests:', summary.summary.failedTests);
            console.log('Success Rate:', summary.summary.successRate.toFixed(1) + '%');
            console.log('\\nTest Results Directory:', summary.testResultsDirectory);
        "
    else
        print_warning "No summary file found"
    fi
    
    print_status "Individual test results available in: $TEST_RESULTS_DIR"
    print_status "Generated reports available in: $REPORTS_DIR"
}

# Function to cleanup old test results
cleanup_old_results() {
    print_status "Cleaning up old test results (keeping last 10 runs)..."
    
    # Keep only the last 10 test result directories
    find "$TEST_RESULTS_DIR" -name "*.json" -type f | sort -r | tail -n +11 | xargs -r rm -f
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    print_status "🚀 BioPoint Comprehensive Load Testing Suite"
    print_status "=============================================="
    
    # Parse command line arguments
    local run_endurance=false
    local skip_setup=false
    local cleanup_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --endurance)
                run_endurance=true
                shift
                ;;
            --skip-setup)
                skip_setup=true
                shift
                ;;
            --cleanup)
                cleanup_only=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --endurance     Run endurance test (24 hours)"
                echo "  --skip-setup    Skip dependency installation"
                echo "  --cleanup       Clean up old test results only"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    if [ "$cleanup_only" = true ]; then
        setup_directories
        cleanup_old_results
        exit 0
    fi
    
    # Pre-flight checks
    check_api_status || exit 1
    
    # Setup
    setup_directories
    
    if [ "$skip_setup" = false ]; then
        install_dependencies
    fi
    
    # Run tests
    if [ "$run_endurance" = true ]; then
        run_endurance_test
    else
        run_all_tests
    fi
    
    # Generate reports
    generate_comprehensive_report
    
    # Display results
    display_results_summary
    
    # Cleanup
    cleanup_old_results
    
    print_success "🎉 Load testing suite completed successfully!"
    print_status "Check the results in: $TEST_RESULTS_DIR"
    print_status "Check the reports in: $REPORTS_DIR"
}

# Run main function with all arguments
main "$@"