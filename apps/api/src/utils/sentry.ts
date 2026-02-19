/**
 * Sentry Error Tracking Configuration
 * Advanced error monitoring for BioPoint API
 * HIPAA-compliant error reporting with PII scrubbing
 */

import * as Sentry from '@sentry/node';
import { CaptureContext, SeverityLevel } from '@sentry/types';

// Environment configuration
const ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = 'biopoint-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';

/**
 * Error severity levels for BioPoint
 */
export enum ErrorSeverity {
  LOW = 'info',
  MEDIUM = 'warning',
  HIGH = 'error',
  CRITICAL = 'fatal',
}

/**
 * Error categories for BioPoint
 */
export enum ErrorCategory {
  // Authentication & Authorization
  AUTH_FAILURE = 'auth_failure',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  TOKEN_EXPIRED = 'token_expired',
  
  // Database errors
  DATABASE_CONNECTION = 'database_connection',
  DATABASE_QUERY = 'database_query',
  DATABASE_TIMEOUT = 'database_timeout',
  
  // External services
  S3_OPERATION = 's3_operation',
  EXTERNAL_API = 'external_api',
  EMAIL_SERVICE = 'email_service',
  
  // Validation errors
  VALIDATION_ERROR = 'validation_error',
  BUSINESS_RULE = 'business_rule',
  
  // System errors
  SYSTEM_ERROR = 'system_error',
  MEMORY_LEAK = 'memory_leak',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  
  // Security errors
  SECURITY_BREACH = 'security_breach',
  PHI_ACCESS_VIOLATION = 'phi_access_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Infrastructure
  HEALTH_CHECK_FAILED = 'health_check_failed',
  DEPLOYMENT_FAILURE = 'deployment_failure',
}

/**
 * Enhanced error context for BioPoint
 */
export interface BioPointErrorContext extends CaptureContext {
  user?: {
    id?: string;
    email?: string;
    role?: string;
    organization?: string;
  };
  
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    ip?: string;
    userAgent?: string;
    traceId?: string;
  };
  
  database?: {
    query?: string;
    table?: string;
    duration?: number;
    connectionPool?: number;
  };
  
  externalService?: {
    service?: string;
    operation?: string;
    endpoint?: string;
    duration?: number;
    statusCode?: number;
  };
  
  security?: {
    breachType?: string;
    phiAccessed?: boolean;
    unauthorizedAccess?: boolean;
    ipAddress?: string;
    userAgent?: string;
  };
  
  business?: {
    operation?: string;
    entity?: string;
    entityId?: string;
    organizationId?: string;
  };
  
  tags?: {
    category: ErrorCategory;
    severity: ErrorSeverity;
    env: string;
    service: string;
    version: string;
    [key: string]: string;
  };
  
  extra?: {
    [key: string]: any;
  };
}

/**
 * Enhanced error class for BioPoint
 */
export class BioPointError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: BioPointErrorContext;
  public readonly originalError?: Error;
  
  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: BioPointErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'BioPointError';
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.originalError = originalError;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BioPointError);
    }
  }
}

/**
 * Sentry configuration class
 */
