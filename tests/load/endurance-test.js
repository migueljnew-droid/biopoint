// Endurance Test - 500 concurrent users for 24 hours
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Endurance test configuration
export const options = {
    stages: [
        // Gradual ramp-up
        { duration: SCENARIOS.ENDURANCE.RAMP_UP, target: SCENARIOS.ENDURANCE.VUS },
        // Sustained load for 24 hours
        { duration: SCENARIOS.ENDURANCE.DURATION, target: SCENARIOS.ENDURANCE.VUS },
        // Gradual ramp-down
        { duration: SCENARIOS.ENDURANCE.RAMP_DOWN, target: 0 },
    ],
    
    thresholds: {
        // Strict thresholds for long-running test
        'http_req_duration': [`p(50)<300`, `p(95)<800`, `p(99)<1500`],
        'http_req_failed': [`rate<0.005`], // 0.5% error rate for endurance
        'http_reqs': [`rate>=250`], // Minimum 250 req/s sustained
        
        // Memory and resource thresholds
        'memory_usage': ['avg<2048'], // 2GB average memory usage
        'db_query_time': [`p(95)<200`],
        
        // No memory leaks or degradation over time
        'api_response_time': [`avg<500`, `p(95)<1000`],
    },
    
    // Enable detailed monitoring for long-running test
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)', 'p(99.9)', 'stddev', 'count'],
    
    // Configure for cloud execution
    ext: {
        loadimpact: {
            name: 'BioPoint Endurance Test',
            projectID: __ENV.K6_CLOUD_PROJECT_ID,
            distribution: {
                'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 25 },
                'amazon:us:paloalto': { loadZone: 'amazon:us:paloalto', percent: 25 },
                'amazon:eu:ireland': { loadZone: 'amazon:eu:ireland', percent: 25 },
                'amazon:ap:sydney': { loadZone: 'amazon:ap:sydney', percent: 25 }
            }
        }
    },
    
    tags: {
        test_type: 'endurance',
        test_name: 'biopoint_endurance_test'
    }
};

// Global variables
let authData = [];
let testUsers = [];
let enduranceMetrics = {
    hourlyPerformance: [],
    memoryTrend: [],
    errorTrend: [],
    throughputTrend: [],
    degradationDetected: false,
    memoryLeakDetected: false,
    stabilityScore: 0
};

// Setup function
export function setup() {
    console.log('Setting up 24-hour endurance test...');
    
    // Create test users for endurance test
    testUsers = authManager.createTestUsers(SCENARIOS.ENDURANCE.VUS);
    
    // Authenticate users
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
    console.log(`Endurance test setup complete: ${authData.length} out of ${testUsers.length} users authenticated (${(authSuccessRate * 100).toFixed(1)}%)`);
    
    // Initialize endurance tracking
    enduranceMetrics.startTime = new Date().toISOString();
    enduranceMetrics.initialMemoryUsage = 0;
    enduranceMetrics.initialThroughput = 0;
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: enduranceMetrics.startTime,
        successRate: authSuccessRate
    };
}

// Main endurance test function
export default function (data) {
    if (!data.authData || data.authData.length === 0) {
        console.error('No authentication data available');
        return;
    }
    
    // Get authenticated user
    const authUser = getRandomAuthUser(data.authData);
    if (!authUser) {
        console.error('No authenticated user available');
        return;
    }
    
    // Execute endurance test patterns
    executeEndurancePattern(authUser);
    
    // Track endurance metrics hourly
    trackEnduranceMetrics();
    
    // Detect performance degradation
    detectDegradation();
}

// Execute endurance test pattern
function executeEndurancePattern(authUser) {
    const baseURL = CONFIG.BASE_URL;
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60)) % 24; // Current hour of day
    
    // Simulate realistic daily usage patterns
    const usagePattern = getDailyUsagePattern(currentHour);
    
    switch (usagePattern) {
        case 'low':
            executeLowUsagePattern(authUser, baseURL);
            break;
        case 'medium':
            executeMediumUsagePattern(authUser, baseURL);
            break;
        case 'high':
            executeHighUsagePattern(authUser, baseURL);
            break;
        case 'peak':
            executePeakUsagePattern(authUser, baseURL);
            break;
    }
}

