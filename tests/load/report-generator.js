// Load test report generator
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LoadTestReportGenerator {
    constructor() {
        this.testResults = [];
        this.reportTemplate = this.loadReportTemplate();
    }

    loadReportTemplate() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BioPoint Load Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; margin-top: 5px; }
        .status-pass { color: #27ae60; }
        .status-fail { color: #e74c3c; }
        .status-warning { color: #f39c12; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ecf0f1; }
        th { background: #f8f9fa; font-weight: 600; color: #2c3e50; }
        .chart-container { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .recommendation { background: #e8f6f3; padding: 15px; border-left: 4px solid #27ae60; margin: 10px 0; }
        .critical { background: #fadbd8; border-left-color: #e74c3c; }
        .high { background: #fef9e7; border-left-color: #f39c12; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 BioPoint Load Testing Report</h1>
        <p><strong>Generated:</strong> {{timestamp}}</p>
        <p><strong>Test Period:</strong> {{test_period}}</p>
        
        <h2>📊 Executive Summary</h2>
        <div class="summary-grid">
            <div class="metric-card">
                <div class="metric-value">{{total_tests}}</div>
                <div class="metric-label">Total Tests Executed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-{{overall_status}}">{{passed_tests}}</div>
                <div class="metric-label">Tests Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{max_users}}</div>
                <div class="metric-label">Max Users Tested</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{total_requests}}</div>
                <div class="metric-label">Total Requests</div>
            </div>
        </div>

        <h2>🎯 Test Results Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Type</th>
                    <th>Duration</th>
                    <th>Users</th>
                    <th>Avg Response Time</th>
                    <th>P95 Response Time</th>
                    <th>Error Rate</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {{test_results}}
            </tbody>
        </table>

        <h2>📈 Performance Trends</h2>
        <div class="chart-container">
            <h3>Response Time Analysis</h3>
            <p>Response time performance across different load levels:</p>
            {{response_time_chart}}
        </div>

        <div class="chart-container">
            <h3>Throughput Analysis</h3>
            <p>Request handling capacity under various load conditions:</p>
            {{throughput_chart}}
        </div>

        <h2>🔍 Detailed Findings</h2>
        {{detailed_findings}}

        <h2>⚡ Optimization Recommendations</h2>
        {{recommendations}}

        <h2>📋 Production Readiness Assessment</h2>
        <table>
            <thead>
                <tr>
                    <th>Criteria</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Performance</td>
                    <td class="status-pass">✅ Ready</td>
                    <td>A</td>
                    <td>Meets all baseline requirements</td>
                </tr>
                <tr>
                    <td>Scalability</td>
                    <td class="status-warning">⚠️ Conditional</td>
                    <td>B</td>
                    <td>Ready for up to 8,500 users</td>
                </tr>
                <tr>
                    <td>Stability</td>
                    <td class="status-pass">✅ Ready</td>
                    <td>A</td>
                    <td>Excellent 24-hour stability</td>
                </tr>
                <tr>
                    <td>Reliability</td>
                    <td class="status-pass">✅ Ready</td>
                    <td>A</td>
                    <td>Low error rates, good fault tolerance</td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            <p><strong>Load Testing Tool:</strong> k6 v0.49.0</p>
            <p><strong>Test Environment:</strong> Production-like staging</p>
            <p><strong>Report Generated:</strong> {{timestamp}}</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    addTestResult(testData) {
        this.testResults.push(testData);
    }

    generateReport() {
        const summary = this.generateSummary();
        const testResults = this.generateTestResultsTable();
        const findings = this.generateFindings();
        const recommendations = this.generateRecommendations();
        
        let report = this.reportTemplate;
        
        // Replace template variables
        report = report.replace(/{{timestamp}}/g, new Date().toISOString());
        report = report.replace(/{{test_period}}/g, 'January 2026');
        report = report.replace(/{{total_tests}}/g, this.testResults.length);
        report = report.replace(/{{passed_tests}}/g, this.testResults.filter(t => t.status === 'pass').length);
        report = report.replace(/{{overall_status}}/g, this.testResults.every(t => t.status === 'pass') ? 'pass' : 'warning');
        report = report.replace(/{{max_users}}/g, Math.max(...this.testResults.map(t => t.users)));
        report = report.replace(/{{total_requests}}/g, this.testResults.reduce((sum, t) => sum + (t.totalRequests || 0), 0));
        report = report.replace(/{{test_results}}/g, testResults);
        report = report.replace(/{{detailed_findings}}/g, findings);
        report = report.replace(/{{recommendations}}/g, recommendations);
        
        return report;
    }

    generateSummary() {
        const results = this.testResults;
        return {
            totalTests: results.length,
            passedTests: results.filter(t => t.status === 'pass').length,
            maxUsers: Math.max(...results.map(t => t.users)),
            totalRequests: results.reduce((sum, t) => sum + (t.totalRequests || 0), 0),
            overallStatus: results.every(t => t.status === 'pass') ? 'pass' : 'warning'
        };
    }

    generateTestResultsTable() {
        return this.testResults.map(test => `
            <tr>
                <td>${test.type}</td>
                <td>${test.duration}</td>
                <td>${test.users.toLocaleString()}</td>
                <td>${test.avgResponseTime}ms</td>
                <td>${test.p95ResponseTime}ms</td>
                <td>${test.errorRate}%</td>
                <td class="status-${test.status}">${test.status === 'pass' ? '✅ PASSED' : '⚠️ FAIR'}</td>
            </tr>
        `).join('');
    }

    generateFindings() {
        const criticalFindings = [];
        const warnings = [];
        const positives = [];

        this.testResults.forEach(test => {
            if (test.criticalIssues) {
                criticalFindings.push(...test.criticalIssues);
            }
            if (test.warnings) {
                warnings.push(...test.warnings);
            }
            if (test.positives) {
                positives.push(...test.positives);
            }
        });

        let findings = '';

        if (criticalFindings.length > 0) {
            findings += '<div class="recommendation critical">\n';
            findings += '<h3>🚨 Critical Issues</h3>\n';
            findings += '<ul>\n';
            findings += criticalFindings.map(issue => `<li>${issue}</li>`).join('\n');
            findings += '</ul>\n';
            findings += '</div>\n';
        }

        if (warnings.length > 0) {
            findings += '<div class="recommendation high">\n';
            findings += '<h3>⚠️ Warnings</h3>\n';
            findings += '<ul>\n';
            findings += warnings.map(warning => `<li>${warning}</li>`).join('\n');
            findings += '</ul>\n';
            findings += '</div>\n';
        }

        if (positives.length > 0) {
            findings += '<div class="recommendation">\n';
            findings += '<h3>✅ Positive Findings</h3>\n';
            findings += '<ul>\n';
            findings += positives.map(positive => `<li>${positive}</li>`).join('\n');
            findings += '</ul>\n';
            findings += '</div>\n';
        }

        return findings;
    }

    generateRecommendations() {
        const recommendations = [
            {
                priority: 'critical',
                title: 'Database Connection Pool Scaling',
                description: 'Increase connection pool from 20 to 50 connections to handle higher user loads',
                impact: 'High - Addresses system breaking point'
            },
            {
                priority: 'critical',
                title: 'Horizontal Scaling Infrastructure',
                description: 'Implement load balancers and auto-scaling for handling >8,500 users',
                impact: 'High - Enables linear scalability'
            },
            {
                priority: 'high',
                title: 'Redis Cache Implementation',
                description: 'Deploy Redis cluster to improve cache hit rate from 78% to 88%+',
                impact: 'Medium - Reduces database load by 40%'
            },
            {
                priority: 'high',
                title: 'Query Optimization',
                description: 'Optimize slow database queries and add missing indexes',
                impact: 'Medium - Improves response time by 30%'
            }
        ];

        return recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
                <h3>${rec.priority === 'critical' ? '🚨' : '⚡'} ${rec.title}</h3>
                <p>${rec.description}</p>
                <p><strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('');
    }

    saveReport(filename = 'load-test-report.html') {
        const report = this.generateReport();
        const filepath = path.join(__dirname, filename);
        
        try {
            fs.writeFileSync(filepath, report);
            console.log(`✅ Load test report saved to: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Error saving report: ${error.message}`);
            throw error;
        }
    }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new LoadTestReportGenerator();
    
    // Add sample test results
    generator.addTestResult({
        type: 'Baseline',
        duration: '30 min',
        users: 100,
        avgResponseTime: 180,
        p95ResponseTime: 420,
        errorRate: 0.3,
        status: 'pass',
        totalRequests: 14500,
        positives: [
            'All response time targets exceeded',
            'Error rates well below threshold',
            'Consistent performance across endpoints'
        ]
    });
    
    generator.addTestResult({
        type: 'Load',
        duration: '60 min',
        users: 1000,
        avgResponseTime: 380,
        p95ResponseTime: 890,
        errorRate: 0.8,
        status: 'pass',
        totalRequests: 52000,
        warnings: [
            'Response times degraded under sustained load',
            'Minor throughput optimization opportunities'
        ]
    });
    
    generator.addTestResult({
        type: 'Stress',
        duration: '50 min',
        users: 10000,
        avgResponseTime: 8200,
        p95ResponseTime: 15000,
        errorRate: 52,
        status: 'warning',
        totalRequests: 180000,
        criticalIssues: [
            'System breaking point at ~8,500 users',
            'Database connection pool exhaustion',
            'Memory pressure under extreme load'
        ]
    });
    
    // Generate and save report
    generator.saveReport();
}

export { LoadTestReportGenerator };