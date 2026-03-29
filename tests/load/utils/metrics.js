// Metrics collection and analysis utilities
import { Trend, Counter, Gauge, Rate } from 'k6/metrics';

// Custom metrics
export const customMetrics = {
    // Response time metrics
    apiResponseTime: new Trend('api_response_time', true),
    dashboardLoadTime: new Trend('dashboard_load_time', true),
    labsResponseTime: new Trend('labs_response_time', true),
    photosResponseTime: new Trend('photos_response_time', true),
    
    // Database metrics
    dbQueryTime: new Trend('db_query_time', true),
    dbConnectionPoolUtilization: new Gauge('db_connection_pool_utilization'),
    
    // S3 metrics
    s3UploadTime: new Trend('s3_upload_time', true),
    s3DownloadTime: new Trend('s3_download_time', true),
    s3PresignTime: new Trend('s3_presign_time', true),
    
    // Authentication metrics
    authSuccessRate: new Rate('auth_success_rate'),
    tokenRefreshTime: new Trend('token_refresh_time', true),
    
    // Error metrics
    apiErrorRate: new Rate('api_error_rate'),
    timeoutErrors: new Counter('timeout_errors'),
    rateLimitErrors: new Counter('rate_limit_errors'),
    authErrors: new Counter('auth_errors'),
    dbErrors: new Counter('db_errors'),
    s3Errors: new Counter('s3_errors'),
    
    // Business logic metrics
    successfulLogins: new Counter('successful_logins'),
    failedLogins: new Counter('failed_logins'),
    labReportsUploaded: new Counter('lab_reports_uploaded'),
    photosUploaded: new Counter('photos_uploaded'),
    dashboardViews: new Counter('dashboard_views'),
    
    // Resource utilization
    memoryUsage: new Gauge('memory_usage_mb'),
    cpuUsage: new Gauge('cpu_usage_percent'),
    
    // Geographic distribution
    requestsByRegion: new Counter('requests_by_region'),
    
    // Caching metrics
    cacheHitRate: new Rate('cache_hit_rate'),
    cacheMissRate: new Rate('cache_miss_rate')
};

// Performance analyzer class
export class PerformanceAnalyzer {
    constructor() {
        this.metrics = [];
        this.thresholds = {};
    }

    // Add metric data point
    addMetric(name, value, tags = {}) {
        if (customMetrics[name]) {
            customMetrics[name].add(value, tags);
        }
        
        this.metrics.push({
            name: name,
            value: value,
            timestamp: Date.now(),
            tags: tags
        });
    }

    // Set performance thresholds
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    // Check if metrics meet thresholds
    checkThresholds() {
        const violations = [];
        
        Object.keys(this.thresholds).forEach(metricName => {
            const threshold = this.thresholds[metricName];
            const recentMetrics = this.metrics.filter(m => m.name === metricName);
            
            if (recentMetrics.length === 0) return;
            
            const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
            
            if (avgValue > threshold) {
                violations.push({
                    metric: metricName,
                    value: avgValue,
                    threshold: threshold,
                    violation: avgValue - threshold
                });
            }
        });
        
        return violations;
    }

