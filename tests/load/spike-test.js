// Spike Test - Sudden spike to 5,000 users for 10 minutes
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Spike test configuration
export const options = {
    stages: [
        // Normal load baseline
        { duration: SCENARIOS.SPIKE.NORMAL_DURATION, target: SCENARIOS.SPIKE.NORMAL_VUS },
        // Sudden spike to 5,000 users
        { duration: SCENARIOS.SPIKE.RAMP_UP, target: SCENARIOS.SPIKE.SPIKE_VUS },
        // Hold spike load
        { duration: SCENARIOS.SPIKE.SPIKE_DURATION, target: SCENARIOS.SPIKE.SPIKE_VUS },
        // Rapid ramp down
        { duration: SCENARIOS.SPIKE.RAMP_DOWN, target: SCENARIOS.SPIKE.NORMAL_VUS },
        // Return to normal load
        { duration: SCENARIOS.SPIKE.NORMAL_DURATION, target: SCENARIOS.SPIKE.NORMAL_VUS },
    ],
    
    thresholds: {
        // Focus on recovery time and stability
        'http_req_duration': [`p(50)<1000`, `p(95)<3000`, `p(99)<5000`],
        'http_req_failed': [`rate<0.03`], // 3% error rate acceptable during spike
        'http_reqs': [`rate>=2000`], // Expect higher throughput during spike
        
        // Monitor auto-scaling response
        'api_error_rate': [`rate<0.05`],
        'timeout_errors': ['count<50'],
        'rate_limit_errors': ['count<200'],
        
        // Recovery metrics
        'dashboard_load_time': [`p(95)<2000`],
        'labs_response_time': [`p(95)<1500`],
        'photos_response_time': [`p(95)<1200`],
    },
    
    // Monitor for auto-scaling events
    ext: {
        loadimpact: {
            name: 'BioPoint Spike Test',
            projectID: __ENV.K6_CLOUD_PROJECT_ID,
        }
    },
    
    tags: {
        test_type: 'spike',
        test_name: 'biopoint_spike_test'
    }
};

// Global variables
let authData = [];
let testUsers = [];
let spikeMetrics = {
    baselinePerformance: {},
    spikePerformance: {},
    recoveryPerformance: {},
    autoScalingDetected: false,
    recoveryTime: null
};

// Setup function
export function setup() {
    console.log('Setting up spike test - testing auto-scaling response...');
    
    // Create test users for spike test
    testUsers = authManager.createTestUsers(500); // Create 500 unique users
    
    // Authenticate users in batches
    const batchSize = 50;
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
    }
    
    const authSuccessRate = authData.length / testUsers.length;
    console.log(`Spike test setup complete: ${authData.length} out of ${testUsers.length} users authenticated (${(authSuccessRate * 100).toFixed(1)}%)`);
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: new Date().toISOString(),
        successRate: authSuccessRate
    };
}

// Main spike test function
export default function (data) {
    if (!data.authData || data.authData.length === 0) {
        console.error('No authentication data available');
        return;
    }
    
    // Determine current test phase
    const currentPhase = getCurrentPhase();
    
    // Execute appropriate behavior for current phase
    switch (currentPhase) {
        case 'baseline':
            executeBaselineBehavior(data);
            break;
        case 'spike_ramp':
            executeSpikeRampBehavior(data);
            break;
        case 'spike_hold':
            executeSpikeHoldBehavior(data);
            break;
        case 'recovery_ramp':
            executeRecoveryRampBehavior(data);
            break;
        case 'recovery_hold':
            executeRecoveryHoldBehavior(data);
            break;
    }
    
    // Track spike metrics
    trackSpikeMetrics(currentPhase);
}

// Determine current test phase based on VU count and timing
function getCurrentPhase() {
    const currentVUs = __VU;
    const maxVUs = __ENV.K6_VUS_MAX || 5000;
    const normalVUs = SCENARIOS.SPIKE.NORMAL_VUS;
    const spikeVUs = SCENARIOS.SPIKE.SPIKE_VUS;
    
    if (currentVUs <= normalVUs * 1.2) {
        return __ITER < 50 ? 'baseline' : 'recovery_hold';
    } else if (currentVUs >= spikeVUs * 0.8 && currentVUs <= spikeVUs * 1.2) {
        return __ITER < 20 ? 'spike_ramp' : 'spike_hold';
    } else {
        return 'recovery_ramp';
    }
}

