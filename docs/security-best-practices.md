# BioPoint Security Best Practices

## Overview

This document outlines comprehensive security practices for the BioPoint application, ensuring HIPAA compliance and protecting sensitive health data. These practices cover code security, dependency management, secret handling, incident response, and security testing.

## Table of Contents

1. [Code Security Guidelines](#code-security-guidelines)
2. [Dependency Management](#dependency-management)
3. [Secret Handling Procedures](#secret-handling-procedures)
4. [Incident Response Checklist](#incident-response-checklist)
5. [Security Testing Procedures](#security-testing-procedures)
6. [HIPAA Compliance](#hipaa-compliance)
7. [Infrastructure Security](#infrastructure-security)
8. [Mobile App Security](#mobile-app-security)

## Code Security Guidelines

### 1. Input Validation and Sanitization

#### Backend Validation
```typescript
// apps/api/src/middleware/validation.ts
import { z } from 'zod';

// Define strict validation schemas
const UserRegistrationSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  firstName: z.string().max(50).regex(/^[a-zA-Z\s-']+$/, 'Invalid name format'),
  lastName: z.string().max(50).regex(/^[a-zA-Z\s-']+$/, 'Invalid name format'),
});

// Implement validation middleware
export const validateInput = (schema: z.ZodSchema) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = schema.parse(request.body);
      request.body = validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      throw error;
    }
  };
};
```

#### SQL Injection Prevention
```typescript
// Always use parameterized queries with Prisma
// ✅ Good
const users = await prisma.user.findMany({
  where: {
    email: userEmail, // Parameterized query
    role: 'USER',
  },
});

// ❌ Never use raw SQL without parameters
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = '${userEmail}' -- Vulnerable to SQL injection
`;

// ✅ Safe raw query with parameters
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userEmail} AND role = ${userRole}
`;
```

#### XSS Prevention
```typescript
// Sanitize user input before storage
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  });
}

// Use in API endpoints
app.post('/users/profile', async (request, reply) => {
  const { bio, notes } = request.body;
  
  const sanitizedData = {
    bio: sanitizeInput(bio),
    notes: sanitizeInput(notes),
  };
  
  const updatedProfile = await prisma.profile.update({
    where: { userId: request.userId },
    data: sanitizedData,
  });
  
  return updatedProfile;
});
```

### 2. Authentication and Authorization

#### Implement JWT Best Practices
```typescript
// apps/api/src/utils/auth.ts
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

// Use strong, random secrets
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || randomBytes(64).toString('hex');

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m', // Short expiration for access tokens
    issuer: 'biopoint.com',
    audience: 'biopoint-users',
    algorithm: 'HS256',
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    {
      expiresIn: '7d', // Longer expiration for refresh tokens
      issuer: 'biopoint.com',
      audience: 'biopoint-users',
    }
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'biopoint.com',
      audience: 'biopoint-users',
    }) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
```

#### Implement Role-Based Access Control (RBAC)
```typescript
// apps/api/src/middleware/authorization.ts
export enum Permission {
  READ_OWN_DATA = 'read:own_data',
  WRITE_OWN_DATA = 'write:own_data',
  READ_USER_DATA = 'read:user_data',
  WRITE_USER_DATA = 'write:user_data',
  ADMIN_ACCESS = 'admin:access',
}

interface PermissionRequirement {
  resource: string;
  action: string;
}

export function requirePermission(requiredPermission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const userRole = (request as any).userRole;
    
    // Define role permissions
    const rolePermissions = {
      USER: [Permission.READ_OWN_DATA, Permission.WRITE_OWN_DATA],
      ADMIN: [
        Permission.READ_OWN_DATA,
        Permission.WRITE_OWN_DATA,
        Permission.READ_USER_DATA,
        Permission.WRITE_USER_DATA,
        Permission.ADMIN_ACCESS,
      ],
    };
    
    const userPermissions = rolePermissions[userRole] || [];
    
    if (!userPermissions.includes(requiredPermission)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }
    
    // Additional resource-specific checks
    if (requiredPermission === Permission.READ_USER_DATA) {
      const targetUserId = request.params.userId;
      if (targetUserId !== userId && userRole !== 'ADMIN') {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot access other users data',
        });
        return;
      }
    }
  };
}
```

### 3. Secure Error Handling

#### Prevent Information Leakage
```typescript
// apps/api/src/middleware/errorHandler.ts
export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  // Log full error details for debugging
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    userId: (request as any).userId,
    ip: request.ip,
  });

  // Send sanitized error response
  if (error instanceof ValidationError) {
    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid input data',
      details: error.getSanitizedDetails(),
    });
  } else if (error instanceof AuthenticationError) {
    reply.status(401).send({
      error: 'Authentication Error',
      message: 'Authentication failed',
    });
  } else if (error instanceof AuthorizationError) {
    reply.status(403).send({
      error: 'Authorization Error',
      message: 'Access denied',
    });
  } else {
    // Generic error for unexpected issues
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      requestId: (request as any).id, // For tracking
    });
  }
}
```

### 4. Secure File Upload

#### Implement File Type Validation
```typescript
// apps/api/src/middleware/fileUpload.ts
import { extname } from 'path';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function validateFileUpload(
  file: Buffer,
  originalName: string
): Promise<void> {
  // Check file size
  if (file.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds maximum allowed size');
  }

  // Check file extension
  const extension = extname(originalName).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];
  
  if (!allowedExtensions.includes(extension)) {
    throw new Error('File type not allowed');
  }

  // Verify file type from buffer
  const fileType = await fileTypeFromBuffer(file);
  if (!fileType) {
    throw new Error('Cannot determine file type');
  }

  const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
  if (!allowedTypes.includes(fileType.mime)) {
    throw new Error('File type not allowed');
  }

  // Additional security checks
  if (extension === '.pdf' && fileType.mime !== 'application/pdf') {
    throw new Error('File extension does not match content');
  }
}
```

#### Secure File Storage
```typescript
// apps/api/src/services/fileStorageService.ts
import crypto from 'crypto';
import path from 'path';

export class FileStorageService {
  private s3Client: S3Client;
  private bucket: string;

  async uploadFile(
    file: Buffer,
    originalName: string,
    userId: string
  ): Promise<string> {
    // Generate secure filename
    const fileExtension = path.extname(originalName);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const secureFilename = `${userId}/${timestamp}-${randomBytes}${fileExtension}`;

    // Encrypt file before upload (optional for sensitive data)
    const encryptedBuffer = await this.encryptFile(file);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: secureFilename,
      Body: encryptedBuffer,
      ContentType: fileType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        userId,
        originalName: Buffer.from(originalName).toString('base64'), // Encode filename
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
    return secureFilename;
  }

  private async encryptFile(file: Buffer): Promise<Buffer> {
    const algorithm = 'aes-256-gcm';
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    const encrypted = Buffer.concat([cipher.update(file), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }
}
```

## Dependency Management

### 1. Dependency Scanning

#### Regular Vulnerability Scans
```bash
# package.json scripts
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:check": "npm audit --audit-level=high --production",
    "security:fix": "npm audit fix",
    "security:outdated": "npm outdated",
    "security:snyk": "snyk test",
    "security:licenses": "license-checker --summary"
  }
}

# Run security checks
npm run security:audit
npm run security:snyk
```

#### Automated Dependency Updates
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
      - "backend-team"
    assignees:
      - "lead-engineer"
    commit-message:
      prefix: "security"
      include: "scope"
    labels:
      - "security"
      - "dependencies"
```

### 2. License Compliance

#### License Checking
```typescript
// scripts/checkLicenses.js
const checker = require('license-checker');
const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
];

checker.init({ start: './' }, function (err, packages) {
  if (err) {
    console.error('License check failed:', err);
    process.exit(1);
  }

  const violations = [];
  
  Object.entries(packages).forEach(([packageName, info]) => {
    const licenses = Array.isArray(info.licenses) 
      ? info.licenses 
      : [info.licenses];
    
    const hasAllowedLicense = licenses.some(license => 
      ALLOWED_LICENSES.includes(license)
    );
    
    if (!hasAllowedLicense) {
      violations.push({
        package: packageName,
        licenses: licenses,
      });
    }
  });

  if (violations.length > 0) {
    console.error('License violations found:');
    violations.forEach(violation => {
      console.error(`${violation.package}: ${violation.licenses.join(', ')}`);
    });
    process.exit(1);
  }

  console.log('All licenses are compliant');
});
```

### 3. Supply Chain Security

#### Package Integrity Verification
```bash
# Enable package-lock.json integrity verification
npm config set package-lock true

# Verify package signatures when available
npm audit signatures

# Use npm ci in CI/CD for reproducible builds
npm ci --only=production
```

#### Private Registry Usage
```bash
# Configure private npm registry for sensitive packages
npm config set registry https://registry.biopoint.internal

# Use scoped packages for internal libraries
npm install @biopoint/security-utils
npm install @biopoint/encryption
```

## Secret Handling Procedures

### 1. Secret Management with Doppler

#### Environment Configuration
```bash
# Development environment
doppler setup
doppler enclave environments create development
doppler enclave environments create staging
doppler enclave environments create production

# Set secrets for each environment
doppler secrets set DATABASE_URL --config dev
doppler secrets set JWT_SECRET --config prod
doppler secrets set AWS_ACCESS_KEY_ID --config prod
```

#### Secret Rotation
```typescript
// apps/api/src/services/secretRotationService.ts
export class SecretRotationService {
  async rotateJWTSecret(): Promise<void> {
    const newSecret = crypto.randomBytes(64).toString('hex');
    
    // Update Doppler secret
    await doppler.secrets.update({
      project: 'biopoint',
      config: 'production',
      secrets: {
        JWT_SECRET: newSecret,
      },
    });

    // Graceful transition - allow old tokens to remain valid for 1 hour
    await this.updateTokenValidationLogic();
    
    // Log rotation event
    await auditLog.create({
      action: 'SECRET_ROTATION',
      entityType: 'JWT_SECRET',
      metadata: {
        rotatedAt: new Date().toISOString(),
        oldSecretHash: crypto.createHash('sha256').update(oldSecret).digest('hex'),
      },
    });
  }

  async rotateDatabaseCredentials(): Promise<void> {
    // Create new database user
    const newCredentials = await createDatabaseUser();
    
    // Update connection strings
    await this.updateDatabaseConnections(newCredentials);
    
    // Remove old user after transition period
    setTimeout(async () => {
      await removeDatabaseUser(oldCredentials);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}
```

### 2. Secure Secret Storage

#### Never Commit Secrets
```bash
# .gitignore additions
# Environment files
.env
.env.local
.env.production
.env.staging

# Secret files
*.key
*.pem
*.p12
*.p8
secrets.json
config/secrets.js

# IDE files
.vscode/settings.json
.idea/
*.swp
*.swo
```

#### Secure Local Development
```bash
# Use Doppler for local development
doppler run -- npm run dev

# Never store secrets in environment files
echo "JWT_SECRET=never_put_secrets_here" > .env # ❌ Never do this

# Use secure secret templates
cp .env.example .env.local
# Fill .env.local with placeholder values only
```

### 3. Secret Access Auditing

#### Audit Log Implementation
```typescript
// apps/api/src/middleware/secretAccessAudit.ts
export function auditSecretAccess(
  secretName: string,
  userId: string,
  action: 'READ' | 'WRITE' | 'DELETE'
): void {
  auditLog.create({
    action,
    entityType: 'Secret',
    entityId: secretName,
    userId,
    metadata: {
      accessedAt: new Date().toISOString(),
      action,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    },
  });
}
```

## Incident Response Checklist

### 1. Immediate Response (0-15 minutes)

#### Security Incident Detection
```typescript
// apps/api/src/services/securityMonitoring.ts
export class SecurityMonitoringService {
  async detectSuspiciousActivity(): Promise<void> {
    // Monitor for unusual login patterns
    const suspiciousLogins = await this.db.query(`
      SELECT user_id, COUNT(*) as login_count, array_agg(ip_address) as ips
      FROM audit_log 
      WHERE action = 'LOGIN_ATTEMPT' 
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 10 OR COUNT(DISTINCT ip_address) > 3
    `);

    // Monitor for data access anomalies
    const unusualDataAccess = await this.db.query(`
      SELECT user_id, COUNT(*) as access_count
      FROM audit_log 
      WHERE action = 'READ' 
        AND entity_type IN ('LabReport', 'LabMarker', 'ProgressPhoto')
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 100
    `);

    // Alert on suspicious patterns
    if (suspiciousLogins.length > 0 || unusualDataAccess.length > 0) {
      await this.sendSecurityAlert({
        suspiciousLogins,
        unusualDataAccess,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

#### Incident Response Steps
1. **Assess Severity**
   ```typescript
   // Determine incident severity level
   enum IncidentSeverity {
     LOW = 'low',      // Minor impact, no PHI exposed
     MEDIUM = 'medium', // Some impact, potential PHI exposure
     HIGH = 'high',    // Significant impact, PHI likely exposed
     CRITICAL = 'critical', // Severe impact, large-scale PHI breach
   }
   ```

2. **Immediate Containment**
   ```bash
   # Isolate affected systems
   # Block suspicious IP addresses
   # Revoke compromised credentials
   # Enable enhanced logging
   ```

3. **Notification Procedures**
   ```typescript
   // apps/api/src/services/incidentNotification.ts
   export class IncidentNotificationService {
     async notifySecurityTeam(incident: SecurityIncident): Promise<void> {
       const severity = this.assessSeverity(incident);
       
       // Immediate notifications for high/critical incidents
       if (severity === 'HIGH' || severity === 'CRITICAL') {
         await this.sendEmergencyAlert(incident);
         await this.notifyManagement(incident);
       }
       
       // Log incident
       await this.createIncidentRecord(incident);
       
       // Schedule follow-up notifications
       await this.scheduleStatusUpdates(incident);
     }
   }
   ```

### 2. Investigation Phase (15-60 minutes)

#### Evidence Collection
```typescript
// apps/api/src/services/forensicService.ts
export class ForensicService {
  async collectEvidence(incident: SecurityIncident): Promise<Evidence> {
    const evidence: Evidence = {
      timestamp: new Date().toISOString(),
      logs: await this.collectLogs(incident),
      networkData: await this.collectNetworkData(incident),
      databaseSnapshots: await this.createDatabaseSnapshots(incident),
      fileSystemSnapshots: await this.createFileSystemSnapshots(incident),
    };

    // Secure evidence storage
    await this.secureEvidence(evidence);
    
    return evidence;
  }

  private async collectLogs(incident: SecurityIncident): Promise<LogData> {
    return {
      applicationLogs: await this.getApplicationLogs(incident.timeRange),
      systemLogs: await this.getSystemLogs(incident.timeRange),
      databaseLogs: await this.getDatabaseLogs(incident.timeRange),
      auditLogs: await this.getAuditLogs(incident.timeRange, incident.affectedUsers),
    };
  }
}
```

#### Impact Assessment
```typescript
// Assess the scope of the incident
interface ImpactAssessment {
  affectedUsers: number;
  affectedDataTypes: string[];
  dataVolume: number;
  geographicScope: string;
  timeline: {
    detectionTime: Date;
    startTime: Date;
    endTime: Date;
  };
}
```

### 3. Recovery Phase (60+ minutes)

#### System Restoration
```bash
# Restore from clean backups
# Patch vulnerabilities
# Update security configurations
# Re-enable services gradually
# Monitor for recurring issues
```

#### Communication Plan
```typescript
// apps/api/src/services/incidentCommunication.ts
export class IncidentCommunicationService {
  async sendUserNotification(incident: SecurityIncident): Promise<void> {
    if (incident.severity === 'HIGH' || incident.severity === 'CRITICAL') {
      // Notify affected users within 72 hours (HIPAA requirement)
      for (const user of incident.affectedUsers) {
        await this.sendBreachNotification(user, incident);
      }
    }
  }

  private async sendBreachNotification(user: User, incident: SecurityIncident): Promise<void> {
    const notification = {
      type: 'DATA_BREACH',
      userId: user.id,
      incidentId: incident.id,
      description: this.generateBreachDescription(incident),
      recommendedActions: this.getRecommendedActions(incident),
      contactInfo: {
        email: 'security@biopoint.com',
        phone: '1-800-BIOPOINT',
      },
      sentAt: new Date().toISOString(),
    };

    await emailService.sendEmail({
      to: user.email,
      subject: 'Important Security Notice - BioPoint',
      template: 'data_breach_notification',
      data: notification,
    });
  }
}
```

## Security Testing Procedures

### 1. Automated Security Testing

#### SAST (Static Application Security Testing)
```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run ESLint Security Rules
      run: |
        npm install eslint-plugin-security
        npx eslint . --ext .ts,.tsx --config .eslintrc-security.js
    
    - name: Run Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/secrets
          p/ci
          p/typescript
    
    - name: Run CodeQL Analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: typescript
```

#### Dependency Scanning
```yaml
    - name: Run Snyk Security Scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
    
    - name: Run OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'biopoint'
        path: '.'
        format: 'HTML'
```

### 2. Dynamic Security Testing

#### API Security Testing
```typescript
// tests/security/apiSecurity.test.ts
describe('API Security Tests', () => {
  it('should prevent SQL injection in user search', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .get(`/users/search?q=${encodeURIComponent(maliciousInput)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid input');
  });

  it('should prevent XSS in profile bio', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const response = await request(app)
      .put('/users/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bio: xssPayload });
    
    expect(response.status).toBe(200);
    expect(response.body.bio).not.toContain('<script>');
  });

  it('should enforce rate limiting', async () => {
    const requests = Array(100).fill(null).map(() =>
      request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

#### Penetration Testing
```bash
# Automated penetration testing with OWASP ZAP
# scripts/security/penetration-test.sh

#!/bin/bash

echo "Starting OWASP ZAP security scan..."

# Start ZAP daemon
zap.sh -daemon -port 8080 -config api.key=$ZAP_API_KEY &
ZAP_PID=$!

# Wait for ZAP to start
sleep 10

# Run active scan
zap-cli --zap-url http://localhost:8080 quick-scan \
  --self-contained \
  --start-options "-config api.key=$ZAP_API_KEY" \
  http://localhost:3000

# Generate report
zap-cli --zap-url http://localhost:8080 report -o zap-report.html -f html

# Stop ZAP
kill $ZAP_PID

echo "Security scan completed. Report saved to zap-report.html"
```

### 3. Infrastructure Security Testing

#### Container Security Scanning
```dockerfile
# Secure Dockerfile base image
FROM node:18-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S biopoint -u 1001

# Install security updates
RUN apk update && apk upgrade && apk add dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=biopoint:nodejs . .

# Switch to non-root user
USER biopoint

# Expose port
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Infrastructure as Code Security
```yaml
# terraform/security.tf
# Enable encryption at rest for all resources

resource "aws_s3_bucket" "uploads" {
  bucket = "biopoint-uploads-${var.environment}"
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
  
  versioning {
    enabled = true
  }
  
  logging {
    target_bucket = aws_s3_bucket.logs.id
    target_prefix = "s3-access-logs/"
  }
}

resource "aws_db_instance" "biopoint" {
  # ... other configuration ...
  
  storage_encrypted = true
  kms_key_id = aws_kms_key.rds.arn
  
  backup_retention_period = 30
  backup_window = "03:00-04:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  deletion_protection = true
  skip_final_snapshot = false
}
```

## HIPAA Compliance

### 1. Data Protection Requirements

#### Encryption Implementation
```typescript
// apps/api/src/services/encryptionService.ts
import crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyDerivationIterations = 100000;

  async encryptPHI(data: string, password: string): Promise<EncryptedData> {
    // Generate salt
    const salt = crypto.randomBytes(32);
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(
      password,
      salt,
      this.keyDerivationIterations,
      32,
      'sha256'
    );
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from('biopoint-phi'));
    
    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.algorithm,
    };
  }

  async decryptPHI(encryptedData: EncryptedData, password: string): Promise<string> {
    // Decode components
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(
      password,
      salt,
      this.keyDerivationIterations,
      32,
      'sha256'
    );
    
    // Create decipher
    const decipher = crypto.createDecipher(encryptedData.algorithm, key);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from('biopoint-phi'));
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }
}
```

#### Access Control and Audit Logging
```typescript
// apps/api/src/services/hipaaAuditService.ts
export class HIPAAAuditService {
  async logPHIAccess(
    userId: string,
    phiType: string,
    phiId: string,
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await auditLog.create({
      action,
      entityType: 'PHI',
      entityId: phiId,
      userId,
      metadata: {
        phiType,
        ipAddress,
        userAgent,
        accessedAt: new Date().toISOString(),
      },
    });
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const accessLogs = await this.getPHIAccessLogs(startDate, endDate);
    const securityEvents = await this.getSecurityEvents(startDate, endDate);
    const dataBreaches = await this.getDataBreaches(startDate, endDate);

    return {
      period: { startDate, endDate },
      totalAccessEvents: accessLogs.length,
      uniqueUsersAccessed: new Set(accessLogs.map(log => log.userId)).size,
      securityEvents: securityEvents.length,
      dataBreaches: dataBreaches.length,
      complianceScore: this.calculateComplianceScore(accessLogs, securityEvents),
      recommendations: this.generateRecommendations(accessLogs, securityEvents),
    };
  }
}
```

### 2. Business Associate Agreements (BAA)

#### Third-Party Service Assessment
```typescript
// apps/api/src/services/vendorAssessment.ts
interface VendorSecurityAssessment {
  vendorName: string;
  serviceType: string;
  baaStatus: 'SIGNED' | 'PENDING' | 'NOT_REQUIRED';
  securityControls: {
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
    accessControls: boolean;
    auditLogging: boolean;
    incidentResponse: boolean;
  };
  complianceCertifications: string[];
  dataProcessingLocation: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class VendorAssessmentService {
  async assessVendor(vendor: Vendor): Promise<VendorSecurityAssessment> {
    const assessment: VendorSecurityAssessment = {
      vendorName: vendor.name,
      serviceType: vendor.serviceType,
      baaStatus: await this.checkBAAStatus(vendor),
      securityControls: await this.evaluateSecurityControls(vendor),
      complianceCertifications: vendor.complianceCertifications,
      dataProcessingLocation: vendor.dataProcessingLocation,
      riskLevel: await this.calculateRiskLevel(vendor),
    };

    // High-risk vendors require additional review
    if (assessment.riskLevel === 'HIGH') {
      await this.triggerSecurityReview(vendor, assessment);
    }

    return assessment;
  }
}
```

### 3. Breach Notification Procedures

#### Automated Breach Detection
```typescript
// apps/api/src/services/breachDetection.ts
export class BreachDetectionService {
  async detectPotentialBreach(): Promise<PotentialBreach[]> {
    const indicators = await Promise.all([
      this.checkForUnusualDataAccess(),
      this.checkForUnauthorizedExports(),
      this.checkForFailedAuthenticationSpikes(),
      this.checkForUnusualAdminActivity(),
    ]);

    return indicators.filter(indicator => indicator.severity === 'HIGH');
  }

  private async checkForUnusualDataAccess(): Promise<PotentialBreach> {
    const unusualAccess = await this.db.query(`
      SELECT user_id, COUNT(*) as access_count
      FROM audit_log 
      WHERE action = 'READ' 
        AND entity_type IN ('LabReport', 'LabMarker', 'ProgressPhoto')
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY user_id
      HAVING COUNT(*) > 1000  // Threshold for unusual access
    `);

    if (unusualAccess.length > 0) {
      return {
        type: 'UNUSUAL_DATA_ACCESS',
        severity: 'HIGH',
        affectedUsers: unusualAccess.length,
        description: 'Unusually high volume of PHI access detected',
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }
}
```

#### Breach Notification Timeline
```typescript
// apps/api/src/services/breachNotification.ts
export class BreachNotificationService {
  async handleDataBreach(breach: DataBreach): Promise<void> {
    const notificationTimeline = this.calculateNotificationTimeline(breach);
    
    // Immediate internal notification (within 1 hour)
    await this.notifyInternalTeam(breach);
    
    // Risk assessment (within 24 hours)
    const riskAssessment = await this.assessBreachRisk(breach);
    
    // If high risk, notify individuals within 72 hours
    if (riskAssessment.riskLevel === 'HIGH') {
      await this.notifyAffectedIndividuals(breach, notificationTimeline.individualNotification);
    }
    
    // Notify HHS within 60 days if required
    if (riskAssessment.affectedIndividuals > 500) {
      await this.notifyHHS(breach, notificationTimeline.hhsNotification);
    }
    
    // Document all notifications
    await this.documentNotifications(breach, notificationTimeline);
  }

  private calculateNotificationTimeline(breach: DataBreach): NotificationTimeline {
    const discoveryDate = new Date(breach.discoveryDate);
    
    return {
      discovery: discoveryDate,
      internalNotification: new Date(discoveryDate.getTime() + 60 * 60 * 1000), // 1 hour
      riskAssessment: new Date(discoveryDate.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      individualNotification: new Date(discoveryDate.getTime() + 72 * 60 * 60 * 1000), // 72 hours
      hhsNotification: new Date(discoveryDate.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days
    };
  }
}
```

## Infrastructure Security

### 1. Network Security

#### VPC and Security Groups
```yaml
# terraform/network-security.tf
resource "aws_security_group" "biopoint_api" {
  name_prefix = "biopoint-api-"
  vpc_id      = aws_vpc.main.id

  # Only allow HTTPS traffic
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from anywhere"
  }

  # Restrict egress traffic
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to anywhere"
  }

  # Allow database access only from application servers
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.biopoint_db.id]
    description     = "PostgreSQL to database"
  }

  tags = {
    Name = "biopoint-api-sg"
  }
}

# Network ACLs for additional security
resource "aws_network_acl" "biopoint_public" {
  vpc_id = aws_vpc.main.id

  # Deny all traffic by default
  egress {
    rule_number = 100
    protocol    = "-1"
    rule_action = "deny"
    cidr_block  = "0.0.0.0/0"
    from_port   = 0
    to_port     = 0
  }

  # Allow specific traffic
  egress {
    rule_number = 200
    protocol    = "tcp"
    rule_action = "allow"
    cidr_block  = "0.0.0.0/0"
    from_port   = 443
    to_port     = 443
  }
}
```

#### SSL/TLS Configuration
```nginx
# nginx/ssl-config.conf
server {
    listen 443 ssl http2;
    server_name api.biopoint.com;

    # SSL Certificate
    ssl_certificate /etc/ssl/certs/biopoint.crt;
    ssl_certificate_key /etc/ssl/private/biopoint.key;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL Session Settings
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

    # Hide server version
    server_tokens off;

    location / {
        proxy_pass http://biopoint_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Server Hardening

#### Operating System Security
```bash
# scripts/server-hardening.sh
#!/bin/bash

# Update system packages
apt-get update && apt-get upgrade -y

# Configure automatic security updates
apt-get install -y unattended-upgrades
sed -i 's/\/\/Unattended-Upgrade::Automatic-Reboot "false";/Unattended-Upgrade::Automatic-Reboot "true";/' /etc/apt/apt.conf.d/50unattended-upgrades

# Disable unnecessary services
systemctl disable bluetooth
systemctl disable cups
systemctl disable avahi-daemon

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 443/tcp
ufw --force enable

# Configure SSH security
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/X11Forwarding yes/X11Forwarding no/' /etc/ssh/sshd_config

# Install and configure fail2ban
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

#### Container Security
```dockerfile
# Dockerfile.security
FROM node:18-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S biopoint -u 1001

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies as root
RUN npm ci --only=production && npm cache clean --force

# Change ownership to app user
RUN chown -R biopoint:nodejs /app

# Switch to non-root user
USER biopoint

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run application
CMD ["node", "dist/server.js"]
```

## Mobile App Security

### 1. Secure Storage

#### Biometric Authentication
```typescript
// apps/mobile/src/services/biometricAuth.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export class BiometricAuthService {
  async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }

  async authenticate(reason: string = 'Access sensitive data'): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });

    return result.success;
  }

  async storeSecureData(key: string, data: string): Promise<void> {
    const biometricsAvailable = await this.isAvailable();
    
    await SecureStore.setItemAsync(key, data, {
      requireAuthentication: biometricsAvailable,
      authenticationPrompt: 'Authenticate to store data securely',
    });
  }

  async retrieveSecureData(key: string): Promise<string | null> {
    const biometricsAvailable = await this.isAvailable();
    
    return await SecureStore.getItemAsync(key, {
      requireAuthentication: biometricsAvailable,
      authenticationPrompt: 'Authenticate to access secure data',
    });
  }
}
```

#### Certificate Pinning
```typescript
// apps/mobile/src/services/certificatePinning.ts
import { Platform } from 'react-native';

export function setupCertificatePinning(): void {
  if (Platform.OS === 'ios') {
    // iOS certificate pinning configuration
    const pinnedCertificates = [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Production certificate hash
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Staging certificate hash
    ];

    // Configure certificate pinning for iOS
    // Implementation depends on networking library used
  } else if (Platform.OS === 'android') {
    // Android certificate pinning configuration
    const networkSecurityConfig = `
      <network-security-config>
        <domain-config>
          <domain includeSubdomains="true">api.biopoint.com</domain>
          <pin-set>
            <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
            <pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
          </pin-set>
        </domain-config>
      </network-security-config>
    `;

    // Configure certificate pinning for Android
    // Implementation depends on networking library used
  }
}
```

### 2. Network Security

#### Secure API Communication
```typescript
// apps/mobile/src/services/secureApi.ts
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

export class SecureApiService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Version': process.env.EXPO_PUBLIC_APP_VERSION,
        'X-Platform': Platform.OS,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.apiClient.interceptors.request.use(
      async (config) => {
        const credentials = await Keychain.getInternetCredentials('biopoint');
        if (credentials) {
          config.headers.Authorization = `Bearer ${credentials.password}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh or re-authentication
          await this.handleAuthenticationError();
        }
        return Promise.reject(error);
      }
    );
  }

  async makeSecureRequest<T>(
    method: string,
    url: string,
    data?: any,
    requireBiometrics = false
  ): Promise<T> {
    if (requireBiometrics) {
      const biometricAuth = new BiometricAuthService();
      const isAuthenticated = await biometricAuth.authenticate();
      if (!isAuthenticated) {
        throw new Error('Biometric authentication failed');
      }
    }

    const response = await this.apiClient.request({
      method,
      url,
      data,
    });

    return response.data;
  }
}
```

#### Request/Response Encryption
```typescript
// apps/mobile/src/services/encryptionService.ts
import CryptoJS from 'crypto-js';

export class MobileEncryptionService {
  private encryptionKey: string;

  constructor() {
    // Get encryption key from secure storage
    this.encryptionKey = this.getEncryptionKey();
  }

  encryptRequest(data: any): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
  }

  decryptResponse(encryptedData: string): any {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  }

  private getEncryptionKey(): string {
    // Retrieve from secure storage or derive from device-specific data
    return process.env.EXPO_PUBLIC_ENCRYPTION_KEY || this.deriveDeviceKey();
  }

  private deriveDeviceKey(): string {
    // Derive encryption key from device-specific characteristics
    const deviceId = DeviceInfo.getUniqueId();
    const appId = Application.getApplicationId();
    return CryptoJS.SHA256(deviceId + appId).toString();
  }
}
```

### 3. App Tampering Prevention

#### Root/Jailbreak Detection
```typescript
// apps/mobile/src/services/deviceSecurity.ts
import JailMonkey from 'jail-monkey';

export class DeviceSecurityService {
  async checkDeviceIntegrity(): Promise<DeviceIntegrity> {
    const checks = {
      isJailBroken: JailMonkey.isJailBroken(),
      canMockLocation: JailMonkey.canMockLocation(),
      isOnExternalStorage: JailMonkey.isOnExternalStorage(),
      hasCydiaInstalled: JailMonkey.hasCydiaInstalled(),
      hasFridaInstalled: await this.checkFrida(),
      hasSuperuserBinary: JailMonkey.hasSuperUserBinary(),
      hasSuperuserAPK: JailMonkey.hasSuperUserApk(),
    };

    const isCompromised = Object.values(checks).some(check => check === true);

    if (isCompromised) {
      await this.handleCompromisedDevice(checks);
    }

    return {
      isCompromised,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkFrida(): Promise<boolean> {
    try {
      // Check for Frida server process
      const processes = await this.getRunningProcesses();
      return processes.some(process => 
        process.name.toLowerCase().includes('frida') ||
        process.name.toLowerCase().includes('gadget')
      );
    } catch {
      return false;
    }
  }

  private async handleCompromisedDevice(checks: DeviceChecks): Promise<void> {
    // Log security event
    await this.logSecurityEvent('DEVICE_COMPROMISED', {
      checks,
      timestamp: new Date().toISOString(),
    });

    // Clear sensitive data
    await this.clearSensitiveData();

    // Notify user
    Alert.alert(
      'Security Alert',
      'This device appears to be compromised. For your security, some features may be disabled.',
      [{ text: 'OK', onPress: () => this.navigateToSecurityInfo() }]
    );
  }
}
```

#### Code Obfuscation
```javascript
// metro.config.js - React Native Metro configuration
module.exports = {
  transformer: {
    minifierPath: 'metro-minify-terser',
    minifierConfig: {
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
        },
      },
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      output: {
        comments: false,
        beautify: false,
      },
    },
  },
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx'],
  },
};
```

## Documentation Maintenance

This security best practices guide should be reviewed and updated:
- **Monthly**: Review procedures for accuracy and compliance
- **Quarterly**: Update based on new security threats and incidents
- **Annually**: Comprehensive review and certification renewal

### Version Control
```
Version: 1.0.0
Last Updated: January 2024
Next Review: February 2024
Approved By: Security Team, Compliance Officer
```

### Change Log
```markdown
## Change Log

### Version 1.0.0 (2024-01-15)
- Initial security best practices document
- HIPAA compliance procedures
- Incident response checklist
- Mobile app security guidelines

### Planned Updates
- SOC 2 compliance requirements
- GDPR compliance additions
- Advanced threat detection procedures
```

This comprehensive security best practices guide provides the foundation for maintaining the highest security standards in the BioPoint application. Regular training, testing, and updates ensure continued protection of sensitive health data and compliance with regulatory requirements.