import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  isEncryptedString,
  generateEncryptionKey,
  isValidEncryptionKey,
  validateEncryptionSetup,
  sanitizeForLogging,
} from "../utils/encryption.js";
import { setupEncryptionMiddleware } from "../middleware/encryption.js";
import { setupTestDatabase, teardownTestDatabase } from "./utils/testDatabase.js";

const testDatabaseUrl =
  process.env.DATABASE_URL_TEST ||
  "postgresql://biopoint_test:test_password@localhost:5433/biopoint_test";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

describe("Encryption Utilities", () => {
  it("encrypts and decrypts strings", async () => {
    const original = "sensitive_phi_data_12345";
    const encrypted = await encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
    expect(encrypted.encrypted).not.toBe(original);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.version).toBeDefined();
    expect(encrypted.algorithm).toBe("aes-256-gcm");
  });

  it("handles encrypted JSON string format", async () => {
    const original = "json_formatted_phi_data";
    const encryptedString = await encryptToString(original);
    const decrypted = decryptFromString(encryptedString);

    expect(decrypted).toBe(original);
    expect(isEncryptedString(encryptedString)).toBe(true);
    expect(isEncryptedString(original)).toBe(false);
  });

  it("generates valid encryption keys", async () => {
    const key = await generateEncryptionKey();
    expect(typeof key).toBe("string");
    expect(isValidEncryptionKey(key)).toBe(true);
  });

  it("validates encryption setup", async () => {
    const validation = await validateEncryptionSetup();
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it("sanitizes encrypted data for logging", () => {
    const encryptedData = JSON.stringify({
      encrypted: "ciphertext",
      iv: "vector",
      tag: "tag",
      version: "1",
      algorithm: "aes-256-gcm",
    });

    const sanitized = sanitizeForLogging(encryptedData);
    expect(sanitized).toBe("[ENCRYPTED_DATA]");
  });
});

describe("Prisma Encryption Middleware", () => {
  let testUserId: string;
  let testProfileId: string | null = null;

  beforeAll(async () => {
    await setupTestDatabase();
    setupEncryptionMiddleware(prisma);

    const user = await prisma.user.create({
      data: {
        email: "encryption-test@biopoint.com",
        passwordHash: "test_hash",
        role: "USER",
      },
    });

    testUserId = user.id;
  });

  afterAll(async () => {
    if (testProfileId) {
      await prisma.profile.delete({ where: { id: testProfileId } });
    }
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    if (testProfileId) {
      await prisma.profile.delete({ where: { id: testProfileId } });
      testProfileId = null;
    }
  });

  it("encrypts profile PHI fields on create and decrypts on read", async () => {
    const dateOfBirth = new Date("1990-01-15T00:00:00Z").toISOString();

    const profile = await prisma.profile.create({
      data: {
        userId: testUserId,
        dateOfBirth: new Date(dateOfBirth),
        sex: "male",
      },
    });

    testProfileId = profile.id;

    const [rawProfile] = (await prisma.$queryRaw`
      SELECT "dateOfBirth_encrypted" FROM "Profile" WHERE id = ${profile.id}
    `) as Array<{ dateOfBirth_encrypted: string | null }>;

    expect(rawProfile.dateOfBirth_encrypted).toBeDefined();
    expect(isEncryptedString(rawProfile.dateOfBirth_encrypted || "")).toBe(true);

    const retrievedProfile = await prisma.profile.findUnique({
      where: { id: profile.id },
    });

    expect(retrievedProfile).toBeDefined();
    expect(retrievedProfile?.dateOfBirth).toBe(dateOfBirth);
    expect((retrievedProfile as unknown as Record<string, unknown>)['dateOfBirth_encrypted']).toBeUndefined();
  });

  it("encrypts and decrypts lab marker values", async () => {
    const marker = await prisma.labMarker.create({
      data: {
        userId: testUserId,
        name: "Testosterone",
        value: 500.5,
        unit: "ng/dL",
      },
    });

    const [rawMarker] = (await prisma.$queryRaw`
      SELECT "value_encrypted" FROM "LabMarker" WHERE id = ${marker.id}
    `) as Array<{ value_encrypted: string | null }>;

    expect(rawMarker.value_encrypted).toBeDefined();
    expect(isEncryptedString(rawMarker.value_encrypted || "")).toBe(true);

    const retrievedMarker = await prisma.labMarker.findUnique({
      where: { id: marker.id },
    });

    expect(retrievedMarker).toBeDefined();
    expect(Number(retrievedMarker?.value)).toBeCloseTo(500.5);
  });

  it("handles decryption failures gracefully", async () => {
    const profile = await prisma.profile.create({
      data: {
        userId: testUserId,
        dateOfBirth: new Date("1990-01-15T00:00:00Z"),
        sex: "female",
      },
    });

    testProfileId = profile.id;

    await prisma.$executeRaw`
      UPDATE "Profile" 
      SET "dateOfBirth_encrypted" = 'invalid_encrypted_data' 
      WHERE id = ${profile.id}
    `;

    const retrievedProfile = await prisma.profile.findUnique({
      where: { id: profile.id },
    });

    expect(retrievedProfile).toBeDefined();
    expect(retrievedProfile?.dateOfBirth).toBe("[DECRYPTION_FAILED]");
  });
});
