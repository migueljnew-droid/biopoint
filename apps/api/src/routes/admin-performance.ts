import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbPerformanceMonitor } from '../services/databasePerformance.js';
import { getDatabaseConfig } from '../config/database.js';

export async function adminPerformanceRoutes(app: FastifyInstance) {
  const config = getDatabaseConfig();

  // Get detailed performance metrics
  app.get('/admin/performance/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = dbPerformanceMonitor.getMetrics();
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get performance recommendations
  app.get('/admin/performance/recommendations', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const recommendations = dbPerformanceMonitor.getRecommendations();
      return {
        success: true,
        data: {
          recommendations,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get connection pool statistics
  app.get('/admin/performance/pool', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { prisma } = await import('@biopoint/db');
      const poolMetrics = await (prisma as unknown as { $metrics: { json: () => Promise<{ gauges: { key: string; value: number }[] }> } }).$metrics.json();
      
      const totalConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_open')?.value || 0;
      const activeConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_busy')?.value || 0;
      const idleConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_idle')?.value || 0;
      const waitingClients = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_wait')?.value || 0;
      
      const utilization = (activeConnections / config.pool.max) * 100;
      
      return {
        success: true,
        data: {
          poolStats: {
            totalConnections,
            activeConnections,
            idleConnections,
            waitingClients,
            maxConnections: config.pool.max,
            minConnections: config.pool.min,
            utilization: Math.round(utilization * 100) / 100,
            utilizationStatus: utilization >= 90 ? 'critical' : 
                             utilization >= 70 ? 'warning' : 'healthy',
          },
          config: {
            maxConnections: config.pool.max,
            minConnections: config.pool.min,
            idleTimeout: config.pool.idleTimeoutMillis,
            connectionTimeout: config.pool.connectionTimeoutMillis,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve pool statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get query performance statistics
  app.get('/admin/performance/queries', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { since = '1h' } = request.query as { since?: string };
      
      // Convert since parameter to milliseconds
      const sinceMs = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
      }[since] || 60 * 60 * 1000; // Default to 1 hour
      
      const metrics = dbPerformanceMonitor.getMetrics();
      const recentQueries = metrics.queries.filter(q => 
        q.timestamp > new Date(Date.now() - sinceMs)
      );
      
      const avgQueryTime = recentQueries.length > 0 
        ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length 
        : 0;
      
      const slowQueries = recentQueries.filter(q => q.slow);
      
      return {
        success: true,
        data: {
          queryStats: {
            totalQueries: recentQueries.length,
            slowQueries: slowQueries.length,
            avgQueryTime: Math.round(avgQueryTime * 100) / 100,
            maxQueryTime: recentQueries.length > 0 ? Math.max(...recentQueries.map(q => q.duration)) : 0,
            slowQueryRatio: recentQueries.length > 0 ? (slowQueries.length / recentQueries.length) * 100 : 0,
          },
          slowQueries: slowQueries.slice(0, 10), // Top 10 slowest queries
          recentQueries: recentQueries.slice(-10), // Last 10 queries
          since,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve query statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get performance alerts
  app.get('/admin/performance/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { level } = request.query as { level?: 'info' | 'warning' | 'critical' };
      
      const metrics = dbPerformanceMonitor.getMetrics();
      let alerts = metrics.alerts;
      
      if (level) {
        alerts = alerts.filter(alert => alert.level === level);
      }
      
      // Sort by timestamp (most recent first)
      alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return {
        success: true,
        data: {
          alerts: alerts.slice(0, 50), // Last 50 alerts
          summary: {
            total: alerts.length,
            critical: alerts.filter(a => a.level === 'critical').length,
            warning: alerts.filter(a => a.level === 'warning').length,
            info: alerts.filter(a => a.level === 'info').length,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve performance alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get database configuration
  app.get('/admin/performance/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return {
        success: true,
        data: {
          pool: config.pool,
          performance: config.performance,
          monitoring: config.monitoring,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Export performance report
  app.get('/admin/performance/report', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { format = 'json' } = request.query as { format?: 'json' | 'csv' };
      
      const metrics = dbPerformanceMonitor.getMetrics();
      const recommendations = dbPerformanceMonitor.getRecommendations();
      
      if (format === 'csv') {
        // Generate CSV report
        const csvHeaders = 'Timestamp,Status,Total Queries,Slow Queries,Avg Query Time (ms),Max Query Time (ms),Pool Utilization (%),Active Connections,Idle Connections,Waiting Clients\n';
        
        const csvData = metrics.connections.map(conn => 
          `${new Date().toISOString()},${metrics.summary.status},${metrics.summary.totalQueries},${metrics.summary.slowQueries},${metrics.summary.avgQueryTime},${metrics.summary.maxQueryTime},${conn.poolUtilization},${conn.activeConnections},${conn.idleConnections},${conn.waitingClients}`
        ).join('\n');
        
        const csvContent = csvHeaders + csvData;
        
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="biopoint-performance-report.csv"');
        return csvContent;
      }
      
      // Generate JSON report
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          reportVersion: '1.0',
        },
        summary: metrics.summary,
        queryStats: {
          totalQueries: metrics.summary.totalQueries,
          slowQueries: metrics.summary.slowQueries,
          avgQueryTime: metrics.summary.avgQueryTime,
          maxQueryTime: metrics.summary.maxQueryTime,
          recentQueries: metrics.queries.slice(-20),
        },
        connectionStats: {
          currentUtilization: metrics.summary.currentPoolUtilization,
          recentConnections: metrics.connections.slice(-20),
          poolConfig: config.pool,
        },
        alerts: {
          recent: metrics.alerts.slice(-10),
          summary: {
            total: metrics.alerts.length,
            critical: metrics.alerts.filter(a => a.level === 'critical').length,
            warning: metrics.alerts.filter(a => a.level === 'warning').length,
            info: metrics.alerts.filter(a => a.level === 'info').length,
          },
        },
        recommendations,
      };
      
      return {
        success: true,
        data: report,
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate performance report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}