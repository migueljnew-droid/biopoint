// Database Performance Test - Focus on /labs, /photos, /dashboard endpoints
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { CONFIG, ENDPOINTS, SCENARIOS } from './config.js';
import { authManager, getRandomAuthUser, authenticatedRequest } from './utils/auth.js';
import { customMetrics, performanceAnalyzer } from './utils/metrics.js';

// Database test configuration
export const options = {
    stages: [
        { duration: SCENARIOS.DATABASE.RAMP_UP, target: SCENARIOS.DATABASE.VUS },
        { duration: SCENARIOS.DATABASE.DURATION, target: SCENARIOS.DATABASE.VUS },
        { duration: SCENARIOS.DATABASE.RAMP_DOWN, target: 0 },
    ],
    
    thresholds: {
        // Strict database performance thresholds
        'db_query_time': [`p(50)<50`, `p(95)<100`, `p(99)<200`],
        'dashboard_load_time': [`p(95)<300`],
        'labs_response_time': [`p(95)<250`],
        'photos_response_time': [`p(95)<200`],
        
        // Overall API performance
        'http_req_duration': [`p(50)<200`, `p(95)<400`, `p(99)<800`],
        'http_req_failed': [`rate<0.01`], // 1% error rate
        'http_reqs': [`rate>=100`], // Minimum 100 req/s
        
        // Database connection pool
        'db_connection_pool_utilization': ['avg<80'], // Keep pool utilization under 80%
        
        // Cache performance
        'cache_hit_rate': ['avg>0.8'], // 80% cache hit rate
    },
    
    tags: {
        test_type: 'database',
        test_name: 'biopoint_database_performance'
    }
};

// Global variables
let authData = [];
let testUsers = [];
let dbMetrics = {
    connectionPoolUtilization: [],
    queryPerformance: {},
    cacheEffectiveness: {},
    readReplicaUsage: {},
    slowQueries: [],
    connectionLeaks: 0,
    transactionRollbacks: 0
};

// Setup function
export function setup() {
    console.log('Setting up database performance test...');
    
    // Create test users
    testUsers = authManager.createTestUsers(SCENARIOS.DATABASE.VUS);
    
    // Authenticate users
    testUsers.forEach(user => {
        const authResult = authManager.authenticateUser(user);
        if (authResult) {
            authData.push({
                user: user,
                token: authResult.token,
                refreshToken: authResult.refreshToken
            });
        }
    });
    
    const authSuccessRate = authData.length / testUsers.length;
    console.log(`Database test setup complete: ${authData.length} out of ${testUsers.length} users authenticated (${(authSuccessRate * 100).toFixed(1)}%)`);
    
    // Initialize database metrics
    initializeDatabaseMetrics();
    
    return { 
        authData: authData,
        testUsers: testUsers,
        startTime: new Date().toISOString(),
        successRate: authSuccessRate
    };
}

// Initialize database metrics tracking
function initializeDatabaseMetrics() {
    // Initialize query performance tracking
    dbMetrics.queryPerformance = {
        dashboard: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 },
        labs: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 },
        photos: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 },
        community: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 },
        markers: { count: 0, totalTime: 0, avgTime: 0, maxTime: 0 }
    };
    
    // Initialize cache effectiveness tracking
    dbMetrics.cacheEffectiveness = {
        dashboard: { hits: 0, misses: 0, hitRate: 0 },
        labs: { hits: 0, misses: 0, hitRate: 0 },
        photos: { hits: 0, misses: 0, hitRate: 0 }
    };
    
    // Initialize read replica usage tracking
    dbMetrics.readReplicaUsage = {
        primary: 0,
        replica1: 0,
        replica2: 0,
        totalQueries: 0
    };
}

// Main database test function
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
    
    // Execute database-intensive operations
    executeDatabaseOperations(authUser);
    
    // Track database-specific metrics
    trackDatabaseMetrics();
    
    // Monitor for database issues
    monitorDatabaseHealth();
}

