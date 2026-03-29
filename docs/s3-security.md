# S3 Security Documentation

## Overview

This document outlines the S3 security measures implemented in BioPoint to ensure HIPAA compliance and protect sensitive medical data. The system includes URL expiry management, revocation capabilities, download tracking, and security monitoring.

## URL Expiry Policies

### Content-Type Specific Expiry Times

| Content Type | Expiry Time | Use Case |
|--------------|-------------|----------|
| PHI Documents (labs) | 300 seconds (5 minutes) | Lab reports, medical documents |
| Progress Photos | 600 seconds (10 minutes) | User progress photos |
| Non-PHI Content | 1800 seconds (30 minutes) | General files, templates |
| Default | 300 seconds (5 minutes) | Fallback for security |

### Implementation

The expiry times are implemented in `/apps/api/src/utils/s3.ts`:

```typescript
// Content-type specific expiry times for HIPAA compliance
const PRESIGN_EXPIRES_PHI = 300; // 5 minutes for PHI documents (labs)
const PRESIGN_EXPIRES_PHOTOS = 600; // 10 minutes for progress photos
const PRESIGN_EXPIRES_GENERAL = 1800; // 30 minutes for non-PHI content
const PRESIGN_EXPIRES_DEFAULT = 300; // Default 5 minutes for security
```

## URL Revocation System

### Database Schema

The revocation system uses the `RevokedUrl` model:

```prisma
model RevokedUrl {
  id         String   @id @default(cuid())
  url        String   @unique
  revokedAt  DateTime @default(now())
  revokedBy  String   // User ID who revoked the URL
  reason     String?  // Reason for revocation
  createdAt  DateTime @default(now())

  @@index([url])
  @@index([revokedBy, revokedAt])
}
```

### Admin Endpoints

#### Revoke URL
```http
POST /admin/s3/revoke
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "url": "https://s3.amazonaws.com/bucket/presigned-url",
  "reason": "Security incident - unauthorized access detected"
}
```

**Response:**
```json
{
  "success": true,
  "revokedUrl": {
    "url": "https://s3.amazonaws.com/bucket/presigned-url",
    "revokedAt": "2024-01-15T10:30:00.000Z",
    "revokedBy": "admin-user-id",
    "reason": "Security incident - unauthorized access detected"
  }
}
```

