# BioPoint API Rate Limiting Implementation

## 🚀 Implementation Complete

This document provides a comprehensive overview of the rate limiting and account security implementation for BioPoint API, designed to meet HIPAA compliance requirements.

## 📋 Requirements Status

### ✅ Completed Requirements

1. **Route-specific Rate Limits**
   - [x] Auth endpoints (`/auth/*`): 5 requests per 15 minutes per IP
   - [x] PHI endpoints (`/labs/*`, `/photos/*`, `/profile/*`): 200 req/min per user
   - [x] Public endpoints (`/health`): 1000 req/hour per IP
   - [x] API presign endpoints (`/labs/presign`, `/photos/presign`): 50 req/hour per user

2. **Account Lockout Mechanism**
   - [x] After 5 failed login attempts: lock account for 15 minutes
   - [x] Store lockout in database (PostgreSQL)
   - [x] Return 429 with "Account temporarily locked" message
   - [x] Send notification email to user

3. **Progressive Delays**
   - [x] 1st failed attempt: no delay
   - [x] 2nd failed attempt: 1 second delay
   - [x] 3rd failed attempt: 2 seconds delay
   - [x] 4th failed attempt: 4 seconds delay
   - [x] 5th failed attempt: 8 seconds delay + lockout

4. **Test Suite**
   - [x] Test auth rate limits
   - [x] Test PHI endpoint limits
   - [x] Test account lockout
   - [x] Test progressive delays

5. **Documentation**
   - [x] Complete rate limiting documentation
   - [x] Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

## 📁 Files Modified/Created

### Core Implementation
- `apps/api/src/middleware/rateLimit.ts` - Main rate limiting middleware
- `apps/api/src/routes/auth.ts` - Updated auth routes with lockout integration
- `apps/api/src/index.ts` - Updated main server with rate limiting registration

### Database Schema
- `db/prisma/schema.prisma` - Added RateLimit and AccountLockout models
- `scripts/setup-rate-limiting.sql` - Database migration script

### Tests
- `apps/api/src/__tests__/security/rate-limiting-complete.test.ts` - Comprehensive test suite
- `apps/api/src/__tests__/middleware/rateLimit.test.ts` - Unit tests for middleware
- `apps/api/src/__tests__/integration/rate-limiting-integration.test.ts` - Integration tests

### Services
- `apps/api/src/services/notificationService.ts` - Account lockout notifications

### Documentation
- `docs/rate-limiting.md` - Complete rate limiting documentation

## 🔧 Configuration

### Environment Variables
```bash
# Global rate limiting fallback
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW="1 minute"

# Email notifications (optional)
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=security@biopoint.com

# Slack notifications (optional)
SLACK_NOTIFICATIONS_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#security-alerts
```

### Rate Limiting Configuration
```typescript
const rateLimitConfigs = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },      // 5 req/15min
  phi: { windowMs: 60 * 1000, max: 200 },          // 200 req/min
  public: { windowMs: 60 * 60 * 1000, max: 1000 }, // 1000 req/hour
  presign: { windowMs: 60 * 60 * 1000, max: 50 },  // 50 req/hour
};

const accountLockoutConfig = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  progressiveDelays: [0, 1, 2, 4, 8], // seconds
};
```

## 🏗️ Database Setup

### 1. Run Migration Script
```bash
# Connect to your PostgreSQL database and run:
psql -d your_database -f scripts/setup-rate-limiting.sql
```

### 2. Update Prisma Client
```bash
cd db
npx prisma generate
```

### 3. Verify Tables
The migration creates two new tables:
- `RateLimit` - Tracks request counts for rate limiting
- `AccountLockout` - Tracks failed login attempts and lockouts

## 🧪 Testing

### Run All Rate Limiting Tests
```bash
# Run comprehensive test suite
npm run test:security

# Run specific rate limiting tests
npm run test -- --testPathPattern=rate-limiting

# Run with coverage
npm run test:coverage -- --testPathPattern=rate-limiting
```

