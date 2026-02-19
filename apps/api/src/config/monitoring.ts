/**
 * BioPoint Monitoring Configuration
 * Enterprise monitoring setup for Datadog APM and Sentry error tracking
 * HIPAA-compliant logging and metrics collection
 */

import tracer from 'dd-trace';
import * as Sentry from '@sentry/node';
import pino from 'pino';
import { hostname } from 'os';

// Environment configuration
const ENV = process.env.NODE_ENV || 'development';
const DATADOG_ENABLED = process.env.DATADOG_ENABLED === 'true';
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';
const SENTRY_DSN = process.env.SENTRY_DSN;
const SERVICE_NAME = 'biopoint-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';

/**
 * Initialize Datadog APM tracer
 */
export function initializeDatadogTracer(): void {
  if (!DATADOG_ENABLED) {
    console.log('Datadog APM disabled');
    return;
  }

  try {
    tracer.init({
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      env: ENV,
      hostname: hostname(),
      logInjection: true,
      runtimeMetrics: true,
      profiling: true,
      
      // APM configuration
      plugins: false, // We'll manually configure plugins
      
      // Sampling configuration
      sampleRate: 1.0, // Sample all traces in production
      
      // Custom tags
      tags: {
        team: 'sre',
        app: 'biopoint',
        compliance: 'hipaa',
        tier: 'healthcare',
      },
      
      // HTTP plugin configuration
      http: {
        enabled: true,
        headers: ['user-agent', 'x-forwarded-for', 'x-request-id'],
        blacklist: ['/health', '/health/db', '/health/s3', '/health/external'],
      },
      
      // Database plugin configuration
      pg: {
        enabled: true,
        service: `${SERVICE_NAME}-database`,
      },
      
      // Redis plugin configuration
      redis: {
        enabled: true,
        service: `${SERVICE_NAME}-cache`,
      },
    });

    // Manually register plugins for better control
    tracer.use('http', {
      headers: ['user-agent', 'x-forwarded-for', 'x-request-id'],
      blacklist: ['/health', '/health/db', '/health/s3', '/health/external'],
    });

    tracer.use('pg', {
      service: `${SERVICE_NAME}-database`,
    });

    tracer.use('redis', {
      service: `${SERVICE_NAME}-cache`,
    });

    console.log('Datadog APM initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Datadog APM:', error);
  }
}

/**
 * Initialize Sentry error tracking
 */
export function initializeSentry(): void {
  if (!SENTRY_ENABLED || !SENTRY_DSN) {
    console.log('Sentry disabled or DSN not configured');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENV,
      release: `${SERVICE_NAME}@${SERVICE_VERSION}`,
      serverName: hostname(),
      
      // Performance monitoring
      tracesSampleRate: 1.0, // Sample all transactions
      profilesSampleRate: 1.0, // Sample all profiles
      
      // Error filtering
      beforeSend(event, _hint) {
        // Drop health check noise
        if (event.transaction?.includes('/health')) return null;

        // --- PHI SCRUBBING ---
        // 1. Scrub PHI from breadcrumb data (auto-instrumentation captures request/response bodies)
        if (event.breadcrumbs?.values) {
          event.breadcrumbs.values = event.breadcrumbs.values.map(crumb => {
            if (crumb.data) {
              const {
                email, name, value, notes, dateOfBirth, phi, password, token,
                ...safe
              } = crumb.data as Record<string, unknown>;
              crumb.data = safe;
            }
            return crumb;
          });
        }

        // 2. Scrub PHI from extra context (may contain request body snapshots)
        if (event.extra) {
          const {
            email, name, value, notes, dateOfBirth, phi, password, token,
            ...safe
          } = event.extra as Record<string, unknown>;
          event.extra = safe;
        }

        // 3. Strip user.email from Sentry user context — keep only opaque ID
        // User email is a direct identifier and must not be stored in Sentry
        if (event.user?.email) {
          event.user = { id: event.user.id };
        }

        // 4. Add compliance context (non-PHI)
        event.contexts = {
          ...event.contexts,
          app: {
            name: SERVICE_NAME,
            version: SERVICE_VERSION,
            environment: ENV,
          },
          compliance: {
            framework: 'hipaa',
            data_classification: 'phi',
          },
        };

        return event;
      },
      
      // Integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
        new Sentry.Integrations.Postgres(),
        new Sentry.Integrations.Redis(),
      ],
      
      // Additional configuration
      maxBreadcrumbs: 20,   // Limit PHI exposure window (was 100)
      attachStacktrace: true,
      
      // Ignore certain error types
      ignoreErrors: [
        'health check failed',
        'connection timeout',
        'ECONNRESET',
        'ENOTFOUND',
      ],
    });

    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Create Pino logger with Datadog integration
 */
