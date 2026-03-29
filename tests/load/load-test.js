// Load Test - 1,000 concurrent users for 60 minutes
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Load test configuration
export const options = {
    stages: [
        // Ramp up to 1,000 users over 2 minutes
        { duration: SCENARIOS.LOAD.RAMP_UP, target: SCENARIOS.LOAD.VUS },
        // Sustain 1,000 users for 60 minutes
        { duration: SCENARIOS.LOAD.DURATION, target: SCENARIOS.LOAD.VUS },
        // Ramp down over 2 minutes
        { duration: SCENARIOS.LOAD.RAMP_DOWN, target: 0 },
    ],
    
    thresholds: {
        // Relaxed thresholds for load testing
        'http_req_duration': [`p(50)<500`, `p(95)<1500`, `p(99)<3000`],
        'api_response_time': [`p(95)<2000`],
        'dashboard_load_time': [`p(95)<2000`],
        'labs_response_time': [`p(95)<1500`],
        'photos_response_time': [`p(95)<1200`],
        'http_req_failed': [`rate<0.02`], // 2% error rate acceptable under load
        'http_reqs': [`rate>=500`], // Minimum 500 req/s throughput
        'db_query_time': [`p(95)<300`],
        's3_presign_time': [`p(95)<500`],
        's3_upload_time': [`p(95)<10000`], // 10 seconds acceptable under load
    },
    
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)', 'p(99.9)', 'count'],
    
    tags: {
        test_type: 'load',
        test_name: 'biopoint_load_test'
    }
};

// Global variables
let authData = [];
let testUsers = [];

// Setup function
export function setup() {
    console.log('Setting up load test with 1,000 concurrent users...');
    
    // Create test users
    testUsers = authManager.createTestUsers(SCENARIOS.LOAD.VUS);
    
    // Authenticate users in batches to avoid overwhelming the auth system
    const batchSize = 50;
    const batches = Math.ceil(SCENARIOS.LOAD.VUS / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, SCENARIOS.LOAD.VUS);
        const batchUsers = testUsers.slice(startIdx, endIdx);
        
        console.log(`Authenticating batch ${i + 1}/${batches} (${batchUsers.length} users)...`);
        
        batchUsers.forEach(user => {
            const authResult = authManager.authenticateUser(user);
            if (authResult) {
                authData.push({
                    user: user,
                    token: authResult.token,
                    refreshToken: authResult.refreshToken
                });
            }
        });
        
        // Small delay between batches
        if (i < batches - 1) {
            sleep(2);
        }
    }
    
    console.log(`Load test setup complete: ${authData.length} out of ${SCENARIOS.LOAD.VUS} users authenticated`);
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: new Date().toISOString(),
        successRate: authData.length / SCENARIOS.LOAD.VUS
    };
}

// Main load test function
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
    
    // Define user behavior patterns for load testing
    const userBehavior = Math.random();
    
    // Pattern 1: Heavy dashboard users (35%)
    if (userBehavior < 0.35) {
        heavyDashboardUser(authUser, baseURL);
    }
    // Pattern 2: Lab report uploaders (25%)
    else if (userBehavior < 0.60) {
        labReportUploader(authUser, baseURL);
    }
    // Pattern 3: Photo uploaders (20%)
    else if (userBehavior < 0.80) {
        photoUploader(authUser, baseURL);
    }
    // Pattern 4: Community browsers (15%)
    else {
        communityBrowser(authUser, baseURL);
    }
    
    // Random short think time to simulate real user behavior
    sleep(Math.random() * 2 + 0.5); // 0.5 to 2.5 seconds
}

// Heavy dashboard user behavior
function heavyDashboardUser(authUser, baseURL) {
    group('Heavy Dashboard User', function () {
        // Load dashboard
        const dashboardResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
        customMetrics.apiResponseTime.add(dashboardResponse.timings.duration);
        
        check(dashboardResponse, {
            'dashboard loaded successfully': (r) => r.status === 200
        });
        
        // Load BioPoint history
        const historyResponse = authenticatedRequest('GET', 
            `${baseURL}/biopoint/history`, 
            authUser.token
        );
        
        check(historyResponse, {
            'biopoint history loaded': (r) => r.status === 200
        });
        
        // Load markers
        const markersResponse = authenticatedRequest('GET', 
            `${baseURL}/markers`, 
            authUser.token
        );
        
        check(markersResponse, {
            'markers loaded': (r) => r.status === 200
        });
        
        // Load marker trends
        const trendsResponse = authenticatedRequest('GET', 
            `${baseURL}/markers/trends`, 
            authUser.token
        );
        
        check(trendsResponse, {
            'marker trends loaded': (r) => r.status === 200
        });
    });
}