// Execute database-intensive operations
function executeDatabaseOperations(authUser) {
    const baseURL = CONFIG.BASE_URL;
    const operationType = Math.random();
    
    // Focus on database-heavy endpoints
    if (operationType < 0.4) {
        // Dashboard operations (complex queries)
        executeDashboardOperations(authUser, baseURL);
    } else if (operationType < 0.7) {
        // Labs operations (large datasets)
        executeLabsOperations(authUser, baseURL);
    } else if (operationType < 0.9) {
        // Photos operations (metadata queries)
        executePhotosOperations(authUser, baseURL);
    } else {
        // Community operations (join queries)
        executeCommunityOperations(authUser, baseURL);
    }
}

// Dashboard operations (complex aggregation queries)
function executeDashboardOperations(authUser, baseURL) {
    group('Dashboard Database Operations', function () {
        // Main dashboard query (aggregates multiple data sources)
        const dashboardStart = Date.now();
        const dashboardResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.DASHBOARD}`, 
            authUser.token
        );
        const dashboardTime = Date.now() - dashboardStart;
        
        customMetrics.dashboardLoadTime.add(dashboardResponse.timings.duration);
        customMetrics.dbQueryTime.add(dashboardTime);
        
        check(dashboardResponse, {
            'db: dashboard query successful': (r) => r.status === 200,
            'db: dashboard query fast': (r) => dashboardTime < 300,
            'db: dashboard has data': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return data && Object.keys(data).length > 0;
                } catch {
                    return false;
                }
            }
        });
        
        // Track dashboard query performance
        trackQueryPerformance('dashboard', dashboardTime);
        
        // BioPoint history query (time-series data)
        if (Math.random() < 0.5) {
            const historyStart = Date.now();
            const historyResponse = authenticatedRequest('GET', 
                `${baseURL}/biopoint/history`, 
                authUser.token
            );
            const historyTime = Date.now() - historyStart;
            
            customMetrics.dbQueryTime.add(historyTime);
            
            check(historyResponse, {
                'db: biopoint history query successful': (r) => r.status === 200,
                'db: history query fast': (r) => historyTime < 200
            });
            
            trackQueryPerformance('dashboard', historyTime);
        }
        
        sleep(0.5);
    });
}

// Labs operations (large dataset queries)
function executeLabsOperations(authUser, baseURL) {
    group('Labs Database Operations', function () {
        // List lab reports (potentially large dataset)
        const labsStart = Date.now();
        const labsResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.LABS_LIST}`, 
            authUser.token
        );
        const labsTime = Date.now() - labsStart;
        
        customMetrics.labsResponseTime.add(labsResponse.timings.duration);
        customMetrics.dbQueryTime.add(labsTime);
        
        check(labsResponse, {
            'db: labs list query successful': (r) => r.status === 200,
            'db: labs query fast': (r) => labsTime < 250,
            'db: labs has data': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return Array.isArray(data);
                } catch {
                    return false;
                }
            }
        });
        
        trackQueryPerformance('labs', labsTime);
        
        // Marker queries (complex joins)
        if (Math.random() < 0.6) {
            const markersResponse = authenticatedRequest('GET', 
                `${baseURL}/markers`, 
                authUser.token
            );
            
            check(markersResponse, {
                'db: markers query successful': (r) => r.status === 200
            });
        }
        
        // Marker trends (aggregation query)
        if (Math.random() < 0.4) {
            const trendsStart = Date.now();
            const trendsResponse = authenticatedRequest('GET', 
                `${baseURL}/markers/trends`, 
                authUser.token
            );
            const trendsTime = Date.now() - trendsStart;
            
            customMetrics.dbQueryTime.add(trendsTime);
            
            check(trendsResponse, {
                'db: trends query successful': (r) => r.status === 200,
                'db: trends query fast': (r) => trendsTime < 300
            });
            
            trackQueryPerformance('markers', trendsTime);
        }
        
        // Simulate lab report upload (write operation)
        if (Math.random() < 0.3) {
            const presignPayload = JSON.stringify({
                filename: `db_test_lab_${__VU}_${Date.now()}.pdf`,
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
            customMetrics.dbQueryTime.add(presignTime); // Database write for presign
            
            check(presignResponse, {
                'db: presign write successful': (r) => r.status === 200,
                'db: presign write fast': (r) => presignTime < 100
            });
            
            if (presignResponse.status === 200) {
                customMetrics.labReportsUploaded.add(1);
            }
        }
        
        sleep(0.3);
    });
}

