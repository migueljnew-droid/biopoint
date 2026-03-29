# BioPoint API Rate Limiting & Account Security

## Overview

BioPoint API implements a comprehensive rate limiting and account security system designed to protect against abuse, brute force attacks, and ensure HIPAA compliance. The system provides multiple layers of protection including IP-based rate limiting, user-specific rate limiting, account lockout mechanisms, and progressive delays.

## HIPAA Compliance

This rate limiting implementation addresses specific HIPAA Security Rule requirements:

- **§164.312(a)(2)(i) - Unique User Identification**: Rate limits are applied per authenticated user, ensuring individual accountability
- **§164.308(a)(5)(ii)(D) - Password Management**: Account lockout mechanisms prevent brute force password attacks
- **§164.308(a)(5)(ii)(B) - Protection from Malicious Software**: Rate limiting prevents abuse that could lead to security vulnerabilities

## Rate Limiting Configuration

### Endpoint Categories

| Category | Endpoints | Limit | Time Window | Key Strategy |
|----------|-----------|--------|-------------|--------------|
| **Authentication** | `/auth/*` | 5 requests | 15 minutes | Per IP address |
| **PHI Data** | `/labs/*`, `/photos/*`, `/profile/*` | 200 requests | 1 minute | Per authenticated user |
| **Public** | `/health` | 1000 requests | 1 hour | Per IP address |
| **Presign URLs** | `/labs/presign`, `/photos/presign` | 50 requests | 1 hour | Per authenticated user |
| **Default** | All other endpoints | 100 requests | 1 minute | Per IP address |

### Rate Limit Headers

All API responses include comprehensive rate limiting headers:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 150
X-RateLimit-Reset: 2024-01-23T12:45:00.000Z
```

When rate limited, responses include additional headers:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 300
Content-Type: application/json

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 300
}
```

## Account Lockout Protection

### Failed Login Attempts

The system implements progressive account lockout with the following behavior:

| Attempt | Delay | Action |
|---------|--------|---------|
| 1st | 0 seconds | Normal response |
| 2nd | 1 second | 1-second delay applied |
| 3rd | 2 seconds | 2-second delay applied |
| 4th | 4 seconds | 4-second delay applied |
| 5th | 8 seconds | 8-second delay applied |
| 6th+ | N/A | Account locked for 15 minutes |

### Account Lockout Response

When an account is locked, the API returns:

```http
HTTP/1.1 429 Account Temporarily Locked
Retry-After: 900
Content-Type: application/json

{
  "error": "Account Temporarily Locked",
  "message": "Account temporarily locked due to multiple failed login attempts.",
  "retryAfter": 900,
  "lockedUntil": "2024-01-23T13:00:00.000Z"
}
```

### Lockout Reset

Account lockouts are automatically reset when:
- The 15-minute lockout period expires
- A successful login occurs (resets failed attempt counter)
- Manual intervention by an administrator

## Implementation Details

### Storage Backend

The rate limiting system uses PostgreSQL for storage with the following tables:

#### RateLimit Table
```sql
CREATE TABLE "RateLimit" (
    "id" TEXT PRIMARY KEY,
    "key" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX "RateLimit_key_timestamp_idx" ON "RateLimit"("key", "timestamp");
```

#### AccountLockout Table
```sql
CREATE TABLE "AccountLockout" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT UNIQUE NOT NULL,
    "failedAttempts" JSONB NOT NULL DEFAULT '[]',
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "AccountLockout_lockedUntil_idx" ON "AccountLockout"("lockedUntil");
```

### Rate Limiting Algorithm

1. **Request Identification**: Each request is identified by a unique key (IP address, user ID, or combination)
2. **Window Tracking**: Requests are tracked within sliding time windows
3. **Count Increment**: Each request increments the count for its key
4. **Limit Check**: The count is compared against the configured maximum
5. **Header Population**: Rate limit information is added to response headers
6. **Enforcement**: Requests exceeding limits are rejected with 429 status

### Account Lockout Algorithm

1. **Attempt Tracking**: Failed login attempts are recorded with timestamp and IP
2. **Progressive Delays**: Increasing delays are applied based on attempt count
3. **Lockout Enforcement**: After maximum attempts, account is locked for 15 minutes
4. **Automatic Reset**: Lockouts expire automatically after the time period
5. **Success Reset**: Successful login clears all failed attempts

## Security Features

### Brute Force Protection
- Progressive delays make brute force attacks impractical
- Account lockout prevents sustained attack attempts
- IP-based rate limiting blocks automated attack tools

### Distributed Attack Mitigation
- Per-user rate limits prevent distributed attacks on single accounts
- IP-based limits catch attacks from single sources
- Progressive delays apply regardless of IP changes

### Audit Trail
- All rate limiting events are logged with request context
- Failed login attempts are tracked with IP addresses
- Lockout events include timing and reason information

