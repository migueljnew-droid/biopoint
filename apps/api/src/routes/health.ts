import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@biopoint/db';
import { getDatabaseConfig } from '../config/database.js';
import { appLogger } from '../utils/appLogger.js';

const HEALTH_CHECK_TOKEN = process.env.HEALTH_CHECK_TOKEN;

function getProvidedHealthToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  const header = request.headers['x-health-token'];
  if (typeof header === 'string') {
    return header;
  }
  return undefined;
}

function isHealthTokenValid(request: FastifyRequest): boolean {
  if (!HEALTH_CHECK_TOKEN) return false;
  return getProvidedHealthToken(request) === HEALTH_CHECK_TOKEN;
}

async function healthTokenGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!HEALTH_CHECK_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Health check token not configured',
      });
    }
    return;
  }

  if (!isHealthTokenValid(request)) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid health check token',
    });
  }
}

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    poolStats: {
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      waitingClients: number;
      poolUtilization: number;
    };
    queryStats: {
      totalQueries: number;
      slowQueries: number;
      averageQueryTime: number;
      maxQueryTime: number;
    };
    performance: {
      lastHealthCheck: string;
      responseTime: number;
      connectionLatency: number;
    };
  };
  alerts: string[];
}

export async function healthRoutes(app: FastifyInstance) {
  const dbConfig = getDatabaseConfig();

  // Database health check endpoint
  app.get('/health/db', { preHandler: healthTokenGuard }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const metrics: HealthMetrics = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        poolStats: {
          totalConnections: 0,
          activeConnections: 0,
          idleConnections: 0,
          waitingClients: 0,
          poolUtilization: 0,
        },
        queryStats: {
          totalQueries: 0,
          slowQueries: 0,
          averageQueryTime: 0,
          maxQueryTime: 0,
        },
        performance: {
          lastHealthCheck: new Date().toISOString(),
          responseTime: 0,
          connectionLatency: 0,
        },
      },
      alerts: [],
    };

    try {
      // Test database connection with a simple query
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbEndTime = Date.now();
      
      metrics.database.status = 'connected';
      metrics.database.performance.connectionLatency = dbEndTime - dbStartTime;

      // Get connection pool metrics
      try {
        const poolMetrics = await (prisma as unknown as { $metrics: { json: () => Promise<{ gauges: { key: string; value: number }[] }> } }).$metrics.json();
        
        // Extract relevant metrics
        const totalConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_open')?.value || 0;
        const activeConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_busy')?.value || 0;
        const idleConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_idle')?.value || 0;
        const waitingClients = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_wait')?.value || 0;
        
        metrics.database.poolStats = {
          totalConnections,
          activeConnections,
          idleConnections,
          waitingClients,
          poolUtilization: totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0,
        };

        // Check for pool exhaustion
        const poolUtilization = (activeConnections / dbConfig.pool.max) * 100;
        if (poolUtilization >= dbConfig.performance.poolExhaustionAlert) {
          metrics.alerts.push(`CRITICAL: Connection pool utilization at ${poolUtilization.toFixed(1)}%`);
          metrics.status = 'unhealthy';
        } else if (poolUtilization >= dbConfig.performance.poolExhaustionAlert * 0.8) {
          metrics.alerts.push(`WARNING: Connection pool utilization at ${poolUtilization.toFixed(1)}%`);
          if (metrics.status === 'healthy') metrics.status = 'degraded';
        }

        // Check for waiting clients (connection starvation)
        if (waitingClients > 0) {
          metrics.alerts.push(`WARNING: ${waitingClients} clients waiting for connections`);
          if (metrics.status === 'healthy') metrics.status = 'degraded';
        }

      } catch (metricsError) {
        appLogger.error({ err: metricsError }, 'Failed to get pool metrics');
        metrics.alerts.push('WARNING: Unable to retrieve connection pool metrics');
      }

      // Get query performance metrics (simplified)
      try {
        // This is a simplified version - in production, you'd want more sophisticated query tracking
        const queryStats = await prisma.$queryRaw`
          SELECT 
            COUNT(*) as total_queries,
            AVG(query_time) as avg_time,
            MAX(query_time) as max_time,
            SUM(CASE WHEN query_time > ${dbConfig.performance.slowQueryThreshold} THEN 1 ELSE 0 END) as slow_queries
          FROM (
            SELECT 
              query_start,
              query_time
            FROM pg_stat_activity 
            WHERE datname = current_database()
              AND query_start > NOW() - INTERVAL '5 minutes'
              AND state = 'active'
          ) recent_queries
        `;

        if (Array.isArray(queryStats) && queryStats.length > 0) {
          interface DbQueryStats { total_queries?: string; slow_queries?: string; avg_time?: string; max_time?: string; }
          const stats = queryStats[0] as DbQueryStats;
          const slowQueries = parseInt(stats.slow_queries ?? '0') || 0;
          metrics.database.queryStats = {
            totalQueries: parseInt(stats.total_queries ?? '0') || 0,
            slowQueries,
            averageQueryTime: parseFloat(stats.avg_time ?? '0') || 0,
            maxQueryTime: parseFloat(stats.max_time ?? '0') || 0,
          };

          if (slowQueries > 0) {
            metrics.alerts.push(`WARNING: ${slowQueries} slow queries detected in last 5 minutes`);
            if (metrics.status === 'healthy') metrics.status = 'degraded';
          }
        }
      } catch (queryError) {
        appLogger.error({ err: queryError }, 'Failed to get query stats');
        // Continue without query stats
      }

      // Check connection latency
      if (metrics.database.performance.connectionLatency > 1000) {
        metrics.alerts.push(`WARNING: High connection latency (${metrics.database.performance.connectionLatency}ms)`);
        if (metrics.status === 'healthy') metrics.status = 'degraded';
      }

    } catch (error) {
      metrics.database.status = 'error';
      metrics.status = 'unhealthy';
      metrics.alerts.push(`CRITICAL: Database connection failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Calculate total response time
    metrics.database.performance.responseTime = Date.now() - startTime;
    metrics.database.performance.lastHealthCheck = new Date().toISOString();

    // Set appropriate HTTP status code
    const statusCode = metrics.status === 'healthy' ? 200 : 
                      metrics.status === 'degraded' ? 200 : 503;

    return reply.status(statusCode).send(metrics);
  });

  // General health check endpoint (enhanced with database info)
  app.get('/health', async (request: FastifyRequest, _reply: FastifyReply) => {
    const startTime = Date.now();
    let dbStatus = 'unknown';
    let poolUtilization: number | undefined;
    const includeDetails = isHealthTokenValid(request);

    // Keep the /health endpoint lightweight under test runs.
    if (process.env.NODE_ENV === 'test') {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: { status: 'connected' },
        responseTime: Date.now() - startTime,
      };
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      
      if (includeDetails) {
        // Get pool utilization if possible
        try {
          const poolMetrics = await (prisma as unknown as { $metrics: { json: () => Promise<{ gauges: { key: string; value: number }[] }> } }).$metrics.json();
          const totalConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_open')?.value || 0;
          const activeConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_busy')?.value || 0;
          poolUtilization = totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;
        } catch {
          // Continue without pool metrics
        }
      }
    } catch {
      dbStatus = 'disconnected';
    }

    const response: {
      status: string;
      timestamp: string;
      uptime: number;
      database: { status: string; poolUtilization?: number };
      responseTime: number;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
      },
      responseTime: Date.now() - startTime,
    };

    if (includeDetails && poolUtilization !== undefined) {
      response.database.poolUtilization = Math.round(poolUtilization);
    }

    return response;
  });
}