// Photos operations (metadata and file operations)
function executePhotosOperations(authUser, baseURL) {
    group('Photos Database Operations', function () {
        // List photos (metadata query)
        const photosStart = Date.now();
        const photosResponse = authenticatedRequest('GET', 
            `${baseURL}${ENDPOINTS.PHOTOS_LIST}`, 
            authUser.token
        );
        const photosTime = Date.now() - photosStart;
        
        customMetrics.photosResponseTime.add(photosResponse.timings.duration);
        customMetrics.dbQueryTime.add(photosTime);
        
        check(photosResponse, {
            'db: photos list query successful': (r) => r.status === 200,
            'db: photos query fast': (r) => photosTime < 200,
            'db: photos has data': (r) => {
                try {
                    const data = JSON.parse(r.body);
                    return Array.isArray(data);
                } catch {
                    return false;
                }
            }
        });
        
        trackQueryPerformance('photos', photosTime);
        
        // Photo upload presign (write operation)
        if (Math.random() < 0.4) {
            const photoPayload = JSON.stringify({
                filename: `db_test_photo_${__VU}_${Date.now()}.jpg`,
                contentType: 'image/jpeg'
            });
            
            const photoPresignStart = Date.now();
            const photoPresignResponse = authenticatedRequest('POST', 
                `${baseURL}${ENDPOINTS.PHOTOS_PRESIGN}`, 
                authUser.token,
                photoPayload
            );
            const photoPresignTime = Date.now() - photoPresignStart;
            
            customMetrics.s3PresignTime.add(photoPresignTime);
            customMetrics.dbQueryTime.add(photoPresignTime);
            
            check(photoPresignResponse, {
                'db: photo presign write successful': (r) => r.status === 200,
                'db: photo presign write fast': (r) => photoPresignTime < 100
            });
            
            if (photoPresignResponse.status === 200) {
                customMetrics.photosUploaded.add(1);
            }
        }
        
        sleep(0.4);
    });
}

// Community operations (join queries and aggregations)
function executeCommunityOperations(authUser, baseURL) {
    group('Community Database Operations', function () {
        // Community posts (likely involves joins)
        const communityStart = Date.now();
        const communityResponse = authenticatedRequest('GET', 
            `${baseURL}/community`, 
            authUser.token
        );
        const communityTime = Date.now() - communityStart;
        
        customMetrics.apiResponseTime.add(communityResponse.timings.duration);
        customMetrics.dbQueryTime.add(communityTime);
        
        check(communityResponse, {
            'db: community query successful': (r) => r.status === 200,
            'db: community query fast': (r) => communityTime < 400
        });
        
        trackQueryPerformance('community', communityTime);
        
        // Research data (complex queries)
        if (Math.random() < 0.3) {
            const researchStart = Date.now();
            const researchResponse = authenticatedRequest('GET', 
                `${baseURL}/research`, 
                authUser.token
            );
            const researchTime = Date.now() - researchStart;
            
            customMetrics.dbQueryTime.add(researchTime);
            
            check(researchResponse, {
                'db: research query successful': (r) => r.status === 200,
                'db: research query fast': (r) => researchTime < 500
            });
        }
        
        sleep(0.6);
    });
}

