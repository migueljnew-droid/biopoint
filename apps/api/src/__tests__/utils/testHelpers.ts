import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../../utils/auth.js';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  token?: string;
}

export interface TestLabReport {
  id: string;
  userId: string;
  filename: string;
  s3Key: string;
  notes?: string;
  reportDate?: Date;
  uploadedAt: Date;
}

export interface TestDailyLog {
  id: string;
  userId: string;
  date: Date;
  notes?: string;
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  focusLevel?: number;
  moodLevel?: number;
  weightKg?: number;
  createdAt: Date;
}

export class TestHelpers {
  static generateUserData(overrides?: Partial<TestUser>) {
    return {
      email: faker.internet.email(),
      password: 'TestPassword123!',
      role: 'USER' as const,
      ...overrides,
    };
  }

  static generateLabReportData(overrides?: Partial<TestLabReport>) {
    return {
      filename: faker.system.fileName({ extensionCount: 1 }) + '.pdf',
      s3Key: `test-reports/${faker.string.uuid()}.pdf`,
      notes: faker.lorem.paragraphs(2),
      reportDate: faker.date.recent(),
      ...overrides,
    };
  }

  static generateDailyLogData(overrides?: Partial<TestDailyLog>) {
    return {
      date: faker.date.recent(),
      notes: faker.lorem.sentence(),
      sleepHours: faker.number.int({ min: 4, max: 10 }),
      sleepQuality: faker.number.int({ min: 1, max: 10 }),
      energyLevel: faker.number.int({ min: 1, max: 10 }),
      focusLevel: faker.number.int({ min: 1, max: 10 }),
      moodLevel: faker.number.int({ min: 1, max: 10 }),
      weightKg: faker.number.float({ min: 45, max: 120, precision: 0.1 }),
      ...overrides,
    };
  }

  static generateJwtToken(payload: any, secret?: string, expiresIn = '1h') {
    return jwt.sign(payload, secret || process.env.JWT_SECRET || 'test-secret', {
      expiresIn,
    });
  }

  static generateValidToken(userId: string, role: string = 'USER') {
    return generateAccessToken({ userId, email: faker.internet.email(), role: role as 'USER' | 'ADMIN' });
  }

  static generateExpiredToken(userId: string, role: string = 'USER') {
    return jwt.sign(
      { userId, email: faker.internet.email(), role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '-1h' }
    );
  }

  static generateInvalidToken() {
    return 'invalid.token.here';
  }

  static generateMalformedToken() {
    return 'not.a.jwt';
  }

  static async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateIpAddress() {
    return faker.internet.ip();
  }

  static generateUserAgent() {
    return faker.internet.userAgent();
  }

  static generateLargePayload(sizeInKB: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const targetSize = sizeInKB * 1024;
    let result = '';
    for (let i = 0; i < targetSize; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateSqlInjectionPayloads() {
    return [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "1' OR 1=1#",
    ];
  }

  static generateXssPayloads() {
    return [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<svg onload="alert(1)">',
      '"><script>alert(1)</script>',
    ];
  }

  static generatePathTraversalPayloads() {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '/etc/passwd',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
    ];
  }

  static generateRateLimitTestData(numRequests: number) {
    return Array.from({ length: numRequests }, (_, i) => ({
      ip: this.generateIpAddress(),
      userAgent: this.generateUserAgent(),
      timestamp: Date.now() + i,
    }));
  }
}

export class SecurityTestHelpers {
  static generateAuthHeaders(token?: string) {
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      'X-Forwarded-For': faker.internet.ip(),
      'User-Agent': faker.internet.userAgent(),
    };
  }

  static generateMalformedHeaders() {
    return {
      'Content-Type': 'invalid/content-type',
      'X-Forwarded-For': 'not-an-ip',
      'User-Agent': '',
    };
  }

  static generateLargeHeaders(sizeInKB: number) {
    const largeValue = TestHelpers.generateLargePayload(sizeInKB);
    return {
      'X-Large-Header': largeValue,
      'Authorization': 'Bearer token',
    };
  }

  static generateCorsTestOrigins() {
    return [
      'http://localhost:3000',
      'https://biopoint.app',
      'https://app.biopoint.com',
      'http://malicious-site.com',
      'https://evil.example.com',
    ];
  }
}

export class ComplianceTestHelpers {
  static generatePHIData() {
    return {
      name: faker.person.fullName(),
      dateOfBirth: faker.date.birthdate(),
      ssn: faker.string.numeric(9),
      medicalRecordNumber: faker.string.alphanumeric(10),
      diagnosis: faker.lorem.words(3),
      treatment: faker.lorem.sentence(),
    };
  }

  static generateAuditLogData(action: string, entityType: string) {
    return {
      action,
      entityType,
      entityId: faker.string.uuid(),
      userId: faker.string.uuid(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      timestamp: new Date(),
      metadata: {
        userRole: 'USER',
        sessionId: faker.string.uuid(),
      },
    };
  }

  static generateHIPAABreachScenarios() {
    return [
      {
        scenario: 'Unauthorized access to patient data',
        userId: 'unauthorized-user',
        entityType: 'LabReport',
        shouldLog: true,
        shouldAlert: true,
      },
      {
        scenario: 'Bulk data export without authorization',
        userId: 'authorized-user',
        entityType: 'User',
        metadata: { exportType: 'bulk', recordCount: 1000 },
        shouldLog: true,
        shouldAlert: true,
      },
      {
        scenario: 'Normal user accessing own data',
        userId: 'legitimate-user',
        entityType: 'LabReport',
        shouldLog: true,
        shouldAlert: false,
      },
    ];
  }
}

export default TestHelpers;
