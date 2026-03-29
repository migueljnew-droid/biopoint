#!/usr/bin/env node

/**
 * Check for unencrypted PHI data in the database
 * This script helps ensure all PHI data is properly encrypted
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Models and fields that should be encrypted
const PHI_FIELDS = {
  Profile: ['dateOfBirth'],
  LabMarker: ['value'],
  LabReport: ['notes'],
  DailyLog: ['notes'],
  StackItem: ['notes'],
  ProgressPhoto: ['notes'],
};

/**
 * Check a specific model for unencrypted PHI data
 */
async function checkModel(modelName, fields) {
  console.log(`\nChecking ${modelName} for unencrypted PHI...`);
  
  const results = {
    model: modelName,
    totalRecords: 0,
    encryptedRecords: 0,
    unencryptedRecords: 0,
    errors: 0,
    details: []
  };
  
  try {
    // Get total record count
    results.totalRecords = await prisma[modelName.toLowerCase()].count();
    
    if (results.totalRecords === 0) {
      console.log(`  ✓ No records found in ${modelName}`);
      return results;
    }
    
    // Check each field
    for (const field of fields) {
      const encryptedField = `${field}_encrypted`;
      
      // Count records with encrypted data
      const encryptedCount = await prisma[modelName.toLowerCase()].count({
        where: {
          [encryptedField]: { not: null }
        }
      });
      
      // Count records with unencrypted data (original field not null and encrypted field null)
      const unencryptedCount = await prisma[modelName.toLowerCase()].count({
        where: {
          AND: [
            { [field]: { not: null } },
            { [encryptedField]: null }
          ]
        }
      });
      
      results.encryptedRecords += encryptedCount;
      results.unencryptedRecords += unencryptedCount;
      
      if (unencryptedCount > 0) {
        results.details.push({
          field,
          encrypted: encryptedCount,
          unencrypted: unencryptedCount
        });
      }
      
      console.log(`  Field ${field}: ${encryptedCount} encrypted, ${unencryptedCount} unencrypted`);
    }
    
    // Check for records with both encrypted and unencrypted data (inconsistency)
    const inconsistentCount = await prisma[modelName.toLowerCase()].count({
      where: {
        AND: [
          ...fields.map(field => ({
            OR: [
              {
                AND: [
                  { [field]: { not: null } },
                  { [`${field}_encrypted`]: { not: null } }
                ]
              }
            ]
          }))
        ]
      }
    });
    
    if (inconsistentCount > 0) {
      results.details.push({
        type: 'inconsistent',
        count: inconsistentCount
      });
      console.log(`  ⚠️  ${inconsistentCount} records have both encrypted and unencrypted data`);
    }
    
    // Summary
    if (results.unencryptedRecords === 0) {
      console.log(`  ✅ All PHI data in ${modelName} is properly encrypted`);
    } else {
      console.log(`  ❌ Found ${results.unencryptedRecords} unencrypted records in ${modelName}`);
    }
    
  } catch (error) {
    console.error(`  ❌ Error checking ${modelName}:`, error.message);
    results.errors++;
  }
  
  return results;
}

/**
 * Get sample unencrypted records for analysis
 */
async function getSampleUnencryptedRecords(modelName, field, limit = 5) {
  try {
    const records = await prisma[modelName.toLowerCase()].findMany({
      where: {
        AND: [
          { [field]: { not: null } },
          { [`${field}_encrypted`]: null }
        ]
      },
      select: {
        id: true,
        [field]: true,
        createdAt: true,
        userId: true
      },
      take: limit
    });
    
    return records;
  } catch (error) {
    console.error(`Error getting sample records for ${modelName}.${field}:`, error.message);
    return [];
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalModels: results.length,
      compliantModels: 0,
      nonCompliantModels: 0,
      totalUnencryptedRecords: 0,
      totalErrors: 0
    },
    details: results
  };
  
  for (const result of results) {
    if (result.unencryptedRecords === 0 && result.errors === 0) {
      report.summary.compliantModels++;
    } else {
      report.summary.nonCompliantModels++;
    }
    
    report.summary.totalUnencryptedRecords += result.unencryptedRecords;
    report.summary.totalErrors += result.errors;
  }
  
  return report;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 BioPoint PHI Encryption Audit');
  console.log('=====================================\n');
  
  const options = {
    detailed: process.argv.includes('--detailed'),
    sampleSize: parseInt(process.argv.find(arg => arg.startsWith('--sample='))?.split('=')[1]) || 5,
    outputFile: process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1]
  };
  
  try {
    const results = [];
    
    // Check each model
    for (const [modelName, fields] of Object.entries(PHI_FIELDS)) {
      const result = await checkModel(modelName, fields);
      results.push(result);
      
      // Get detailed samples if requested and issues found
      if (options.detailed && result.unencryptedRecords > 0) {
        console.log(`\n  📋 Sample unencrypted records:`);
        
        for (const detail of result.details) {
          if (detail.field && detail.unencrypted > 0) {
            const samples = await getSampleUnencryptedRecords(
              modelName, 
              detail.field, 
              Math.min(options.sampleSize, detail.unencrypted)
            );
            
            for (const sample of samples) {
              console.log(`    ID: ${sample.id}`);
              console.log(`    ${detail.field}: ${sample[detail.field]}`);
              console.log(`    Created: ${sample.createdAt}`);
              console.log(`    User ID: ${sample.userId}`);
              console.log('    ---');
            }
          }
        }
      }
    }
    
    // Generate compliance report
    const report = await generateComplianceReport(results);
    
    console.log('\n📊 Compliance Summary');
    console.log('=====================');
    console.log(`Total Models Checked: ${report.summary.totalModels}`);
    console.log(`Compliant Models: ${report.summary.compliantModels}`);
    console.log(`Non-Compliant Models: ${report.summary.nonCompliantModels}`);
    console.log(`Total Unencrypted Records: ${report.summary.totalUnencryptedRecords}`);
    console.log(`Total Errors: ${report.summary.totalErrors}`);
    
    if (report.summary.totalUnencryptedRecords === 0) {
      console.log('\n✅ All PHI data is properly encrypted!');
    } else {
      console.log('\n⚠️  Found unencrypted PHI data that needs attention');
      console.log('\nRecommended Actions:');
      console.log('1. Run encryption migration script for unencrypted data');
      console.log('2. Verify encryption middleware is properly configured');
      console.log('3. Check for any recent data imports that bypassed encryption');
    }
    
    // Save report if output file specified
    if (options.outputFile) {
      const fs = require('fs');
      fs.writeFileSync(options.outputFile, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${options.outputFile}`);
    }
    
    // Exit with appropriate code
    process.exit(report.summary.totalUnencryptedRecords > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { 
  checkModel, 
  getSampleUnencryptedRecords, 
  generateComplianceReport,
  PHI_FIELDS 
};