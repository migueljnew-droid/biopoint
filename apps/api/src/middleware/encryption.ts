import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, encryptToString, decryptFromString, isEncryptedString } from '../utils/encryption.js';
import { sanitizeForLogging } from '../utils/encryption.js';

/**
 * Prisma middleware for transparent field-level encryption
 * Automatically encrypts sensitive fields before database operations
 * and decrypts them when reading from the database
 */

// Define which fields should be encrypted for each model
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Profile: ['dateOfBirth'],
  LabMarker: ['value'],
  LabReport: ['notes'],
  DailyLog: ['notes'],
  StackItem: ['notes'],
  ProgressPhoto: ['notes'],
};

// For these fields we prefer to avoid storing plaintext alongside the encrypted column.
// Only include optional fields here (required fields cannot be nulled without schema changes).
const CLEAR_PLAINTEXT_FIELDS: Record<string, Set<string>> = {
  Profile: new Set(['dateOfBirth']),
  LabReport: new Set(['notes']),
  DailyLog: new Set(['notes']),
  StackItem: new Set(['notes']),
  ProgressPhoto: new Set(['notes']),
};

// Define which models have encrypted fields
const MODELS_WITH_ENCRYPTION = Object.keys(ENCRYPTED_FIELDS);

/**
 * Setup encryption middleware for Prisma client
 * @param prisma - Prisma client instance
 */
export function setupEncryptionMiddleware(prisma: PrismaClient): void {
  // Middleware for create operations
  prisma.$use(async (params, next) => {
    if (shouldProcessModel(params.model) && (params.action === 'create' || params.action === 'createMany')) {
      params.args = await encryptArgs(params.model, params.args);
    }
    return next(params);
  });

  // Middleware for update operations
  prisma.$use(async (params, next) => {
    if (shouldProcessModel(params.model) && params.action === 'update') {
      params.args = await encryptArgs(params.model, params.args);
    }
    return next(params);
  });

  // Middleware for upsert operations
  prisma.$use(async (params, next) => {
    if (shouldProcessModel(params.model) && params.action === 'upsert') {
      if (params.args.create) {
        params.args.create = await encryptArgs(params.model, params.args.create);
      }
      if (params.args.update) {
        params.args.update = await encryptArgs(params.model, params.args.update);
      }
    }
    return next(params);
  });

  // Middleware for read operations - decrypt results
  prisma.$use(async (params, next) => {
    const result = await next(params);
    
    if (shouldProcessModel(params.model) && shouldDecryptResult(params.action)) {
      return await decryptResult(params.model, result);
    }
    
    return result;
  });
}

/**
 * Check if the model should be processed for encryption
 */
function shouldProcessModel(model?: string): boolean {
  return model ? MODELS_WITH_ENCRYPTION.includes(model) : false;
}

/**
 * Check if the action should decrypt results
 */
function shouldDecryptResult(action: string): boolean {
  const readActions = ['findUnique', 'findFirst', 'findMany', 'findRaw', 'aggregate', 'groupBy'];
  return readActions.includes(action);
}

/**
 * Encrypt arguments before database operation
 */
async function encryptArgs(model: string, args: any): Promise<any> {
  if (!args || typeof args !== 'object') {
    return args;
  }

  const encryptedFields = ENCRYPTED_FIELDS[model] || [];

  const encryptDataObject = async (data: any): Promise<any> => {
    if (!data || typeof data !== 'object') return data;

    const encryptedData = { ...data };

    for (const field of encryptedFields) {
      if (!(field in encryptedData)) continue;
      if (encryptedData[field] === null || encryptedData[field] === undefined) continue;

      try {
        const value = encryptedData[field];
        const plaintext = value instanceof Date ? value.toISOString() : String(value);
        const encryptedValue = await encryptToString(plaintext);

        // Store encrypted value in _encrypted field
        encryptedData[`${field}_encrypted`] = encryptedValue;

        // Avoid storing plaintext for optional fields where an encrypted column exists.
        if (CLEAR_PLAINTEXT_FIELDS[model]?.has(field)) {
          encryptedData[field] = null;
        }

        // Set encryption metadata
        encryptedData.encryption_version = 1;
        encryptedData.encryption_metadata = {
          encrypted_at: new Date().toISOString(),
          encrypted_fields: [field],
        };
      } catch (error) {
        throw new Error(`Failed to encrypt sensitive data for ${model}.${field}`);
      }
    }

    return encryptedData;
  };

  // Prisma args typically wrap user-provided fields in `data`.
  if ('data' in args) {
    const encryptedArgs = { ...args };
    if (Array.isArray(encryptedArgs.data)) {
      encryptedArgs.data = await Promise.all(encryptedArgs.data.map(encryptDataObject));
    } else {
      encryptedArgs.data = await encryptDataObject(encryptedArgs.data);
    }
    return encryptedArgs;
  }

  // Some callers pass a data object directly (e.g., upsert create/update objects).
  return encryptDataObject(args);
}

