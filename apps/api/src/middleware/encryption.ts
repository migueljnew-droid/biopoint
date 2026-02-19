import { encryptToString, decryptFromString, isEncryptedString } from '../utils/encryption.js';

/**
 * Prisma transparent field-level encryption (SEC-05: migrated from $use to $extends)
 *
 * This module exports pure functions consumed by the $extends() client in db/src/index.ts.
 * Encryption is structurally embedded in the Prisma client — it cannot be accidentally omitted.
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

// For these fields we null the plaintext column after encrypting (SEC-02).
// LabMarker.value is now Float? (nullable) after schema migration, so it can be added here.
const CLEAR_PLAINTEXT_FIELDS: Record<string, Set<string>> = {
  Profile: new Set(['dateOfBirth']),
  LabMarker: new Set(['value']),
  LabReport: new Set(['notes']),
  DailyLog: new Set(['notes']),
  StackItem: new Set(['notes']),
  ProgressPhoto: new Set(['notes']),
};

// Define which models have encrypted fields
const MODELS_WITH_ENCRYPTION = Object.keys(ENCRYPTED_FIELDS);

/**
 * Check if the model should be processed for encryption.
 * Used by the $extends() query hooks in db/src/index.ts.
 */
export function shouldProcessModel(model: string): boolean {
  return MODELS_WITH_ENCRYPTION.includes(model);
}

/**
 * Encrypt the data object for a Prisma write operation.
 * Handles both flat data objects and Prisma's { data: ... } wrapper.
 */
export async function encryptDataObject(model: string, data: any): Promise<any> {
  if (!data || typeof data !== 'object') return data;

  const encryptedFields = ENCRYPTED_FIELDS[model] || [];
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

      // SEC-02: Null out the plaintext column to prevent dual-storage
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
}

/**
 * Decrypt a single database record.
 * SEC-03: Returns null for fields that fail decryption (never exposes sentinel strings).
 */
export async function decryptRecord(model: string, record: any): Promise<any> {
  if (!record || typeof record !== 'object') return record;

  const encryptedFields = ENCRYPTED_FIELDS[model] || [];
  const decryptedItem = { ...record };

  for (const field of encryptedFields) {
    const encryptedFieldName = `${field}_encrypted`;

    if (encryptedFieldName in decryptedItem && decryptedItem[encryptedFieldName]) {
      try {
        const encryptedValue = decryptedItem[encryptedFieldName];

        if (!isEncryptedString(encryptedValue)) {
          throw new Error('Encrypted field does not match expected format');
        }

        const decryptedValue = decryptFromString(encryptedValue);
        decryptedItem[field] = decryptedValue;

        // Remove the encrypted field from the result
        delete decryptedItem[encryptedFieldName];
      } catch (error) {
        // SEC-03: Log error server-side, return null instead of sentinel
        console.error(
          `[ENCRYPTION] Decryption failed for ${model}.${field}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        decryptedItem[field] = null;
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
 */
export async function manualEncrypt(model: string, data: any): Promise<any> {
  if (!data || typeof data !== 'object') return data;

  if ('data' in data) {
    const wrappedArgs = { ...data };
    if (Array.isArray(wrappedArgs.data)) {
      wrappedArgs.data = await Promise.all(wrappedArgs.data.map((d: any) => encryptDataObject(model, d)));
    } else {
      wrappedArgs.data = await encryptDataObject(model, wrappedArgs.data);
    }
    return wrappedArgs;
  }

  return encryptDataObject(model, data);
}

/**
 * Manual decryption utility for batch operations
 */
export async function manualDecrypt(model: string, data: any): Promise<any> {
  if (!data) return data;
  if (Array.isArray(data)) {
    return Promise.all(data.map(item => decryptRecord(model, item)));
  }
  return decryptRecord(model, data);
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
 * Validate encryption setup by testing encrypt/decrypt round-trip
 */
export async function validateEncryptionSetup(): Promise<{ valid: boolean; error?: string }> {
  try {
    const testData = 'test_encryption_data_12345';

    const encrypted = await encryptToString(testData);
    const decrypted = decryptFromString(encrypted);

    if (decrypted !== testData) {
      return { valid: false, error: 'Encryption/decryption round trip failed' };
    }

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
