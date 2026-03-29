import { vi } from 'vitest';
import { faker } from '@faker-js/faker';

export const mockS3Service = {
  uploadFile: vi.fn(),
  getSignedUrl: vi.fn(),
  deleteFile: vi.fn(),
  getFile: vi.fn(),
  listFiles: vi.fn(),
};

// Mock S3 upload response
export const createMockS3UploadResponse = (filename: string, key: string) => ({
  Location: `https://biopoint-test-bucket.s3.amazonaws.com/${key}`,
  ETag: `"${Math.random().toString(36).substring(7)}"`,
  Bucket: 'biopoint-test-bucket',
  Key: key,
});

// Mock S3 signed URL response
export const createMockSignedUrl = (key: string, expiresIn = 3600) => {
  const expiry = new Date(Date.now() + expiresIn * 1000);
  return `https://biopoint-test-bucket.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Date=${expiry.toISOString()}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=test`;
};

// Mock S3 file listing
export const createMockFileList = (prefix = '', count = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    Key: `${prefix}file-${i + 1}.pdf`,
    LastModified: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    ETag: `"${Math.random().toString(36).substring(7)}"`,
    Size: faker.number.int({ min: 1024, max: 1024 * 1024 * 10 }), // 1KB to 10MB
    StorageClass: 'STANDARD',
  }));
};

// Setup S3 mocks
export const setupS3Mocks = () => {
  mockS3Service.uploadFile.mockImplementation(async (file: Buffer, key: string) => {
    return createMockS3UploadResponse('test-file.pdf', key);
  });

  mockS3Service.getSignedUrl.mockImplementation(async (key: string, expiresIn = 3600) => {
    return createMockSignedUrl(key, expiresIn);
  });

  mockS3Service.deleteFile.mockImplementation(async (key: string) => {
    return { success: true };
  });

  mockS3Service.getFile.mockImplementation(async (key: string) => {
    return Buffer.from('Mock file content');
  });

  mockS3Service.listFiles.mockImplementation(async (prefix = '', maxKeys = 1000) => {
    return createMockFileList(prefix, Math.min(maxKeys, 10));
  });

  return mockS3Service;
};

// Reset all S3 mocks
export const resetS3Mocks = () => {
  Object.values(mockS3Service).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
};