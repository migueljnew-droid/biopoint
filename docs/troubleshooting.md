# BioPoint Troubleshooting Guide

## Quick Diagnostics

### System Status Check
```bash
# Run comprehensive health check
npm run health:full

# Check individual components
npm run health:api        # API health
npm run health:database   # Database connectivity
npm run health:s3         # S3 connectivity
npm run health:cache      # Cache status
```

### Log Analysis
```bash
# View recent API logs
pm2 logs biopoint-api --lines 100

# View database logs
heroku logs --tail --app biopoint-api | grep DATABASE

# View error logs
tail -f logs/error.log
```

## Authentication Issues

### Login Failures

#### Symptom: "Invalid email or password" error
**Diagnosis Steps:**
1. Check if user exists in database
2. Verify password hash algorithm
3. Check account lockout status
4. Review recent failed attempts

**Solution:**
```sql
-- Check user status
SELECT email, role, created_at 
FROM users 
WHERE email = 'user@example.com';

-- Check account lockout
SELECT * FROM account_lockout 
WHERE identifier = 'user@example.com' 
  AND locked_until > NOW();

-- Reset failed attempts
DELETE FROM account_lockout 
WHERE identifier = 'user@example.com';
```

#### Symptom: Account locked after multiple attempts
**Diagnosis Steps:**
1. Check lockout duration
2. Review failed attempt pattern
3. Verify IP address legitimacy

**Solution:**
```sql
-- Check lockout details
SELECT identifier, failed_attempts, locked_until, last_attempt_at
FROM account_lockout 
WHERE identifier = 'user@example.com';

-- Manual unlock (if verified legitimate user)
UPDATE account_lockout 
SET locked_until = NULL, failed_attempts = '[]'::json
WHERE identifier = 'user@example.com';
```

### JWT Token Issues

#### Symptom: "Invalid or expired token" error
**Diagnosis Steps:**
1. Check token expiration time
2. Verify JWT secret configuration
3. Check refresh token validity

**Solution:**
```typescript
// Debug JWT verification
const decoded = jwt.decode(token);
console.log('Token expiration:', new Date(decoded.exp * 1000));
console.log('Current time:', new Date());

// Check refresh token
const refreshToken = await prisma.refreshToken.findUnique({
  where: { tokenHash: hashToken(refreshToken) }
});
```

#### Symptom: Refresh token not working
**Diagnosis Steps:**
1. Check if refresh token exists in database
2. Verify refresh token expiration
3. Check if token has been revoked

**Solution:**
```sql
-- Check refresh token status
SELECT id, expires_at, revoked_at, created_at
FROM refresh_token 
WHERE token_hash = 'hashed_token_value';

-- Check for revoked tokens
SELECT COUNT(*) as revoked_count
FROM refresh_token 
WHERE user_id = 'user_id' 
  AND revoked_at IS NOT NULL 
  AND created_at > NOW() - INTERVAL '7 days';
```

## Database Connectivity Issues

### Connection Pool Exhaustion

#### Symptom: "Too many connections" error
**Diagnosis Steps:**
1. Check current connection count
2. Review connection pool configuration
3. Identify connection leaks

**Solution:**
```sql
-- Check active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE datname = 'biopoint';

-- Check connection limits
SHOW max_connections;
SHOW shared_buffers;

-- View connection details
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE datname = 'biopoint'
ORDER BY query_start;
```

#### Symptom: Database queries timing out
**Diagnosis Steps:**
1. Check for long-running queries
2. Review query execution plans
3. Check for table locks

**Solution:**
```sql
-- Kill long-running queries (use with caution)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_stat_activity%';
```

### Database Performance Issues

#### Symptom: Slow query performance
**Diagnosis Steps:**
1. Analyze query execution plans
2. Check for missing indexes
3. Review table statistics

**Solution:**
```sql
-- Analyze query execution plan
EXPLAIN ANALYZE 
SELECT * FROM daily_log 
WHERE user_id = 'user_id' AND date > '2024-01-01';

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables;

-- Update statistics
ANALYZE daily_log;
```

#### Symptom: High CPU usage on database
**Diagnosis Steps:**
1. Identify resource-intensive queries
2. Check for missing indexes
3. Review connection patterns

**Solution:**
```sql
-- Find CPU-intensive queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_daily_log_user_date 
ON daily_log(user_id, date);
```

## API Performance Issues

### High Response Times

#### Symptom: API endpoints responding slowly
**Diagnosis Steps:**
1. Check endpoint-specific performance
2. Review database query performance
3. Check for external service delays

**Solution:**
```typescript
// Add performance logging
app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  if (duration > 1000) { // Log slow requests
    console.log(`Slow request: ${request.url} took ${duration}ms`);
  }
});
```

#### Symptom: API returning 502/503 errors
**Diagnosis Steps:**
1. Check server resource utilization
2. Review load balancer configuration
3. Check for upstream service failures