// Lab report uploader behavior
function labReportUploader(authUser, baseURL) {
    group('Lab Report Uploader', function () {
        // List existing lab reports
        const labsResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.LABS_LIST}`, 
            authUser.token
        );
        
        customMetrics.labsResponseTime.add(labsResponse.timings.duration);
        customMetrics.apiResponseTime.add(labsResponse.timings.duration);
        
        check(labsResponse, {
            'lab reports listed': (r) => r.status === 200
        });
        
        // Get presigned URL for upload
        const presignPayload = JSON.stringify({
            filename: `lab_report_${__VU}_${Date.now()}.pdf`,
            contentType: 'application/pdf'
        });
        
        const presignStart = Date.now();
        const presignResponse = authenticatedRequest('POST', 
            `${baseURL}${ENDPOINTS.LABS_PRESIGN}`, 
            authUser.token,
            presignPayload
        );
        const presignTime = Date.now() - presignStart;
        
        customMetrics.s3PresignTime.add(presignTime);
        
        check(presignResponse, {
            'presign url obtained': (r) => r.status === 200,
            'presign has upload url': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return data.uploadUrl && data.s3Key;
                } catch {
                    return false;
                }
            }
        });
        
        if (presignResponse.status === 200) {
            customMetrics.labReportsUploaded.add(1);
        }
    });
}

// Photo uploader behavior
function photoUploader(authUser, baseURL) {
    group('Photo Uploader', function () {
        // List photos
        const photosResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, 
            authUser.token
        );
        
        customMetrics.photosResponseTime.add(photosResponse.timings.duration);
        customMetrics.apiResponseTime.add(photosResponse.timings.duration);
        
        check(photosResponse, {
            'photos listed': (r) => r.status === 200
        });
        
        // Get presigned URL for photo upload
        const photoPresignPayload = JSON.stringify({
            filename: `progress_photo_${__VU}_${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        const photoPresignStart = Date.now();
        const photoPresignResponse = authenticatedRequest('POST', 
            `${baseURL}${ENDPOINTS.PHOTOS_PRESIGN}`, 
            authUser.token,
            photoPresignPayload
        );
        const photoPresignTime = Date.now() - photoPresignStart;
        
        customMetrics.s3PresignTime.add(photoPresignTime);
        
        check(photoPresignResponse, {
            'photo presign successful': (r) => r.status === 200
        });
        
        if (photoPresignResponse.status === 200) {
            customMetrics.photosUploaded.add(1);
        }
    });
}

// Community browser behavior
function communityBrowser(authUser, baseURL) {
    group('Community Browser', function () {
        // Browse community posts
        const communityResponse = authenticatedRequest('GET', 
            `${baseURL}/community`, 
            authUser.token
        );
        
        customMetrics.apiResponseTime.add(communityResponse.timings.duration);
        
        check(communityResponse, {
            'community posts loaded': (r) => r.status === 200
        });
        
        // Occasionally check reminders
        if (Math.random() < 0.3) {
            const remindersResponse = authenticatedRequest('GET', 
                `${baseURL}/reminders`, 
                authUser.token
            );
            
            check(remindersResponse, {
                'reminders loaded': (r) => r.status === 200
            });
        }
        
        // Occasionally check research
        if (Math.random() < 0.2) {
            const researchResponse = authenticatedRequest('GET', 
                `${baseURL}/research`, 
                authUser.token
            );
            
            check(researchResponse, {
                'research loaded': (r) => r.status === 200
            });
        }
    });
}

// Handle errors and track metrics
export function handleSummary(data) {
    console.log('Load test completed. Generating summary...');
    
    const report = performanceAnalyzer.generateReport();
    
    return {
        'load-test-summary.json': JSON.stringify({
            testType: 'load',
            testConfig: SCENARIOS.LOAD,
            metrics: data.metrics,
            report: report,
            timestamp: new Date().toISOString(),
            successRate: data.setup_data ? data.setup_data.successRate : 0
        }, null, 2),
        stdout: generateLoadTestSummary(report, data)
    };
}

function generateLoadTestSummary(report, data) {
    return `
=== BIOPOINT LOAD TEST SUMMARY ===
Test Type: Sustained Load Test
Duration: 60 minutes
Concurrent Users: 1,000

=== PERFORMANCE METRICS ===
Total Requests: ${report.summary.totalRequests}
Average Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${report.summary.p99ResponseTime.toFixed(2)}ms
Error Rate: ${report.summary.errorRate.toFixed(2)}%
Throughput: ${report.summary.throughput.toFixed(2)} req/s

=== ENDPOINT PERFORMANCE ===
${Object.entries(report.endpointPerformance).map(([endpoint, perf]) => 
    `${endpoint}: ${perf.requests} requests, ${perf.avgResponseTime.toFixed(2)}ms avg, ${((perf.errors/perf.requests)*100).toFixed(2)}% errors`
).join('\n')}

=== RESOURCE UTILIZATION ===
Average Memory Usage: ${report.resourceUtilization.avgMemoryUsage.toFixed(2)} MB
Average CPU Usage: ${report.resourceUtilization.avgCpuUsage.toFixed(2)}%
Database Connection Pool: ${report.resourceUtilization.avgDbConnectionPoolUtilization.toFixed(2)}%
Cache Hit Rate: ${(report.resourceUtilization.cacheHitRate * 100).toFixed(2)}%

=== BOTTLENECKS IDENTIFIED ===
${report.bottlenecks.map(b => `[${b.severity.toUpperCase()}] ${b.type}: ${b.description}`).join('\n')}

=== OPTIMIZATION RECOMMENDATIONS ===
${report.recommendations.map(r => `[${r.priority.toUpperCase()}] ${r.category}: ${r.recommendation}`).join('\n')}

=== TEST RESULT ===
${data.state && data.state.num_failed_tests === 0 ? '✅ PASSED' : '❌ FAILED'}
Authentication Success Rate: ${((data.setup_data ? data.setup_data.successRate : 0) * 100).toFixed(2)}%
    `;
}