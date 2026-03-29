# BioPoint Database Performance Guide

## Overview

This guide covers database performance optimization and connection pooling configuration for BioPoint's PostgreSQL database. The implementation ensures HIPAA-compliant system availability for patient care access while maintaining optimal performance under high concurrent load.

## Connection Pool Configuration

### Environment-Specific Pool Sizes

| Environment | Pool Size | Target Users | Use Case |
|-------------|-----------|--------------|----------|
| Development | 5 | 1-3 developers | Local development and testing |
| Staging | 10 | QA team | Pre-production testing |
| Production | 20 | 1000+ concurrent users | Live patient data access |
| Test | 3 | Automated tests | CI/CD pipeline |

### Pool Configuration Settings

```typescript
// apps/api/src/config/database.ts
const baseConfig = {
  pool: {
    min: 2,                    // Minimum connections
    idleTimeoutMillis: 30000,   // 30 seconds idle timeout
    connectionTimeoutMillis: 10000, // 10 seconds connection timeout
    acquireTimeoutMillis: 15000,    // 15 seconds to acquire connection
    reapIntervalMillis: 1000,       // Check idle connections every second
    createTimeoutMillis: 5000,      // 5 seconds to create connection
    destroyTimeoutMillis: 5000,     // 5 seconds to destroy connection
  }
};
```

## Performance Targets

### Response Time Targets

| Concurrent Users | Target Response Time | Current Performance |
|------------------|---------------------|---------------------|
| 100 users | <200ms avg | 150ms (✅ Good) |
| 500 users | <500ms avg | 800ms (⚠️ Needs improvement) |
| 1000 users | <1000ms avg | 3200ms (❌ Critical) |

### Connection Pool Metrics

- **Pool Utilization**: Target <70% for normal operations
- **Warning Threshold**: 70-89% utilization
- **Critical Threshold**: ≥90% utilization
- **Connection Wait Time**: Target <5 seconds
- **Query Timeout**: 30 seconds maximum
- **Slow Query Threshold**: 500ms

## Health Check Endpoints

### Basic Health Check
```http
GET /health
```

Returns basic system status:
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "uptime": 3600,
  "database": {
    "status": "connected",
    "poolUtilization": 45
  },
  "responseTime": 25
}
```

### Database Health Check
```http
GET /health/db
```

Returns comprehensive database performance metrics:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "database": {
    "status": "connected",
    "poolStats": {
      "totalConnections": 8,
      "activeConnections": 3,
      "idleConnections": 5,
      "waitingClients": 0,
      "poolUtilization": 37.5
    },
    "queryStats": {
      "totalQueries": 1250,
      "slowQueries": 12,
      "averageQueryTime": 45,
      "maxQueryTime": 850
    },
    "performance": {
      "lastHealthCheck": "2024-01-20T12:00:00.000Z",
      "responseTime": 125,
      "connectionLatency": 15
    }
  },
  "alerts": []
}
```

## Monitoring and Alerting

### Performance Monitoring

The system continuously monitors:

1. **Connection Pool Metrics**
   - Total connections
   - Active vs idle connections
   - Pool utilization percentage
   - Waiting clients (connection starvation)

2. **Query Performance**
   - Query execution time
   - Slow query detection (>500ms)
   - Query frequency patterns
   - Error rates

3. **Connection Health**
   - Connection latency
   - Connection leaks
   - Pool exhaustion events
   - Database availability

### Alert Conditions

| Level | Condition | Action |
|-------|-----------|--------|
| INFO | Pool utilization >50% | Log for trending |
| WARNING | Pool utilization >70% | Console warning |
| WARNING | Slow queries >10 in 5min | Console warning |
| CRITICAL | Pool utilization >90% | Console error |
| CRITICAL | Database connection failed | Console error |
| CRITICAL | Connection wait time >5s | Console error |

## Optimization Script

### Running the Optimization Analysis

```bash
# Make script executable
chmod +x scripts/database-optimize.sh

# Run analysis
./scripts/database-optimize.sh

# With specific database URL
DATABASE_URL="postgresql://..." ./scripts/database-optimize.sh
```

### Script Output

The script analyzes:
- Connection pool usage
- Slow query identification
- Table bloat analysis
- Index usage patterns
- Missing index recommendations
- Vacuum and analyze statistics
- Connection pool sizing recommendations

## Performance Optimization Strategies

### 1. Connection Pool Optimization

```typescript
// Prisma client configuration
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  connectionLimit: 20, // Production pool size
  poolTimeout: 15000,  // 15 seconds
  idleTimeout: 30000,  // 30 seconds
});
```

### 2. Query Optimization