**Solution:**
```bash
# Check server resources
htop
df -h
free -m

# Check service status
pm2 status
systemctl status biopoint-api

# Review logs
pm2 logs biopoint-api --lines 200
tail -f /var/log/nginx/error.log
```

### Rate Limiting Issues

#### Symptom: Users getting rate limited incorrectly
**Diagnosis Steps:**
1. Check rate limiting configuration
2. Review rate limit keys
3. Check for IP address spoofing

**Solution:**
```typescript
// Debug rate limiting
const rateLimitDebug = {
  key: request.ip,
  current: currentCount,
  limit: limit,
  window: windowMs,
  remaining: limit - currentCount
};
console.log('Rate limit debug:', rateLimitDebug);
```

## Mobile App Crashes

### iOS App Crashes

#### Symptom: App crashes on startup
**Diagnosis Steps:**
1. Check crash logs in Xcode
2. Review device console logs
3. Check for memory issues

**Solution:**
```bash
# View device logs
xcrun simctl spawn booted log show --predicate 'process == "BioPoint"'

# Check for memory warnings
grep -i "memory" /path/to/crash.log
```

#### Symptom: App crashes during specific operations
**Diagnosis Steps:**
1. Reproduce crash in development
2. Check for unhandled promises
3. Review native module usage

**Solution:**
```typescript
// Add error boundaries
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.log('Error caught:', error, errorInfo);
    // Send to crash reporting service
  }
}

// Handle unhandled promise rejections
useEffect(() => {
  const handler = (event) => {
    console.log('Unhandled promise rejection:', event);
  };
  
  if (Platform.OS === 'ios') {
    // iOS-specific error handling
  }
  
  return () => {
    // Cleanup
  };
}, []);
```

### Android App Crashes

#### Symptom: App crashes with native errors
**Diagnosis Steps:**
1. Check Android Studio logs
2. Review device logcat
3. Check for native library issues

**Solution:**
```bash
# View logcat logs
adb logcat | grep -i "biopoint"

# Check for specific crash
adb logcat --pid=$(adb shell pidof com.biopoint.app)
```

#### Symptom: App crashes on specific devices
**Diagnosis Steps:**
1. Check device-specific issues
2. Review device capabilities
3. Check for permission issues

**Solution:**
```typescript
// Add device capability checks
const checkDeviceCapabilities = async () => {
  const deviceInfo = await Device.getDeviceInfo();
  const isSupported = deviceInfo.supportedAbis.includes('arm64-v8a');
  
  if (!isSupported) {
    Alert.alert('Unsupported Device', 'This app requires a 64-bit device');
  }
};
```

## File Upload Issues

### S3 Upload Failures

#### Symptom: File uploads failing with 403 errors
**Diagnosis Steps:**
1. Check S3 bucket permissions
2. Verify presigned URL validity
3. Check file size limits

**Solution:**
```bash
# Check S3 bucket policy
aws s3api get-bucket-policy --bucket biopoint-uploads

# Check bucket CORS configuration
aws s3api get-bucket-cors --bucket biopoint-uploads

# Test upload with AWS CLI
aws s3 cp test-file.jpg s3://biopoint-uploads/test/
```

#### Symptom: Large file uploads timing out
**Diagnosis Steps:**
1. Check upload timeout configuration
2. Review network conditions
3. Check for proxy issues

**Solution:**
```typescript
// Implement chunked upload
const uploadLargeFile = async (file: File) => {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    await uploadChunk(chunk, i, chunks);
  }
};
```

### File Download Issues

#### Symptom: Downloaded files are corrupted
**Diagnosis Steps:**
1. Check file integrity on S3
2. Verify download process
3. Check for encoding issues

**Solution:**
```bash
# Check file integrity
aws s3api head-object --bucket biopoint-uploads --key path/to/file.jpg

# Compare checksums
aws s3api get-object-attributes --bucket biopoint-uploads --key path/to/file.jpg --object-attributes "Checksum"
```

## Step-by-Step Debugging Procedures

### 1. Initial Problem Assessment

#### Gather Basic Information
```bash
# Check system status
npm run health:full

# Check recent deployments
git log --oneline -10

# Check recent changes
git diff HEAD~5..HEAD
```

#### Identify Affected Components
- Determine which services are affected
- Check if issue is user-specific
- Identify error patterns
- Check monitoring dashboards

### 2. Log Analysis Procedure

#### Systematic Log Review
```bash
# Search for error patterns
grep -i "error\|exception\|failed" logs/app.log | tail -50

# Check for specific error codes
grep -i "500\|502\|503\|504" logs/app.log | tail -20

# Review database errors
grep -i "database\|connection\|timeout" logs/app.log | tail -20
```

#### Timeline Analysis
```bash
# Find when issue started
grep -i "error" logs/app.log | head -10
grep -i "error" logs/app.log | tail -10

# Check around specific time
grep "2024-01-15 14:30" logs/app.log | grep -i "error"
```

### 3. Database Debugging

