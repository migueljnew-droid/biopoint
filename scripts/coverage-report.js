#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CoverageReporter {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.apiDir = path.join(this.projectRoot, 'apps', 'api');
    this.mobileDir = path.join(this.projectRoot, 'apps', 'mobile');
    this.coverageDir = path.join(this.apiDir, 'coverage');
    this.reportPath = path.join(this.projectRoot, 'coverage-report.json');
  }

  async generateCoverageReport() {
    console.log('🧪 BioPoint Test Coverage Report Generator');
    console.log('==========================================');

    try {
      // Run tests with coverage
      console.log('Running API tests with coverage...');
      this.runApiTests();

      console.log('Running Mobile tests with coverage...');
      this.runMobileTests();

      // Collect coverage data
      const coverageData = await this.collectCoverageData();
      
      // Generate analysis
      const analysis = this.analyzeCoverage(coverageData);
      
      // Create report
      const report = this.createReport(coverageData, analysis);
      
      // Save report
      this.saveReport(report);
      
      // Display results
      this.displayResults(report);
      
      return report;
    } catch (error) {
      console.error('Error generating coverage report:', error.message);
      process.exit(1);
    }
  }

  runApiTests() {
    try {
      process.chdir(this.apiDir);
      execSync('npx vitest run --coverage', { stdio: 'inherit' });
    } catch (error) {
      console.warn('API tests failed, but continuing with coverage analysis...');
    }
  }

  runMobileTests() {
    try {
      process.chdir(this.mobileDir);
      execSync('npm test -- --coverage', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Mobile tests failed, but continuing with coverage analysis...');
    }
  }

  async collectCoverageData() {
    const coverageData = {
      api: {
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
      },
      mobile: {
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
      },
      overall: {
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
      },
      files: [],
      timestamp: new Date().toISOString(),
    };

    // Collect API coverage data
    try {
      const apiCoveragePath = path.join(this.coverageDir, 'coverage-final.json');
      if (fs.existsSync(apiCoveragePath)) {
        const apiCoverage = JSON.parse(fs.readFileSync(apiCoveragePath, 'utf8'));
        coverageData.api = this.extractCoverageMetrics(apiCoverage);
        coverageData.files = coverageData.files.concat(this.extractFileCoverage(apiCoverage, 'api'));
      }
    } catch (error) {
      console.warn('Could not collect API coverage data:', error.message);
    }

    // Collect Mobile coverage data
    try {
      const mobileCoveragePath = path.join(this.mobileDir, 'coverage', 'coverage-final.json');
      if (fs.existsSync(mobileCoveragePath)) {
        const mobileCoverage = JSON.parse(fs.readFileSync(mobileCoveragePath, 'utf8'));
        coverageData.mobile = this.extractCoverageMetrics(mobileCoverage);
        coverageData.files = coverageData.files.concat(this.extractFileCoverage(mobileCoverage, 'mobile'));
      }
    } catch (error) {
      console.warn('Could not collect Mobile coverage data:', error.message);
    }

    // Calculate overall coverage
    coverageData.overall = this.calculateOverallCoverage(coverageData);

    return coverageData;
  }

  extractCoverageMetrics(coverageData) {
    const metrics = {
      lines: { total: 0, covered: 0, pct: 0 },
      statements: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
    };

    Object.values(coverageData).forEach(fileCoverage => {
      if (fileCoverage && typeof fileCoverage === 'object') {
        metrics.lines.total += fileCoverage.l?.total || 0;
        metrics.lines.covered += fileCoverage.l?.covered || 0;
        metrics.statements.total += fileCoverage.s?.total || 0;
        metrics.statements.covered += fileCoverage.s?.covered || 0;
        metrics.functions.total += fileCoverage.f?.total || 0;
        metrics.functions.covered += fileCoverage.f?.covered || 0;
        metrics.branches.total += fileCoverage.b?.total || 0;
        metrics.branches.covered += fileCoverage.b?.covered || 0;
      }
    });

    // Calculate percentages
    metrics.lines.pct = metrics.lines.total > 0 ? Math.round((metrics.lines.covered / metrics.lines.total) * 100 * 100) / 100 : 0;
    metrics.statements.pct = metrics.statements.total > 0 ? Math.round((metrics.statements.covered / metrics.statements.total) * 100 * 100) / 100 : 0;
    metrics.functions.pct = metrics.functions.total > 0 ? Math.round((metrics.functions.covered / metrics.functions.total) * 100 * 100) / 100 : 0;
    metrics.branches.pct = metrics.branches.total > 0 ? Math.round((metrics.branches.covered / metrics.branches.total) * 100 * 100) / 100 : 0;

    return metrics;
  }

  extractFileCoverage(coverageData, appType) {
    const fileCoverage = [];

    Object.entries(coverageData).forEach(([filePath, fileData]) => {
      if (fileData && typeof fileData === 'object') {
        fileCoverage.push({
          file: filePath,
          appType,
          lines: {
            total: fileData.l?.total || 0,
            covered: fileData.l?.covered || 0,
            pct: fileData.l?.total > 0 ? Math.round((fileData.l.covered / fileData.l.total) * 100 * 100) / 100 : 0,
          },
          statements: {
            total: fileData.s?.total || 0,
            covered: fileData.s?.covered || 0,
            pct: fileData.s?.total > 0 ? Math.round((fileData.s.covered / fileData.s.total) * 100 * 100) / 100 : 0,
          },
          functions: {
            total: fileData.f?.total || 0,
            covered: fileData.f?.covered || 0,
            pct: fileData.f?.total > 0 ? Math.round((fileData.f.covered / fileData.f.total) * 100 * 100) / 100 : 0,
          },
          branches: {
            total: fileData.b?.total || 0,
            covered: fileData.b?.covered || 0,
            pct: fileData.b?.total > 0 ? Math.round((fileData.b.covered / fileData.b.total) * 100 * 100) / 100 : 0,
          },
        });
      }
    });

    return fileCoverage;
  }

  calculateOverallCoverage(coverageData) {
    const overall = {
      lines: { total: 0, covered: 0, pct: 0 },
      statements: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
    };

    ['api', 'mobile'].forEach(appType => {
      const data = coverageData[appType];
      overall.lines.total += data.lines.total;
      overall.lines.covered += data.lines.covered;
      overall.statements.total += data.statements.total;
      overall.statements.covered += data.statements.covered;
      overall.functions.total += data.functions.total;
      overall.functions.covered += data.functions.covered;
      overall.branches.total += data.branches.total;
      overall.branches.covered += data.branches.covered;
    });

    // Calculate percentages
    overall.lines.pct = overall.lines.total > 0 ? Math.round((overall.lines.covered / overall.lines.total) * 100 * 100) / 100 : 0;
    overall.statements.pct = overall.statements.total > 0 ? Math.round((overall.statements.covered / overall.statements.total) * 100 * 100) / 100 : 0;
    overall.functions.pct = overall.functions.total > 0 ? Math.round((overall.functions.covered / overall.functions.total) * 100 * 100) / 100 : 0;
    overall.branches.pct = overall.branches.total > 0 ? Math.round((overall.branches.covered / overall.branches.total) * 100 * 100) / 100 : 0;

    return overall;
  }

  analyzeCoverage(coverageData) {
    const targetCoverage = 80;
    const criticalThreshold = 60;

    const analysis = {
      targetMet: false,
      criticalFiles: [],
      wellCoveredFiles: [],
      missingCoverage: [],
      recommendations: [],
      hipaaCompliance: {
        auditLogs: false,
        phiAccess: false,
        encryption: false,
        overall: false,
      },
    };

    // Check if target is met
    analysis.targetMet = coverageData.overall.lines.pct >= targetCoverage;

    // Identify critical files with low coverage
    coverageData.files.forEach(file => {
      if (file.lines.pct < criticalThreshold) {
        analysis.criticalFiles.push({
          file: file.file,
          coverage: file.lines.pct,
          type: file.appType,
        });
      } else if (file.lines.pct >= targetCoverage) {
        analysis.wellCoveredFiles.push({
          file: file.file,
          coverage: file.lines.pct,
          type: file.appType,
        });
      }
    });

    // HIPAA compliance analysis
    const hipaaFiles = coverageData.files.filter(file => 
      file.file.includes('audit') || 
      file.file.includes('auth') || 
      file.file.includes('encryption') ||
      file.file.includes('phi') ||
      file.file.includes('compliance')
    );

    analysis.hipaaCompliance.auditLogs = hipaaFiles.some(f => f.file.includes('audit') && f.lines.pct >= 80);
    analysis.hipaaCompliance.phiAccess = hipaaFiles.some(f => f.file.includes('auth') && f.lines.pct >= 80);
    analysis.hipaaCompliance.encryption = hipaaFiles.some(f => f.file.includes('encryption') && f.lines.pct >= 80);
    analysis.hipaaCompliance.overall = Object.values(analysis.hipaaCompliance).every(v => v === true);

    // Generate recommendations
    if (!analysis.targetMet) {
      analysis.recommendations.push(`Increase overall coverage from ${coverageData.overall.lines.pct}% to ${targetCoverage}%`);
    }

    if (analysis.criticalFiles.length > 0) {
      analysis.recommendations.push(`Focus on critical files with <${criticalThreshold}% coverage: ${analysis.criticalFiles.length} files`);
    }

    if (!analysis.hipaaCompliance.overall) {
      analysis.recommendations.push('Improve HIPAA compliance test coverage for audit, auth, and encryption modules');
    }

    return analysis;
  }

  createReport(coverageData, analysis) {
    return {
      summary: {
        timestamp: coverageData.timestamp,
        overallCoverage: coverageData.overall.lines.pct,
        targetCoverage: 80,
        targetMet: analysis.targetMet,
        totalFiles: coverageData.files.length,
        criticalFiles: analysis.criticalFiles.length,
        wellCoveredFiles: analysis.wellCoveredFiles.length,
      },
      coverage: coverageData,
      analysis,
      hipaaCompliance: {
        status: analysis.hipaaCompliance.overall ? 'COMPLIANT' : 'NON_COMPLIANT',
        requirements: {
          '§164.312(b) - Audit Controls': analysis.hipaaCompliance.auditLogs ? 'PASS' : 'FAIL',
          '§164.308(a)(8) - Technical Evaluation': analysis.hipaaCompliance.overall ? 'PASS' : 'FAIL',
          'PHI Access Controls': analysis.hipaaCompliance.phiAccess ? 'PASS' : 'FAIL',
          'Data Encryption': analysis.hipaaCompliance.encryption ? 'PASS' : 'FAIL',
        },
      },
      recommendations: analysis.recommendations,
      nextSteps: this.generateNextSteps(analysis),
    };
  }

  generateNextSteps(analysis) {
    const steps = [];

    if (analysis.criticalFiles.length > 0) {
      steps.push('Prioritize testing for critical files with low coverage');
      steps.push('Implement unit tests for authentication and authorization modules');
      steps.push('Add integration tests for PHI access control');
    }

    if (!analysis.hipaaCompliance.overall) {
      steps.push('Enhance HIPAA compliance testing');
      steps.push('Implement comprehensive audit logging tests');
      steps.push('Add encryption/decryption validation tests');
    }

    steps.push('Set up automated coverage reporting in CI/CD');
    steps.push('Implement coverage gates in deployment pipeline');
    steps.push('Regular coverage reviews and optimization');

    return steps;
  }

  saveReport(report) {
    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`Coverage report saved to: ${this.reportPath}`);
  }

  displayResults(report) {
    console.log('\n📊 COVERAGE RESULTS');
    console.log('==================');
    
    console.log(`Overall Coverage: ${report.summary.overallCoverage}%`);
    console.log(`Target Coverage: ${report.summary.targetCoverage}%`);
    console.log(`Target Met: ${report.summary.targetMet ? '✅ YES' : '❌ NO'}`);
    console.log(`Total Files: ${report.summary.totalFiles}`);
    console.log(`Critical Files: ${report.summary.criticalFiles}`);
    console.log(`Well Covered Files: ${report.summary.wellCoveredFiles}`);

    console.log('\n📋 DETAILED COVERAGE');
    console.log('====================');
    console.log('API Coverage:');
    console.log(`  Lines: ${report.coverage.api.lines.pct}% (${report.coverage.api.lines.covered}/${report.coverage.api.lines.total})`);
    console.log(`  Functions: ${report.coverage.api.functions.pct}% (${report.coverage.api.functions.covered}/${report.coverage.api.functions.total})`);
    console.log(`  Branches: ${report.coverage.api.branches.pct}% (${report.coverage.api.branches.covered}/${report.coverage.api.branches.total})`);
    
    console.log('Mobile Coverage:');
    console.log(`  Lines: ${report.coverage.mobile.lines.pct}% (${report.coverage.mobile.lines.covered}/${report.coverage.mobile.lines.total})`);
    console.log(`  Functions: ${report.coverage.mobile.functions.pct}% (${report.coverage.mobile.functions.covered}/${report.coverage.mobile.functions.total})`);
    console.log(`  Branches: ${report.coverage.mobile.branches.pct}% (${report.coverage.mobile.branches.covered}/${report.coverage.mobile.branches.total})`);

    console.log('\n🔒 HIPAA COMPLIANCE');
    console.log('====================');
    console.log(`Status: ${report.hipaaCompliance.status}`);
    Object.entries(report.hipaaCompliance.requirements).forEach(([req, status]) => {
      console.log(`  ${req}: ${status === 'PASS' ? '✅' : '❌'} ${status}`);
    });

    if (report.analysis.criticalFiles.length > 0) {
      console.log('\n🚨 CRITICAL FILES (Low Coverage)');
      console.log('=================================');
      report.analysis.criticalFiles.slice(0, 10).forEach(file => {
        console.log(`  ${file.file}: ${file.coverage}%`);
      });
      if (report.analysis.criticalFiles.length > 10) {
        console.log(`  ... and ${report.analysis.criticalFiles.length - 10} more files`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('==================');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    if (report.nextSteps.length > 0) {
      console.log('\n🎯 NEXT STEPS');
      console.log('==============');
      report.nextSteps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`);
      });
    }

    console.log('\n📈 COVERAGE PROGRESSION');
    console.log('========================');
    console.log('0.88% → 80% Target');
    console.log(`Current: ${report.summary.overallCoverage}%`);
    console.log(`Remaining: ${Math.max(0, 80 - report.summary.overallCoverage)}%`);
    
    const progressBar = this.createProgressBar(report.summary.overallCoverage, 80);
    console.log(`Progress: ${progressBar}`);
  }

  createProgressBar(current, target) {
    const width = 40;
    const filled = Math.round((current / target) * width);
    const empty = width - filled;
    
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}%`;
  }
}

// Run the coverage report if called directly
if (require.main === module) {
  const reporter = new CoverageReporter();
  reporter.generateCoverageReport().catch(console.error);
}

module.exports = CoverageReporter;