export class SentryManager {
  private static instance: SentryManager;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): SentryManager {
    if (!SentryManager.instance) {
      SentryManager.instance = new SentryManager();
    }
    return SentryManager.instance;
  }
  
  /**
   * Capture enhanced error
   */
  public captureError(
    error: Error | BioPointError,
    context?: BioPointErrorContext
  ): string {
    try {
      // Prepare Sentry context
      const sentryContext: CaptureContext = {
        level: this.getSeverityLevel(error instanceof BioPointError ? error.severity : ErrorSeverity.MEDIUM),
        contexts: {},
        tags: {
          env: ENV,
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
          ...(context?.tags || {}),
        },
        extra: {
          ...context?.extra,
        },
      };
      
      // Add user context
      if (context?.user) {
        Sentry.setUser({
          id: context.user.id,
          email: context.user.email,
          username: context.user.email,
          ...context.user,
        });
      }
      
      // Add request context
      if (context?.request) {
        sentryContext.contexts!.request = {
          method: context.request.method,
          url: context.request.url,
          headers: this.scrubHeaders(context.request.headers || {}),
          user_agent: context.request.userAgent,
          ...context.request,
        };
      }
      
      // Add database context
      if (context?.database) {
        sentryContext.contexts!.database = {
          query: this.scrubQuery(context.database.query || ''),
          table: context.database.table,
          duration: context.database.duration,
          connection_pool: context.database.connectionPool,
        };
      }
      
      // Add external service context
      if (context?.externalService) {
        sentryContext.contexts!.external_service = context.externalService;
      }
      
      // Add security context
      if (context?.security) {
        sentryContext.contexts!.security = context.security;
      }
      
      // Add business context
      if (context?.business) {
        sentryContext.contexts!.business = context.business;
      }
      
      // Capture the error
      const eventId = Sentry.captureException(error, sentryContext);
      
      // Log locally for audit trail
      console.error(`[Sentry] Captured ${error.name || 'Error'}: ${error.message}`, {
        eventId,
        category: error instanceof BioPointError ? error.category : 'unknown',
        severity: error instanceof BioPointError ? error.severity : ErrorSeverity.MEDIUM,
      });
      
      return eventId;
      
    } catch (captureError) {
      console.error('Failed to capture error in Sentry:', captureError);
      return 'capture-failed';
    }
  }
  
  /**
   * Capture message
   */
  public captureMessage(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: BioPointErrorContext
  ): string {
    try {
      const sentryContext: CaptureContext = {
        level: this.getSeverityLevel(severity),
        tags: {
          env: ENV,
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
          ...(context?.tags || {}),
        },
        extra: {
          ...context?.extra,
        },
      };
      
      // Add contexts
      if (context?.user) {
        Sentry.setUser(context.user);
      }
      
      if (context?.request) {
        sentryContext.contexts = {
          ...sentryContext.contexts,
          request: context.request,
        };
      }
      
      const eventId = Sentry.captureMessage(message, sentryContext);
      
      console.log(`[Sentry] Captured message: ${message}`, {
        eventId,
        severity,
      });
      
      return eventId;
      
    } catch (captureError) {
      console.error('Failed to capture message in Sentry:', captureError);
      return 'capture-failed';
    }
  }
  
  /**
   * Start transaction for performance monitoring
   */
  public startTransaction(
    name: string,
    operation: string,
    tags?: Record<string, string>
  ): Sentry.Transaction {
    const transaction = Sentry.startTransaction({
      name,
      op: operation,
      tags: {
        env: ENV,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        ...tags,
      },
    });
    
    return transaction;
  }
  
  /**
   * Set user context
   */
  public setUser(user: {
    id?: string;
    email?: string;
    role?: string;
    organization?: string;
    [key: string]: any;
  }): void {
    Sentry.setUser(user);
  }
  
  /**
   * Clear user context
   */
  public clearUser(): void {
    Sentry.configureScope(scope => scope.setUser(null));
  }
  
  /**
   * Add breadcrumb
   */
  public addBreadcrumb(
    message: string,
    category?: string,
    level?: ErrorSeverity,
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level: this.getSeverityLevel(level || ErrorSeverity.LOW),
      data,
      timestamp: Date.now() / 1000,
    });
  }
  
  /**
   * Configure scope
   */
  public configureScope(callback: (scope: Sentry.Scope) => void): void {
    Sentry.configureScope(callback);
  }
  
  /**
   * Flush events
   */
  public async flush(timeout?: number): Promise<boolean> {
    try {
      return await Sentry.flush(timeout || 2000);
    } catch (error) {
      console.error('Failed to flush Sentry events:', error);
      return false;
    }
  }
  
  /**
   * Get severity level for Sentry
   */
  private getSeverityLevel(severity: ErrorSeverity): SeverityLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      default:
        return 'error';
    }
  }
  
  /**
   * Scrub sensitive headers
   */
  private scrubHeaders(headers: Record<string, string>): Record<string, string> {
    const scrubbed = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
      'x-refresh-token',
    ];
    
    sensitiveHeaders.forEach(header => {
      if (scrubbed[header]) {
        scrubbed[header] = '[REDACTED]';
      }
    });
    
    return scrubbed;
  }
  
  /**
   * Scrub sensitive query data
   */
  private scrubQuery(query: string): string {
    // Remove potential PHI from queries
    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // Date
    ];
    
    let scrubbed = query;
    patterns.forEach(pattern => {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    });
    
    return scrubbed;
  }
}

/**
 * Helper functions for common error scenarios
 */

/**
 * Create authentication error
 */
export function createAuthError(
  message: string,
  userId?: string,
  context?: Partial<BioPointErrorContext>
): BioPointError {
  return new BioPointError(
    message,
    ErrorCategory.AUTH_FAILURE,
    ErrorSeverity.HIGH,
    {
      user: userId ? { id: userId } : undefined,
      tags: {
        category: ErrorCategory.AUTH_FAILURE,
        severity: ErrorSeverity.HIGH,
        env: ENV,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      ...context,
    }
  );
}

/**
 * Create database error
 */
export function createDatabaseError(
  message: string,
  query?: string,
  table?: string,
  context?: Partial<BioPointErrorContext>
): BioPointError {
  return new BioPointError(
    message,
    ErrorCategory.DATABASE_QUERY,
    ErrorSeverity.HIGH,
    {
      database: {
        query,
        table,
      },
      tags: {
        category: ErrorCategory.DATABASE_QUERY,
        severity: ErrorSeverity.HIGH,
        env: ENV,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      ...context,
    }
  );
}

/**
 * Create security error
 */
export function createSecurityError(
  message: string,
  breachType: string,
  context?: Partial<BioPointErrorContext>
): BioPointError {
  return new BioPointError(
    message,
    ErrorCategory.SECURITY_BREACH,
    ErrorSeverity.CRITICAL,
    {
      security: {
        breachType,
        unauthorizedAccess: true,
      },
      tags: {
        category: ErrorCategory.SECURITY_BREACH,
        severity: ErrorSeverity.CRITICAL,
        env: ENV,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      ...context,
    }
  );
}

/**
 * Create S3 error
 */
export function createS3Error(
  message: string,
  operation: string,
  bucket: string,
  context?: Partial<BioPointErrorContext>
): BioPointError {
  return new BioPointError(
    message,
    ErrorCategory.S3_OPERATION,
    ErrorSeverity.MEDIUM,
    {
      externalService: {
        service: 's3',
        operation,
        endpoint: bucket,
      },
      tags: {
        category: ErrorCategory.S3_OPERATION,
        severity: ErrorSeverity.MEDIUM,
        env: ENV,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      ...context,
    }
  );
}

// Export singleton instance
export const sentry = SentryManager.getInstance();

export default {
  sentry,
  BioPointError,
  ErrorCategory,
  ErrorSeverity,
  createAuthError,
  createDatabaseError,
  createSecurityError,
  createS3Error,
};