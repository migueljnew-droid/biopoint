/**
 * BioPoint Database Performance Configuration
 * Connection pooling and performance optimization settings
 * 
 * HIPAA Performance Implication: Ensures system availability for patient care access
 */

export interface DatabaseConfig {
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    acquireTimeoutMillis: number;
    reapIntervalMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
  };
  performance: {
    queryTimeout: number;
    slowQueryThreshold: number;
    connectionLeakDetection: number;
    poolExhaustionAlert: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

const baseConfig: DatabaseConfig = {
  pool: {
    min: 2, // Minimum connections in pool
    max: 5, // Default max connections (will be overridden per environment)
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 10000, // 10 seconds
    acquireTimeoutMillis: 15000, // 15 seconds
    reapIntervalMillis: 1000, // Check for idle connections every second
    createTimeoutMillis: 5000, // 5 seconds to create new connection
    destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
  },
  performance: {
    queryTimeout: 30000, // 30 seconds max query time
    slowQueryThreshold: 500, // 500ms threshold for slow queries
    connectionLeakDetection: 60000, // 60 seconds for leak detection
    poolExhaustionAlert: 90, // Alert when pool utilization > 90%
  },
  monitoring: {
    enabled: true,
    metricsInterval: 30000, // Collect metrics every 30 seconds
    healthCheckInterval: 10000, // Health check every 10 seconds
  },
};

const environmentConfigs = {
  development: {
    ...baseConfig,
    pool: {
      ...baseConfig.pool,
      max: 5, // 5 connections for development
    },
  },
  staging: {
    ...baseConfig,
    pool: {
      ...baseConfig.pool,
      max: 10, // 10 connections for staging
    },
  },
  production: {
    ...baseConfig,
    pool: {
      ...baseConfig.pool,
      max: 20, // 20 connections for production
    },
    monitoring: {
      ...baseConfig.monitoring,
      metricsInterval: 15000, // More frequent monitoring in production
      healthCheckInterval: 5000, // More frequent health checks
    },
  },
  test: {
    ...baseConfig,
    pool: {
      ...baseConfig.pool,
      max: 3, // 3 connections for tests
    },
    monitoring: {
      ...baseConfig.monitoring,
      enabled: false, // Disable monitoring in tests
    },
  },
};

export function getDatabaseConfig(): DatabaseConfig {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof environmentConfigs;
  return environmentConfigs[env] || environmentConfigs.development;
}

// Performance targets
export const performanceTargets = {
  concurrentUsers: {
    100: { target: 200, unit: 'ms' },    // 100 users: <200ms avg response
    500: { target: 500, unit: 'ms' },    // 500 users: <500ms avg response
    1000: { target: 1000, unit: 'ms' },  // 1000 users: <1000ms avg response
  },
  poolUtilization: {
    warning: 70,  // Warning at 70% utilization
    critical: 90, // Critical at 90% utilization
  },
  connectionMetrics: {
    maxWaitTime: 5000, // Max 5 seconds waiting for connection
    maxQueryTime: 30000, // Max 30 seconds for query execution
  },
};

export default getDatabaseConfig;