## Configuration

### Environment Variables

```bash
# Global rate limiting fallback
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW="1 minute"

# Specific rate limits (override defaults)
AUTH_RATE_LIMIT_MAX=5
AUTH_RATE_LIMIT_WINDOW="15 minutes"
PHI_RATE_LIMIT_MAX=200
PHI_RATE_LIMIT_WINDOW="1 minute"
PUBLIC_RATE_LIMIT_MAX=1000
PUBLIC_RATE_LIMIT_WINDOW="1 hour"
presign_RATE_LIMIT_MAX=50
PRESIGN_RATE_LIMIT_WINDOW="1 hour"
```

### Account Lockout Configuration

```typescript
const accountLockoutConfig = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  progressiveDelays: [0, 1, 2, 4, 8], // Seconds
};
```

## Monitoring and Alerting

### Metrics to Monitor
- Rate limit hit rate by endpoint category
- Account lockout frequency
- Failed login attempt patterns
- Response time impact from rate limiting

### Alert Conditions
- Sudden spike in account lockouts (potential attack)
- High rate limit hit rate (indicate client issues)
- Progressive delay activation patterns
- Lockout duration expiration failures

### Log Format
```json
{
  "level": "warn",
  "message": "Rate limit exceeded",
  "context": {
    "key": "auth:192.168.1.100",
    "limit": 5,
    "current": 6,
    "endpoint": "/auth/login",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

## Testing

### Unit Tests
- Rate limiting middleware functionality
- Account lockout logic
- Progressive delay calculations
- Header population accuracy

### Integration Tests
- End-to-end rate limiting scenarios
- Account lockout flow testing
- Concurrent request handling
- Recovery after time windows

### Security Tests
- Brute force attack simulation
- Distributed attack scenarios
- Header manipulation attempts
- Timing attack prevention

### HIPAA Compliance Tests
- User identification verification
- Password management compliance
- Audit trail completeness
- Lockout mechanism effectiveness

## Best Practices

### For API Consumers
1. **Implement Exponential Backoff**: When receiving 429 responses, wait before retrying
2. **Respect Retry-After Headers**: Use the provided retry timing
3. **Cache Authentication Tokens**: Minimize authentication requests
4. **Handle Account Lockouts**: Inform users and provide recovery options
5. **Monitor Rate Limit Headers**: Proactively manage request rates

### For Developers
1. **Test Rate Limits**: Include rate limiting in development testing
2. **Log Security Events**: Track rate limiting and lockout events
3. **Configure Appropriately**: Set limits based on legitimate usage patterns
4. **Monitor Performance**: Ensure rate limiting doesn't impact response times
5. **Document Clearly**: Provide clear guidance to API consumers

### For Operations
1. **Monitor Metrics**: Track rate limiting effectiveness
2. **Set Alerts**: Configure alerts for security events
3. **Review Logs**: Regularly review rate limiting logs
4. **Adjust Limits**: Modify limits based on usage patterns
5. **Test Recovery**: Verify lockout recovery mechanisms

## Troubleshooting

### Common Issues

**High Rate Limit Hit Rate**
- Check for client implementation issues
- Verify legitimate usage patterns
- Consider increasing limits if appropriate

**Account Lockout Spam**
- Implement CAPTCHA for repeated failures
- Consider IP-based blocking for abuse
- Review notification settings

**Performance Impact**
- Optimize database queries for rate limit checks
- Consider Redis for high-traffic scenarios
- Monitor database connection pool usage

### Debug Steps

1. **Check Headers**: Verify rate limit headers in responses
2. **Review Logs**: Examine rate limiting logs for patterns
3. **Test Endpoints**: Use provided test suite to verify functionality
4. **Monitor Database**: Check rate limit table growth and performance
5. **Verify Configuration**: Ensure environment variables are set correctly

## Future Enhancements

### Planned Improvements
- Redis backend for higher performance
- Machine learning for anomaly detection
- Geographic rate limiting
- Device fingerprinting
- Integration with SIEM systems

### Scalability Considerations
- Database partitioning for rate limit tables
- Distributed rate limiting across multiple servers
- CDN integration for edge rate limiting
- Microservices rate limiting coordination

## Compliance Certification

This rate limiting implementation has been designed to meet the following standards:

- ✅ HIPAA Security Rule Requirements
- ✅ OWASP API Security Guidelines
- ✅ NIST Cybersecurity Framework
- ✅ ISO 27001 Security Controls
- ✅ SOC 2 Type II Requirements

## Support

For questions or issues related to rate limiting:

1. **Check Documentation**: Review this guide and API documentation
2. **Review Logs**: Examine application logs for rate limiting events
3. **Run Tests**: Execute the provided test suite
4. **Contact Support**: Reach out to the development team

---

*This documentation is updated automatically with each release. For the latest version, check the `/docs` endpoint or visit the API documentation portal.*