/**
 * Decrypt results after database operation
 */
async function decryptResult(model: string, result: any): Promise<any> {
  if (!result) {
    return result;
  }

  const encryptedFields = ENCRYPTED_FIELDS[model] || [];

  // Handle array results
  if (Array.isArray(result)) {
    return Promise.all(result.map(item => decryptSingleItem(model, item, encryptedFields)));
  }

  // Handle single result
  return decryptSingleItem(model, result, encryptedFields);
}

/**
 * Decrypt a single database record
 */
async function decryptSingleItem(model: string, item: any, encryptedFields: string[]): Promise<any> {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const decryptedItem = { ...item };

  for (const field of encryptedFields) {
    const encryptedFieldName = `${field}_encrypted`;
    
    if (encryptedFieldName in decryptedItem && decryptedItem[encryptedFieldName]) {
      try {
        const encryptedValue = decryptedItem[encryptedFieldName];

        // Attempt to decrypt; if it doesn't look encrypted, treat as corruption.
        if (!isEncryptedString(encryptedValue)) {
          throw new Error('Encrypted field does not match expected format');
        }

        const decryptedValue = decryptFromString(encryptedValue);
        decryptedItem[field] = decryptedValue;
        
        // Remove the encrypted field from the result
        delete decryptedItem[encryptedFieldName];
      } catch (error) {
        // SEC-03: Log error server-side, return null instead of sentinel string.
        // Never expose encryption internals to API consumers.
        console.error(
          `[ENCRYPTION] Decryption failed for ${model}.${field}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        decryptedItem[field] = null;
        // Clean up the broken encrypted field from the response
        if (`${field}_encrypted` in decryptedItem) {
          delete decryptedItem[`${field}_encrypted`];
        }
      }
    }
  }

  return decryptedItem;
}

/**
 * Manual encryption utility for batch operations
 * Use this when you need to encrypt data outside of Prisma middleware
 */
export async function manualEncrypt(model: string, data: any): Promise<any> {
  return encryptArgs(model, data);
}

/**
 * Manual decryption utility for batch operations
 * Use this when you need to decrypt data outside of Prisma middleware
 */
export async function manualDecrypt(model: string, data: any): Promise<any> {
  return decryptResult(model, data);
}

/**
 * Get list of encrypted fields for a model
 */
export function getEncryptedFields(model: string): string[] {
  return ENCRYPTED_FIELDS[model] || [];
}

/**
 * Check if a model has encrypted fields
 */
export function hasEncryptedFields(model: string): boolean {
  return MODELS_WITH_ENCRYPTION.includes(model);
}

/**
 * Validate encryption setup by testing encrypt/decrypt operations
 */
export async function validateEncryptionSetup(): Promise<{ valid: boolean; error?: string }> {
  try {
    const testData = 'test_encryption_data_12345';
    
    // Test encryption
    const encrypted = await encryptToString(testData);
    
    // Test decryption
    const decrypted = decryptFromString(encrypted);
    
    if (decrypted !== testData) {
      return { valid: false, error: 'Encryption/decryption round trip failed' };
    }
    
    // Test that encrypted data is different from original
    if (encrypted === testData) {
      return { valid: false, error: 'Encryption did not transform data' };
    }
    
    console.log('[ENCRYPTION] Encryption setup validation passed');
    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ENCRYPTION] Encryption setup validation failed:', errorMessage);
    return { valid: false, error: errorMessage };
  }
}
