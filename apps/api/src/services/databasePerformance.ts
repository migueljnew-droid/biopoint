/**
 * Database Performance Monitoring Service
 * Tracks query performance, connection usage, and pool health
 * 
 * HIPAA Performance Implication: Ensures system availability for patient care access
 */

import { prisma } from '@biopoint/db';
import { getDatabaseConfig } from '../config/database.js';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  slow: boolean;
  model?: string;
  action?: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  poolUtilization: number;
  timestamp: Date;
}

export interface PerformanceAlert {
  level: 'info' | 'warning' | 'critical';
  type: 'slow_query' | 'pool_exhaustion' | 'connection_leak' | 'high_latency';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

class DatabasePerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics: ConnectionMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private config = getDatabaseConfig();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor() {
    // Avoid keeping the Node event loop alive during tests.
    if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_DB_MONITORING !== 'true') {
      this.startMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_DB_MONITORING === 'true') return;

    this.isMonitoring = true;
    
    // Monitor connection pool metrics
    this.monitoringInterval = setInterval(async () => {
      await this.collectConnectionMetrics();
      this.checkForAlerts();
    }, this.config.monitoring.metricsInterval);

    console.log('[DB MONITOR] Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log('[DB MONITOR] Performance monitoring stopped');
  }

  /**
   * Record query performance metrics
   */
  recordQuery(query: string, duration: number, model?: string, action?: string): void {
    const metrics: QueryMetrics = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      slow: duration > this.config.performance.slowQueryThreshold,
      model,
      action,
    };

    this.queryMetrics.push(metrics);

    // Keep only recent metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > oneHourAgo);

