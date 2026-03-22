// Field-level encryption for Prisma $extends
export {
    shouldProcessModel,
    encryptDataObject,
    decryptRecord,
    manualEncrypt,
    manualDecrypt,
    getEncryptedFields,
    hasEncryptedFields,
} from './fields.js';

// Low-level crypto utilities
export {
    encrypt,
    decrypt,
    encryptToString,
    decryptFromString,
    isEncryptedString,
    validateEncryptionSetup,
    generateEncryptionKey,
    isValidEncryptionKey,
    sanitizeForLogging,
} from './crypto.js';

export type { EncryptedData, EncryptionMetadata } from './crypto.js';
