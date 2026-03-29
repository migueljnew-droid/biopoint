// Baseline Performance Test - 100 concurrent users for 30 minutes
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS, generateTestData } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest, setupLoadTestAuth } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Test configuration
export const options = {
    stages: [
        { duration: SCENARIOS.BASELINE.RAMP_UP, target: SCENARIOS.BASELINE.VUS },
        { duration: SCENARIOS.BASELINE.DURATION, target: SCENARIOS.BASELINE.VUS },
        { duration: SCENARIOS.BASELINE.RAMP_DOWN, target: 0 },
    ],
    
    thresholds: {
        // Response time thresholds
        'http_req_duration': [`p(50)<${CONFIG.THRESHOLDS.HTTP_REQ_DURATION_P50}`, `p(95)<${CONFIG.THRESHOLDS.HTTP_REQ_DURATION_P95}`, `p(99)<${CONFIG.THRESHOLDS.HTTP_REQ_DURATION_P99}`],
        'api_response_time': [`p(95)<${CONFIG.THRESHOLDS.HTTP_REQ_DURATION_P95}`],
        'dashboard_load_time': [`p(95)<1000`],
        'labs_response_time': [`p(95)<800`],
        'photos_response_time': [`p(95)<600`],
        
        // Error rate thresholds
        'http_req_failed': [`rate<${CONFIG.THRESHOLDS.ERROR_RATE / 100}`],
        'api_error_rate': [`rate<${CONFIG.THRESHOLDS.ERROR_RATE / 100}`],
        
        // Throughput thresholds
        'http_reqs': [`rate>=${CONFIG.THRESHOLDS.MIN_THROUGHPUT}`],
        
        // Database performance
        'db_query_time': [`p(95)<100`],
        
        // S3 performance
        's3_presign_time': [`p(95)<200`],
        's3_upload_time': [`p(95)<5000`],
        
        // Authentication success rate
        'auth_success_rate': [`rate>=0.99`]
    },
    
    // Summary trend stats
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)', 'p(99.9)', 'p(99.99)', 'count'],
    
    // System tags
    systemTags: ['status', 'method', 'url', 'name', 'group', 'check', 'error', 'tls_version', 'scenario', 'service'],
    
    // Tag with name for better organization
    tags: {
        test_type: 'baseline',
        test_name: 'biopoint_baseline_performance'
    }
};

// Global variables
let authData = [];
let testUsers = [];

// Setup function - runs before the test
export function setup() {
    console.log('Setting up baseline performance test...');
    
    // Create test users
    testUsers = authManager.createTestUsers(SCENARIOS.BASELINE.VUS);
    
    // Authenticate users
    const authResult = setupLoadTestAuth(SCENARIOS.BASELINE.VUS);
    authData = authResult.authData;
    
    console.log(`Baseline test setup complete: ${authData.length} users authenticated`);
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: new Date().toISOString()
    };
}

