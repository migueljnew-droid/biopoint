# BioPoint Performance Tuning Guide

## Overview

This guide provides comprehensive performance optimization strategies for the BioPoint application, covering database queries, API endpoints, caching strategies, and monitoring techniques.

## Table of Contents

1. [Database Query Optimization](#database-query-optimization)
2. [API Endpoint Optimization](#api-endpoint-optimization)
3. [Caching Strategies](#caching-strategies)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Scaling Guidelines](#scaling-guidelines)
6. [Mobile App Performance](#mobile-app-performance)

## Database Query Optimization

### 1. Index Strategy

#### Essential Indexes
```sql
-- User-related indexes
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_user_created_at ON users(created_at);

-- Stack-related indexes
CREATE INDEX idx_stack_user_id ON stacks(user_id);
CREATE INDEX idx_stack_is_active ON stacks(is_active);
CREATE INDEX idx_stack_created_at ON stacks(created_at);

-- Stack item indexes
CREATE INDEX idx_stack_item_stack_id ON stack_items(stack_id);
CREATE INDEX idx_stack_item_is_active ON stack_items(is_active);

-- Compliance event indexes
CREATE INDEX idx_compliance_user_id ON compliance_events(user_id);
CREATE INDEX idx_compliance_taken_at ON compliance_events(taken_at);
CREATE INDEX idx_compliance_stack_item_id ON compliance_events(stack_item_id);

-- Daily log indexes
CREATE INDEX idx_daily_log_user_date ON daily_logs(user_id, date);
CREATE INDEX idx_daily_log_date ON daily_logs(date);

-- Lab marker indexes
CREATE INDEX idx_lab_marker_user_id ON lab_markers(user_id);
CREATE INDEX idx_lab_marker_name ON lab_markers(name);
CREATE INDEX idx_lab_marker_recorded_at ON lab_markers(recorded_at);

-- BioPoint score indexes
CREATE INDEX idx_biopoint_score_user_date ON biopoint_scores(user_id, date);
CREATE INDEX idx_biopoint_score_date ON biopoint_scores(date);
CREATE INDEX idx_biopoint_score_score ON biopoint_scores(score);
```

#### Composite Indexes for Common Queries
```sql
-- Dashboard query optimization
CREATE INDEX idx_dashboard_data ON daily_logs(user_id, date DESC) 
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Stack compliance tracking
CREATE INDEX idx_stack_compliance ON compliance_events(user_id, taken_at DESC, stack_item_id);

-- Lab results timeline
CREATE INDEX idx_lab_timeline ON lab_markers(user_id, recorded_at DESC, name);

-- User activity tracking
CREATE INDEX idx_user_activity ON audit_logs(user_id, created_at DESC, action);
```

### 2. Query Performance Analysis

#### Identify Slow Queries
```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT 
    query,
    calls,
    total_time / 1000 as total_seconds,
    mean_time / 1000 as mean_seconds,
    stddev_time / 1000 as stddev_seconds,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 50  -- Queries taking > 50ms
ORDER BY mean_time DESC 
LIMIT 20;
```

#### Analyze Specific Query Performance
```sql
-- Analyze dashboard query
EXPLAIN ANALYZE
SELECT 
    u.id,
    u.email,
    dl.date,
    dl.weight_kg,
    dl.sleep_hours,
    dl.energy_level,
    dl.mood_level,
    bps.score as biopoint_score
FROM users u
LEFT JOIN daily_logs dl ON u.id = dl.user_id AND dl.date = CURRENT_DATE
LEFT JOIN biopoint_scores bps ON u.id = bps.user_id AND bps.date = CURRENT_DATE
WHERE u.id = 'user123'
ORDER BY dl.date DESC;
```

### 3. Query Optimization Techniques

#### Optimize Dashboard Data Loading
```typescript
// Before: Multiple queries (N+1 problem)
const users = await prisma.user.findMany();
for (const user of users) {
  const todayLog = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });
  const bioPointScore = await prisma.bioPointScore.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });
}

// After: Single optimized query
const usersWithTodayData = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    profile: {
      select: {
        onboardingComplete: true,
      },
    },
    dailyLogs: {
      where: { date: today },
      take: 1,
    },
    bioPointScores: {
      where: { date: today },
      take: 1,
    },
  },
});
```

#### Optimize Stack Compliance Tracking
```typescript
// Before: Multiple queries with aggregation
const stacks = await prisma.stack.findMany({
  where: { userId, isActive: true },
});

for (const stack of stacks) {
  const complianceRate = await prisma.complianceEvent.count({
    where: {
      stackItemId: { in: stack.items.map(item => item.id) },
      takenAt: { gte: weekAgo },
    },
  });
}

// After: Single query with aggregation
const stackData = await prisma.stack.findMany({
  where: { userId, isActive: true },
  include: {
    items: {
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            complianceEvents: {
              where: {
                takenAt: { gte: weekAgo },
              },
            },
          },
        },
      },
    },
  },
});
```

#### Optimize Lab Results Timeline
```typescript
// Efficient lab results query with proper indexing
const labResults = await prisma.labMarker.findMany({
  where: {
    userId,
    recordedAt: {
      gte: startDate,
      lte: endDate,
    },
  },
  orderBy: {
    recordedAt: 'desc',
  },
  select: {
    id: true,
    name: true,
    value: true,
    unit: true,
    refRangeLow: true,
    refRangeHigh: true,
    recordedAt: true,
    isInRange: true,
  },
});
```

### 4. Database Configuration Tuning

#### Connection Pool Optimization
```typescript
// packages/db/src/client.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  errorFormat: 'pretty',
});

// Optimize connection pooling
const optimizedPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  __internal: {
    engine: {
      endpoint: process.env.DATABASE_URL,
      // Optimize for serverless environment
      allowTriggerPanic: true,
      logQueries: process.env.NODE_ENV === 'development',
      logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'error',
    },
  },
});
```

#### PostgreSQL Configuration
```sql
-- Optimize PostgreSQL for BioPoint workload
-- Connection settings
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Query planner settings
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';

-- Logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = '1000';
ALTER SYSTEM SET log_statement = 'mod';

-- Auto-vacuum settings for high-write tables
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = '0.1';
ALTER SYSTEM SET autovacuum_analyze_scale_factor = '0.05';
```

## API Endpoint Optimization

### 1. Response Time Optimization

#### Implement Efficient Pagination
```typescript
// apps/api/src/utils/pagination.ts
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginatedQuery<T>(
  model: any,
  where: any,
  include: any,
  pagination: PaginationParams
): Promise<PaginatedResponse<T>> {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      include,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
```

#### Optimize Response Serialization
```typescript
// apps/api/src/middleware/serialization.ts
import fastJson from 'fast-json-stringify';

// Define response schemas for fast serialization
const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string' },
    createdAt: { type: 'string' },
    profile: {
      type: 'object',
      properties: {
        onboardingComplete: { type: 'boolean' },
      },
    },
  },
};

const stringifyUser = fastJson(userResponseSchema);

export function serializeUser(user: any): string {
  return stringifyUser(user);
}
```

### 2. Request Processing Optimization

#### Implement Request Batching
```typescript
// apps/api/src/services/batchService.ts
export class BatchService {
  private batchQueue: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  async addToBatch<T>(
    batchKey: string,
    data: T,
    processor: (items: T[]) => Promise<any>,
    batchSize: number = 10,
    timeout: number = 100
  ): Promise<any> {
    if (!this.batchQueue.has(batchKey)) {
      this.batchQueue.set(batchKey, []);
    }

    const queue = this.batchQueue.get(batchKey)!;
    queue.push(data);

    // Process immediately if batch is full
    if (queue.length >= batchSize) {
      return this.processBatch(batchKey, processor);
    }

    // Set timeout for partial batch processing
    if (!this.batchTimers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey, processor);
      }, timeout);
      this.batchTimers.set(batchKey, timer);
    }
  }

  private async processBatch<T>(
    batchKey: string,
    processor: (items: T[]) => Promise<any>
  ): Promise<any> {
    const queue = this.batchQueue.get(batchKey);
    if (!queue || queue.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Clear queue and process
    this.batchQueue.delete(batchKey);
    return processor(queue);
  }
}
```

#### Implement Rate Limiting with Redis
```typescript
// apps/api/src/middleware/rateLimit.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1,
});

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `${options.keyPrefix}:${request.ip}`;
    const window = Math.floor(Date.now() / options.windowMs);
    const redisKey = `${key}:${window}`;

    try {
      const current = await redis.incr(redisKey);
      await redis.expire(redisKey, Math.ceil(options.windowMs / 1000));

      if (current > options.maxRequests) {
        reply.status(429).send({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${options.windowMs}ms.`,
        });
        return;
      }

      reply.header('X-RateLimit-Limit', options.maxRequests);
      reply.header('X-RateLimit-Remaining', Math.max(0, options.maxRequests - current));
      reply.header('X-RateLimit-Reset', (window + 1) * options.windowMs);
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Allow request if Redis is down
    }
  };
}
```

### 3. Background Job Processing

#### Implement Queue System for Heavy Operations
```typescript
// apps/api/src/services/queueService.ts
import Bull from 'bull';