// Get daily usage pattern based on hour
function getDailyUsagePattern(hour) {
    // Simulate realistic daily usage patterns
    if (hour >= 2 && hour < 6) return 'low';      // Night time
    if (hour >= 6 && hour < 9) return 'medium';   // Morning
    if (hour >= 9 && hour < 17) return 'high';    // Business hours
    if (hour >= 17 && hour < 22) return 'peak';   // Evening peak
    return 'medium';                               // Late evening
}

// Low usage pattern (night time)
function executeLowUsagePattern(authUser, baseURL) {
    group('Low Usage Pattern', function () {
        // Infrequent dashboard checks
        if (Math.random() < 0.3) {
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            
            check(dashboardResponse, {
                'endurance low: dashboard accessible': (r) => r.status === 200
            });
        }
        
        // Occasional data browsing
        if (Math.random() < 0.2) {
            const labsResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.LABS_LIST}`, 
                authUser.token
            );
            
            check(labsResponse, {
                'endurance low: labs accessible': (r) => r.status === 200
            });
        }
        
        sleep(5); // Long think time during low usage
    });
}

// Medium usage pattern (morning/late evening)
function executeMediumUsagePattern(authUser, baseURL) {
    group('Medium Usage Pattern', function () {
        // Regular dashboard access
        const dashboardResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        
        customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
        
        check(dashboardResponse, {
            'endurance medium: dashboard accessible': (r) => r.status === 200,
            'endurance medium: response time stable': (r) => r.timings.duration < 1000
        });
        
        // Browse data
        if (Math.random() < 0.6) {
            const labsResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.LABS_LIST}`, 
                authUser.token
            );
            
            customMetrics.labsResponseTime.add(labsResponse.timings.duration);
            
            check(labsResponse, {
                'endurance medium: labs accessible': (r) => r.status === 200
            });
        }
        
        // Occasional uploads
        if (Math.random() < 0.2) {
            attemptEnduranceUpload(authUser);
        }
        
        sleep(2); // Normal think time
    });
}