- **Use indexes**: Ensure frequently queried columns are indexed
- **Limit results**: Use `take` and `skip` for pagination
- **Select specific fields**: Avoid `select *` queries
- **Use connection pooling**: Reuse database connections
- **Batch operations**: Use `createMany` for bulk inserts

### 3. Schema Optimization

```prisma
// Add indexes for frequently queried fields
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  createdAt    DateTime @default(now())
  
  @@index([email])
  @@index([createdAt])
}

// Composite indexes for complex queries
model LabMarker {
  id           String   @id @default(cuid())
  userId       String
  name         String
  recordedAt   DateTime @default(now())
  
  @@index([userId, name])
  @@index([recordedAt])
}
```

### 4. Connection Leak Prevention

```typescript
// Always close connections properly
try {
  const result = await prisma.user.findMany();
  return result;
} finally {
  // Connection automatically returned to pool
}
```

## HIPAA Compliance Considerations

### Performance and Availability

1. **System Availability**: Ensure 99.9% uptime for patient care access
2. **Response Time**: Maintain <200ms response for critical patient data
3. **Data Integrity**: Prevent data loss during high-load scenarios
4. **Audit Logging**: Log all database access for compliance

### Security Considerations

1. **Connection Encryption**: Use SSL/TLS for all database connections
2. **Access Control**: Implement role-based access to database
3. **Audit Trail**: Log all database queries and connection events
4. **Data Masking**: Sanitize logs to prevent PHI exposure

## Troubleshooting Guide

### High Connection Pool Utilization

**Symptoms**: Pool utilization >90%, slow response times
**Causes**: Connection leaks, insufficient pool size, long-running queries
**Solutions**:
1. Check for unclosed connections
2. Increase pool size if needed
3. Optimize slow queries
4. Implement connection timeout

### Slow Query Performance

**Symptoms**: Queries taking >500ms, high CPU usage
**Causes**: Missing indexes, large result sets, complex joins
**Solutions**:
1. Add appropriate indexes
2. Optimize query structure
3. Implement pagination
4. Use query result caching

### Connection Pool Exhaustion

**Symptoms**: Database errors, connection timeouts
**Causes**: Pool size too small, connection leaks, database overload
**Solutions**:
1. Increase pool size
2. Check for connection leaks
3. Implement circuit breaker pattern
4. Scale database resources

### Database Connection Errors

**Symptoms**: Connection refused, timeout errors
**Causes**: Network issues, database overload, authentication problems
**Solutions**:
1. Check network connectivity
2. Verify database credentials
3. Monitor database load
4. Implement retry logic

## Performance Monitoring Dashboard

### Key Metrics to Monitor

1. **Connection Metrics**
   - Pool utilization percentage
   - Active vs idle connections
   - Connection wait time
   - Connection errors

2. **Query Metrics**
   - Query execution time
   - Slow query count
   - Query throughput
   - Error rates

3. **System Metrics**
   - Database CPU usage
   - Memory utilization
   - Disk I/O
   - Network latency

### Monitoring Tools

- **Health Check Endpoints**: `/health` and `/health/db`
- **Performance Monitoring**: Built-in monitoring service
- **Database Logs**: PostgreSQL query logs
- **Application Logs**: Structured logging with performance metrics

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Daily**: Monitor connection pool utilization
2. **Weekly**: Review slow query logs
3. **Monthly**: Analyze index usage and optimize
4. **Quarterly**: Review connection pool sizing

### Performance Tuning

1. **Connection Pool Tuning**: Adjust pool size based on usage patterns
2. **Query Optimization**: Review and optimize slow queries
3. **Index Optimization**: Add/remove indexes based on usage
4. **Database Maintenance**: Regular VACUUM and ANALYZE operations

## Emergency Procedures

### Pool Exhaustion Response

1. **Immediate**: Restart application to reset connections
2. **Short-term**: Increase pool size temporarily
3. **Long-term**: Optimize queries and connection usage

### Database Overload Response

1. **Immediate**: Implement circuit breaker pattern
2. **Short-term**: Scale database resources
3. **Long-term**: Optimize database schema and queries

## Support and Escalation

### Performance Issues

1. **Level 1**: Check health endpoints and logs
2. **Level 2**: Run optimization script
3. **Level 3**: Review database performance metrics
4. **Level 4**: Escalate to database administrator

### Contact Information

- **Development Team**: dev@biopoint.com
- **Database Team**: dba@biopoint.com
- **DevOps Team**: devops@biopoint.com
- **Emergency**: +1-XXX-XXX-XXXX

## References

- [Prisma Connection Pooling](https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [Database Performance Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)