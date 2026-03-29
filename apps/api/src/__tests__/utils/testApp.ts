import { prisma } from '@biopoint/db';
import { createServer } from '../../app.js';

/**
 * Build a test instance of the BioPoint API
 */
export async function buildTestApp() {
  const loggerLevel = process.env.VITEST_DEBUG_LOGS ? 'info' : 'silent';

  const app = await createServer({
    // Keep test output quiet by default; set `VITEST_DEBUG_LOGS=1` to re-enable logs.
    logger: { level: loggerLevel },
    disableRateLimit: true,
  });

  await app.ready();
  return app;
}

/**
 * Close test app and cleanup
 */
export async function closeTestApp(app: any) {
  await prisma.$disconnect();
  await app.close();
}
