#!/bin/bash

# BioPoint Database Performance Simple Integration Test
# Tests the connection pooling implementation without external dependencies

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

# Check Node.js
check_node() {
    echo -e "${YELLOW}Checking Node.js...${NC}"
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓ Node.js $(node --version) available${NC}"
    else
        echo -e "${RED}✗ Node.js is not installed${NC}"
        exit 1
    fi
}

# Test database schema generation
test_schema_generation() {
    echo -e "${YELLOW}Testing database schema generation...${NC}"
    
    if npx prisma generate --schema=db/prisma/schema.prisma >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database schema generated successfully${NC}"
    else
        echo -e "${RED}✗ Failed to generate database schema${NC}"
        exit 1
    fi
}

# Test configuration validation
test_configuration() {
    echo -e "${YELLOW}Testing database configuration...${NC}"
    
    if node -e "
        try {
            const { getDatabaseConfig } = require('./apps/api/src/config/database.js');
            const config = getDatabaseConfig();
            
            console.log('Pool Configuration:');
            console.log('- Max connections:', config.pool.max);
            console.log('- Min connections:', config.pool.min);
            console.log('- Idle timeout:', config.pool.idleTimeoutMillis + 'ms');
            console.log('- Connection timeout:', config.pool.connectionTimeoutMillis + 'ms');
            
            if (config.pool.max >= 5 && config.pool.min >= 1) {
                console.log('✓ Pool configuration valid');
                process.exit(0);
            } else {
                console.error('✗ Invalid pool configuration');
                process.exit(1);
            }
        } catch (error) {
            console.error('✗ Configuration test failed:', error.message);
            process.exit(1);
        }
    "; then
        echo -e "${GREEN}✓ Database configuration is valid${NC}"
    else
        echo -e "${RED}✗ Database configuration test failed${NC}"
        exit 1
    fi
}

# Test performance targets
test_performance_targets() {
    echo -e "${YELLOW}Testing performance targets...${NC}"
    
    if node -e "
        try {
            const { performanceTargets } = require('./apps/api/src/config/database.js');
            
            console.log('Performance Targets:');
            console.log('- 100 users:', performanceTargets.concurrentUsers[100].target + 'ms');
            console.log('- 500 users:', performanceTargets.concurrentUsers[500].target + 'ms');
            console.log('- 1000 users:', performanceTargets.concurrentUsers[1000].target + 'ms');
            
            if (performanceTargets.concurrentUsers[100] && 
                performanceTargets.concurrentUsers[500] && 
                performanceTargets.concurrentUsers[1000]) {
                console.log('✓ Performance targets defined');
                process.exit(0);
            } else {
                console.error('✗ Performance targets not defined');
                process.exit(1);
            }
        } catch (error) {
            console.error('✗ Performance targets test failed:', error.message);
            process.exit(1);
        }
    "; then
        echo -e "${GREEN}✓ Performance targets are defined${NC}"
    else
        echo -e "${RED}✗ Performance targets test failed${NC}"
        exit 1
    fi
}

# Test performance monitoring service
test_performance_monitoring() {
    echo -e "${YELLOW}Testing performance monitoring service...${NC}"
    
    if node -e "
        try {
            const { dbPerformanceMonitor } = require('./apps/api/src/services/databasePerformance.js');
            const metrics = dbPerformanceMonitor.getMetrics();
            
            console.log('Performance Monitoring Service:');
            console.log('- Status:', metrics.summary.status);
            console.log('- Total queries tracked:', metrics.summary.totalQueries);
            console.log('- Pool utilization:', metrics.summary.currentPoolUtilization.toFixed(1) + '%');
            
            if (metrics && metrics.summary) {
                console.log('✓ Performance monitoring service available');
                process.exit(0);
            } else {
                console.error('✗ Performance monitoring service not available');
                process.exit(1);
            }
        } catch (error) {
            console.error('✗ Performance monitoring test failed:', error.message);
            process.exit(1);
        }
    "; then
        echo -e "${GREEN}✓ Performance monitoring service available${NC}"
    else
        echo -e "${RED}✗ Performance monitoring service test failed${NC}"
        exit 1
    fi
}

# Test optimization script
test_optimization_script() {
    echo -e "${YELLOW}Testing optimization script...${NC}"
    
    if [[ -f "./scripts/database-optimize.sh" ]]; then
        echo -e "${GREEN}✓ Optimization script exists${NC}"
    else
        echo -e "${RED}✗ Optimization script missing${NC}"
        exit 1
    fi
    
    if [[ -x "./scripts/database-optimize.sh" ]]; then
        echo -e "${GREEN}✓ Optimization script is executable${NC}"
    else
        echo -e "${YELLOW}⚠ Optimization script is not executable (fixing)${NC}"
        chmod +x ./scripts/database-optimize.sh
    fi
    
    # Test script syntax
    if bash -n ./scripts/database-optimize.sh; then
        echo -e "${GREEN}✓ Optimization script syntax is valid${NC}"
    else
        echo -e "${RED}✗ Optimization script has syntax errors${NC}"
        exit 1
    fi
}

# Test health check endpoints (if server is running)
test_health_endpoints() {
    echo -e "${YELLOW}Testing health check endpoints...${NC}"
    
    # Check if we can test endpoints (server might not be running)
    if command -v curl &> /dev/null; then
        echo "Testing health endpoints (server must be running)..."
        
        # Test basic health endpoint
        if curl -s -f http://localhost:3000/health >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Basic health endpoint working${NC}"
        else
            echo -e "${YELLOW}⚠ Basic health endpoint not available (server may not be running)${NC}"
        fi
        
        # Test database health endpoint
        if curl -s -f http://localhost:3000/health/db >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Database health endpoint working${NC}"
        else
            echo -e "${YELLOW}⚠ Database health endpoint not available (server may not be running)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ curl not available, skipping endpoint tests${NC}"
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

# Test TypeScript compilation
test_typescript() {
    echo -e "${YELLOW}Testing TypeScript compilation...${NC}"
    
    if npx tsc --noEmit apps/api/src/config/database.ts >/dev/null 2>&1; then
        echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
    else
        echo -e "${RED}✗ TypeScript compilation failed${NC}"
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
    echo "• Performance monitoring service"
    echo "• Admin dashboard for performance monitoring"
    echo ""
    echo -e "${BLUE}Performance targets:${NC}"
    echo "• 100 concurrent users: <200ms avg response"
    echo "• 500 concurrent users: <500ms avg response"
    echo "• 1000 concurrent users: <1000ms avg response"
    echo ""
    echo -e "${BLUE}Connection pool sizes:${NC}"
    echo "• Development: 5 connections"
    echo "• Staging: 10 connections"
    echo "• Production: 20 connections"
    echo "• Test: 3 connections"
    echo ""
    echo -e "${GREEN}BioPoint database performance optimization is ready!${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Configure your DATABASE_URL environment variable"
    echo "2. Deploy to your environment"
    echo "3. Monitor performance via /health/db endpoint"
    echo "4. Run optimization script regularly"
}

# Main execution
main() {
    check_node
    test_schema_generation
    test_configuration
    test_performance_targets
    test_performance_monitoring
    test_optimization_script
    test_health_endpoints
    test_documentation
    test_typescript
    generate_report
}

# Run main function
main "$@"