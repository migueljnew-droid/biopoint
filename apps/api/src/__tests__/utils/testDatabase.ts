import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const testDatabaseUrl = process.env.DATABASE_URL_TEST || 'postgresql://biopoint_test:test_password@localhost:5433/biopoint_test';

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

let schemaInitialized = false;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..'
);

function ensureTestDatabaseSchema() {
  if (schemaInitialized) return;

  execSync('npx prisma db push --force-reset --schema db/prisma/schema.prisma', {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      TMPDIR: '/tmp',
    },
    stdio: 'ignore',
  });

  schemaInitialized = true;
}

export class TestDatabase {
  private static instance: TestDatabase;
  
  constructor(public prisma: PrismaClient) {}

  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase(testPrisma);
    }
    return TestDatabase.instance;
  }

  async cleanDatabase() {
    // Delete in correct order to handle foreign key constraints
    await this.prisma.auditLog.deleteMany({});
    await this.prisma.downloadLog.deleteMany({});
    await this.prisma.revokedUrl.deleteMany({});
    await this.prisma.complianceEvent.deleteMany({});
    await this.prisma.reminderSchedule.deleteMany({});
    await this.prisma.labMarker.deleteMany({});
    await this.prisma.labReport.deleteMany({});
    await this.prisma.progressPhoto.deleteMany({});
    await this.prisma.dailyLog.deleteMany({});
    await this.prisma.bioPointScore.deleteMany({});
    await this.prisma.stackItem.deleteMany({});
    await this.prisma.stack.deleteMany({});
    await this.prisma.post.deleteMany({});
    await this.prisma.groupMember.deleteMany({});
    await this.prisma.group.deleteMany({});
    await this.prisma.refreshToken.deleteMany({});
    await this.prisma.deletionRequest.deleteMany({});
    await this.prisma.consentRecord.deleteMany({});
    await this.prisma.accountLockout.deleteMany({});
    await this.prisma.rateLimit.deleteMany({});
    await this.prisma.profile.deleteMany({});
    await this.prisma.user.deleteMany({});
  }

  async createTestUser(data: {
    email: string;
    password?: string;
    role?: 'USER' | 'ADMIN';
  }) {
    const bcrypt = await import('bcrypt');
    const password = data.password || 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role || 'USER',
      },
    });
  }

  async createTestLabReport(
    userId: string,
    data?: {
      filename?: string;
      s3Key?: string;
      notes?: string;
      reportDate?: Date;
    }
  ) {
    return this.prisma.labReport.create({
      data: {
        userId,
        filename: data?.filename || 'test-report.pdf',
        s3Key: data?.s3Key || 'test-reports/test-report.pdf',
        notes: data?.notes || 'Test lab report notes',
        reportDate: data?.reportDate,
      },
    });
  }

  async createStack(data: {
    userId: string;
    name: string;
    goal?: string;
    startDate?: Date;
    items?: Array<{
      name: string;
      dose: number;
      unit: string;
      route?: string;
      frequency: string;
      timing?: string;
      cycleJson?: any;
      notes?: string;
      isActive?: boolean;
    }>;
  }) {
    return this.prisma.stack.create({
      data: {
        userId: data.userId,
        name: data.name,
        goal: data.goal,
        startDate: data.startDate,
        items: data.items
          ? {
              create: data.items.map((item) => ({
                name: item.name,
                dose: item.dose,
                unit: item.unit,
                route: item.route,
                frequency: item.frequency,
                timing: item.timing,
                cycleJson: item.cycleJson,
                notes: item.notes,
                isActive: item.isActive ?? true,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });
  }

  async createStackItem(data: {
    stackId: string;
    name: string;
    dose: number;
    unit: string;
    route?: string;
    frequency: string;
    timing?: string;
    cycleJson?: any;
    notes?: string;
    isActive?: boolean;
  }) {
    return this.prisma.stackItem.create({
      data: {
        stackId: data.stackId,
        name: data.name,
        dose: data.dose,
        unit: data.unit,
        route: data.route,
        frequency: data.frequency,
        timing: data.timing,
        cycleJson: data.cycleJson,
        notes: data.notes,
        isActive: data.isActive ?? true,
      },
    });
  }

  async createTestDailyLog(
    userId: string,
    data?: {
      date?: Date;
      notes?: string;
      sleepHours?: number;
      sleepQuality?: number;
      energyLevel?: number;
      focusLevel?: number;
      moodLevel?: number;
      weightKg?: number;
    }
  ) {
    return this.prisma.dailyLog.create({
      data: {
        userId,
        date: data?.date || new Date(),
        notes: data?.notes || 'Test daily log notes',
        sleepHours: data?.sleepHours,
        sleepQuality: data?.sleepQuality,
        energyLevel: data?.energyLevel,
        focusLevel: data?.focusLevel,
        moodLevel: data?.moodLevel,
        weightKg: data?.weightKg,
      },
    });
  }

  async createDailyLog(data: {
    userId: string;
    date?: Date;
    notes?: string;
    sleepHours?: number;
    sleepQuality?: number;
    energyLevel?: number;
    focusLevel?: number;
    moodLevel?: number;
    weightKg?: number;
  }) {
    return this.createTestDailyLog(data.userId, data);
  }

  async createLabReport(data: {
    userId: string;
    filename?: string;
    s3Key?: string;
    notes?: string;
    reportDate?: Date;
  }) {
    return this.createTestLabReport(data.userId, data);
  }

  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getAuditLogs(userId?: string) {
    const where = userId ? { userId } : {};
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

export const setupTestDatabase = async () => {
  ensureTestDatabaseSchema();
  const testDb = TestDatabase.getInstance();
  await testDb.cleanDatabase();
  return testDb;
};

export const teardownTestDatabase = async () => {
  const testDb = TestDatabase.getInstance();
  await testDb.cleanDatabase();
  await testDb.close();
};