// Create queues for different job types
const emailQueue = new Bull('emails', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

const imageProcessingQueue = new Bull('image-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

export class QueueService {
  async addEmailJob(data: EmailJobData): Promise<void> {
    await emailQueue.add('send-email', data, {
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async addImageProcessingJob(data: ImageProcessingData): Promise<void> {
    await imageProcessingQueue.add('process-image', data, {
      delay: 0,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 1000,
      },
      priority: 1,
    });
  }
}

// Process email jobs
emailQueue.process('send-email', async (job) => {
  const { to, subject, body } = job.data;
  await emailService.sendEmail(to, subject, body);
});

// Process image processing jobs
imageProcessingQueue.process('process-image', async (job) => {
  const { imageUrl, userId } = job.data;
  await imageProcessingService.processImage(imageUrl, userId);
});
```

## Caching Strategies

### 1. Redis Caching Implementation

#### Cache User Sessions
```typescript
// apps/api/src/services/sessionCache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
});

export class SessionCache {
  private defaultTTL = 3600; // 1 hour

  async setSession(
    sessionId: string,
    userData: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    await redis.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(userData)
    );
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  async updateSessionTTL(sessionId: string, ttl: number): Promise<void> {
    await redis.expire(`session:${sessionId}`, ttl);
  }
}
```

#### Cache Dashboard Data
```typescript
// apps/api/src/services/dashboardCache.ts
export class DashboardCache {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 2,
    });
  }

  async getDashboardData(userId: string): Promise<any | null> {
    const cached = await this.redis.get(`dashboard:${userId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setDashboardData(
    userId: string,
    data: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    await this.redis.setex(
      `dashboard:${userId}`,
      ttl,
      JSON.stringify(data)
    );
  }

  async invalidateDashboard(userId: string): Promise<void> {
    await this.redis.del(`dashboard:${userId}`);
  }

  async invalidateAllDashboards(): Promise<void> {
    const keys = await this.redis.keys('dashboard:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 2. API Response Caching

#### Cache GET Endpoints
```typescript
// apps/api/src/middleware/apiCache.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 3,
});

