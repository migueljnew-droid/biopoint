#!/usr/bin/env node

/**
 * Re-encryption script for rotating encryption keys
 * Processes data in batches to minimize database load
 */

const { PrismaClient } = require('@prisma/client');
const { decrypt, encryptToString } = require('../apps/api/src/utils/encryption.js');

const prisma = new PrismaClient();

// Field mappings for each model
const FIELD_MAPPINGS = {
  Profile: {
    encryptedFields: ['dateOfBirth_encrypted'],
    originalFields: ['dateOfBirth'],
    model: 'profile'
  },
  LabMarker: {
    encryptedFields: ['value_encrypted'],
    originalFields: ['value'],
    model: 'labMarker'
  },
  LabReport: {
    encryptedFields: ['notes_encrypted'],
    originalFields: ['notes'],
    model: 'labReport'
  },
  DailyLog: {
    encryptedFields: ['notes_encrypted'],
    originalFields: ['notes'],
    model: 'dailyLog'
  },
  StackItem: {
    encryptedFields: ['notes_encrypted'],
    originalFields: ['notes'],
    model: 'stackItem'
  },
  ProgressPhoto: {
    encryptedFields: ['notes_encrypted'],
    originalFields: ['notes'],
    model: 'progressPhoto'
  }
};

/**
 * Process a single batch of records
 */
async function processBatch(model, records, fieldMapping) {
  const updates = [];
  
  for (const record of records) {
    try {
      const updateData = {};
      let needsUpdate = false;
      
      // Process each encrypted field
      for (let i = 0; i < fieldMapping.encryptedFields.length; i++) {
        const encryptedField = fieldMapping.encryptedFields[i];
        const originalField = fieldMapping.originalFields[i];
        
        // Check if there's encrypted data to re-encrypt
        if (record[encryptedField]) {
          try {
            // Decrypt with old key
            const decryptedValue = decrypt(JSON.parse(record[encryptedField]));
            
            // Re-encrypt with new key
            const reencryptedValue = await encryptToString(decryptedValue);
            
            updateData[encryptedField] = reencryptedValue;
            updateData.encryption_version = 1; // Update to latest version
            needsUpdate = true;
            
            console.log(`Re-encrypted ${model} ${record.id} field ${originalField}`);
          } catch (error) {
            console.error(`Failed to re-encrypt ${model} ${record.id} field ${originalField}:`, error.message);
            // Continue with other records, don't fail the entire batch
          }
        }
      }
      
      if (needsUpdate) {
        updates.push({
          where: { id: record.id },
          data: updateData
        });
      }
    } catch (error) {
      console.error(`Failed to process ${model} ${record.id}:`, error.message);
    }
  }
  
  return updates;
}

/**
 * Re-encrypt all data for a specific model
 */
async function reencryptModel(modelName, batchSize = 1000, sleepBetweenBatches = 0.1) {
  console.log(`Starting re-encryption for model: ${modelName}`);
  
  const fieldMapping = FIELD_MAPPINGS[modelName];
  if (!fieldMapping) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  
  let processedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  try {
    // Get total count of records that need processing
    const totalCount = await prisma[fieldMapping.model].count({
      where: {
        OR: fieldMapping.encryptedFields.map(field => ({
          [field]: { not: null }
        }))
      }
    });
    
    console.log(`Found ${totalCount} ${modelName} records to process`);
    
    if (totalCount === 0) {
      console.log(`No ${modelName} records need re-encryption`);
      return { processedCount, updatedCount, errorCount };
    }
    
    // Process records in batches
    let skip = 0;
    
    while (skip < totalCount) {
      console.log(`Processing batch: skip=${skip}, limit=${batchSize}`);
      
      // Fetch batch of records
      const records = await prisma[fieldMapping.model].findMany({
        where: {
          OR: fieldMapping.encryptedFields.map(field => ({
            [field]: { not: null }
          }))
        },
        select: {
          id: true,
          ...fieldMapping.encryptedFields.reduce((acc, field) => {
            acc[field] = true;
            return acc;
          }, {})
        },
        skip,
        take: batchSize
      });
      
      if (records.length === 0) {
        break;
      }
      
      // Process this batch
      const updates = await processBatch(modelName, records, fieldMapping);
      
      if (updates.length > 0) {
        // Apply updates in a transaction
        await prisma.$transaction(async (tx) => {
          for (const update of updates) {
            await tx[fieldMapping.model].update(update);
          }
        });
        
        updatedCount += updates.length;
        console.log(`Updated ${updates.length} records in this batch`);
      }
      
      processedCount += records.length;
      skip += batchSize;
      
      // Sleep between batches to avoid overwhelming the database
      if (sleepBetweenBatches > 0 && skip < totalCount) {
        await new Promise(resolve => setTimeout(resolve, sleepBetweenBatches * 1000));
      }
      
      console.log(`Progress: ${processedCount}/${totalCount} records processed`);
    }
    
    console.log(`Completed re-encryption for ${modelName}:`);
    console.log(`  Processed: ${processedCount}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Errors: ${errorCount}`);
    
  } catch (error) {
    console.error(`Error during re-encryption of ${modelName}:`, error);
    throw error;
  }
  
  return { processedCount, updatedCount, errorCount };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node reencrypt-model.js <modelName> [batchSize] [sleepBetweenBatches] [environment]');
    process.exit(1);
  }
  
  const modelName = args[0];
  const batchSize = parseInt(args[1]) || 1000;
  const sleepBetweenBatches = parseFloat(args[2]) || 0.1;
  const environment = args[3] || 'development';
  
  console.log(`Re-encryption script started`);
  console.log(`Model: ${modelName}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Sleep between batches: ${sleepBetweenBatches}s`);
  console.log(`Environment: ${environment}`);
  
  try {
    const result = await reencryptModel(modelName, batchSize, sleepBetweenBatches);
    
    console.log('Re-encryption completed successfully');
    console.log(`Total processed: ${result.processedCount}`);
    console.log(`Total updated: ${result.updatedCount}`);
    console.log(`Total errors: ${result.errorCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Re-encryption failed:', error);
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

module.exports = { reencryptModel, FIELD_MAPPINGS };