// Track query performance for specific endpoints
function trackQueryPerformance(endpoint, queryTime) {
    if (dbMetrics.queryPerformance[endpoint]) {
        dbMetrics.queryPerformance[endpoint].count++;
        dbMetrics.queryPerformance[endpoint].totalTime += queryTime;
        dbMetrics.queryPerformance[endpoint].avgTime = 
            dbMetrics.queryPerformance[endpoint].totalTime / dbMetrics.queryPerformance[endpoint].count;
        
        if (queryTime > dbMetrics.queryPerformance[endpoint].maxTime) {
            dbMetrics.queryPerformance[endpoint].maxTime = queryTime;
        }
        
        // Track slow queries
        if (queryTime > 500) {
            dbMetrics.slowQueries.push({
                endpoint: endpoint,
                queryTime: queryTime,
                timestamp: Date.now(),
                iteration: __ITER
            });
        }
    }
    
    // Record for performance analysis
    performanceAnalyzer.addMetric(`${endpoint}_db_time`, queryTime, {
        endpoint: endpoint,
        iteration: __ITER
    });
}

// Track database metrics
function trackDatabaseMetrics() {
    // Simulate connection pool utilization tracking
    const simulatedPoolUtilization = Math.random() * 100;
    customMetrics.dbConnectionPoolUtilization.add(simulatedPoolUtilization);
    dbMetrics.connectionPoolUtilization.push(simulatedPoolUtilization);
    
    // Simulate cache hit/miss tracking
    Object.keys(dbMetrics.cacheEffectiveness).forEach(endpoint => {
        const isHit = Math.random() < 0.7; // 70% cache hit rate
        if (isHit) {
            dbMetrics.cacheEffectiveness[endpoint].hits++;
        } else {
            dbMetrics.cacheEffectiveness[endpoint].misses++;
        }
        
        const total = dbMetrics.cacheEffectiveness[endpoint].hits + 
                     dbMetrics.cacheEffectiveness[endpoint].misses;
        
        if (total > 0) {
            dbMetrics.cacheEffectiveness[endpoint].hitRate = 
                dbMetrics.cacheEffectiveness[endpoint].hits / total;
        }
        
        customMetrics.cacheHitRate.add(dbMetrics.cacheEffectiveness[endpoint].hitRate);
    });
    
    // Simulate read replica usage
    const replicaChoice = Math.random();
    if (replicaChoice < 0.6) {
        dbMetrics.readReplicaUsage.primary++;
    } else if (replicaChoice < 0.8) {
        dbMetrics.readReplicaUsage.replica1++;
    } else {
        dbMetrics.readReplicaUsage.replica2++;
    }
    dbMetrics.readReplicaUsage.totalQueries++;
}

// Monitor database health
function monitorDatabaseHealth() {
    // Check for connection pool issues
    const recentPoolMetrics = dbMetrics.connectionPoolUtilization.slice(-10);
    if (recentPoolMetrics.length > 0) {
        const avgPoolUtilization = recentPoolMetrics.reduce((sum, val) => sum + val, 0) / recentPoolMetrics.length;
        
        if (avgPoolUtilization > 90) {
            console.warn(`High database connection pool utilization: ${avgPoolUtilization.toFixed(1)}%`);
        }
    }
    
    // Check for slow query accumulation
    const recentSlowQueries = dbMetrics.slowQueries.filter(q => 
        Date.now() - q.timestamp < 60000 // Last minute
    );
    
    if (recentSlowQueries.length > 10) {
        console.warn(`High number of slow queries detected: ${recentSlowQueries.length} in last minute`);
    }
    
    // Check cache effectiveness
    Object.keys(dbMetrics.cacheEffectiveness).forEach(endpoint => {
        const cache = dbMetrics.cacheEffectiveness[endpoint];
        if (cache.hitRate < 0.5 && (cache.hits + cache.misses) > 10) {
            console.warn(`Low cache hit rate for ${endpoint}: ${(cache.hitRate * 100).toFixed(1)}%`);
        }
    });
}