export function createLogger(name: string) {
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    name,
    base: {
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: ENV,
      hostname: hostname(),
    },
    
    // Redact sensitive information
    redact: {
      paths: [
        // Auth & secrets (existing)
        '*.password',
        '*.token',
        '*.secret',
        '*.api_key',
        '*.ssn',
        '*.dob',
        '*.phi',
        '*.pii',
        'headers.authorization',
        'headers.cookie',
        // Healthcare PHI identifiers (HIPAA 18 identifiers - codebase field names)
        '*.email',            // Direct identifier — logs include email in auth/profile routes
        '*.name',             // PHI when associated with health records
        '*.dateOfBirth',      // Common field name in Profile model
        '*.value',            // Lab marker values (encrypted in DB, must not appear in logs)
        '*.notes',            // Clinical notes in StackItem, LabReport, DailyLog, ProgressPhoto
        '*.markers',          // Lab marker arrays
        // Request body patterns (prevent logging request bodies with PHI)
        'body.email',
        'body.name',
        'body.dateOfBirth',
        'body.value',
        'body.notes',
        // Response patterns
        'res.email',
        'res.name',
      ],
      censor: '[REDACTED]',  // Use censor string instead of remove: true — makes debugging easier while still compliant
    },
    
    // Custom serializers
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      
      // Custom PHI data serializer
      phi: (data: any) => {
        return {
          id: data.id ? '[PHI_ID]' : undefined,
          type: data.type,
          access_time: data.access_time,
          user_id: data.user_id ? '[USER_ID]' : undefined,
          // Never log actual PHI content
        };
      },
    },
    
    // Format for Datadog
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        ...bindings,
        dd: {
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
          env: ENV,
        },
      }),
    },
    
    // Timestamp in ISO format
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return logger;
}

/**
 * Custom metrics collection
 */
export class MetricsCollector {
  private logger: pino.Logger;
  
  constructor(logger: pino.Logger) {
    this.logger = logger.child({ component: 'MetricsCollector' });
  }
  
  /**
   * Track PHI access events
   */
  trackPHIAccess(userId: string, recordId: string, action: string, metadata?: any): void {
    const metric = {
      metric: 'phi.access',
      value: 1,
      tags: [
        `user:${userId}`,
        `action:${action}`,
        `env:${ENV}`,
      ],
      timestamp: Date.now(),
    };
    
    this.logger.info({
      ...metric,
      phi: { id: recordId, type: 'access', action },
      user_id: userId,
    }, 'PHI access tracked');
    
    // Send to Datadog if available
    if (DATADOG_ENABLED && tracer.dogstatsd) {
      tracer.dogstatsd.increment('biopoint.phi.access', [
        `user:${userId}`,
        `action:${action}`,
        `env:${ENV}`,
      ]);
    }
  }
  
  /**
   * Track authentication attempts
   */
  trackAuthAttempt(userId: string, success: boolean, method: string, metadata?: any): void {
    const metric = {
      metric: 'auth.attempt',
      value: 1,
      tags: [
        `user:${userId}`,
        `success:${success}`,
        `method:${method}`,
        `env:${ENV}`,
      ],
      timestamp: Date.now(),
    };
    
    this.logger.info({
      ...metric,
      auth: { user_id: userId, success, method },
    }, 'Authentication attempt tracked');
    
    // Send to Datadog if available
    if (DATADOG_ENABLED && tracer.dogstatsd) {
      tracer.dogstatsd.increment('biopoint.auth.attempt', [
        `user:${userId}`,
        `success:${success.toString()}`,
        `method:${method}`,
        `env:${ENV}`,
      ]);
    }
  }
  
