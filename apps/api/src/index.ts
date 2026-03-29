import 'dotenv/config';
import { prisma } from '@biopoint/db';
import { dbPerformanceMonitor } from './services/databasePerformance.js';
import { accountLockoutConfig } from './middleware/rateLimit.js';
import { createServer } from './app.js';

const app = await createServer();

// Graceful shutdown
const shutdown = async () => {
    app.log.info('Shutting down...');

    // Stop performance monitoring
    dbPerformanceMonitor.stopMonitoring();

    await prisma.$disconnect();
    await app.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

try {
    await app.listen({ port, host });
    app.log.info(`🚀 BioPoint API running at http://${host}:${port}`);
    app.log.info(`🔒 Rate limiting active with HIPAA-compliant account lockout`);
    app.log.info(`🔐 Account lockout: ${accountLockoutConfig.maxAttempts} attempts, ${accountLockoutConfig.lockoutDurationMs / 1000 / 60}min lockout`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