// Baseline behavior (100 users)
function executeBaselineBehavior(data) {
    group('Baseline Phase', function () {
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) return;
        
        // Light dashboard usage
        const dashboardResponse = authenticatedRequest('GET', 
            `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        // Record baseline performance
        if (dashboardResponse.status === 200) {
            spikeMetrics.baselinePerformance.responseTime = dashboardResponse.timings.duration;
        }
        
        check(dashboardResponse, {
            'baseline: dashboard stable': (r) => r.status === 200,
            'baseline: response time acceptable': (r) => r.timings.duration < 1000
        });
        
        // Occasional data browsing
        if (Math.random() < 0.3) {
            const labsResponse = authenticatedRequest('GET', 
                `${CONFIG.BASE_URL}${ENDPOINTS.LABS_LIST}`, 
                authUser.token
            );
            
            check(labsResponse, {
                'baseline: labs accessible': (r) => r.status === 200
            });
        }
        
        sleep(2); // Normal think time
    });
}

// Spike ramp behavior (transition to 5,000 users)
function executeSpikeRampBehavior(data) {
    group('Spike Ramp Phase', function () {
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) return;
        
        // Monitor for auto-scaling triggers
        const startTime = Date.now();
        
        // Rapid dashboard access to trigger scaling
        const dashboardResponse = authenticatedRequest('GET', 
            `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        const responseTime = Date.now() - startTime;
        
        // Detect potential auto-scaling (response time spike indicates scaling event)
        if (responseTime > 3000 && !spikeMetrics.autoScalingDetected) {
            spikeMetrics.autoScalingDetected = true;
            console.log('Auto-scaling event detected during spike ramp');
        }
        
        check(dashboardResponse, {
            'spike ramp: dashboard accessible': (r) => r.status === 200,
            'spike ramp: scaling response acceptable': (r) => r.timings.duration < 5000
        });
        
        // Quick data access
        const concurrentRequests = [
            authenticatedRequest('GET', `${CONFIG.BASE_URL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${CONFIG.BASE_URL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${CONFIG.BASE_URL}/community`, authUser.token)
        ];
        
        concurrentRequests.forEach((response, index) => {
            if (response.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        sleep(0.5); // Reduced think time during ramp
    });
}

// Spike hold behavior (5,000 users sustained)
function executeSpikeHoldBehavior(data) {
    group('Spike Hold Phase', function () {
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) return;
        
        // Intensive operations under spike load
        const operations = [
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`, authUser.token),
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}/community`, authUser.token),
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}/markers`, authUser.token),
            () => authenticatedRequest('GET', `${CONFIG.BASE_URL}/biopoint/history`, authUser.token)
        ];
        
        // Execute multiple operations rapidly
        operations.forEach(operation => {
            const response = operation();
            
            // Record spike performance metrics
            if (response.status === 200) {
                spikeMetrics.spikePerformance.responseTime = response.timings.duration;
            }
            
            if (response.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        // Attempt uploads under spike load
        if (Math.random() < 0.4) {
            attemptSpikeUpload(authUser);
        }
        
        // Monitor for stability
        check(spikeMetrics.spikePerformance.responseTime, {
            'spike: system stable under load': (time) => time < 3000
        });
        
        sleep(0.2); // Minimal think time under spike
    });
}

// Recovery ramp behavior (transition back to normal load)
function executeRecoveryRampBehavior(data) {
    group('Recovery Ramp Phase', function () {
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) return;
        
        // Monitor recovery performance
        const recoveryStart = Date.now();
        
        // Test system recovery
        const dashboardResponse = authenticatedRequest('GET', 
            `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        const recoveryTime = Date.now() - recoveryStart;
        
        // Track recovery time
        if (!spikeMetrics.recoveryTime && dashboardResponse.status === 200 && recoveryTime < 2000) {
            spikeMetrics.recoveryTime = recoveryTime;
        }
        
        check(dashboardResponse, {
            'recovery ramp: system recovering': (r) => r.status === 200,
            'recovery ramp: response time improving': (r) => r.timings.duration < 2000
        });
        
        // Gradual return to normal operations
        if (Math.random() < 0.5) {
            const labsResponse = authenticatedRequest('GET', 
                `${CONFIG.BASE_URL}${ENDPOINTS.LABS_LIST}`, 
                authUser.token
            );
            
            check(labsResponse, {
                'recovery ramp: labs recovering': (r) => r.status === 200
            });
        }
        
        sleep(1); // Increasing think time during recovery
    });
}

// Recovery hold behavior (return to baseline)
function executeRecoveryHoldBehavior(data) {
    group('Recovery Hold Phase', function () {
        const authUser = getRandomAuthUser(data.authData);
        if (!authUser) return;
        
        // Verify system stability after spike
        const dashboardResponse = authenticatedRequest('GET', 
            `${CONFIG.BASE_URL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        // Record recovery performance
        if (dashboardResponse.status === 200) {
            spikeMetrics.recoveryPerformance.responseTime = dashboardResponse.timings.duration;
        }
        
        check(dashboardResponse, {
            'recovery hold: system stable': (r) => r.status === 200,
            'recovery hold: performance restored': (r) => r.timings.duration < 1500
        });
        
        // Normal operations
        if (Math.random() < 0.3) {
            const photosResponse = authenticatedRequest('GET', 
                `${CONFIG.BASE_URL}${ENDPOINTS.PHOTOS_LIST}`, 
                authUser.token
            );
            
            check(photosResponse, {
                'recovery hold: photos accessible': (r) => r.status === 200
            });
        }
        
        sleep(1.5); // Normal think time restored
    });
}

// Attempt file upload during spike
function attemptSpikeUpload(authUser) {
    const isLabReport = Math.random() < 0.6;
    const endpoint = isLabReport ? ENDPOINTS.LABS_PRESIGN : ENDPOINTS.PHOTOS_PRESIGN;
    
    const payload = JSON.stringify({
        filename: isLabReport ? 
            `spike_lab_${__VU}_${Date.now()}.pdf` :
            `spike_photo_${__VU}_${Date.now()}.jpg`,
        contentType: isLabReport ? 'application/pdf' : 'image/jpeg'
    });
    
    const presignResponse = authenticatedRequest('POST', 
        `${CONFIG.BASE_URL}${endpoint}`, 
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

// Track spike test metrics
function trackSpikeMetrics(phase) {
    performanceAnalyzer.addMetric('spike_phase', phase === 'baseline' ? 1 :
                                                phase === 'spike_ramp' ? 2 :
                                                phase === 'spike_hold' ? 3 :
                                                phase === 'recovery_ramp' ? 4 : 5, {
        phase: phase,
        timestamp: Date.now()
    });
}

// Handle spike test summary
export function handleSummary(data) {
    console.log('Spike test completed. Analyzing auto-scaling and recovery...');
    
    const report = performanceAnalyzer.generateReport();
    
    // Calculate recovery metrics
    const recoveryMetrics = calculateRecoveryMetrics(report);
    
    return {
        'spike-test-summary.json': JSON.stringify({
            testType: 'spike',
            testConfig: SCENARIOS.SPIKE,
            spikeMetrics: spikeMetrics,
            recoveryMetrics: recoveryMetrics,
            autoScalingDetected: spikeMetrics.autoScalingDetected,
            report: report,
            timestamp: new Date().toISOString()
        }, null, 2),
        stdout: generateSpikeTestSummary(report, recoveryMetrics, data)
    };
}

// Calculate recovery metrics
function calculateRecoveryMetrics(report) {
    const baselineTime = spikeMetrics.baselinePerformance.responseTime || 0;
    const spikeTime = spikeMetrics.spikePerformance.responseTime || 0;
    const recoveryTime = spikeMetrics.recoveryPerformance.responseTime || 0;
    
    return {
        baselineResponseTime: baselineTime,
        spikeResponseTime: spikeTime,
        recoveryResponseTime: recoveryTime,
        responseTimeDegradation: spikeTime > baselineTime ? ((spikeTime - baselineTime) / baselineTime * 100) : 0,
        recoveryEfficiency: baselineTime > 0 ? (baselineTime / recoveryTime) * 100 : 0,
        recoveryTimeMs: spikeMetrics.recoveryTime || 0,
        autoScalingDetected: spikeMetrics.autoScalingDetected
    };
}

function generateSpikeTestSummary(report, recoveryMetrics, data) {
    return `
=== BIOPOINT SPIKE TEST SUMMARY ===
Test Type: Spike Test (100 → 5,000 → 100 users)
Spike Duration: 10 minutes
Ramp Time: 30 seconds each direction

=== SPIKE TEST RESULTS ===
Total Requests: ${report.summary.totalRequests}
Average Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${report.summary.p99ResponseTime.toFixed(2)}ms
Error Rate: ${report.summary.errorRate.toFixed(2)}%
Peak Throughput: ${report.summary.throughput.toFixed(2)} req/s

=== AUTO-SCALING ANALYSIS ===
Auto-scaling Detected: ${spikeMetrics.autoScalingDetected ? '✅ YES' : '❌ NO'}
Response Time at Spike: ${recoveryMetrics.spikeResponseTime.toFixed(0)}ms
Response Time at Baseline: ${recoveryMetrics.baselineResponseTime.toFixed(0)}ms
Performance Degradation: ${recoveryMetrics.responseTimeDegradation.toFixed(1)}%

=== RECOVERY METRICS ===
Recovery Time: ${recoveryMetrics.recoveryTimeMs.toFixed(0)}ms
Recovery Efficiency: ${recoveryMetrics.recoveryEfficiency.toFixed(1)}%
System Stabilized: ${recoveryMetrics.recoveryResponseTime < recoveryMetrics.spikeResponseTime * 1.2 ? '✅ YES' : '❌ NO'}

=== SPIKE TEST PHASES ===
1. Baseline (100 users): ${recoveryMetrics.baselineResponseTime.toFixed(0)}ms avg response
2. Spike Ramp (100→5,000): Auto-scaling ${spikeMetrics.autoScalingDetected ? 'triggered' : 'not detected'}
3. Spike Hold (5,000 users): ${recoveryMetrics.spikeResponseTime.toFixed(0)}ms avg response
4. Recovery Ramp (5,000→100): ${recoveryMetrics.recoveryTimeMs.toFixed(0)}ms recovery time
5. Recovery Hold (100 users): ${recoveryMetrics.recoveryResponseTime.toFixed(0)}ms avg response

=== SPIKE TEST CONCLUSIONS ===
${spikeMetrics.autoScalingDetected ? 
    '✅ System successfully auto-scaled during spike' :
    '⚠️  Auto-scaling not clearly detected during spike'
}
${recoveryMetrics.recoveryTimeMs < 30000 ? 
    '✅ Fast recovery time (< 30 seconds)' :
    '⚠️  Recovery time exceeded 30 seconds'
}
${recoveryMetrics.recoveryResponseTime < recoveryMetrics.baselineResponseTime * 1.5 ? 
    '✅ Performance restored to near-baseline levels' :
    '⚠️  Performance did not fully recover to baseline'
}

=== AUTO-SCALING RECOMMENDATIONS ===
${!spikeMetrics.autoScalingDetected ? 
    '• Implement or tune auto-scaling policies\n• Set lower CPU/memory thresholds for scaling triggers\n• Reduce scaling cooldown periods' :
    '• Monitor auto-scaling response times\n• Tune scaling thresholds for faster response\n• Consider pre-scaling for predictable traffic patterns'
}
• Implement predictive scaling based on historical patterns
• Set up alerts for scaling events and performance degradation
• Test scaling policies regularly with synthetic load
    `;
}