  /**
   * Track S3 operations
   */
  trackS3Operation(operation: string, bucket: string, key: string, success: boolean, duration: number): void {
    const metric = {
      metric: 's3.operation',
      value: 1,
      tags: [
        `operation:${operation}`,
        `bucket:${bucket}`,
        `success:${success}`,
        `env:${ENV}`,
      ],
      timestamp: Date.now(),
    };
    
    this.logger.info({
      ...metric,
      s3: { operation, bucket, key, success, duration },
    }, 'S3 operation tracked');
    
    // Send to Datadog if available
    if (DATADOG_ENABLED && tracer.dogstatsd) {
      tracer.dogstatsd.increment('biopoint.s3.operation', [
        `operation:${operation}`,
        `bucket:${bucket}`,
        `success:${success.toString()}`,
        `env:${ENV}`,
      ]);
      
      tracer.dogstatsd.histogram('biopoint.s3.operation.duration', duration, [
        `operation:${operation}`,
        `bucket:${bucket}`,
        `env:${ENV}`,
      ]);
    }
  }
  
  /**
   * Track database query performance
   */
  trackDatabaseQuery(queryType: string, table: string, duration: number, success: boolean): void {
    const metric = {
      metric: 'database.query',
      value: 1,
      tags: [
        `query_type:${queryType}`,
        `table:${table}`,
        `success:${success}`,
        `env:${ENV}`,
      ],
      timestamp: Date.now(),
    };
    
    this.logger.info({
      ...metric,
      db: { query_type: queryType, table, duration, success },
    }, 'Database query tracked');
    
    // Send to Datadog if available
    if (DATADOG_ENABLED && tracer.dogstatsd) {
      tracer.dogstatsd.increment('biopoint.database.query', [
        `query_type:${queryType}`,
        `table:${table}`,
        `success:${success.toString()}`,
        `env:${ENV}`,
      ]);
      
      tracer.dogstatsd.histogram('biopoint.database.query.duration', duration, [
        `query_type:${queryType}`,
        `table:${table}`,
        `env:${ENV}`,
      ]);
    }
  }
  
  /**
   * Track business metrics
   */
  trackBusinessMetric(metric: string, value: number, tags?: string[]): void {
    const defaultTags = [`env:${ENV}`, `service:${SERVICE_NAME}`];
    const allTags = tags ? [...defaultTags, ...tags] : defaultTags;
    
    this.logger.info({
      metric: `business.${metric}`,
      value,
      tags: allTags,
      timestamp: Date.now(),
    }, 'Business metric tracked');
    
    // Send to Datadog if available
    if (DATADOG_ENABLED && tracer.dogstatsd) {
      tracer.dogstatsd.gauge(`biopoint.business.${metric}`, value, allTags);
    }
  }
}

/**
 * Health check monitoring
 */
export class HealthMonitor {
  private logger: pino.Logger;
  private checks: Map<string, () => Promise<boolean>>;
  
  constructor(logger: pino.Logger) {
    this.logger = logger.child({ component: 'HealthMonitor' });
    this.checks = new Map();
  }
  
  /**
   * Register a health check
   */
  registerCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
  }
  
  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, { status: 'healthy' | 'unhealthy'; latency: number; error?: string }>;
    timestamp: string;
  }> {
    const results: Record<string, { status: 'healthy' | 'unhealthy'; latency: number; error?: string }> = {};
    let overallStatus: 'healthy' | 'unhealthy' = 'healthy';
    
    for (const [name, checkFn] of this.checks) {
      const startTime = Date.now();
      
      try {
        const isHealthy = await checkFn();
        const latency = Date.now() - startTime;
        
        results[name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          latency,
          error: isHealthy ? undefined : 'Health check failed',
        };
        
        if (!isHealthy) {
          overallStatus = 'unhealthy';
        }
        
        this.logger.info({
          check: name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          latency,
        }, 'Health check completed');
        
      } catch (error) {
        const latency = Date.now() - startTime;
        
        results[name] = {
          status: 'unhealthy',
          latency,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        
        overallStatus = 'unhealthy';
        
        this.logger.error({
          check: name,
          error: error instanceof Error ? error.message : 'Unknown error',
          latency,
        }, 'Health check failed');
      }
    }
    
    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Initialize all monitoring components
 */
export function initializeMonitoring(): {
  logger: pino.Logger;
  metrics: MetricsCollector;
  health: HealthMonitor;
} {
  // Initialize Datadog APM
  initializeDatadogTracer();
  
  // Initialize Sentry
  initializeSentry();
  
  // Create logger
  const logger = createLogger('biopoint-api');
  
  // Create metrics collector
  const metrics = new MetricsCollector(logger);
  
  // Create health monitor
  const health = new HealthMonitor(logger);
  
  logger.info('Monitoring initialized successfully');
  
  return {
    logger,
    metrics,
    health,
  };
}

export default {
  initializeMonitoring,
  createLogger,
  MetricsCollector,
  HealthMonitor,
};