interface CacheOptions {
  ttl: number;
  keyPrefix: string;
  condition?: (request: FastifyRequest) => boolean;
}

export function createCacheMiddleware(options: CacheOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return;
    }

    // Check cache condition
    if (options.condition && !options.condition(request)) {
      return;
    }

    const cacheKey = `${options.keyPrefix}:${request.url}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      reply.header('X-Cache', 'HIT');
      reply.send(JSON.parse(cached));
      return;
    }

    // Store original send method
    const originalSend = reply.send.bind(reply);
    
    // Override send method to cache response
    reply.send = function(payload: any) {
      // Cache the response
      redis.setex(cacheKey, options.ttl, JSON.stringify(payload));
      reply.header('X-Cache', 'MISS');
      
      // Call original send method
      return originalSend(payload);
    };
  };
}
```

#### Implement Cache Invalidation
```typescript
// apps/api/src/services/cacheInvalidationService.ts
export class CacheInvalidationService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 3,
    });
  }

  async invalidateUserCaches(userId: string): Promise<void> {
    // Invalidate all caches related to a user
    const patterns = [
      `dashboard:${userId}`,
      `user:${userId}`,
      `stacks:${userId}:*`,
      `labs:${userId}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  async invalidateStackCaches(userId: string): Promise<void> {
    await this.redis.del(`stacks:${userId}`);
    await this.redis.del(`stacks:${userId}:active`);
  }

  async invalidateLabCaches(userId: string): Promise<void> {
    await this.redis.del(`labs:${userId}`);
    await this.redis.del(`labs:${userId}:recent`);
  }
}
```

### 3. Database Query Result Caching

#### Cache Expensive Aggregations
```typescript
// apps/api/src/services/aggregationCache.ts
export class AggregationCache {
  private redis: Redis;
  private defaultTTL = 900; // 15 minutes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 4,
    });
  }

  async getWeeklyComplianceRate(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number | null> {
    const cacheKey = `compliance:weekly:${userId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return parseFloat(cached);
    }

    return null;
  }

  async setWeeklyComplianceRate(
    userId: string,
    startDate: Date,
    endDate: Date,
    rate: number,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const cacheKey = `compliance:weekly:${userId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    await this.redis.setex(cacheKey, ttl, rate.toString());
  }

  async getBioPointTrend(userId: string, days: number): Promise<any | null> {
    const cacheKey = `biopoint:trend:${userId}:${days}`;
    const cached = await this.redis.get(cacheKey);
    
    return cached ? JSON.parse(cached) : null;
  }

  async setBioPointTrend(
    userId: string,
    days: number,
    trend: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const cacheKey = `biopoint:trend:${userId}:${days}`;
    await this.redis.setex(cacheKey, ttl, JSON.stringify(trend));
  }
}
```

## Monitoring and Alerting

### 1. Performance Metrics Collection

#### Application Performance Monitoring
```typescript
// apps/api/src/middleware/performanceMonitoring.ts
import { performance } from 'perf_hooks';

export function performanceMonitoring(
  request: FastifyRequest,
  reply: FastifyReply,
  done: Function
) {
  const start = performance.now();
  const startTime = Date.now();

  reply.addListener('finish', () => {
    const duration = performance.now() - start;
    const endTime = Date.now();

    // Log performance metrics
    logger.info('API Performance', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: Math.round(duration),
      startTime,
      endTime,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    // Send metrics to monitoring service
    metrics.histogram('api.request.duration', duration, {
      method: request.method,
      route: request.routerPath,
      status_code: reply.statusCode,
    });

    // Alert on slow requests
    if (duration > 1000) { // Requests taking > 1 second
      logger.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        duration: Math.round(duration),
        userId: (request as any).userId,
      });
    }
  });

  done();
}
```

#### Database Query Performance
```typescript
// apps/api/src/middleware/databaseMonitoring.ts
export function databaseMonitoring(prisma: PrismaClient) {
  prisma.$on('query', (e: any) => {
    if (e.duration > 100) { // Queries taking > 100ms
      logger.warn('Slow query detected', {
        query: e.query,
        duration: e.duration,
        params: e.params,
        timestamp: new Date().toISOString(),
      });

      // Send to monitoring service
      metrics.histogram('database.query.duration', e.duration, {
        query_type: e.query.split(' ')[0],
      });
    }
  });
}
```

### 2. Key Performance Indicators (KPIs)

#### API Performance Metrics
```typescript
// Define performance targets
const PERFORMANCE_TARGETS = {
  API_RESPONSE_TIME: {
    P50: 200,    // 50th percentile: 200ms
    P95: 500,    // 95th percentile: 500ms
    P99: 1000,   // 99th percentile: 1s
  },
  DATABASE_QUERY_TIME: {
    P50: 50,     // 50th percentile: 50ms
    P95: 100,    // 95th percentile: 100ms
    P99: 200,    // 99th percentile: 200ms
  },
  ERROR_RATE: {
    TARGET: 0.01,  // 1% error rate
    MAX: 0.05,     // 5% maximum error rate
  },
  AVAILABILITY: {
    TARGET: 0.999,  // 99.9% uptime
    MIN: 0.995,     // 99.5% minimum uptime
  },
};
```

#### Health Check Implementation
```typescript
// apps/api/src/routes/health.ts
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: await checkDatabaseHealth(),
        redis: await checkRedisHealth(),
        s3: await checkS3Health(),
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    const allServicesHealthy = Object.values(health.services).every(
      service => service.status === 'healthy'
    );

    return reply.status(allServicesHealthy ? 200 : 503).send(health);
  });

  app.get('/health/detailed', async (request, reply) => {
    const detailedHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: await getDatabaseMetrics(),
      redis: await getRedisMetrics(),
      api: await getApiMetrics(),
      performance: await getPerformanceMetrics(),
    };

    return detailedHealth;
  });
}

