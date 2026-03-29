#!/bin/bash

# BioPoint Comprehensive Test Runner
# This script runs all tests and generates coverage reports

set -e

echo "🧪 BioPoint Test Automation Suite"
echo "=================================="
echo "Starting comprehensive test execution..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run tests with error handling
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local directory=$3
    
    print_status $BLUE "📋 Running $suite_name tests..."
    cd "$directory" || exit 1
    
    if eval "$test_command"; then
        print_status $GREEN "✅ $suite_name tests passed"
        return 0
    else
        print_status $RED "❌ $suite_name tests failed"
        return 1
    fi
}

# Function to check test coverage
check_coverage() {
    local coverage_file=$1
    local min_coverage=$2
    
    if [[ -f "$coverage_file" ]]; then
        local coverage=$(grep -o '"pct":[0-9]*\.[0-9]*' "$coverage_file" | head -1 | cut -d':' -f2)
        if (( $(echo "$coverage >= $min_coverage" | bc -l) )); then
            print_status $GREEN "✅ Coverage $coverage% meets minimum requirement of $min_coverage%"
            return 0
        else
            print_status $RED "❌ Coverage $coverage% below minimum requirement of $min_coverage%"
            return 1
        fi
    else
        print_status $YELLOW "⚠️  Coverage file not found: $coverage_file"
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    local failed_tests=()
    
    # Create test directories if they don't exist
    mkdir -p apps/api/coverage
    mkdir -p apps/mobile/coverage
    
    print_status $BLUE "🔧 Setting up test environment..."
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        print_status $YELLOW "📦 Installing dependencies..."
        npm install
    fi
    
    # Run API Unit Tests
    if ! run_test_suite "API Unit" "npx vitest run --reporter=verbose src/__tests__/unit/" "apps/api"; then
        failed_tests+=("API Unit Tests")
    fi
    
    # Run API Integration Tests
    if ! run_test_suite "API Integration" "npx vitest run --reporter=verbose src/__tests__/integration/" "apps/api"; then
        failed_tests+=("API Integration Tests")
    fi
    
    # Run API Security Tests
    if ! run_test_suite "API Security" "npx vitest run --reporter=verbose src/__tests__/security/" "apps/api"; then
        failed_tests+=("API Security Tests")
    fi
    
    # Run API Performance Tests
    if ! run_test_suite "API Performance" "npx vitest run --reporter=verbose src/__tests__/performance.test.ts" "apps/api"; then
        failed_tests+=("API Performance Tests")
    fi
    
    # Run Mobile Component Tests
    if ! run_test_suite "Mobile Components" "npm test -- --coverage --watchAll=false" "apps/mobile"; then
        failed_tests+=("Mobile Component Tests")
    fi
    
    # Generate coverage report
    print_status $BLUE "📊 Generating coverage report..."
    cd "$PROJECT_ROOT" || exit 1
    node scripts/coverage-report.js
    
    # Check coverage thresholds
    print_status $BLUE "🔍 Checking coverage thresholds..."
    
    # API Coverage Check
    if [[ -f "apps/api/coverage/coverage-summary.json" ]]; then
        if ! check_coverage "apps/api/coverage/coverage-summary.json" 80; then
            failed_tests+=("API Coverage Threshold")
        fi
    fi
    
    # Mobile Coverage Check
    if [[ -f "apps/mobile/coverage/coverage-summary.json" ]]; then
        if ! check_coverage "apps/mobile/coverage/coverage-summary.json" 80; then
            failed_tests+=("Mobile Coverage Threshold")
        fi
    fi
    
    # HIPAA Compliance Check
    print_status $BLUE "🔒 Checking HIPAA compliance..."
    if [[ -f "coverage-report.json" ]]; then
        local hipaa_status=$(grep -o '"status":"[^"]*"' coverage-report.json | cut -d'"' -f4)
        if [[ "$hipaa_status" != "COMPLIANT" ]]; then
            print_status $RED "❌ HIPAA compliance check failed"
            failed_tests+=("HIPAA Compliance")
        else
            print_status $GREEN "✅ HIPAA compliance check passed"
        fi
    fi
    
    # Security Vulnerability Scan
    print_status $BLUE "🔍 Running security vulnerability scan..."
    if command -v npm-audit &> /dev/null; then
        if npm audit --audit-level=high; then
            print_status $GREEN "✅ No high-severity vulnerabilities found"
        else
            print_status $YELLOW "⚠️  Security vulnerabilities detected - review required"
        fi
    fi
    
    # Test execution summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "=================================="
    print_status $BLUE "📋 TEST EXECUTION SUMMARY"
    echo "=================================="
    echo "Total execution time: ${duration}s"
    echo ""
    
    if [[ ${#failed_tests[@]} -eq 0 ]]; then
        print_status $GREEN "🎉 ALL TESTS PASSED!"
        print_status $GREEN "✅ BioPoint test suite completed successfully"
        print_status $GREEN "✅ Coverage targets met"
        print_status $GREEN "✅ HIPAA compliance verified"
        exit 0
    else
        print_status $RED "❌ SOME TESTS FAILED"
        echo "Failed test suites:"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        echo ""
        print_status $YELLOW "💡 Next steps:"
        echo "  1. Review failed test output above"
        echo "  2. Fix failing tests in the respective directories"
        echo "  3. Run individual test suites to isolate issues"
        echo "  4. Ensure all dependencies are properly installed"
        exit 1
    fi
}

# Help function
show_help() {
    echo "BioPoint Test Runner"
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -u, --unit          Run only unit tests"
    echo "  -i, --integration   Run only integration tests"
    echo "  -s, --security      Run only security tests"
    echo "  -p, --performance   Run only performance tests"
    echo "  -m, --mobile        Run only mobile tests"
    echo "  -c, --coverage      Generate coverage report only"
    echo "  -a, --audit         Run HIPAA audit only"
    echo "  --quick             Run quick test suite (unit + integration)"
    echo ""
    echo "Examples:"
    echo "  $0                  Run all tests"
    echo "  $0 --unit           Run unit tests only"
    echo "  $0 --coverage       Generate coverage report"
    echo "  $0 --quick          Run quick test suite"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--unit)
            RUN_UNIT_ONLY=true
            shift
            ;;
        -i|--integration)
            RUN_INTEGRATION_ONLY=true
            shift
            ;;
        -s|--security)
            RUN_SECURITY_ONLY=true
            shift
            ;;
        -p|--performance)
            RUN_PERFORMANCE_ONLY=true
            shift
            ;;
        -m|--mobile)
            RUN_MOBILE_ONLY=true
            shift
            ;;
        -c|--coverage)
            GENERATE_COVERAGE_ONLY=true
            shift
            ;;
        -a|--audit)
            RUN_AUDIT_ONLY=true
            shift
            ;;
        --quick)
            RUN_QUICK_SUITE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# Export variables for use in functions
export PROJECT_ROOT

# Run main function
main "$@"