// High usage pattern (business hours)
function executeHighUsagePattern(authUser, baseURL) {
    group('High Usage Pattern', function () {
        // Frequent dashboard access
        for (let i = 0; i < 2; i++) {
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            
            customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
            customMetrics.apiResponseTime.add(dashboardResponse.timings.duration);
            
            if (dashboardResponse.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        }
        
        // Multiple data operations
        const dataOperations = [
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/community`, authUser.token)
        ];
        
        dataOperations.forEach(response => {
            if (response.status === 200) {
                customMetrics.labsResponseTime.add(response.timings.duration);
            } else {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        // Regular uploads
        if (Math.random() < 0.3) {
            attemptEnduranceUpload(authUser);
        }
        
        sleep(1); // Reduced think time during high usage
    });
}

// Peak usage pattern (evening)
function executePeakUsagePattern(authUser, baseURL) {
    group('Peak Usage Pattern', function () {
        // Intensive dashboard usage
        for (let i = 0; i < 3; i++) {
            const dashboardResponse = authenticatedRequest('GET', 
                `${baseURL}${ENDPOINTS.DASHBOARD}`, 
                authUser.token
            );
            
            customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
            customMetrics.apiResponseTime.add(dashboardResponse.timings.duration);
            
            if (dashboardResponse.timings.duration > 2000) {
                enduranceMetrics.degradationDetected = true;
            }
        }
        
        // Comprehensive data access
        const peakOperations = [
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.DASHBOARD}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.LABS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/community`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/reminders`, authUser.token),
            authenticatedRequest('GET', `${baseURL}/markers`, authUser.token)
        ];
        
        peakOperations.forEach(response => {
            if (response.status !== 200) {
                customMetrics.apiErrorRate.add(1);
            }
        });
        
        // Frequent uploads during peak
        if (Math.random() < 0.4) {
            attemptEnduranceUpload(authUser);
        }
        
        sleep(0.5); // Minimal think time during peak
    });
}

// Attempt file upload during endurance test
function attemptEnduranceUpload(authUser) {
    const isLabReport = Math.random() < 0.6;
    const endpoint = isLabReport ? ENDPOINTS.LABS_PRESIGN : ENDPOINTS.PHOTOS_PRESIGN;
    
    const payload = JSON.stringify({
        filename: isLabReport ? 
            `endurance_lab_${__VU}_${Date.now()}.pdf` :
            `endurance_photo_${__VU}_${Date.now()}.jpg`,
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

// Track endurance metrics hourly
function trackEnduranceMetrics() {
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
    const lastTrackedHour = enduranceMetrics.lastTrackedHour;
    
    if (currentHour !== lastTrackedHour) {
        // Record hourly metrics
        const hourlyMetric = {
            hour: currentHour,
            timestamp: Date.now(),
            responseTime: performanceAnalyzer.calculateAverage('api_response_time'),
            errorRate: performanceAnalyzer.calculateErrorRate(),
            throughput: performanceAnalyzer.calculateThroughput(),
            memoryUsage: performanceAnalyzer.calculateAverage('memory_usage'),
            cpuUsage: performanceAnalyzer.calculateAverage('cpu_usage')
        };
        
        enduranceMetrics.hourlyPerformance.push(hourlyMetric);
        enduranceMetrics.lastTrackedHour = currentHour;
        
        console.log(`Hour ${currentHour} metrics recorded: ${hourlyMetric.responseTime.toFixed(2)}ms avg response, ${hourlyMetric.errorRate.toFixed(2)}% errors`);
    }
}

// Detect performance degradation and memory leaks
function detectDegradation() {
    const hourlyData = enduranceMetrics.hourlyPerformance;
    
    if (hourlyData.length < 3) return; // Need at least 3 hours of data
    
    // Check for performance degradation
    const recentHours = hourlyData.slice(-3);
    const earlierHours = hourlyData.slice(-6, -3);
    
    if (recentHours.length > 0 && earlierHours.length > 0) {
        const recentAvgResponse = recentHours.reduce((sum, h) => sum + h.responseTime, 0) / recentHours.length;
        const earlierAvgResponse = earlierHours.reduce((sum, h) => sum + h.responseTime, 0) / earlierHours.length;
        
        // Detect degradation (>20% increase in response time)
        if (recentAvgResponse > earlierAvgResponse * 1.2) {
            enduranceMetrics.degradationDetected = true;
            console.warn(`Performance degradation detected: ${((recentAvgResponse - earlierAvgResponse) / earlierAvgResponse * 100).toFixed(1)}% increase in response time`);
        }
    }
    
    // Check for memory leaks
    const memoryData = hourlyData.map(h => h.memoryUsage).filter(m => m > 0);
    if (memoryData.length >= 6) {
        const earlyMemory = memoryData.slice(0, 3).reduce((sum, m) => sum + m, 0) / 3;
        const recentMemory = memoryData.slice(-3).reduce((sum, m) => sum + m, 0) / 3;
        
        // Detect memory leak (>50% increase in memory usage)
        if (recentMemory > earlyMemory * 1.5) {
            enduranceMetrics.memoryLeakDetected = true;
            console.warn(`Memory leak detected: ${((recentMemory - earlyMemory) / earlyMemory * 100).toFixed(1)}% increase in memory usage`);
        }
    }
}

// Handle endurance test summary
export function handleSummary(data) {
    console.log('24-hour endurance test completed. Analyzing long-term stability...');
    
    const report = performanceAnalyzer.generateReport();
    
    // Calculate stability score
    const stabilityScore = calculateStabilityScore(report);
    
    return {
        'endurance-test-summary.json': JSON.stringify({
            testType: 'endurance',
            testConfig: SCENARIOS.ENDURANCE,
            enduranceMetrics: enduranceMetrics,
            stabilityScore: stabilityScore,
            report: report,
            timestamp: new Date().toISOString(),
            duration: '24 hours'
        }, null, 2),
        stdout: generateEnduranceTestSummary(report, stabilityScore, data)
    };
}

// Calculate stability score
function calculateStabilityScore(report) {
    let score = 100;
    
    // Penalize based on error rate
    const errorRate = report.summary.errorRate;
    if (errorRate > 1) score -= 20;
    else if (errorRate > 0.5) score -= 10;
    
    // Penalize based on performance degradation
    if (enduranceMetrics.degradationDetected) score -= 25;
    
    // Penalize based on memory leaks
    if (enduranceMetrics.memoryLeakDetected) score -= 30;
    
    // Penalize based on response time consistency
    const avgResponseTime = report.summary.avgResponseTime;
    if (avgResponseTime > 1000) score -= 15;
    else if (avgResponseTime > 500) score -= 5;
    
    return Math.max(0, score);
}

function generateEnduranceTestSummary(report, stabilityScore, data) {
    const hourlyData = enduranceMetrics.hourlyPerformance;
    const firstHour = hourlyData.length > 0 ? hourlyData[0] : null;
    const lastHour = hourlyData.length > 0 ? hourlyData[hourlyData.length - 1] : null;
    
    return `
=== BIOPOINT ENDURANCE TEST SUMMARY ===
Test Type: 24-Hour Endurance Test
Duration: 24 hours
Concurrent Users: 500

=== ENDURANCE TEST RESULTS ===
Total Requests: ${report.summary.totalRequests}
Average Response Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${report.summary.p99ResponseTime.toFixed(2)}ms
Error Rate: ${report.summary.errorRate.toFixed(2)}%
Average Throughput: ${report.summary.throughput.toFixed(2)} req/s

=== STABILITY ANALYSIS ===
Stability Score: ${stabilityScore}/100 (${getStabilityGrade(stabilityScore)})
Performance Degradation: ${enduranceMetrics.degradationDetected ? '❌ DETECTED' : '✅ NONE'}
Memory Leak Detected: ${enduranceMetrics.memoryLeakDetected ? '❌ DETECTED' : '✅ NONE'}
System Crash: ${data.state && data.state.num_failed_tests === 0 ? '✅ NONE' : '❌ DETECTED'}

=== HOURLY PERFORMANCE TRENDS ===
First Hour Performance:
${firstHour ? `  Response Time: ${firstHour.responseTime.toFixed(2)}ms` : 'N/A'}
${firstHour ? `  Error Rate: ${firstHour.errorRate.toFixed(2)}%` : 'N/A'}
${firstHour ? `  Throughput: ${firstHour.throughput.toFixed(2)} req/s` : 'N/A'}
${firstHour ? `  Memory Usage: ${firstHour.memoryUsage.toFixed(2)}MB` : 'N/A'}

Last Hour Performance:
${lastHour ? `  Response Time: ${lastHour.responseTime.toFixed(2)}ms` : 'N/A'}
${lastHour ? `  Error Rate: ${lastHour.errorRate.toFixed(2)}%` : 'N/A'}
${lastHour ? `  Throughput: ${lastHour.throughput.toFixed(2)} req/s` : 'N/A'}
${lastHour ? `  Memory Usage: ${lastHour.memoryUsage.toFixed(2)}MB` : 'N/A'}

=== ENDURANCE TEST CONCLUSIONS ===
${stabilityScore >= 90 ? '✅ EXCELLENT: System showed exceptional stability over 24 hours' :
  stabilityScore >= 80 ? '✅ GOOD: System showed good stability with minor issues' :
  stabilityScore >= 70 ? '⚠️  FAIR: System showed acceptable stability with some concerns' :
  '❌ POOR: System showed significant stability issues over 24 hours'}

${enduranceMetrics.degradationDetected ? 
    '⚠️  Performance degradation detected - investigate database queries and caching' : ''}
${enduranceMetrics.memoryLeakDetected ? 
    '⚠️  Memory leak detected - investigate memory management and garbage collection' : ''}

=== LONG-TERM STABILITY RECOMMENDATIONS ===
${stabilityScore < 90 ? '• Implement performance monitoring and alerting\n• Set up automated performance regression detection' : ''}
${enduranceMetrics.degradationDetected ? '• Optimize database queries and implement query result caching\n• Add database connection pooling and optimize connection management' : ''}
${enduranceMetrics.memoryLeakDetected ? '• Implement memory usage monitoring and garbage collection tuning\n• Review object lifecycle management and memory allocation patterns' : ''}
• Schedule regular endurance tests to detect long-term issues
• Implement automated cleanup of temporary data and logs
• Monitor resource utilization trends over time
• Set up alerts for memory usage and response time degradation
    `;
}

function getStabilityGrade(score) {
    if (score >= 90) return 'A (Excellent)';
    if (score >= 80) return 'B (Good)';
    if (score >= 70) return 'C (Fair)';
    if (score >= 60) return 'D (Poor)';
    return 'F (Failed)';
}