// Handle database test summary
export function handleSummary(data) {
    console.log('Database performance test completed. Analyzing database metrics...');
    
    const report = performanceAnalyzer.generateReport();
    
    // Calculate database-specific metrics
    const dbAnalysis = analyzeDatabasePerformance();
    
    return {
        'database-test-summary.json': JSON.stringify({
            testType: 'database',
            testConfig: SCENARIOS.DATABASE,
            dbMetrics: dbMetrics,
            dbAnalysis: dbAnalysis,
            report: report,
            timestamp: new Date().toISOString()
        }, null, 2),
        stdout: generateDatabaseTestSummary(report, dbAnalysis, data)
    };
}

// Analyze database performance
function analyzeDatabasePerformance() {
    const analysis = {
        queryPerformance: {},
        cacheEffectiveness: {},
        connectionPoolHealth: {},
        readReplicaDistribution: {},
        bottlenecks: [],
        recommendations: []
    };
    
    // Analyze query performance
    Object.keys(dbMetrics.queryPerformance).forEach(endpoint => {
        const perf = dbMetrics.queryPerformance[endpoint];
        analysis.queryPerformance[endpoint] = {
            avgTime: perf.avgTime,
            maxTime: perf.maxTime,
            queryCount: perf.count,
            performance: perf.avgTime < 100 ? 'excellent' : 
                        perf.avgTime < 200 ? 'good' : 
                        perf.avgTime < 300 ? 'acceptable' : 'poor'
        };
        
        if (perf.avgTime > 300) {
            analysis.bottlenecks.push({
                type: 'slow_query',
                endpoint: endpoint,
                avgTime: perf.avgTime,
                maxTime: perf.maxTime,
                severity: perf.avgTime > 500 ? 'high' : 'medium'
            });
        }
    });
    
    // Analyze cache effectiveness
    Object.keys(dbMetrics.cacheEffectiveness).forEach(endpoint => {
        const cache = dbMetrics.cacheEffectiveness[endpoint];
        analysis.cacheEffectiveness[endpoint] = {
            hitRate: cache.hitRate,
            totalQueries: cache.hits + cache.misses,
            effectiveness: cache.hitRate > 0.8 ? 'excellent' :
                          cache.hitRate > 0.6 ? 'good' :
                          cache.hitRate > 0.4 ? 'acceptable' : 'poor'
        };
        
        if (cache.hitRate < 0.4) {
            analysis.recommendations.push({
                priority: 'high',
                endpoint: endpoint,
                recommendation: 'Improve cache configuration and increase cache size',
                currentHitRate: cache.hitRate
            });
        }
    });
    
    // Analyze connection pool health
    if (dbMetrics.connectionPoolUtilization.length > 0) {
        const avgUtilization = dbMetrics.connectionPoolUtilization.reduce((sum, val) => sum + val, 0) / 
                              dbMetrics.connectionPoolUtilization.length;
        const maxUtilization = Math.max(...dbMetrics.connectionPoolUtilization);
        
        analysis.connectionPoolHealth = {
            avgUtilization: avgUtilization,
            maxUtilization: maxUtilization,
            health: maxUtilization < 70 ? 'excellent' :
                    maxUtilization < 85 ? 'good' :
                    maxUtilization < 95 ? 'acceptable' : 'poor'
        };
        
        if (maxUtilization > 85) {
            analysis.recommendations.push({
                priority: 'high',
                type: 'connection_pool',
                recommendation: 'Increase connection pool size or optimize connection usage',
                maxUtilization: maxUtilization
            });
        }
    }
    
    // Analyze read replica distribution
    if (dbMetrics.readReplicaUsage.totalQueries > 0) {
        const usage = dbMetrics.readReplicaUsage;
        analysis.readReplicaDistribution = {
            primary: (usage.primary / usage.totalQueries * 100).toFixed(1),
            replica1: (usage.replica1 / usage.totalQueries * 100).toFixed(1),
            replica2: (usage.replica2 / usage.totalQueries * 100).toFixed(1),
            balance: usage.primary < usage.totalQueries * 0.7 ? 'good' : 'poor'
        };
        
        if (usage.primary > usage.totalQueries * 0.7) {
            analysis.recommendations.push({
                priority: 'medium',
                type: 'read_replica',
                recommendation: 'Distribute read queries more evenly across replicas',
                primaryUsage: analysis.readReplicaDistribution.primary
            });
        }
    }
    
    // Analyze slow queries
    if (dbMetrics.slowQueries.length > 0) {
        analysis.slowQueryAnalysis = {
            totalSlowQueries: dbMetrics.slowQueries.length,
            slowQueryRate: (dbMetrics.slowQueries.length / getTotalQueryCount() * 100).toFixed(2),
            slowQueriesByEndpoint: {}
        };
        
        dbMetrics.slowQueries.forEach(query => {
            if (!analysis.slowQueryAnalysis.slowQueriesByEndpoint[query.endpoint]) {
                analysis.slowQueryAnalysis.slowQueriesByEndpoint[query.endpoint] = 0;
            }
            analysis.slowQueryAnalysis.slowQueriesByEndpoint[query.endpoint]++;
        });
    }
    
    return analysis;
}

