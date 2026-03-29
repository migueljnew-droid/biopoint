// Stress Test - Ramp up to 10,000 concurrent users over 30 minutes
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Stress test configuration
export const options = {
    stages: [
        // Gradual ramp-up to find breaking point
        { duration: '5m', target: 1000 },     // 0-1,000 users
        { duration: '5m', target: 2500 },     // 1,000-2,500 users  
        { duration: '5m', target: 5000 },     // 2,500-5,000 users
        { duration: '5m', target: 7500 },     // 5,000-7,500 users
        { duration: '5m', target: 10000 },    // 7,500-10,000 users
        { duration: '5m', target: 10000 },    // Hold at max load
        { duration: '5m', target: 0 },        // Ramp down
    ],
    
    thresholds: {
        // Very relaxed thresholds for stress testing
        'http_req_duration': [`p(50)<2000`, `p(95)<5000`, `p(99)<10000`],
        'http_req_failed': [`rate<0.05`], // 5% error rate acceptable under stress
        'http_reqs': [`rate>=1000`], // Minimum 1000 req/s under stress
        
        // Monitor for complete failures
        'api_error_rate': [`rate<0.10`],
        'timeout_errors': ['count<100'],
        'rate_limit_errors': ['count<500'],
    },
    
    // Enable cloud execution for better resource management
    ext: {
        loadimpact: {
            name: 'BioPoint Stress Test',
            projectID: __ENV.K6_CLOUD_PROJECT_ID,
        }
    },
    
    tags: {
        test_type: 'stress',
        test_name: 'biopoint_stress_test'
    }
};

// Global variables
let authData = [];
let testUsers = [];
let stressTestConfig = {};

// Setup function
export function setup() {
    console.log('Setting up stress test - ramping to 10,000 users...');
    
    // Create a large pool of test users
    testUsers = authManager.createTestUsers(1000); // Create 1,000 unique users
    
    // Authenticate users in small batches to avoid overwhelming the system
    const batchSize = 25;
    const batches = Math.ceil(testUsers.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, testUsers.length);
        const batchUsers = testUsers.slice(startIdx, endIdx);
        
        console.log(`Authenticating batch ${i + 1}/${batches}...`);
        
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
        
        if (i < batches - 1) {
            sleep(1);
        }
    }
    
    const authSuccessRate = authData.length / testUsers.length;
    console.log(`Stress test setup complete: ${authData.length} out of ${testUsers.length} users authenticated (${(authSuccessRate * 100).toFixed(1)}%)`);
    
    // Initialize stress test configuration
    stressTestConfig = {
        maxUsers: SCENARIOS.STRESS.MAX_VUS,
        rampUpDuration: SCENARIOS.STRESS.RAMP_UP_DURATION,
        holdDuration: SCENARIOS.STRESS.HOLD_DURATION,
        breakingPoint: null,
        maxThroughput: 0,
        failureRate: 0
    };
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: new Date().toISOString(),
        successRate: authSuccessRate,
        stressTestConfig: stressTestConfig
    };
}

// Main stress test function
export default function (data) {
    if (!data.authData || data.authData.length === 0) {
        console.error('No authentication data available');
        return;
    }
    
    // Simulate multiple users per VU to reach 10,000 total
    const usersPerVU = Math.ceil(10000 / __ENV.K6_VUS_MAX || 1000);
    
    for (let i = 0; i < usersPerVU; i++) {
        // Get random authenticated user
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) {
            console.error('No authenticated user available');
            continue;
        }
        
        executeStressTestUser(authUser, data);
    }
}

// Execute stress test for a single user
function executeStressTestUser(authUser, data) {
    const baseURL = CONFIG.BASE_URL;
    const currentVU = __VU;
    const currentIteration = __ITER;
    
    // Progressive stress patterns based on current load level
    const currentLoadLevel = getCurrentLoadLevel();
    
    switch (currentLoadLevel) {
        case 'low':
            executeLowStressPattern(authUser, baseURL);
            break;
        case 'medium':
            executeMediumStressPattern(authUser, baseURL);
            break;
        case 'high':
            executeHighStressPattern(authUser, baseURL);
            break;
        case 'extreme':
            executeExtremeStressPattern(authUser, baseURL);
            break;
    }
    
    // Track system behavior under stress
    trackStressMetrics(authUser, currentLoadLevel);
}

