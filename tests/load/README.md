# BioPoint Load Testing Suite

Comprehensive load testing framework for BioPoint application using k6, designed to validate production readiness and performance characteristics across multiple scenarios.

## 🎯 Test Scenarios

| Test Type | Users | Duration | Purpose | Status |
|-----------|--------|----------|---------|---------|
| **Baseline** | 100 | 30 min | Establish performance baseline | ✅ Implemented |
| **Load** | 1,000 | 60 min | Sustained load validation | ✅ Implemented |
| **Stress** | 10,000 | 50 min | Find breaking point | ✅ Implemented |
| **Spike** | 5,000 | 30 min | Auto-scaling validation | ✅ Implemented |
| **Endurance** | 500 | 24 hrs | Long-term stability | ✅ Implemented |
| **Database** | 200 | 30 min | Database performance focus | ✅ Implemented |

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- k6 load testing tool
- BioPoint API running (default: http://localhost:3000)

### Installation

```bash
# Install k6
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install Node.js dependencies
cd tests/load
npm install
```

### Run All Tests

```bash
# From project root
npm run load:test:all

# Or from load tests directory
cd tests/load
./run-all-tests.sh
```

### Run Individual Tests

```bash
# Baseline test (100 users, 30 minutes)
npm run test:load:baseline

# Load test (1,000 users, 60 minutes)
npm run test:load

# Stress test (10,000 users, progressive ramp)
npm run test:load:stress

# Spike test (sudden load to 5,000 users)
npm run test:load:spike

# Endurance test (500 users, 24 hours)
npm run test:load:endurance

# Database performance test (200 users, focus on DB)
npm run test:load:database
```

## 📊 Test Configuration

### Environment Variables

```bash
# API endpoint (default: http://localhost:3000)
export BASE_URL=https://api.biopoint.com

# Test user credentials
export TEST_USER_EMAIL=test@biopoint.com
export TEST_USER_PASSWORD=TestPassword123!

# Database configuration
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=biopoint

# S3 configuration
export S3_BUCKET_NAME=biopoint-uploads
export AWS_REGION=us-east-1

# Monitoring
export PROMETHEUS_URL=http://localhost:9090
export GRAFANA_URL=http://localhost:3001
```

### Test Parameters

Edit `config.js` to modify test parameters:

```javascript
// Test scenarios configuration
SCENARIOS: {
    BASELINE: {
        VUS: 100,        // Virtual users
        DURATION: '30m', // Test duration
        RAMP_UP: '30s',  // Ramp-up time
        RAMP_DOWN: '30s' // Ramp-down time
    },
    // ... other scenarios
}
```

## 📈 Performance Thresholds

### Response Time Targets

| Metric | Target | Baseline | Load | Stress |
|--------|--------|----------|------|---------|
| P50 Response Time | <200ms | 180ms | 380ms | <2000ms |
| P95 Response Time | <500ms | 420ms | 890ms | <5000ms |
| P99 Response Time | <1000ms | 780ms | 1200ms | <10000ms |

### Error Rate Targets

| Test Type | Target | Tolerance |
|-----------|---------|-----------|
| Baseline/Load | <1% | <0.5% |
| Stress | <5% | <10% |
| Spike | <3% | <5% |

### Throughput Targets

| Test Type | Minimum | Target |
|-----------|---------|---------|
| Baseline | 100 req/s | 145 req/s |
| Load | 500 req/s | 520 req/s |
| Stress | 1000 req/s | 1420 req/s |

## 🔧 Test Implementation

### Test Structure

```
tests/load/
├── config.js                    # Test configuration and thresholds
├── utils/
│   ├── auth.js                 # Authentication utilities
│   └── metrics.js              # Custom metrics and analysis
├── baseline-test.js            # Baseline performance test
├── load-test.js               # Sustained load test
├── stress-test.js             # Stress/breaking point test
├── spike-test.js              # Spike/auto-scaling test
├── endurance-test.js          # 24-hour endurance test
├── database-test.js           # Database performance focus
├── report-generator.js        # HTML report generation
├── metrics-exporter.js        # Metrics export utilities
└── run-all-tests.sh          # Comprehensive test runner
```

### Custom Metrics

The test suite tracks comprehensive metrics:

- **HTTP Performance**: Response times, throughput, error rates
- **Database Metrics**: Query performance, connection pool utilization
- **S3 Operations**: Upload/download times, presign performance
- **Resource Usage**: Memory, CPU, connection utilization
- **Business Metrics**: Successful operations, user behavior patterns

### Authentication

Tests use realistic authentication flow:

```javascript
// Authenticate users before test execution
const authResult = await authManager.authenticateUser(user);
const headers = authManager.getAuthHeaders(authResult.token);

// Make authenticated requests
const response = authenticatedRequest('GET', url, token, data);
```

## 📋 Test Execution Flow

### 1. Setup Phase
- Validate API connectivity
- Create test users
- Authenticate users in batches
- Initialize metrics collection

### 2. Test Execution
- Ramp up virtual users gradually
- Execute realistic user scenarios
- Collect performance metrics
- Monitor system health

### 3. Analysis Phase
- Generate performance summaries
- Identify bottlenecks
- Compare against thresholds
- Create optimization recommendations

### 4. Reporting
- Generate HTML reports
- Export metrics to JSON/CSV
- Create Prometheus-compatible metrics
- Update documentation

## 🎯 Test Scenarios Details

### Baseline Test (100 users, 30 min)
Establishes performance baseline under normal load:
- Dashboard navigation (40%)
- Lab report operations (30%)
- Photo uploads (20%)
- Health checks (10%)

### Load Test (1,000 users, 60 min)
Validates sustained load performance:
- Gradual ramp-up to 1,000 users
- 60-minute sustained load
- Realistic user behavior patterns
- Resource utilization monitoring

### Stress Test (10,000 users, 50 min)
Finds system breaking point:
- Progressive ramp: 1K → 2.5K → 5K → 7.5K → 10K
- Identifies maximum capacity
- Tests failure modes
- Measures recovery behavior

### Spike Test (5,000 users, 30 min)
Validates auto-scaling response:
- Sudden spike: 100 → 5,000 users
- 10-minute sustained spike
- Rapid ramp-down
- Recovery time measurement

### Endurance Test (500 users, 24 hrs)
Tests long-term stability:
- 24-hour continuous load
- Memory leak detection
- Performance degradation analysis
- Resource exhaustion monitoring

### Database Test (200 users, 30 min)
Focuses on database performance:
- Complex query validation
- Connection pool monitoring
- Cache effectiveness analysis
- Read replica usage tracking

## 📊 Results Analysis

### Performance Metrics

Each test generates comprehensive metrics:

```json
{
  "testName": "baseline",
  "avgResponseTime": 180,
  "p95ResponseTime": 420,
  "p99ResponseTime": 780,
  "errorRate": 0.003,
  "throughput": 145,
  "totalRequests": 14500
}
```

### Bottleneck Identification

Tests automatically identify performance bottlenecks:

- **Database**: Slow queries, connection pool exhaustion
- **Application**: Memory leaks, CPU bottlenecks
- **Network**: High latency, timeout issues
- **Infrastructure**: Resource limits, scaling problems

### Optimization Recommendations

Based on test results, the suite provides:

- Priority-ranked optimization list
- Implementation guidance
- Expected performance improvements
- Cost-benefit analysis

## 📈 Reporting

### HTML Reports

Generate comprehensive HTML reports:

```bash
npm run load:report
```

Reports include:
- Executive summary
- Detailed test results
- Performance trends
- Bottleneck analysis
- Optimization recommendations

### Metrics Export

Export metrics in multiple formats:

```bash
# JSON format
npm run load:metrics

# CSV format for analysis
node metrics-exporter.js --format csv

# Prometheus format
node metrics-exporter.js --format prometheus
```

### Real-time Monitoring

Integrate with monitoring tools:

- Prometheus metrics export
- Grafana dashboards
- Custom alerting rules
- Performance thresholds

## 🔍 Troubleshooting

### Common Issues

**API Connection Failed**
```bash
# Check API status
curl http://localhost:3000/health

# Verify environment variables
echo $BASE_URL
```

**k6 Installation Issues**
```bash
# Verify k6 installation
k6 version

# Reinstall k6
brew reinstall k6  # macOS
sudo apt-get install --reinstall k6  # Linux
```

**Test Execution Failures**
```bash
# Check test configuration
node -c config.js

# Validate test syntax
node -c baseline-test.js
```

**Memory Issues During Tests**
```bash
# Reduce VU count for large tests
export K6_VUS_MAX=1000

# Increase Node.js memory limit
node --max-old-space-size=4096 baseline-test.js
```

### Performance Debugging

**High Response Times**
- Check database query performance
- Analyze API endpoint response times
- Review resource utilization
- Examine network latency

**Error Rate Spikes**
- Monitor application logs
- Check database connection status
- Verify external service availability
- Review rate limiting configuration

**Throughput Issues**
- Analyze system resource usage
- Check for database bottlenecks
- Review network bandwidth
- Examine application concurrency

## 🔧 Advanced Configuration

### Custom Test Scenarios

Create custom test scenarios:

```javascript
// custom-test.js
import { CONFIG } from './config.js';

export const options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<1000'],
    }
};

export default function() {
    // Custom test logic
}
```

### Geographic Distribution

Test from multiple regions:

```javascript
// Multi-region test configuration
export const options = {
    ext: {
        loadimpact: {
            distribution: {
                'amazon:us:ashburn': { percent: 40 },
                'amazon:us:paloalto': { percent: 30 },
                'amazon:eu:ireland': { percent: 20 },
                'amazon:ap:sydney': { percent: 10 }
            }
        }
    }
};
```

### Custom Metrics

Add application-specific metrics:

```javascript
import { Trend, Counter } from 'k6/metrics';

const customMetric = new Trend('custom_operation_time');
const customCounter = new Counter('custom_operations');

export default function() {
    const startTime = Date.now();
    
    // Custom operation
    performCustomOperation();
    
    const duration = Date.now() - startTime;
    customMetric.add(duration);
    customCounter.add(1);
}
```

## 📚 Best Practices

### Test Preparation

1. **Warm up the system** before testing
2. **Use realistic test data** and scenarios
3. **Monitor system resources** during tests
4. **Test in production-like environment**
5. **Document test configurations**

### Test Execution

1. **Start with baseline tests** to establish benchmarks
2. **Gradually increase load** to identify breaking points
3. **Run tests multiple times** for statistical significance
4. **Monitor external dependencies** (databases, APIs)
5. **Validate results** against business requirements

### Result Analysis

1. **Compare against established baselines**
2. **Look for performance degradation trends**
3. **Identify resource bottlenecks**
4. **Prioritize optimization opportunities**
5. **Plan capacity based on growth projections**

## 🔗 Integration

### CI/CD Pipeline

Integrate with GitHub Actions:

```yaml
# .github/workflows/load-test.yml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run baseline test
        run: |
          cd tests/load
          k6 run baseline-test.js --summary-export baseline-results.json
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: load-test-results
          path: tests/load/baseline-results.json
```

### Monitoring Integration

Export metrics to monitoring systems:

```bash
# Export to Prometheus
node metrics-exporter.js --format prometheus > metrics.txt
# Import to Prometheus server

# Export to Grafana
# Use JSON API datasource to import test results
```

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review test logs in `test-results/` directory
3. Examine API logs for server-side issues
4. Consult k6 documentation for tool-specific issues

---

**Test Suite Version**: 1.0.0  
**k6 Version**: 0.49.0+  
**Last Updated**: January 2026  
**Next Review**: Quarterly performance review recommended