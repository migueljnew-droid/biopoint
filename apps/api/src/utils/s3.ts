import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sanitizeFilePath } from './sanitization.js';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET = process.env.S3_BUCKET || 'biopoint-uploads';

// Content-type specific expiry times for HIPAA compliance
const PRESIGN_EXPIRES_PHI = 300; // 5 minutes for PHI documents (labs)
const PRESIGN_EXPIRES_PHOTOS = 600; // 10 minutes for progress photos
const PRESIGN_EXPIRES_GENERAL = 1800; // 30 minutes for non-PHI content
// PRESIGN_EXPIRES_DEFAULT and PRESIGN_EXPIRES kept as documentation; runtime uses getExpiryTime()
// const PRESIGN_EXPIRES_DEFAULT = 300; // Default 5 minutes for security
// const PRESIGN_EXPIRES = 300; // Changed from 3600 to 300 seconds (5 minutes)

export function getExpiryTime(_contentType: string, folder: 'labs' | 'photos' | 'general' = 'general'): number {
    switch (folder) {
        case 'labs':
            return PRESIGN_EXPIRES_PHI; // 5 minutes for PHI documents
        case 'photos':
            return PRESIGN_EXPIRES_PHOTOS; // 10 minutes for progress photos
        case 'general':
        default:
            return PRESIGN_EXPIRES_GENERAL; // 30 minutes for general content
    }
}

export async function generateUploadPresignedUrl(
    key: string,
    contentType: string,
    folder: 'labs' | 'photos' | 'general' = 'general'
): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    const expiresIn = getExpiryTime(contentType, folder);
    const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn,
    });

    return { uploadUrl, s3Key: key, expiresIn };
}

export async function generateDownloadPresignedUrl(
    key: string,
    folder?: 'labs' | 'photos' | 'general'
): Promise<{ url: string; expiresIn: number }> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    // Determine folder type from key if not provided
    let folderType = folder;
    if (!folderType) {
        if (key.startsWith('labs/')) folderType = 'labs';
        else if (key.startsWith('photos/')) folderType = 'photos';
        else folderType = 'general';
    }

    const expiresIn = getExpiryTime('', folderType);
    const url = await getSignedUrl(s3Client, command, {
        expiresIn,
    });

    return { url, expiresIn };
}

// Legacy function for backward compatibility
export async function generateLegacyDownloadPresignedUrl(key: string): Promise<string> {
    const result = await generateDownloadPresignedUrl(key);
    return result.url;
}

export function generateS3Key(
    userId: string,
    folder: 'labs' | 'photos',
    filename: string
): string {
    // Validate folder parameter
    if (!['labs', 'photos'].includes(folder)) {
        throw new Error('Invalid folder type');
    }
    
    // Validate userId format (should be UUID or similar)
    if (!/^[a-zA-Z0-9-_]+$/.test(userId)) {
        throw new Error('Invalid user ID format');
    }
    
    // Sanitize filename with path traversal protection
    const sanitizedFilename = sanitizeFilePath(filename);
    
    // Remove any remaining dangerous characters and ensure safe filename
    const safeFilename = sanitizedFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    if (!safeFilename || safeFilename.length === 0) {
        throw new Error('Invalid filename after sanitization');
    }
    
    const timestamp = Date.now();
    return `${folder}/${userId}/${timestamp}-${safeFilename}`;
}

export async function getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error('No body in S3 response');
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
}