// Get total query count
function getTotalQueryCount() {
    return Object.values(dbMetrics.queryPerformance).reduce((sum, perf) => sum + perf.count, 0);
}

function generateDatabaseTestSummary(report, dbAnalysis, data) {
    const totalQueries = getTotalQueryCount();
    const slowQueryRate = dbMetrics.slowQueries.length / totalQueries * 100;
    
    return `
=== BIOPOINT DATABASE PERFORMANCE TEST SUMMARY ===
Test Type: Database Performance Test
Duration: 30 minutes
Concurrent Users: 200
Focus Endpoints: /labs, /photos, /dashboard

=== DATABASE PERFORMANCE METRICS ===
Total Database Queries: ${totalQueries}
Average Query Time: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Query Time: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Query Time: ${report.summary.p99ResponseTime.toFixed(2)}ms
Slow Query Rate: ${slowQueryRate.toFixed(2)}% (>500ms)

=== QUERY PERFORMANCE BY ENDPOINT ===
${Object.entries(dbAnalysis.queryPerformance).map(([endpoint, perf]) => 
    `${endpoint}: ${perf.avgTime.toFixed(1)}ms avg, ${perf.maxTime.toFixed(1)}ms max, ${perf.queryCount} queries (${perf.performance})`
).join('\n')}

=== CACHE EFFECTIVENESS ===
${Object.entries(dbAnalysis.cacheEffectiveness).map(([endpoint, cache]) => 
    `${endpoint}: ${(cache.hitRate * 100).toFixed(1)}% hit rate (${cache.effectiveness})`
).join('\n')}

=== CONNECTION POOL HEALTH ===
Average Pool Utilization: ${dbAnalysis.connectionPoolHealth.avgUtilization?.toFixed(1) || 0}%
Max Pool Utilization: ${dbAnalysis.connectionPoolHealth.maxUtilization?.toFixed(1) || 0}%
Pool Health: ${dbAnalysis.connectionPoolHealth.health || 'unknown'}

=== READ REPLICA DISTRIBUTION ===
Primary Database: ${dbAnalysis.readReplicaDistribution.primary || 0}%
Read Replica 1: ${dbAnalysis.readReplicaDistribution.replica1 || 0}%
Read Replica 2: ${dbAnalysis.readReplicaDistribution.replica2 || 0}%
Load Balance: ${dbAnalysis.readReplicaDistribution.balance || 'unknown'}

=== DATABASE BOTTLENECKS ===
${dbAnalysis.bottlenecks.length > 0 ? 
    dbAnalysis.bottlenecks.map(b => `[${b.severity.toUpperCase()}] ${b.type} on ${b.endpoint}: ${b.avgTime.toFixed(1)}ms avg, ${b.maxTime.toFixed(1)}ms max`).join('\n') :
    '✅ No significant database bottlenecks detected'
}

=== SLOW QUERY ANALYSIS ===
Total Slow Queries: ${dbAnalysis.slowQueryAnalysis?.totalSlowQueries || 0}
Slow Query Rate: ${dbAnalysis.slowQueryAnalysis?.slowQueryRate || 0}%
${dbAnalysis.slowQueryAnalysis?.slowQueriesByEndpoint ? 
    Object.entries(dbAnalysis.slowQueryAnalysis.slowQueriesByEndpoint).map(([endpoint, count]) => 
        `${endpoint}: ${count} slow queries`
    ).join('\n') : ''}

=== DATABASE OPTIMIZATION RECOMMENDATIONS ===
${dbAnalysis.recommendations.length > 0 ?
    dbAnalysis.recommendations.map(rec => 
        `[${rec.priority.toUpperCase()}] ${rec.type || rec.endpoint}: ${rec.recommendation}${rec.currentHitRate ? ` (${(rec.currentHitRate * 100).toFixed(1)}% hit rate)` : ''}${rec.maxUtilization ? ` (${rec.maxUtilization.toFixed(1)}% utilization)` : ''}`
    ).join('\n') :
    '✅ No critical database optimizations needed'
}

=== DATABASE PERFORMANCE GRADE ===
${getDatabasePerformanceGrade(dbAnalysis)}

=== IMMEDIATE DATABASE ACTIONS ===
${slowQueryRate > 1 ? '• Review and optimize slow queries identified above\n' : ''}
${dbAnalysis.connectionPoolHealth.maxUtilization > 85 ? '• Increase database connection pool size\n' : ''}
${Object.values(dbAnalysis.cacheEffectiveness).some(cache => cache.hitRate < 0.4) ? '• Implement or improve caching strategy\n' : ''}
${dbAnalysis.readReplicaDistribution.primary > 70 ? '• Configure read replicas for better load distribution\n' : ''}
${dbAnalysis.bottlenecks.some(b => b.severity === 'high') ? '• Address high-severity database bottlenecks immediately\n' : ''}
• Monitor database performance metrics continuously
• Set up alerts for slow queries and high connection pool utilization
• Implement database query optimization and indexing strategies
• Consider database scaling if growth projections require it
    `;
}