async function checkDatabaseHealth(): Promise<any> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latency: await getDatabaseLatency() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkRedisHealth(): Promise<any> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

### 3. Alerting Configuration

#### Set Up Performance Alerts
```yaml
# monitoring/alerts.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: performance-alerts
data:
  alerts.yml: |
    groups:
    - name: performance
      rules:
      - alert: HighAPIResponseTime
        expr: histogram_quantile(0.95, api_request_duration_seconds) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: HighDatabaseQueryTime
        expr: histogram_quantile(0.95, database_query_duration_seconds) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database query time"
          description: "95th percentile query time is {{ $value }}s"

      - alert: HighErrorRate
        expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: LowCacheHitRate
        expr: rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"
```

## Scaling Guidelines

### 1. Horizontal Scaling

#### Load Balancing Configuration
```nginx
# nginx/nginx.conf
upstream biopoint_api {
    least_conn;
    server api1.biopoint.com:3000 weight=1 max_fails=3 fail_timeout=30s;
    server api2.biopoint.com:3000 weight=1 max_fails=3 fail_timeout=30s;
    server api3.biopoint.com:3000 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.biopoint.com;

    location / {
        proxy_pass http://biopoint_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /health {
        proxy_pass http://biopoint_api/health;
        access_log off;
    }
}
```