// Default function - main test logic
export default function (data) {
    if (!data.authData || data.authData.length === 0) {
        console.error('No authentication data available');
        return;
    }
    
    // Get random authenticated user
    const authUser = getRandomAuthUser(data.authData);
    if (!authUser) {
        console.error('No authenticated user available');
        return;
    }
    
    const baseURL = CONFIG.BASE_URL;
    const headers = authManager.getAuthHeaders(authUser.token);
    
    // Scenario 1: Dashboard navigation (40% of traffic)
    group('Dashboard Operations', function () {
        if (Math.random() < 0.4) {
            // Load dashboard data
            const dashboardStart = Date.now();
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            const dashboardLoadTime = Date.now() - dashboardStart;
            
            customMetrics.dashboardLoadTime.add(dashboardLoadTime);
            customMetrics.apiResponseTime.add(dashboardResponse.timings.duration);
            customMetrics.dashboardViews.add(1);
            
            check(dashboardResponse, {
                'dashboard status is 200': (r) => r.status === 200,
                'dashboard response time < 1s': (r) => r.timings.duration < 1000,
                'dashboard has data': (r) => {
                    try {
                        const data = JSON.parse(r.body);
                        return data && typeof data === 'object';
                    } catch {
                        return false;
                    }
                }
            });
            
            // Record metrics for performance analysis
            performanceAnalyzer.addMetric('dashboard_response_time', dashboardResponse.timings.duration, {
                endpoint: ENDPOINTS.DASHBOARD,
                user: authUser.user.email
            });
            
            sleep(1); // Think time between dashboard operations
        }
    });
    
    // Scenario 2: Lab reports operations (30% of traffic)
    group('Lab Reports Operations', function () {
        if (Math.random() < 0.3) {
            // List lab reports
            const labsStart = Date.now();
            const labsResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.LABS_LIST}`, 
                authUser.token
            );
            const labsLoadTime = Date.now() - labsStart;
            
            customMetrics.labsResponseTime.add(labsResponse.timings.duration);
            customMetrics.apiResponseTime.add(labsResponse.timings.duration);
            
            check(labsResponse, {
                'labs list status is 200': (r) => r.status === 200,
                'labs response time < 800ms': (r) => r.timings.duration < 800
            });
            
            performanceAnalyzer.addMetric('labs_response_time', labsResponse.timings.duration, {
                endpoint: ENDPOINTS.LABS_LIST,
                user: authUser.user.email
            });
            
            // Get presigned URL for upload (simulated)
            if (Math.random() < 0.3) {
                const presignStart = Date.now();
                const testData = generateTestData(__VU);
                const presignPayload = JSON.stringify({
                    filename: testData.labReport.filename,
                    contentType: testData.labReport.contentType
                });
                
                const presignResponse = authenticatedRequest('POST', 
                    `${baseURL}${ENDPOINTS.LABS_PRESIGN}`, 
                    authUser.token,
                    presignPayload
                );
                const presignTime = Date.now() - presignStart;
                
                customMetrics.s3PresignTime.add(presignTime);
                
                check(presignResponse, {
                    'presign status is 200': (r) => r.status === 200,
                    'presign response time < 200ms': (r) => r.timings.duration < 200,
                    'presign has upload URL': (r) => {
                        try {
                            const data = JSON.parse(r.body);
                            return data.uploadUrl && data.s3Key;
                        } catch {
                            return false;
                        }
                    }
                });
                
                customMetrics.labReportsUploaded.add(1);
            }
            
            sleep(1);
        }
    });
    
    // Scenario 3: Photos operations (20% of traffic)
    group('Photos Operations', function () {
        if (Math.random() < 0.2) {
            // List photos
            const photosStart = Date.now();
            const photosResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, 
                authUser.token
            );
            const photosLoadTime = Date.now() - photosStart;
            
            customMetrics.photosResponseTime.add(photosResponse.timings.duration);
            customMetrics.apiResponseTime.add(photosResponse.timings.duration);
            
            check(photosResponse, {
                'photos list status is 200': (r) => r.status === 200,
                'photos response time < 600ms': (r) => r.timings.duration < 600
            });
            
            performanceAnalyzer.addMetric('photos_response_time', photosResponse.timings.duration, {
                endpoint: ENDPOINTS.PHOTOS_LIST,
                user: authUser.user.email
            });
            
            // Get presigned URL for photo upload (simulated)
            if (Math.random() < 0.2) {
                const presignStart = Date.now();
                const testData = generateTestData(__VU);
                const presignPayload = JSON.stringify({
                    filename: testData.photo.filename,
                    contentType: testData.photo.contentType
                });
                
                const presignResponse = authenticatedRequest('POST', 
                    `${baseURL}${ENDPOINTS.PHOTOS_PRESIGN}`, 
                    authUser.token,
                    presignPayload
                );
                const presignTime = Date.now() - presignStart;
                
                customMetrics.s3PresignTime.add(presignTime);
                
                check(presignResponse, {
                    'photo presign status is 200': (r) => r.status === 200,
                    'photo presign response time < 200ms': (r) => r.timings.duration < 200
                });
                
                customMetrics.photosUploaded.add(1);
            }
            
            sleep(1);
        }
    });
    
    // Scenario 4: Health checks and monitoring (10% of traffic)
    group('Health and Monitoring', function () {
        if (Math.random() < 0.1) {
            // Basic health check
            const healthResponse = http.get(`${baseURL}${ENDPOINTS.HEALTH}`);
            
            check(healthResponse, {
                'health status is 200': (r) => r.status === 200,
                'health response is ok': (r) => {
                    try {
                        const data = JSON.parse(r.body);
                        return data.status === 'ok';
                    } catch {
                        return false;
                    }
                }
            });
            
            // Database health check
            const dbHealthResponse = http.get(`${baseURL}${ENDPOINTS.HEALTH_DB}`);
            
            check(dbHealthResponse, {
                'db health status is 200': (r) => r.status === 200,
                'db is connected': (r) => {
                    try {
                        const data = JSON.parse(r.body);
                        return data.database && data.database.status === 'connected';
                    } catch {
                        return false;
                    }
                }
            });
            
            sleep(0.5);
        }
    });
    
    // Error tracking
    if (Math.random() < 0.01) { // 1% chance to simulate errors
        const errorResponse = authenticatedRequest('GET', 
            `${baseURL}/nonexistent-endpoint`, 
            authUser.token
        );
        
        if (errorResponse.status !== 404) {
            customMetrics.apiErrorRate.add(1);
            performanceAnalyzer.addMetric('api_error', 1, {
                status: errorResponse.status,
                endpoint: '/nonexistent-endpoint'
            });
        }
    }
}

// Teardown function - runs after the test
export function teardown(data) {
    console.log('Baseline performance test completed');
    
    // Generate performance report
    const report = performanceAnalyzer.generateReport();
    
    console.log('=== BASELINE PERFORMANCE TEST REPORT ===');
    console.log(`Total Requests: ${report.summary.totalRequests}`);
    console.log(`Average Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms`);
    console.log(`P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms`);
    console.log(`P99 Response Time: ${report.summary.p99ResponseTime.toFixed(2)}ms`);
    console.log(`Error Rate: ${report.summary.errorRate.toFixed(2)}%`);
    console.log(`Throughput: ${report.summary.throughput.toFixed(2)} req/s`);
    
    console.log('\n=== BOTTLENECKS IDENTIFIED ===');
    report.bottlenecks.forEach(bottleneck => {
        console.log(`[${bottleneck.severity.toUpperCase()}] ${bottleneck.type}: ${bottleneck.description}`);
        console.log(`Recommendation: ${bottleneck.recommendation}`);
    });
    
    console.log('\n=== RECOMMENDATIONS ===');
    report.recommendations.forEach(rec => {
        console.log(`[${rec.priority.toUpperCase()}] ${rec.category}: ${rec.recommendation}`);
        console.log(`Expected Impact: ${rec.impact}`);
    });
    
    // Check threshold violations
    const violations = performanceAnalyzer.checkThresholds();
    if (violations.length > 0) {
        console.log('\n=== THRESHOLD VIOLATIONS ===');
        violations.forEach(violation => {
            console.log(`${violation.metric}: ${violation.value.toFixed(2)} (threshold: ${violation.threshold})`);
        });
    }
    
    return {
        testType: 'baseline',
        report: report,
        violations: violations,
        endTime: new Date().toISOString()
    };
}