#### Query Performance Analysis
```sql
-- Enable query logging temporarily
SET log_min_duration_statement = 1000; -- Log queries > 1 second

-- Check current activity
SELECT * FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY query_start;

-- Check for locks
SELECT * FROM pg_locks 
WHERE NOT granted;
```

#### Data Integrity Checks
```sql
-- Check for orphaned records
SELECT * FROM stack_item si
LEFT JOIN stack s ON si.stack_id = s.id
WHERE s.id IS NULL;

-- Check for data inconsistencies
SELECT user_id, COUNT(*) as duplicate_count
FROM bio_point_score 
WHERE date = CURRENT_DATE
GROUP BY user_id
HAVING COUNT(*) > 1;
```

### 4. API Debugging

#### Request/Response Analysis
```typescript
// Add detailed request logging
app.addHook('onRequest', async (request, reply) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  console.log('Headers:', request.headers);
  console.log('Body:', request.body);
});

// Add response logging
app.addHook('onResponse', async (request, reply) => {
  console.log(`[${new Date().toISOString()}] Response: ${reply.statusCode}`);
  console.log('Response headers:', reply.getHeaders());
});
```

#### Memory Leak Detection
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep node'

# Check for memory leaks
grep -i "memory\|leak\|heap" logs/app.log
```

### 5. Mobile App Debugging

#### Development Debugging
```bash
# Start React Native debugger
npm run debug

# Check Metro bundler logs
npm start -- --reset-cache

# View device logs
# iOS
xcrun simctl spawn booted log show --predicate 'process == "BioPoint"'

# Android
adb logcat | grep -i "biopoint"
```

#### Production Debugging
```typescript
// Add crash reporting
import crashlytics from '@react-native-firebase/crashlytics';

const logError = (error: Error, context?: string) => {
  crashlytics().recordError(error, context);
  console.error(`Error: ${context}`, error);
};

// Add user context
const setUserContext = (userId: string) => {
  crashlytics().setUserId(userId);
};
```

## Common Error Messages and Solutions

### Database Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Connection terminated unexpectedly" | Database connection lost | Check network connectivity, restart connection pool |
| " deadlock detected" | Concurrent transactions | Retry transaction with exponential backoff |
| "Out of memory" | Insufficient memory | Increase database memory, optimize queries |
| "Permission denied" | Insufficient privileges | Grant appropriate database permissions |

### API Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "ECONNREFUSED" | Service not running | Start the API service, check port configuration |
| "ENOTFOUND" | DNS resolution failure | Check DNS settings, verify hostname |
| "ETIMEDOUT" | Request timeout | Increase timeout, check network latency |
| "EPIPE" | Broken pipe | Handle connection errors gracefully |

### Mobile App Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Network request failed" | No internet connection | Check network settings, implement offline handling |
| "Unable to resolve module" | Missing dependency | Install missing packages, clear cache |
| "Application has not been registered" | App registration issue | Check AppRegistry, verify app name |
| "undefined is not an object" | JavaScript error | Add null checks, improve error handling |

## Performance Troubleshooting

### Slow Database Queries

#### Identify Slow Queries
```sql
-- Find top 10 slowest queries
SELECT 
    query,
    calls,
    total_time / 1000 as total_seconds,
    mean_time / 1000 as mean_seconds,
    stddev_time / 1000 as stddev_seconds
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### Optimize Queries
```sql
-- Add appropriate indexes
CREATE INDEX CONCURRENTLY idx_daily_log_user_date 
ON daily_log(user_id, date DESC);

-- Update table statistics
ANALYZE daily_log;

-- Vacuum and analyze
VACUUM ANALYZE daily_log;
```

### Memory Issues

#### Identify Memory Leaks
```bash
# Monitor Node.js memory usage
node --inspect app.js

# Check for memory leaks in logs
grep -i "memory\|heap\|leak" logs/app.log | tail -20

# Monitor system memory
free -m
vmstat 1 10
```

#### Resolve Memory Issues
```typescript
// Implement memory monitoring
const memwatch = require('@airbnb/node-memwatch');

memwatch.on('leak', (info) => {
  console.error('Memory leak detected:', info);
  // Take heap snapshot for analysis
  const hd = new memwatch.HeapDiff();
  // Send alert
});
```

## Support Escalation

### Level 1: Basic Troubleshooting
- Check system status
- Review logs
- Verify configuration
- Check recent changes

### Level 2: Advanced Diagnostics
- Database analysis
- Performance profiling
- Code debugging
- Infrastructure review

### Level 3: Expert Intervention
- Architecture review
- Security analysis
- Vendor support
- Emergency procedures

### Emergency Escalation
- Contact on-call engineer
- Notify management
- Engage vendor support
- Implement emergency procedures

## Documentation Updates

This troubleshooting guide should be updated:
- **Weekly**: Add new issues and solutions
- **Monthly**: Review and optimize procedures
- **Quarterly**: Major revision based on lessons learned

Last Updated: January 2024
Next Review: February 2024