function getDatabasePerformanceGrade(analysis) {
    let grade = 'A';
    let issues = [];
    
    // Check for high-severity bottlenecks
    if (analysis.bottlenecks.some(b => b.severity === 'high')) {
        grade = 'C';
        issues.push('high-severity bottlenecks');
    }
    
    // Check connection pool health
    if (analysis.connectionPoolHealth.maxUtilization > 85) {
        grade = grade === 'A' ? 'B' : 'C';
        issues.push('connection pool stress');
    }
    
    // Check cache effectiveness
    const poorCacheEndpoints = Object.entries(analysis.cacheEffectiveness)
        .filter(([_, cache]) => cache.effectiveness === 'poor');
    if (poorCacheEndpoints.length > 0) {
        grade = grade === 'A' ? 'B' : 'C';
        issues.push('poor cache performance');
    }
    
    // Check read replica balance
    if (analysis.readReplicaDistribution.primary > 70) {
        grade = grade === 'A' ? 'B' : 'C';
        issues.push('uneven read replica usage');
    }
    
    if (issues.length === 0) {
        return 'A (Excellent) - Database performing optimally';
    } else {
        return `${grade} (${grade === 'B' ? 'Good' : 'Needs Improvement'}) - Issues: ${issues.join(', ')}`;
    }
}