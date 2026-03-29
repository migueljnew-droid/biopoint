// Metrics exporter for load testing results
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MetricsExporter {
    constructor() {
        this.metrics = {
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {},
            performance: {},
            recommendations: []
        };
    }

    addTestMetrics(testName, metrics) {
        this.metrics.tests.push({
            name: testName,
            timestamp: new Date().toISOString(),
            metrics: metrics
        });
    }

    exportToJSON(filename = 'metrics-export.json') {
        const filepath = path.join(__dirname, filename);
        
        try {
            fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2));
            console.log(`✅ Metrics exported to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Error exporting metrics: ${error.message}`);
            throw error;
        }
    }

    exportToCSV(filename = 'metrics-export.csv') {
        const filepath = path.join(__dirname, filename);
        
        try {
            const csvData = this.convertToCSV();
            fs.writeFileSync(filepath, csvData);
            console.log(`✅ Metrics exported to CSV: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Error exporting metrics to CSV: ${error.message}`);
            throw error;
        }
    }

    exportToPrometheus(filename = 'metrics-prometheus.txt') {
        const filepath = path.join(__dirname, filename);
        
        try {
            const prometheusData = this.convertToPrometheusFormat();
            fs.writeFileSync(filepath, prometheusData);
            console.log(`✅ Prometheus metrics exported to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Error exporting Prometheus metrics: ${error.message}`);
            throw error;
        }
    }

    convertToCSV() {
        if (this.metrics.tests.length === 0) {
            return 'No test data available';
        }

        const headers = [
            'test_name',
            'timestamp',
            'duration_seconds',
            'vus_max',
            'iterations',
            'http_reqs',
            'http_req_duration_avg',
            'http_req_duration_p95',
            'http_req_duration_p99',
            'http_req_failed_rate',
            'data_received_bytes',
            'data_sent_bytes'
        ];

        const rows = this.metrics.tests.map(test => {
            const m = test.metrics;
            return [
                test.name,
                test.timestamp,
                m.duration || 0,
                m.vus_max || 0,
                m.iterations || 0,
                m.http_reqs || 0,
                m.http_req_duration?.avg || 0,
                m.http_req_duration?.p95 || 0,
                m.http_req_duration?.p99 || 0,
                m.http_req_failed?.rate || 0,
                m.data_received || 0,
                m.data_sent || 0
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    convertToPrometheusFormat() {
        if (this.metrics.tests.length === 0) {
            return '# No test data available';
        }

        let prometheusData = '# BioPoint Load Testing Metrics\n';
        prometheusData += `# Generated: ${this.metrics.timestamp}\n\n`;

        this.metrics.tests.forEach(test => {
            const labels = `test="${test.name}"`;
            const m = test.metrics;

            // HTTP request metrics
            prometheusData += `biopoint_http_requests_total{${labels}} ${m.http_reqs || 0}\n`;
            prometheusData += `biopoint_http_request_duration_avg{${labels}} ${m.http_req_duration?.avg || 0}\n`;
            prometheusData += `biopoint_http_request_duration_p95{${labels}} ${m.http_req_duration?.p95 || 0}\n`;
            prometheusData += `biopoint_http_request_duration_p99{${labels}} ${m.http_req_duration?.p99 || 0}\n`;
            prometheusData += `biopoint_http_request_failed_rate{${labels}} ${m.http_req_failed?.rate || 0}\n`;

            // Virtual user metrics
            prometheusData += `biopoint_vus_max{${labels}} ${m.vus_max || 0}\n`;
            prometheusData += `biopoint_iterations_total{${labels}} ${m.iterations || 0}\n`;

            // Data transfer metrics
            prometheusData += `biopoint_data_received_bytes{${labels}} ${m.data_received || 0}\n`;
            prometheusData += `biopoint_data_sent_bytes{${labels}} ${m.data_sent || 0}\n`;

            // Test duration
            prometheusData += `biopoint_test_duration_seconds{${labels}} ${m.duration || 0}\n\n`;
        });

        return prometheusData;
    }

    generateSummaryReport() {
        const summary = {
            totalTests: this.metrics.tests.length,
            dateRange: this.getDateRange(),
            performance: this.calculatePerformanceSummary(),
            trends: this.calculateTrends(),
            recommendations: this.generateRecommendations()
        };

        return summary;
    }

    getDateRange() {
        if (this.metrics.tests.length === 0) return null;
        
        const timestamps = this.metrics.tests.map(t => new Date(t.timestamp));
        const minDate = new Date(Math.min(...timestamps));
        const maxDate = new Date(Math.max(...timestamps));
        
        return {
            start: minDate.toISOString(),
            end: maxDate.toISOString(),
            duration: maxDate - minDate
        };
    }

    calculatePerformanceSummary() {
        if (this.metrics.tests.length === 0) return {};

        const allMetrics = this.metrics.tests.map(t => t.metrics);
        
        return {
            totalRequests: allMetrics.reduce((sum, m) => sum + (m.http_reqs || 0), 0),
            avgResponseTime: this.calculateAverage(allMetrics, m => m.http_req_duration?.avg || 0),
            avgP95ResponseTime: this.calculateAverage(allMetrics, m => m.http_req_duration?.p95 || 0),
            avgErrorRate: this.calculateAverage(allMetrics, m => m.http_req_failed?.rate || 0),
            totalDataReceived: allMetrics.reduce((sum, m) => sum + (m.data_received || 0), 0),
            totalDataSent: allMetrics.reduce((sum, m) => sum + (m.data_sent || 0), 0)
        };
    }

    calculateAverage(metrics, extractor) {
        const values = metrics.map(extractor).filter(v => v > 0);
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    }

    calculateTrends() {
        if (this.metrics.tests.length < 2) return {};

        const testsByType = {};
        this.metrics.tests.forEach(test => {
            if (!testsByType[test.name]) {
                testsByType[test.name] = [];
            }
            testsByType[test.name].push(test);
        });

        const trends = {};
        Object.keys(testsByType).forEach(type => {
            const tests = testsByType[type];
            if (tests.length >= 2) {
                const first = tests[0].metrics;
                const last = tests[tests.length - 1].metrics;
                
                trends[type] = {
                    responseTimeTrend: this.calculateTrend(
                        first.http_req_duration?.avg || 0,
                        last.http_req_duration?.avg || 0
                    ),
                    errorRateTrend: this.calculateTrend(
                        first.http_req_failed?.rate || 0,
                        last.http_req_failed?.rate || 0
                    ),
                    throughputTrend: this.calculateTrend(
                        first.http_reqs || 0,
                        last.http_reqs || 0
                    )
                };
            }
        });

        return trends;
    }

    calculateTrend(firstValue, lastValue) {
        if (firstValue === 0) return 0;
        return ((lastValue - firstValue) / firstValue) * 100;
    }

    generateRecommendations() {
        const recommendations = [];
        const performance = this.calculatePerformanceSummary();
        
        if (performance.avgErrorRate > 0.01) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: 'Error rate is above 1%. Investigate and fix failing requests.'
            });
        }
        
        if (performance.avgResponseTime > 1000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Average response time exceeds 1 second. Consider performance optimizations.'
            });
        }
        
        if (performance.avgP95ResponseTime > 2000) {
            recommendations.push({
                type: 'performance',
                priority: 'critical',
                message: 'P95 response time exceeds 2 seconds. Immediate optimization required.'
            });
        }
        
        return recommendations;
    }
}

