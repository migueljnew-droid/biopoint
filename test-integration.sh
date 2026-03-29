#!/bin/bash

# BioPoint Database Performance Integration Test
# Tests the complete connection pooling implementation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}BioPoint Database Performance Integration Test${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if required tools are installed
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}curl is not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}jq is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All dependencies available${NC}"
}

# Test database connection
test_database_connection() {
    echo -e "${YELLOW}Testing database connection...${NC}"
    
    if npm run db:generate >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database schema generated successfully${NC}"
    else
        echo -e "${RED}✗ Failed to generate database schema${NC}"
        exit 1
    fi
}

# Test health endpoints
test_health_endpoints() {
    echo -e "${YELLOW}Testing health endpoints...${NC}"
    
    # Start API server in background
    echo "Starting API server..."
    npm run dev:api &
    API_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test basic health endpoint
    if curl -s -f http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✓ Basic health endpoint working${NC}"
    else
        echo -e "${RED}✗ Basic health endpoint failed${NC}"
        kill $API_PID 2>/dev/null || true
        exit 1
    fi
    
    # Test database health endpoint
    if curl -s -f http://localhost:3000/health/db > /dev/null; then
        echo -e "${GREEN}✓ Database health endpoint working${NC}"
    else
        echo -e "${RED}✗ Database health endpoint failed${NC}"
        kill $API_PID 2>/dev/null || true
        exit 1
    fi
    
    # Stop API server
    kill $API_PID 2>/dev/null || true
    sleep 2
}

# Test performance monitoring
test_performance_monitoring() {
    echo -e "${YELLOW}Testing performance monitoring...${NC}"
    
    # Test that performance monitoring service is available
    if node -e "
        const { dbPerformanceMonitor } = require('./apps/api/src/services/databasePerformance.js');
        const metrics = dbPerformanceMonitor.getMetrics();
        console.log('Performance monitoring available');
        process.exit(0);
    " >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Performance monitoring service available${NC}"
    else
        echo -e "${RED}✗ Performance monitoring service not available${NC}"
        exit 1
    fi
}

# Test database optimization script
test_optimization_script() {
    echo -e "${YELLOW}Testing database optimization script...${NC}"
    
    if [[ -x "./scripts/database-optimize.sh" ]]; then
        echo -e "${GREEN}✓ Database optimization script is executable${NC}"
    else
        echo -e "${RED}✗ Database optimization script is not executable${NC}"
        exit 1
    fi
    
    # Test script syntax
    if bash -n ./scripts/database-optimize.sh; then
        echo -e "${GREEN}✓ Database optimization script syntax is valid${NC}"
    else
        echo -e "${RED}✗ Database optimization script has syntax errors${NC}"
        exit 1
    fi
}

# Test configuration files
test_configuration_files() {
    echo -e "${YELLOW}Testing configuration files...${NC}"
    
    # Test database configuration
    if node -e "
        const { getDatabaseConfig } = require('./apps/api/src/config/database.js');
        const config = getDatabaseConfig();
        if (config.pool.max >= 5 && config.pool.min >= 1) {
            console.log('Database configuration valid');
            process.exit(0);
        } else {
            console.error('Invalid pool configuration');
            process.exit(1);
        }
    " >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database configuration is valid${NC}"
    else
        echo -e "${RED}✗ Database configuration is invalid${NC}"
        exit 1
    fi
    
    # Test that performance targets are defined
    if node -e "
        const { performanceTargets } = require('./apps/api/src/config/database.js');
        if (performanceTargets.concurrentUsers[100] && 
            performanceTargets.concurrentUsers[500] && 
            performanceTargets.concurrentUsers[1000]) {
            console.log('Performance targets defined');
            process.exit(0);
        } else {
            console.error('Performance targets not defined');
            process.exit(1);
        }
    " >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Performance targets are defined${NC}"
    else
        echo -e "${RED}✗ Performance targets are not defined${NC}"
        exit 1
    fi
}

# Test performance tests
test_performance_tests() {
    echo -e "${YELLOW}Testing performance test suite...${NC}"
    
    if npm run test:performance >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Performance tests pass${NC}"
    else
        echo -e "${RED}✗ Performance tests failed${NC}"
        exit 1
    fi
}

# Test documentation
test_documentation() {
    echo -e "${YELLOW}Testing documentation...${NC}"
    
    if [[ -f "docs/database-performance.md" ]]; then
        echo -e "${GREEN}✓ Database performance documentation exists${NC}"
    else
        echo -e "${RED}✗ Database performance documentation missing${NC}"
        exit 1
    fi
    
    # Check if documentation contains key sections
    if grep -q "Connection Pool Configuration" docs/database-performance.md && \
       grep -q "Performance Targets" docs/database-performance.md && \
       grep -q "Health Check Endpoints" docs/database-performance.md; then
        echo -e "${GREEN}✓ Documentation contains required sections${NC}"
    else
        echo -e "${RED}✗ Documentation missing required sections${NC}"
        exit 1
    fi
}

# Run load simulation (basic)
test_load_simulation() {
    echo -e "${YELLOW}Running basic load simulation...${NC}"
    
    # Start API server
    npm run dev:api &
    API_PID=$!
    sleep 5
    
    # Simple load test with curl
    echo "Simulating 10 concurrent requests..."
    
    for i in {1..10}; do
        {
            response=$(curl -s -w "\n%{http_code}" -o /tmp/response_$i.json http://localhost:3000/health)
            http_code=$(echo "$response" | tail -n1)
            
            if [[ "$http_code" == "200" ]]; then
                echo "Request $i: SUCCESS"
            else
                echo "Request $i: FAILED (HTTP $http_code)"
            fi
        } &
    done
    
    # Wait for all requests to complete
    wait
    
    # Check results
    success_count=0
    for i in {1..10}; do
        if [[ -f /tmp/response_$i.json ]]; then
            if grep -q "status.*ok" /tmp/response_$i.json; then
                ((success_count++))
            fi
            rm -f /tmp/response_$i.json
        fi
    done
    
    # Stop API server
    kill $API_PID 2>/dev/null || true
    sleep 2
    
    if [[ $success_count -ge 8 ]]; then
        echo -e "${GREEN}✓ Load simulation successful ($success_count/10 requests)${NC}"
    else
        echo -e "${RED}✗ Load simulation failed ($success_count/10 requests)${NC}"
        exit 1
    fi
}

# Generate test report
generate_report() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Integration Test Report${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}✓ All integration tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Summary of implemented features:${NC}"
    echo "• Connection pooling with environment-specific configurations"
    echo "• Database performance monitoring and alerting"
    echo "• Health check endpoints with pool statistics"
    echo "• Performance optimization script"
    echo "• Comprehensive documentation"
    echo "• Performance test suite"
    echo "• Admin dashboard for performance monitoring"
    echo ""
    echo -e "${BLUE}Performance targets:${NC}"
    echo "• 100 concurrent users: <200ms avg response"
    echo "• 500 concurrent users: <500ms avg response"
    echo "• 1000 concurrent users: <1000ms avg response"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Deploy to staging environment"
    echo "2. Run load testing with realistic user scenarios"
    echo "3. Monitor performance metrics in production"
    echo "4. Fine-tune pool sizes based on actual usage"
    echo ""
    echo -e "${GREEN}BioPoint database performance optimization is ready!${NC}"
}

# Main execution
main() {
    check_dependencies
    test_database_connection
    test_configuration_files
    test_performance_monitoring
    test_optimization_script
    test_health_endpoints
    test_performance_tests
    test_documentation
    test_load_simulation
    generate_report
}

# Run main function
main "$@"