    // Generate performance report
    generateReport() {
        const report = {
            summary: {
                totalRequests: this.metrics.filter(m => m.name === 'apiResponseTime').length,
                avgResponseTime: this.calculateAverage('apiResponseTime'),
                p95ResponseTime: this.calculatePercentile('apiResponseTime', 0.95),
                p99ResponseTime: this.calculatePercentile('apiResponseTime', 0.99),
                errorRate: this.calculateErrorRate(),
                throughput: this.calculateThroughput()
            },
            endpointPerformance: this.analyzeEndpointPerformance(),
            resourceUtilization: this.analyzeResourceUtilization(),
            geographicDistribution: this.analyzeGeographicDistribution(),
            bottlenecks: this.identifyBottlenecks(),
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    // Calculate average for a metric
    calculateAverage(metricName) {
        const values = this.metrics.filter(m => m.name === metricName).map(m => m.value);
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    // Calculate percentile for a metric
    calculatePercentile(metricName, percentile) {
        const values = this.metrics.filter(m => m.name === metricName).map(m => m.value);
        if (values.length === 0) return 0;
        
        values.sort((a, b) => a - b);
        const index = Math.ceil(values.length * percentile) - 1;
        return values[Math.max(0, index)];
    }

    // Calculate error rate
    calculateErrorRate() {
        const totalRequests = this.metrics.filter(m => m.name === 'apiResponseTime').length;
        const errors = this.metrics.filter(m => m.name === 'apiErrorRate').length;
        return totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
    }

    // Calculate throughput
    calculateThroughput() {
        const apiMetrics = this.metrics.filter(m => m.name === 'apiResponseTime');
        if (apiMetrics.length < 2) return 0;
        
        const timeSpan = (apiMetrics[apiMetrics.length - 1].timestamp - apiMetrics[0].timestamp) / 1000; // seconds
        return timeSpan > 0 ? apiMetrics.length / timeSpan : 0;
    }

    // Analyze endpoint performance
    analyzeEndpointPerformance() {
        const endpoints = {};
        const endpointMetrics = this.metrics.filter(m => m.tags.endpoint);
        
        endpointMetrics.forEach(metric => {
            const endpoint = metric.tags.endpoint;
            if (!endpoints[endpoint]) {
                endpoints[endpoint] = {
                    requests: 0,
                    avgResponseTime: 0,
                    p95ResponseTime: 0,
                    errors: 0
                };
            }
            
            if (metric.name === 'apiResponseTime') {
                endpoints[endpoint].requests++;
            } else if (metric.name === 'apiErrorRate') {
                endpoints[endpoint].errors++;
            }
        });
        
        // Calculate averages per endpoint
        Object.keys(endpoints).forEach(endpoint => {
            const endpointResponseTimes = this.metrics.filter(m => 
                m.name === 'apiResponseTime' && m.tags.endpoint === endpoint
            ).map(m => m.value);
            
            if (endpointResponseTimes.length > 0) {
                endpoints[endpoint].avgResponseTime = 
                    endpointResponseTimes.reduce((sum, val) => sum + val, 0) / endpointResponseTimes.length;
                
                endpointResponseTimes.sort((a, b) => a - b);
                const p95Index = Math.ceil(endpointResponseTimes.length * 0.95) - 1;
                endpoints[endpoint].p95ResponseTime = endpointResponseTimes[Math.max(0, p95Index)];
            }
        });
        
        return endpoints;
    }

    // Analyze resource utilization
    analyzeResourceUtilization() {
        return {
            avgMemoryUsage: this.calculateAverage('memoryUsage'),
            avgCpuUsage: this.calculateAverage('cpuUsage'),
            avgDbConnectionPoolUtilization: this.calculateAverage('dbConnectionPoolUtilization'),
            cacheHitRate: this.calculateAverage('cacheHitRate')
        };
    }

    // Analyze geographic distribution
    analyzeGeographicDistribution() {
        const distribution = {};
        const geoMetrics = this.metrics.filter(m => m.tags.region);
        
        geoMetrics.forEach(metric => {
            const region = metric.tags.region;
            if (!distribution[region]) {
                distribution[region] = 0;
            }
            distribution[region]++;
        });
        
        return distribution;
    }

    // Identify performance bottlenecks
    identifyBottlenecks() {
        const bottlenecks = [];
        
        // Check response time bottlenecks
        const avgResponseTime = this.calculateAverage('apiResponseTime');
        if (avgResponseTime > 500) {
            bottlenecks.push({
                type: 'response_time',
                severity: avgResponseTime > 1000 ? 'high' : 'medium',
                description: `Average response time is ${avgResponseTime.toFixed(2)}ms`,
                recommendation: 'Optimize database queries and implement caching'
            });
        }
        
        // Check error rate bottlenecks
        const errorRate = this.calculateErrorRate();
        if (errorRate > 1) {
            bottlenecks.push({
                type: 'error_rate',
                severity: errorRate > 5 ? 'high' : 'medium',
                description: `Error rate is ${errorRate.toFixed(2)}%`,
                recommendation: 'Investigate and fix failing endpoints'
            });
        }
        
        // Check database bottlenecks
        const avgDbQueryTime = this.calculateAverage('dbQueryTime');
        if (avgDbQueryTime > 100) {
            bottlenecks.push({
                type: 'database',
                severity: avgDbQueryTime > 500 ? 'high' : 'medium',
                description: `Average database query time is ${avgDbQueryTime.toFixed(2)}ms`,
                recommendation: 'Optimize database queries and add indexes'
            });
        }
        
        // Check S3 bottlenecks
        const avgS3UploadTime = this.calculateAverage('s3UploadTime');
        if (avgS3UploadTime > 5000) {
            bottlenecks.push({
                type: 's3_upload',
                severity: avgS3UploadTime > 10000 ? 'high' : 'medium',
                description: `Average S3 upload time is ${avgS3UploadTime.toFixed(2)}ms`,
                recommendation: 'Implement multipart uploads and CDN'
            });
        }
        
        return bottlenecks;
    }

    // Generate performance recommendations
    generateRecommendations() {
        const recommendations = [];
        
        // Response time recommendations
        const avgResponseTime = this.calculateAverage('apiResponseTime');
        if (avgResponseTime > 200) {
            recommendations.push({
                priority: 'high',
                category: 'performance',
                recommendation: 'Implement response caching and optimize database queries',
                impact: 'Should reduce average response time by 30-50%'
            });
        }
        
        // Database recommendations
        const avgDbQueryTime = this.calculateAverage('dbQueryTime');
        if (avgDbQueryTime > 50) {
            recommendations.push({
                priority: 'high',
                category: 'database',
                recommendation: 'Add database indexes and implement read replicas',
                impact: 'Should reduce database query time by 40-60%'
            });
        }
        
        // Caching recommendations
        const cacheHitRate = this.calculateAverage('cacheHitRate');
        if (cacheHitRate < 0.8) {
            recommendations.push({
                priority: 'medium',
                category: 'caching',
                recommendation: 'Implement Redis caching for frequently accessed data',
                impact: 'Should improve cache hit rate to 85-90%'
            });
        }
        
        // Scaling recommendations
        const throughput = this.calculateThroughput();
        if (throughput < 100) {
            recommendations.push({
                priority: 'medium',
                category: 'scaling',
                recommendation: 'Implement horizontal scaling with load balancers',
                impact: 'Should increase throughput to 500+ requests/second'
            });
        }
        
        return recommendations;
    }
}

// Global performance analyzer instance
export const performanceAnalyzer = new PerformanceAnalyzer();