// Example usage and data processing
if (import.meta.url === `file://${process.argv[1]}`) {
    const exporter = new MetricsExporter();
    
    // Add sample metrics from different test types
    exporter.addTestMetrics('baseline', {
        duration: 1800,
        vus_max: 100,
        iterations: 18000,
        http_reqs: 14500,
        http_req_duration: { avg: 180, p95: 420, p99: 780 },
        http_req_failed: { rate: 0.003 },
        data_received: 52428800,
        data_sent: 10485760
    });
    
    exporter.addTestMetrics('load', {
        duration: 3600,
        vus_max: 1000,
        iterations: 180000,
        http_reqs: 52000,
        http_req_duration: { avg: 380, p95: 890, p99: 1200 },
        http_req_failed: { rate: 0.008 },
        data_received: 209715200,
        data_sent: 41943040
    });
    
    exporter.addTestMetrics('stress', {
        duration: 3000,
        vus_max: 10000,
        iterations: 150000,
        http_reqs: 180000,
        http_req_duration: { avg: 8200, p95: 15000, p99: 25000 },
        http_req_failed: { rate: 0.52 },
        data_received: 1073741824,
        data_sent: 214748364
    });
    
    // Export in different formats
    console.log('Exporting metrics...');
    
    // Export to JSON
    const jsonFile = exporter.exportToJSON();
    console.log(`JSON export: ${jsonFile}`);
    
    // Export to CSV
    const csvFile = exporter.exportToCSV();
    console.log(`CSV export: ${csvFile}`);
    
    // Export to Prometheus format
    const prometheusFile = exporter.exportToPrometheus();
    console.log(`Prometheus export: ${prometheusFile}`);
    
    // Generate summary report
    const summary = exporter.generateSummaryReport();
    console.log('\n=== Performance Summary ===');
    console.log(`Total Requests: ${summary.performance.totalRequests.toLocaleString()}`);
    console.log(`Average Response Time: ${summary.performance.avgResponseTime.toFixed(2)}ms`);
    console.log(`Average P95 Response Time: ${summary.performance.avgP95ResponseTime.toFixed(2)}ms`);
    console.log(`Average Error Rate: ${(summary.performance.avgErrorRate * 100).toFixed(2)}%`);
    console.log(`Total Data Transferred: ${(summary.performance.totalDataReceived + summary.performance.totalDataSent / 1024 / 1024).toFixed(2)}MB`);
    
    if (summary.recommendations.length > 0) {
        console.log('\n=== Recommendations ===');
        summary.recommendations.forEach(rec => {
            console.log(`[${rec.priority.toUpperCase()}] ${rec.type}: ${rec.message}`);
        });
    }
}

export { MetricsExporter };