#### Database Read Replicas
```typescript
// packages/db/src/readReplica.ts
import { PrismaClient } from '@prisma/client';

// Primary database client for writes
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Read replica clients for read operations
export const prismaRead1 = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_REPLICA_1_URL,
    },
  },
});

export const prismaRead2 = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_REPLICA_2_URL,
    },
  },
});

// Round-robin read replica selection
let currentReadReplica = 0;
const readReplicas = [prismaRead1, prismaRead2];

export function getReadReplica(): PrismaClient {
  const replica = readReplicas[currentReadReplica];
  currentReadReplica = (currentReadReplica + 1) % readReplicas.length;
  return replica;
}

// Usage in services
export class UserService {
  async findByEmail(email: string): Promise<User | null> {
    const readReplica = getReadReplica();
    return readReplica.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    // Always use primary for writes
    return prismaWrite.user.create({
      data,
      include: { profile: true },
    });
  }
}
```

### 2. Vertical Scaling

#### Optimize for High CPU Usage
```typescript
// apps/api/src/cluster.ts
import cluster from 'cluster';
import os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    console.log('Starting a new worker');
    cluster.fork();
  });
} else {
  // Workers share the server port
  startServer();
  console.log(`Worker ${process.pid} started`);
}
```

#### Memory Optimization
```typescript
// apps/api/src/utils/memoryOptimization.ts
export function setupMemoryMonitoring() {
  // Monitor memory usage
  setInterval(() => {
    const usage = process.memoryUsage();
    
    if (usage.heapUsed / usage.heapTotal > 0.8) {
      console.warn('High memory usage detected:', {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      });
      
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Enable manual garbage collection
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_OPTIONS = '--expose-gc';
}
```

### 3. Auto-scaling Configuration

#### Kubernetes Horizontal Pod Autoscaler
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biopoint-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biopoint-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

#### Cloud Provider Auto-scaling
```bash
# AWS Application Auto Scaling
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/biopoint-cluster/biopoint-service \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10

aws application-autoscaling put-scaling-policy \
    --policy-name biopoint-cpu-scaling \
    --service-namespace ecs \
    --resource-id service/biopoint-cluster/biopoint-service \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Mobile App Performance

### 1. Bundle Optimization

#### Code Splitting
```typescript
// apps/mobile/src/navigation/lazyLoading.ts
import { lazy } from 'react';

// Lazy load heavy screens
const LabReportsScreen = lazy(() => import('../screens/LabReportsScreen'));
const ProgressPhotosScreen = lazy(() => import('../screens/ProgressPhotosScreen'));
const CommunityScreen = lazy(() => import('../screens/CommunityScreen'));

// Lazy load heavy components
const ChartComponent = lazy(() => import('../components/ChartComponent'));
const ImageGallery = lazy(() => import('../components/ImageGallery'));
```

#### Optimize Dependencies
```json
// apps/mobile/package.json optimization
{
  "scripts": {
    "analyze:bundle": "npx expo-bundle-analyzer",
    "optimize:bundle": "npx expo-optimize"
  }
}
```

#### Tree Shaking
```typescript
// Use specific imports instead of wildcard imports
// ❌ Bad
import * as _ from 'lodash';