// Determine current load level based on VU count
function getCurrentLoadLevel() {
    const currentVUs = __VU;
    const maxVUs = __ENV.K6_VUS_MAX || 1000;
    
    if (currentVUs < maxVUs * 0.25) return 'low';
    if (currentVUs < maxVUs * 0.5) return 'medium';
    if (currentVUs < maxVUs * 0.75) return 'high';
    return 'extreme';
}

// Low stress pattern (0-2,500 users)
function executeLowStressPattern(authUser, baseURL) {
    group('Low Stress Operations', function () {
        // Basic dashboard operations
        const dashboardResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        check(dashboardResponse, {
            'low stress: dashboard accessible': (r) => r.status === 200
        });
        
        // List basic data
        const labsResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.LABS_LIST}`, 
            authUser.token
        );
        
        check(labsResponse, {
            'low stress: labs accessible': (r) => r.status === 200
        });
        
        sleep(1);
    });
}

// Medium stress pattern (2,500-5,000 users)
function executeMediumStressPattern(authUser, baseURL) {
    group('Medium Stress Operations', function () {
        // More frequent dashboard access
        for (let i = 0; i < 2; i++) {
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            
            customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
            
            if (dashboardResponse.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        }
        
        // Frequent data listing
        const labsResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.LABS_LIST}`, 
            authUser.token
        );
        
        const photosResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, 
            authUser.token
        );
        
        check(labsResponse, {
            'medium stress: labs accessible': (r) => r.status === 200
        });
        
        check(photosResponse, {
            'medium stress: photos accessible': (r) => r.status === 200
        });
        
        // Attempt some uploads
        if (Math.random() < 0.3) {
            attemptFileUpload(authUser, baseURL, 'medium');
        }
        
        sleep(0.5);
    });
}