#### List Revoked URLs
```http
GET /admin/s3/revoked?limit=50&offset=0&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "revokedUrls": [
    {
      "id": "revoked-url-id",
      "url": "https://s3.amazonaws.com/bucket/presigned-url",
      "revokedAt": "2024-01-15T10:30:00.000Z",
      "revokedBy": "admin-user-id",
      "revokedByEmail": "admin@biopoint.com",
      "reason": "Security incident"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Check URL Revocation Status
```http
GET /admin/s3/check-revocation/https%3A%2F%2Fs3.amazonaws.com%2Fbucket%2Fpresigned-url
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "url": "https://s3.amazonaws.com/bucket/presigned-url",
  "isRevoked": true
}
```

## Download Tracking

### Database Schema

The download tracking system uses the `DownloadLog` model:

```prisma
model DownloadLog {
  id           String   @id @default(cuid())
  userId       String?
  user         User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  url          String
  s3Key        String
  downloadedAt DateTime @default(now())
  ipAddress    String?
  userAgent    String?
  success      Boolean  @default(true)
  error        String?
  createdAt    DateTime @default(now())

  @@index([userId, downloadedAt])
  @@index([url, downloadedAt])
  @@index([s3Key, downloadedAt])
}
```

### Admin Endpoints

#### View Download Logs
```http
GET /admin/s3/downloads?limit=50&offset=0&userId=user123&success=true&startDate=2024-01-01&endDate=2024-01-31&s3Key=labs/report.pdf
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "downloads": [
    {
      "id": "download-log-id",
      "userId": "user123",
      "userEmail": "user@example.com",
      "url": "https://s3.amazonaws.com/bucket/presigned-url",
      "s3Key": "labs/report.pdf",
      "downloadedAt": "2024-01-15T10:30:00.000Z",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "success": true,
      "error": null
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

## Security Analytics

### Endpoint
```http
GET /admin/s3/security-analytics?timeRange=24h
Authorization: Bearer <admin-token>
```

**Time Range Options:**
- `1h` - Last hour
- `24h` - Last 24 hours (default)
- `7d` - Last 7 days

**Response:**
```json
{
  "timeRange": "24h",
  "downloadStats": {
    "successful": 145,
    "failed": 3,
    "total": 148
  },
  "topFiles": [
    {
      "s3Key": "labs/popular-report.pdf",
      "downloadCount": 25
    }
  ],
  "topUsers": [
    {
      "userId": "user123",
      "downloadCount": 15
    }
  ],
  "geographicData": [
    {
      "ipAddress": "192.168.1.100",
      "downloadCount": 10
    }
  ],
  "revokedUrls": 2
}
```

## Suspicious Activity Detection

The system automatically detects and logs suspicious activity patterns:

### Detection Rules

1. **Multiple Users Downloading Same File**
   - Trigger: >2 unique users downloading the same file within 5 minutes
   - Severity: Medium
   - Action: Log warning with details

2. **User Downloading from Multiple IPs**
   - Trigger: Same user downloading from >2 unique IPs
   - Severity: High
   - Action: Log warning with user details

3. **High Volume of Downloads**
   - Trigger: >100 successful downloads within 1 hour
   - Severity: Medium
   - Action: Log warning with volume statistics

### Log Format
```json
{
  "level": 40,
  "time": 1705321800000,
  "msg": "Suspicious activity detected: Multiple users downloading same file",
  "s3Key": "labs/sensitive-report.pdf",
  "userCount": 3,
  "downloadCount": 5,
  "timeWindow": "5 minutes"
}
```

## HIPAA Compliance

### Access Controls (§164.312(a)(2)(i))
- **Implementation**: Role-based access control with admin/reviewer roles
- **URL Expiry**: Short-lived presigned URLs (5-30 minutes)
- **Revocation**: Immediate URL revocation capability
- **Audit Trail**: Complete access logging for all S3 operations

### Encryption (§164.312(a)(2)(iv))
- **In Transit**: All S3 communications use HTTPS/TLS 1.3
- **At Rest**: S3 server-side encryption (AES-256)
- **Presigned URLs**: Include encryption parameters in URL signature

### Audit Requirements
- **Download Logging**: Every S3 access is logged with user, timestamp, IP, and user agent
- **Revocation Logging**: All URL revocations are logged with admin user and reason
- **Failed Access Logging**: Failed download attempts are logged with error details
- **Retention**: Logs retained for 6 years per HIPAA requirements

## Implementation Examples

### Generating Secure Upload URLs
```typescript
import { generateUploadPresignedUrl } from '../utils/s3';

// For lab reports (PHI) - 5 minutes expiry
const { uploadUrl, s3Key, expiresIn } = await generateUploadPresignedUrl(
    'labs/user123/report.pdf',
    'application/pdf',
    'labs' // Specifies PHI content type
);

console.log(`Upload URL expires in ${expiresIn} seconds`);
```

### Generating Secure Download URLs
```typescript
import { generateDownloadPresignedUrl } from '../utils/s3';

// For progress photos - 10 minutes expiry
const { url, expiresIn } = await generateDownloadPresignedUrl(
    'photos/user123/progress.jpg',
    'photos' // Specifies photo content type
);

console.log(`Download URL expires in ${expiresIn} seconds`);
```

### Revoking URLs Programmatically
```typescript
// Revoke a compromised URL
const response = await fetch('/admin/s3/revoke', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        url: 'https://s3.amazonaws.com/bucket/compromised-url',
        reason: 'Suspected unauthorized access'
    })
});
```

## Security Best Practices

### 1. URL Generation
- Always specify content type for appropriate expiry times
- Use the shortest expiry time that meets business requirements
- Generate URLs on-demand, not in advance

### 2. URL Distribution
- Never include presigned URLs in permanent storage
- Use secure channels (HTTPS) for URL distribution
- Consider additional authentication beyond URL possession

### 3. Monitoring
- Regularly review security analytics
- Set up alerts for suspicious activity patterns
- Monitor for unusual download volumes or geographic patterns

### 4. Incident Response
- Immediately revoke compromised URLs
- Review download logs for unauthorized access
- Document all security incidents per HIPAA requirements

## Testing

### Running Security Tests
```bash
# Run S3 security tests
npm test -- --testPathPattern=s3-security.test.ts

# Run all security tests
npm test -- --testPathPattern=security/
```

### Test Coverage
- URL expiry time validation
- Revocation system functionality
- Download tracking accuracy
- Suspicious activity detection
- HIPAA compliance verification

## Troubleshooting

### Common Issues

1. **URLs Expiring Too Quickly**
   - Check content type classification
   - Verify folder detection logic
   - Review expiry constants

2. **Revocation Not Working**
   - Ensure admin privileges
   - Check database connectivity
   - Verify URL format matches exactly

3. **Download Logs Missing**
   - Verify middleware integration
   - Check error handling in logging
   - Ensure database permissions

### Debug Mode
Enable debug logging for S3 operations:
```bash
DEBUG=s3:* npm start
```

## Migration Guide

### From Legacy System (1-hour expiry)
1. Update all URL generation calls to use new functions
2. Specify content type for appropriate expiry times
3. Test all endpoints with new expiry times
4. Monitor for any timeout issues
5. Update client-side logic to handle shorter expiry times

### Database Migration
```sql
-- Add new tables for revocation and tracking
CREATE TABLE "RevokedUrl" (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    revokedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revokedBy TEXT NOT NULL,
    reason TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DownloadLog" (
    id TEXT PRIMARY KEY,
    userId TEXT,
    url TEXT NOT NULL,
    s3Key TEXT NOT NULL,
    downloadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ipAddress TEXT,
    userAgent TEXT,
    success BOOLEAN DEFAULT true,
    error TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX "RevokedUrl_url_idx" ON "RevokedUrl"("url");
CREATE INDEX "RevokedUrl_revokedBy_revokedAt_idx" ON "RevokedUrl"("revokedBy", "revokedAt");
CREATE INDEX "DownloadLog_userId_downloadedAt_idx" ON "DownloadLog"("userId", "downloadedAt");
CREATE INDEX "DownloadLog_url_downloadedAt_idx" ON "DownloadLog"("url", "downloadedAt");
CREATE INDEX "DownloadLog_s3Key_downloadedAt_idx" ON "DownloadLog"("s3Key", "downloadedAt");
```

## Compliance Checklist

- [ ] URL expiry times implemented according to content sensitivity
- [ ] Revocation system operational with admin interface
- [ ] Download tracking logs all access attempts
- [ ] Security analytics provide monitoring capabilities
- [ ] Suspicious activity detection rules configured
- [ ] Audit logs capture all security operations
- [ ] HIPAA access control requirements met
- [ ] HIPAA encryption requirements implemented
- [ ] Incident response procedures documented
- [ ] Staff training completed on S3 security policies

## Support

For technical support or security incidents:
- **Security Team**: security@biopoint.com
- **HIPAA Compliance**: compliance@biopoint.com
- **Emergency**: +1-555-SECURITY

---

*Last Updated: January 2024*
*Version: 1.0*
*Classification: L3-CONFIDENTIAL*