// ✅ Good
import { debounce, throttle } from 'lodash';

// Or use lodash-es for better tree shaking
import { debounce, throttle } from 'lodash-es';
```

### 2. Image Optimization

#### Optimize Image Loading
```typescript
// apps/mobile/src/utils/imageOptimization.ts
import { Image } from 'expo-image';

interface OptimizedImageProps {
  source: string;
  style: any;
  placeholder?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  placeholder,
}) => {
  return (
    <Image
      source={source}
      style={style}
      placeholder={placeholder}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      onLoad={() => {
        // Track image load performance
        analytics.track('image_loaded', {
          source,
          timestamp: Date.now(),
        });
      }}
    />
  );
};
```

#### Progressive Image Loading
```typescript
// apps/mobile/src/components/ProgressiveImage.tsx
export const ProgressiveImage: React.FC<{
  thumbnailSource: string;
  fullSource: string;
  style: any;
}> = ({ thumbnailSource, fullSource, style }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);

  return (
    <View style={style}>
      <Image
        source={thumbnailSource}
        style={[style, isFullImageLoaded && styles.hidden]}
        onLoad={() => setIsLoading(false)}
      />
      <Image
        source={fullSource}
        style={[style, !isFullImageLoaded && styles.hidden]}
        onLoad={() => setIsFullImageLoaded(true)}
      />
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### 3. Memory Management

#### Optimize Component Renders
```typescript
// apps/mobile/src/components/OptimizedComponent.tsx
import React, { useMemo, useCallback } from 'react';

interface OptimizedComponentProps {
  data: any[];
  onItemPress: (item: any) => void;
}

export const OptimizedComponent = React.memo<OptimizedComponentProps>(
  ({ data, onItemPress }) => {
    // Memoize expensive calculations
    const processedData = useMemo(() => {
      return data.map(item => ({
        ...item,
        processed: expensiveCalculation(item),
      }));
    }, [data]);

    // Memoize callbacks to prevent unnecessary re-renders
    const handleItemPress = useCallback(
      (item: any) => {
        onItemPress(item);
      },
      [onItemPress]
    );

    return (
      <FlatList
        data={processedData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleItemPress(item)}>
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
        // Optimize FlatList performance
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 60,
          offset: 60 * index,
          index,
        })}
      />
    );
  }
);

function expensiveCalculation(item: any) {
  // Simulate expensive calculation
  return item.value * Math.random();
}
```

#### Manage Large Lists
```typescript
// apps/mobile/src/components/VirtualizedList.tsx
import { VirtualizedList } from 'react-native';

export const VirtualizedListComponent: React.FC<{ data: any[] }> = ({ data }) => {
  const getItemCount = (data: any[]) => data.length;
  const getItem = (data: any[], index: number) => data[index];

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    return (
      <View style={styles.item}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  return (
    <VirtualizedList
      data={data}
      getItemCount={getItemCount}
      getItem={getItem}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={21}
      removeClippedSubviews={true}
    />
  );
};
```

### 4. Network Optimization

#### Implement Request Debouncing
```typescript
// apps/mobile/src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
const SearchComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <TextInput
      value={searchTerm}
      onChangeText={setSearchTerm}
      placeholder="Search..."
    />
  );
};
```

#### Optimize API Calls
```typescript
// apps/mobile/src/services/optimizedApi.ts
import { memoize } from 'lodash';

export class OptimizedApiService {
  // Memoize expensive API calls
  private getUserProfile = memoize(
    async (userId: string) => {
      return apiClient.get(`/users/${userId}/profile`);
    },
    (userId) => userId
  );

  // Batch multiple requests
  async batchRequests<T>(requests: (() => Promise<T>)[]): Promise<T[]> {
    return Promise.all(requests.map(request => request()));
  }

  // Implement request deduplication
  private pendingRequests: Map<string, Promise<any>> = new Map();

  async deduplicatedRequest<T>(
    key: string,
    request: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = request();
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}
```

This comprehensive performance tuning guide provides the foundation for maintaining optimal performance as BioPoint scales. Regular monitoring, testing, and optimization based on these principles will ensure the application continues to deliver excellent user experience while handling increased load.