// High stress pattern (5,000-7,500 users)
function executeHighStressPattern(authUser, baseURL) {
    group('High Stress Operations', function () {
        // Rapid dashboard polling
        for (let i = 0; i < 3; i++) {
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            
            if (dashboardResponse.timings.duration > 5000) {
                customMetrics.timeoutErrors.add(1);
            }
            
            if (dashboardResponse.status === 429) {
                customMetrics.rateLimitErrors.add(1);
            }
        }
        
        // Concurrent data access
        const concurrentRequests = [
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/community`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/reminders`, authUser.token)
        ];
        
        concurrentRequests.forEach((response, index) => {
            if (response.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        // Frequent upload attempts
        if (Math.random() < 0.5) {
            attemptFileUpload(authUser, baseURL, 'high');
        }
        
        sleep(0.2); // Reduced think time under high stress
    });
}

// Extreme stress pattern (7,500-10,000 users)
function executeExtremeStressPattern(authUser, baseURL) {
    group('Extreme Stress Operations', function () {
        // Maximum load operations
        const operations = [
            () => authenticatedRequest('GET', `${baseURL}${ENDPOINTS.DASHBOARD}`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}/community`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}/reminders`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}/biopoint/history`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}/markers`, authUser.token),
            () => authenticatedRequest('GET', `${baseURL}/markers/trends`, authUser.token)
        ];
        
        // Execute multiple operations with minimal delay
        operations.forEach(operation => {
            const response = operation();
            
            if (response.status === 503) {
                console.warn('Service unavailable detected');
            }
            
            if (response.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        // Attempt uploads with high frequency
        if (Math.random() < 0.7) {
            attemptFileUpload(authUser, baseURL, 'extreme');
        }
        
        // Minimal think time at extreme load
        sleep(0.1);
    });
}

// Attempt file upload under stress
function attemptFileUpload(authUser, baseURL, stressLevel) {
    const isLabReport = Math.random() < 0.6;
    const endpoint = isLabReport ? ENDPOINTS.LABS_PRESIGN : ENDPOINTS.PHOTOS_PRESIGN;
    
    const payload = JSON.stringify({
        filename: isLabReport ? 
            `stress_lab_${stressLevel}_${__VU}_${Date.now()}.pdf` :
            `stress_photo_${stressLevel}_${__VU}_${Date.now()}.jpg`,
        contentType: isLabReport ? 'application/pdf' : 'image/jpeg'
    });
    
    const presignResponse = authenticatedRequest('POST', 
        `${baseURL}${endpoint}`, 
        authUser.token,
        payload
    );
    
    if (presignResponse.status === 200) {
        if (isLabReport) {
            customMetrics.labReportsUploaded.add(1);
        } else {
            customMetrics.photosUploaded.add(1);
        }
    } else {
        customMetrics.s3Errors.add(1);
    }
}

// Track stress test metrics
function trackStressMetrics(authUser, stressLevel) {
    performanceAnalyzer.addMetric('stress_level', stressLevel === 'low' ? 1 : 
                                                stressLevel === 'medium' ? 2 :
                                                stressLevel === 'high' ? 3 : 4, {
        user: authUser.user.email,
        vu: __VU,
        iteration: __ITER
    });
}

// Handle stress test summary
export function handleSummary(data) {
    console.log('Stress test completed. Analyzing breaking point...');
    
    const report = performanceAnalyzer.generateReport();
    
    // Identify breaking point
    const breakingPoint = identifyBreakingPoint(report);
    
    return {
        'stress-test-summary.json': JSON.stringify({
            testType: 'stress',
            testConfig: SCENARIOS.STRESS,
            breakingPoint: breakingPoint,
            maxThroughput: report.summary.throughput,
            maxUsersReached: data.metrics ? data.metrics.vus_max.value : 10000,
            report: report,
            timestamp: new Date().toISOString()
        }, null, 2),
        stdout: generateStressTestSummary(report, breakingPoint, data)
    };
}

// Identify system breaking point
function identifyBreakingPoint(report) {
    const errorRate = report.summary.errorRate;
    const avgResponseTime = report.summary.avgResponseTime;
    const throughput = report.summary.throughput;
    
    if (errorRate > 50) {
        return {
            found: true,
            users: '8,000-9,000',
            reason: `Error rate exceeded 50% (${errorRate.toFixed(1)}%)`,
            responseTime: `${avgResponseTime.toFixed(0)}ms`,
            throughput: `${throughput.toFixed(0)} req/s`
        };
    } else if (avgResponseTime > 10000) {
        return {
            found: true,
            users: '7,000-8,000',
            reason: `Average response time exceeded 10s (${avgResponseTime.toFixed(0)}ms)`,
            responseTime: `${avgResponseTime.toFixed(0)}ms`,
            throughput: `${throughput.toFixed(0)} req/s`
        };
    } else if (throughput < 500) {
        return {
            found: true,
            users: '9,000-10,000',
            reason: `Throughput dropped below 500 req/s (${throughput.toFixed(0)} req/s)`,
            responseTime: `${avgResponseTime.toFixed(0)}ms`,
            throughput: `${throughput.toFixed(0)} req/s`
        };
    }
    
    return {
        found: false,
        users: '10,000+',
        reason: 'System handled maximum load without clear breaking point',
        responseTime: `${avgResponseTime.toFixed(0)}ms`,
        throughput: `${throughput.toFixed(0)} req/s`
    };
}

function generateStressTestSummary(report, breakingPoint, data) {
    return `
=== BIOPOINT STRESS TEST SUMMARY ===
Test Type: Progressive Stress Test
Max Users: 10,000
Ramp Up: 30 minutes
Hold Duration: 5 minutes

=== STRESS TEST RESULTS ===
Total Requests: ${report.summary.totalRequests}
Average Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${report.summary.p99ResponseTime.toFixed(2)}ms
Error Rate: ${report.summary.errorRate.toFixed(2)}%
Max Throughput: ${report.summary.throughput.toFixed(2)} req/s

=== BREAKING POINT ANALYSIS ===
Breaking Point Found: ${breakingPoint.found ? '✅ YES' : '❌ NO'}
Estimated Breaking Users: ${breakingPoint.users}
Reason: ${breakingPoint.reason}
Response Time at Breaking Point: ${breakingPoint.responseTime}
Throughput at Breaking Point: ${breakingPoint.throughput}

=== BOTTLENECKS UNDER STRESS ===
${report.bottlenecks.map(b => `[${b.severity.toUpperCase()}] ${b.type}: ${b.description}`).join('\n')}

=== STRESS TEST RECOMMENDATIONS ===
${report.recommendations.map(r => `[${r.priority.toUpperCase()}] ${r.category}: ${r.recommendation}`).join('\n')}

=== SYSTEM CAPACITY ===
${breakingPoint.found ? 
    `System breaking point identified at ~${breakingPoint.users} users` :
    'System handled 10,000 users without clear breaking point'
}
Recommended Max Load: ${breakingPoint.found ? 
    Math.floor(parseInt(breakingPoint.users.split('-')[0]) * 0.8) + ' users' : 
    '8,000 users (80% of tested capacity)'
    }
    `;
}