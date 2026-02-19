import crypto from 'crypto';
import { promisify } from 'util';

const randomBytes = promisify(crypto.randomBytes);

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
// TAG_LENGTH is 16 bytes for GCM — enforced by cipher.getAuthTag() at runtime
const SALT_LENGTH = 32; // Salt length for key derivation

// Environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_KEY_VERSION = process.env.ENCRYPTION_KEY_VERSION || '1';

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required for PHI encryption');
}

const ENCRYPTION_KEY_BYTES = Buffer.from(ENCRYPTION_KEY, 'base64');

// Validate key length (must be 32 bytes for AES-256)
if (ENCRYPTION_KEY_BYTES.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes when base64 decoded');
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  version: string;
  algorithm: string;
}

export interface EncryptionMetadata {
  keyVersion: string;
  algorithm: string;
  timestamp: Date;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @param metadata - Optional metadata to include
 * @returns Encrypted data object
 */
export async function encrypt(plaintext: string, _metadata?: EncryptionMetadata): Promise<EncryptedData> {
  try {
    // Generate random IV for each encryption operation
    const iv = await randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BYTES, iv);
    
    // Update cipher with plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      version: ENCRYPTION_KEY_VERSION,
      algorithm: ALGORITHM
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param encryptedData - The encrypted data object
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: EncryptedData): string {
  try {
    // Validate algorithm
    if (encryptedData.algorithm !== ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
    }
    
    // Decode components
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY_BYTES, iv);
    
    // Set authentication tag
    decipher.setAuthTag(tag);
    
    // Update decipher with encrypted data
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt data and return as JSON string for database storage
 * @param plaintext - The data to encrypt
 * @returns JSON string of encrypted data
 */
export async function encryptToString(plaintext: string): Promise<string> {
  const encrypted = await encrypt(plaintext);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt data from JSON string
 * @param encryptedString - JSON string of encrypted data
 * @returns Decrypted plaintext
 */
export function decryptFromString(encryptedString: string): string {
  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedString);
    return decrypt(encryptedData);
  } catch (error) {
    throw new Error(`Failed to parse encrypted data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a string is encrypted data (JSON format)
 * @param str - The string to check
 * @returns True if the string appears to be encrypted data
 */
export function isEncryptedString(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return (
      parsed &&
      typeof parsed === 'object' &&
      'encrypted' in parsed &&
      'iv' in parsed &&
      'tag' in parsed &&
      'version' in parsed &&
      'algorithm' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Validate encryption setup by performing a round-trip encrypt/decrypt.
 */
export async function validateEncryptionSetup(): Promise<{ valid: boolean; error?: string }> {
  try {
    const sample = 'encryption_test';
    const encrypted = await encrypt(sample);
    const decrypted = decrypt(encrypted);

    if (decrypted !== sample) {
      return { valid: false, error: 'Encryption round-trip validation failed' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a new encryption key for key rotation
 * @returns Base64 encoded 32-byte key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await randomBytes(32);
  return key.toString('base64');
}

/**
 * Derive encryption key from password and salt
 * @param password - The password to derive key from
 * @param salt - Optional salt (will generate if not provided)
 * @returns Object containing key and salt
 */
export async function deriveKeyFromPassword(password: string, salt?: string): Promise<{ key: string; salt: string }> {
  const saltBuffer = salt ? Buffer.from(salt, 'base64') : await randomBytes(SALT_LENGTH);
  const derivedSalt = saltBuffer.toString('base64');
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, saltBuffer, 100000, 32, 'sha256', (err, key) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          key: key.toString('base64'),
          salt: derivedSalt
        });
      }
    });
  });
}

/**
 * Validate encryption key format
 * @param key - The key to validate
 * @returns True if the key is valid
 */
export function isValidEncryptionKey(key: string): boolean {
  try {
    const decoded = Buffer.from(key, 'base64');
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Sanitize data for logging (remove or mask sensitive information)
 * @param data - The data to sanitize
 * @returns Sanitized data safe for logging
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data === 'string') {
    // If it looks like encrypted data, don't log the content
    if (isEncryptedString(data)) {
      return '[ENCRYPTED_DATA]';
    }
    // For other strings, return first and last few characters
    if (data.length > 10) {
      return `${data.substring(0, 3)}...${data.substring(data.length - 3)}`;
    }
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Don't log encryption metadata
      if (key === 'encrypted' || key === 'iv' || key === 'tag') {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    return sanitized;
  }
  
  return data;
}
