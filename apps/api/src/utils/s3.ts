import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET = process.env.S3_BUCKET || 'biopoint-uploads';
const PRESIGN_EXPIRES = 3600; // 1 hour

export async function generateUploadPresignedUrl(
    key: string,
    contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGN_EXPIRES,
    });

    return { uploadUrl, s3Key: key };
}

export async function generateDownloadPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    return getSignedUrl(s3Client, command, {
        expiresIn: PRESIGN_EXPIRES,
    });
}

export function generateS3Key(
    userId: string,
    folder: 'labs' | 'photos',
    filename: string
): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${userId}/${timestamp}-${sanitizedFilename}`;
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