### Test Categories
1. **Authentication Rate Limiting** - Tests 5 req/15min limits
2. **PHI Endpoint Rate Limiting** - Tests 200 req/min per user
3. **Public Endpoint Rate Limiting** - Tests 1000 req/hour
4. **Account Lockout** - Tests 5-attempt lockout mechanism
5. **Progressive Delays** - Tests increasing delays
6. **HIPAA Compliance** - Validates security requirements

## 🔒 HIPAA Compliance

### §164.312(a)(2)(i) - Unique User Identification
- ✅ Rate limits applied per authenticated user
- ✅ User-specific tracking for PHI endpoints
- ✅ Individual accountability for API usage

### §164.308(a)(5)(ii)(D) - Password Management
- ✅ Account lockout after 5 failed attempts
- ✅ 15-minute lockout duration
- ✅ Progressive delays to prevent brute force
- ✅ Email notifications for lockouts

### Additional Security Measures
- ✅ IP-based rate limiting for anonymous endpoints
- ✅ Comprehensive audit logging
- ✅ Security event notifications
- ✅ Fail-open design for reliability

## 📊 Monitoring

### Key Metrics to Monitor
- Rate limit hit rate by endpoint category
- Account lockout frequency
- Failed login attempt patterns
- Response time impact from rate limiting

### Database Queries for Monitoring
```sql
-- Check current rate limit usage
SELECT "key", COUNT(*) as request_count, 
       MIN("timestamp") as window_start, MAX("timestamp") as window_end
FROM "RateLimit" 
WHERE "timestamp" > CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY "key"
ORDER BY request_count DESC;

-- Check current account lockouts
SELECT "identifier", "lockedUntil", "lastAttemptAt", 
       jsonb_array_length("failedAttempts") as attempt_count
FROM "AccountLockout" 
WHERE "lockedUntil" > CURRENT_TIMESTAMP
ORDER BY "lockedUntil" DESC;
```

## 🚨 Security Considerations

### Brute Force Protection
- Progressive delays make brute force attacks impractical
- Account lockout prevents sustained attack attempts
- IP-based limits catch attacks from single sources

### Distributed Attack Mitigation
- Per-user rate limits prevent distributed attacks on single accounts
- IP-based limits catch attacks from single sources
- Progressive delays apply regardless of IP changes

### Fail-Safe Design
- Rate limiting failures don't block legitimate requests (fail open)
- Database connection issues don't prevent authentication
- Graceful degradation under high load

## 🔧 Maintenance

### Regular Cleanup
The system includes cleanup functions for old data:
- Rate limit entries older than 2 hours
- Failed attempts older than 1 hour

### Performance Optimization
- Database indexes on key fields
- Efficient query patterns
- Minimal overhead on successful requests

## 🚀 Deployment Checklist

- [ ] Run database migration script
- [ ] Update Prisma client
- [ ] Configure environment variables
- [ ] Test rate limiting functionality
- [ ] Set up monitoring and alerts
- [ ] Configure email notifications (optional)
- [ ] Configure Slack notifications (optional)
- [ ] Update API documentation
- [ ] Train support team on lockout procedures

## 📞 Support

### Account Lockout Recovery
1. Users are automatically notified via email
2. Lockouts expire after 15 minutes
3. Support team can manually unlock accounts if needed
4. Users can reset passwords through normal flow

### Troubleshooting
- Check rate limit headers in responses
- Review application logs for rate limiting events
- Monitor database table growth
- Verify notification service configuration

## 🔮 Future Enhancements

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

---

## 📞 Contact

For questions or issues related to rate limiting:
1. Check this documentation and API docs
2. Review application logs for rate limiting events
3. Run the provided test suite
4. Contact the development team

**Security Issues**: Report security vulnerabilities immediately to the security team.

---

*This implementation provides enterprise-grade rate limiting and account security for BioPoint API, ensuring HIPAA compliance and protection against abuse and attacks.*