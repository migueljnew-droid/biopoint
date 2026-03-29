// Load testing configuration
export const CONFIG = {
    // Base URL for BioPoint API
    BASE_URL: __ENV.BASE_URL || 'http://localhost:3001',
    
    // Authentication configuration
    AUTH: {
        TEST_USER_EMAIL: __ENV.TEST_USER_EMAIL || 'test@biopoint.com',
        TEST_USER_PASSWORD: __ENV.TEST_USER_PASSWORD || 'TestPassword123!',
        TEST_USER_ID: __ENV.TEST_USER_ID || 'test-user-id'
    },
    
    // Test data configuration
    TEST_DATA: {
        LAB_REPORTS_COUNT: 100,
        PHOTOS_COUNT: 50,
        COMMUNITY_POSTS_COUNT: 200,
        MAX_FILE_SIZE: 10 * 1024 * 1024 // 10MB
    },
    
    // Performance thresholds
    THRESHOLDS: {
        // Response time thresholds (ms)
        HTTP_REQ_DURATION_P50: 200,
        HTTP_REQ_DURATION_P95: 500,
        HTTP_REQ_DURATION_P99: 1000,
        
        // Error rate thresholds (%)
        ERROR_RATE: 1,
        
        // Throughput thresholds (requests/sec)
        MIN_THROUGHPUT: 100
    },
    
    // Geographic regions for distributed testing
    REGIONS: {
        US_EAST: 'us-east-1',
        US_WEST: 'us-west-2',
        EU_WEST: 'eu-west-1',
        ASIA_PACIFIC: 'ap-southeast-1'
    },
    
    // Monitoring configuration
    MONITORING: {
        // Prometheus metrics endpoint
        PROMETHEUS_URL: __ENV.PROMETHEUS_URL || 'http://localhost:9090',
        
        // Grafana dashboard URL
        GRAFANA_URL: __ENV.GRAFANA_URL || 'http://localhost:3001',
        
        // Database monitoring
        DB_METRICS: true,
        S3_METRICS: true,
        CACHE_METRICS: true
    },
    
    // S3 Configuration
    S3: {
        BUCKET_NAME: __ENV.S3_BUCKET_NAME || 'biopoint-uploads',
        PRESIGN_EXPIRY: 3600, // 1 hour
        MAX_CONCURRENT_UPLOADS: 10
    }
};

// API Endpoints
export const ENDPOINTS = {
    // Authentication
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    
    // Core functionality
    DASHBOARD: '/dashboard',
    LABS: '/labs',
    PHOTOS: '/photos',
    COMMUNITY: '/community',
    
    // Specific endpoints for load testing
    LABS_LIST: '/labs',
    LABS_PRESIGN: '/labs/presign',
    PHOTOS_LIST: '/photos',
    PHOTOS_PRESIGN: '/photos/presign',
    DASHBOARD_DATA: '/dashboard',
    
    // Health and metrics
    HEALTH: '/health',
    HEALTH_DB: '/health/db',
    METRICS: '/metrics'
};

// Test scenarios configuration
export const SCENARIOS = {
    BASELINE: {
        VUS: 100,
        DURATION: '30m',
        RAMP_UP: '30s',
        RAMP_DOWN: '30s'
    },
    LOAD: {
        VUS: 1000,
        DURATION: '60m',
        RAMP_UP: '2m',
        RAMP_DOWN: '2m'
    },
    STRESS: {
        MAX_VUS: 10000,
        RAMP_UP_DURATION: '30m',
        HOLD_DURATION: '10m',
        RAMP_DOWN_DURATION: '10m'
    },
    SPIKE: {
        NORMAL_VUS: 100,
        SPIKE_VUS: 5000,
        NORMAL_DURATION: '5m',
        SPIKE_DURATION: '10m',
        RAMP_UP: '30s',
        RAMP_DOWN: '30s'
    },
    ENDURANCE: {
        VUS: 500,
        DURATION: '24h',
        RAMP_UP: '5m',
        RAMP_DOWN: '5m'
    },
    DATABASE: {
        VUS: 200,
        DURATION: '30m',
        RAMP_UP: '1m',
        RAMP_DOWN: '1m',
        FOCUS_ENDPOINTS: ['/labs', '/photos', '/dashboard']
    }
};

// Helper functions
export function generateTestData(index) {
    return {
        email: `testuser${index}@biopoint.com`,
        password: `TestPassword${index}!`,
        labReport: {
            filename: `lab_report_${index}.pdf`,
            contentType: 'application/pdf',
            size: Math.floor(Math.random() * 5 * 1024 * 1024) + 1024 * 1024 // 1-6MB
        },
        photo: {
            filename: `progress_photo_${index}.jpg`,
            contentType: 'image/jpeg',
            size: Math.floor(Math.random() * 3 * 1024 * 1024) + 500 * 1024 // 500KB-3.5MB
        }
    };
}

export function checkResponseTime(response, threshold = CONFIG.THRESHOLDS.HTTP_REQ_DURATION_P95) {
    const duration = response.timings.duration;
    return duration <= threshold;
}

export function logError(scenario, error, response) {
    console.error(`[${scenario}] Error:`, error);
    if (response) {
        console.error(`[${scenario}] Response status:`, response.status);
        console.error(`[${scenario}] Response body:`, response.body);
    }
}

export function generateMetricsSummary(metrics) {
    return {
        http_req_duration: {
            p50: metrics.http_req_duration.p50,
            p95: metrics.http_req_duration.p95,
            p99: metrics.http_req_duration.p99,
            avg: metrics.http_req_duration.avg,
            max: metrics.http_req_duration.max
        },
        http_req_failed: metrics.http_req_failed.rate,
        http_reqs: metrics.http_reqs.rate,
        vus: metrics.vus.value,
        vus_max: metrics.vus_max.value,
        data_received: metrics.data_received.rate,
        data_sent: metrics.data_sent.rate
    };
}