    // Log slow queries
    if (metrics.slow) {
      console.warn(`[SLOW QUERY] ${model || 'Unknown'}.${action || 'Unknown'} took ${duration}ms`);
    }
  }

  /**
   * Collect connection pool metrics
   */
  private async collectConnectionMetrics(): Promise<void> {
    try {
      const poolMetrics = await (prisma as unknown as { $metrics: { json: () => Promise<{ gauges: { key: string; value: number }[] }> } }).$metrics.json();
      
      const totalConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_open')?.value || 0;
      const activeConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_busy')?.value || 0;
      const idleConnections = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_idle')?.value || 0;
      const waitingClients = poolMetrics.gauges.find((m: any) => m.key === 'prisma_pool_connections_wait')?.value || 0;

      const metrics: ConnectionMetrics = {
        totalConnections,
        activeConnections,
        idleConnections,
        waitingClients,
        poolUtilization: (activeConnections / this.config.pool.max) * 100,
        timestamp: new Date(),
      };

      this.connectionMetrics.push(metrics);

      // Keep only recent metrics (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.connectionMetrics = this.connectionMetrics.filter(m => m.timestamp > oneHourAgo);

    } catch (error) {
      console.error('[DB MONITOR] Failed to collect connection metrics:', error);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(): void {
    // Check connection pool exhaustion
    const recentConnections = this.connectionMetrics.slice(-5); // Last 5 measurements
    if (recentConnections.length > 0) {
      const avgUtilization = recentConnections.reduce((sum, m) => sum + m.poolUtilization, 0) / recentConnections.length;
      
      if (avgUtilization >= this.config.performance.poolExhaustionAlert) {
        this.addAlert('critical', 'pool_exhaustion', 
          `Connection pool utilization critical: ${avgUtilization.toFixed(1)}%`,
          { utilization: avgUtilization, threshold: this.config.performance.poolExhaustionAlert }
        );
      } else if (avgUtilization >= this.config.performance.poolExhaustionAlert * 0.8) {
        this.addAlert('warning', 'pool_exhaustion',
          `Connection pool utilization high: ${avgUtilization.toFixed(1)}%`,
          { utilization: avgUtilization, threshold: this.config.performance.poolExhaustionAlert * 0.8 }
        );
      }

      // Check for connection starvation
      const recentWaiting = recentConnections.some(m => m.waitingClients > 0);
      if (recentWaiting) {
        this.addAlert('warning', 'connection_leak',
          'Clients are waiting for database connections',
          { recentMetrics: recentConnections }
        );
      }
    }

    // Check for slow queries
    const recentSlowQueries = this.queryMetrics.filter(m => 
      m.slow && m.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );
    
    if (recentSlowQueries.length > 10) { // More than 10 slow queries in 5 minutes
      this.addAlert('warning', 'slow_query',
        `${recentSlowQueries.length} slow queries detected in last 5 minutes`,
        { count: recentSlowQueries.length, queries: recentSlowQueries.slice(0, 5) }
      );
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(level: PerformanceAlert['level'], type: PerformanceAlert['type'], 
                   message: string, details: Record<string, any>): void {
    const alert: PerformanceAlert = {
      level,
      type,
      message,
      details,
      timestamp: new Date(),
    };

    this.alerts.push(alert);

    // Log alert
    const logMessage = `[DB ALERT] ${level.toUpperCase()}: ${message}`;
    switch (level) {
      case 'critical':
        console.error(logMessage, details);
        break;
      case 'warning':
        console.warn(logMessage, details);
        break;
      default:
        console.log(logMessage, details);
    }

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > oneDayAgo);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    queries: QueryMetrics[];
    connections: ConnectionMetrics[];
    alerts: PerformanceAlert[];
    summary: {
      totalQueries: number;
      slowQueries: number;
      avgQueryTime: number;
      maxQueryTime: number;
      currentPoolUtilization: number;
      status: 'healthy' | 'degraded' | 'critical';
    };
  } {
    const recentQueries = this.queryMetrics.filter(m => 
      m.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    const recentConnections = this.connectionMetrics.filter(m => 
      m.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    const recentAlerts = this.alerts.filter(a => 
      a.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const totalQueries = recentQueries.length;
    const slowQueries = recentQueries.filter(q => q.slow).length;
    const avgQueryTime = totalQueries > 0 ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries : 0;
    const maxQueryTime = totalQueries > 0 ? Math.max(...recentQueries.map(q => q.duration)) : 0;
    
    const currentConnection = recentConnections[recentConnections.length - 1];
    const currentPoolUtilization = currentConnection ? currentConnection.poolUtilization : 0;

    // Determine status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (recentAlerts.some(a => a.level === 'critical')) {
      status = 'critical';
    } else if (recentAlerts.some(a => a.level === 'warning')) {
      status = 'degraded';
    }

    return {
      queries: recentQueries,
      connections: recentConnections,
      alerts: recentAlerts,
      summary: {
        totalQueries,
        slowQueries,
        avgQueryTime,
        maxQueryTime,
        currentPoolUtilization,
        status,
      },
    };
  }

  /**
   * Sanitize query for logging
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query
      .replace(/'[^']*'/g, "'")
      .replace(/\$\d+/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200); // Limit length
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    // Pool size recommendations
    if (metrics.summary.currentPoolUtilization > 80) {
      recommendations.push('Consider increasing connection pool size - current utilization is high');
    }

    // Query optimization recommendations
    if (metrics.summary.slowQueries > metrics.summary.totalQueries * 0.1) {
      recommendations.push('High percentage of slow queries detected - review query performance');
    }

    // Connection leak detection
    const recentConnections = this.connectionMetrics.slice(-10);
    const hasWaitingClients = recentConnections.some(m => m.waitingClients > 0);
    if (hasWaitingClients) {
      recommendations.push('Clients are waiting for connections - check for connection leaks');
    }

    return recommendations;
  }
}

// Export singleton instance
export const dbPerformanceMonitor = new DatabasePerformanceMonitor();

// Performance tracking middleware
export function trackQueryPerformance<T>(
  query: () => Promise<T>,
  model?: string,
  action?: string
): Promise<T> {
  const startTime = Date.now();
  
  return query().finally(() => {
    const duration = Date.now() - startTime;
    dbPerformanceMonitor.recordQuery(`${model || 'unknown'}.${action || 'unknown'}`, duration, model, action);
  });
}
