import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Server-side S3 content-type validation using magic bytes (SEC-07)
 *
 * Client-declared Content-Type is untrusted. After an object is uploaded to S3,
 * we read the first 4KB and inspect magic bytes to determine the real MIME type.
 * Invalid uploads are deleted automatically.
 */

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

interface ValidationResult {
  valid: boolean;
  detectedType: string | undefined;
  declaredType?: string;
}

/**
 * Validate an uploaded S3 object by reading its magic bytes.
 * Deletes the object and returns { valid: false } if the type is not allowed.
 */
export async function validateUploadedFileType(
  s3Client: S3Client,
  bucket: string,
  key: string,
  declaredType?: string,
): Promise<ValidationResult> {
  try {
    // Read only the first 4KB -- enough for magic byte detection
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: 'bytes=0-4095',
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      return { valid: false, detectedType: undefined, declaredType };
    }

    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);

    // file-type is ESM-only (v19+). Dynamic import keeps compatibility.
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);

    const detectedMime = detected?.mime;

    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      // Invalid or unrecognised type -- delete the object from S3
      console.error(
        `[S3_VALIDATION] Rejected upload: key=${key}, declared=${declaredType}, detected=${detectedMime ?? 'unknown'}`,
      );

      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

      return { valid: false, detectedType: detectedMime, declaredType };
    }

    // Warn if declared type doesn't match detected type (possible mislabel)
    if (declaredType && detectedMime !== declaredType) {
      console.warn(
        `[S3_VALIDATION] Type mismatch: key=${key}, declared=${declaredType}, detected=${detectedMime}`,
      );
    }

    return { valid: true, detectedType: detectedMime, declaredType };
  } catch (error) {
    console.error(`[S3_VALIDATION] Validation error for key=${key}:`, error);
    return { valid: false, detectedType: undefined, declaredType };
  }
}
