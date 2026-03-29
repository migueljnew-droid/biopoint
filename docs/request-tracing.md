# Request Tracing System

The BioPoint API includes a comprehensive request tracing system that enables distributed request tracking and debugging across the entire application stack.

## Overview

The request tracing system provides:

- **Unique Request IDs**: Every request gets a unique identifier
- **Distributed Tracing**: Request IDs propagate across service boundaries
- **Log Correlation**: All logs for a request are tagged with the same ID
- **Performance Monitoring**: Track request lifecycle and timing
- **Error Debugging**: Complete request context for error investigation
- **Audit Trail**: Request-scoped audit logging

## Architecture

### Request ID Generation

Request IDs are generated using UUID v4 and can be:
- Auto-generated for each incoming request
- Provided via `X-Request-ID` header (for distributed tracing)
- Used to correlate logs across multiple services

### Middleware Stack

1. **Request ID Middleware** (`requestId.ts`)
   - Generates or extracts request ID
   - Attaches to request object
   - Adds to response headers

2. **Logging Middleware** (`logger.ts`)
   - Creates request-bound logger
   - Logs request/response details
   - Includes timing information

3. **Prisma Middleware** (`prismaRequestId.ts`)
   - Attaches request context to database operations
   - Logs query timing and results
   - Provides database-level tracing

4. **Enhanced Existing Middleware**
   - **Auth Middleware**: Logs authentication events
   - **Audit Log Middleware**: Includes request ID in audit logs
   - **Error Handler**: Provides request context in error responses

## Usage

### Making Requests with Request IDs

Clients can provide their own request ID for distributed tracing:

```bash
curl -H "X-Request-ID: my-custom-request-id" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.biopoint.com/profile
```

The API will return the request ID in the response:

```http
HTTP/1.1 200 OK
X-Request-ID: my-custom-request-id
Content-Type: application/json

{
  "id": "user-123",
  "email": "user@example.com"
}
```

### Log Filtering

All logs include the `reqId` field for filtering:

```bash
# Filter logs by request ID
journalctl -u biopoint-api | grep "reqId=my-request-id"

# Using jq for JSON logs
cat app.log | jq 'select(.reqId == "my-request-id")'
```

### Request Tracing API

Administrators can retrieve complete request traces:

#### Get Request Trace
```http
GET /admin/request/:requestId/logs
Authorization: Bearer ADMIN_TOKEN
```

Response:
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-20T10:30:00.000Z"
  },
  "auditLogs": [
    {
      "id": "log-1",
      "userId": "user-123",
      "action": "READ",
      "entityType": "Profile",
      "entityId": "user-123",
      "timestamp": "2024-01-20T10:30:01.000Z",
      "ipAddress": "192.168.1.100"
    }
  ],
  "apiLogs": [],
  "databaseLogs": [],
  "totalLogs": 1
}
```

#### List Recent Requests
```http
GET /admin/requests?limit=50&userId=user-123&action=READ
Authorization: Bearer ADMIN_TOKEN
```

#### Get System Health
```http
GET /admin/health/detailed
Authorization: Bearer ADMIN_TOKEN
```

## Implementation Details

### Request ID Middleware

```typescript
export async function requestIdMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Generate or use existing request ID
    const requestId = request.headers['x-request-id'] as string || randomUUID();
    
    // Attach request ID to request object
    (request as any).id = requestId;
    
    // Add request ID to response headers
    reply.header('x-request-id', requestId);
    
    // Create child logger with request ID
    if (request.log) {
        (request as any).log = request.log.child({ reqId: requestId });
    }
}
```

### Logger Integration

```typescript
// Create request-bound logger
const logger = createRequestLogger(app.log, request);

// Log with automatic request ID inclusion
logger.info({ userId: 'user-123' }, 'User profile updated');

// Output: {"level":30,"time":1234567890,"reqId":"550e8400-e29b-41d4-a716-446655440000","userId":"user-123","msg":"User profile updated"}
```

### Database Query Logging

```typescript
// Prisma middleware automatically logs queries with request context
const user = await prisma.user.findUnique({
    where: { id: 'user-123' }
});

// Logged automatically:
// {"level":30,"time":1234567890,"reqId":"550e8400-e29b-41d4-a716-446655440000","db":{"operation":"findUnique","model":"User","duration":15,"status":"success"},"msg":"Database query completed"}
```

## Best Practices

### 1. Always Include Request IDs in Client Requests

For applications making multiple API calls, generate a request ID and include it in all requests:

```typescript
const requestId = uuidv4();

// Make multiple related requests with the same ID
const [profile, labs, markers] = await Promise.all([
    fetch('/api/profile', { headers: { 'X-Request-ID': requestId } }),
    fetch('/api/labs', { headers: { 'X-Request-ID': requestId } }),
    fetch('/api/markers', { headers: { 'X-Request-ID': requestId } })
]);
```

### 2. Log Structured Data

Use the provided logging utilities for consistent log formatting:

```typescript
import { logDatabaseQuery, logError, logAuditEvent } from '../utils/logger.js';

// Database query logging
logDatabaseQuery(logger, {
    model: 'User',
    operation: 'findUnique',
    duration: 25,
    args: { where: { id: 'user-123' } }
});

// Error logging
logError(logger, error, { userId: 'user-123', operation: 'profile_update' });

// Audit event logging
logAuditEvent(logger, {
    action: 'UPDATE',
    entityType: 'Profile',
    entityId: 'user-123',
    metadata: { fields: ['email', 'name'] }
});
```

### 3. Monitor Request Patterns

Use the admin endpoints to monitor request patterns:

```bash
# Get recent failed requests
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     "https://api.biopoint.com/admin/requests?action=FAILED&limit=10"

# Get requests by specific user
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     "https://api.biopoint.com/admin/requests?userId=user-123&limit=50"
```

### 4. Set Up Log Aggregation

Configure log aggregation to collect and analyze request traces:

```yaml
# Example: Fluentd configuration for request ID extraction
<source>
  @type tail
  path /var/log/biopoint-api.log
  pos_file /var/log/fluentd-biopoint-api.log.pos
  tag biopoint.api
  format json
</source>

<filter biopoint.api>
  @type record_transformer
  <record>
    request_id ${record["reqId"]}
    user_id ${record["userId"]}
  </record>
</filter>
```

### 5. Error Response Handling

Always include request IDs in error responses for debugging:

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Performance Considerations

### Log Level Configuration

Configure log levels based on environment:

```typescript
const envToLogger = {
    development: {
        level: 'debug', // Detailed logging for development
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
    production: {
        level: 'info', // Reduced logging for production
    },
    test: false,
};
```

### Sampling

For high-traffic applications, consider sampling:

```typescript
// Sample 10% of requests for detailed logging
const shouldLogDetailed = Math.random() < 0.1;

if (shouldLogDetailed) {
    logger.debug({ fullRequest: request.body }, 'Detailed request logging');
}
```

### Async Logging

Use async logging to avoid blocking request processing:

```typescript
const app = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                sync: false, // Async logging
            },
        },
    },
});
```

## Troubleshooting

### Missing Request IDs

If request IDs are missing from logs:

1. Check middleware registration order
2. Verify request ID middleware is registered first
3. Ensure logger child creation is working

### Performance Issues

If request tracing causes performance issues:

1. Reduce log verbosity in production
2. Implement sampling for high-traffic endpoints
3. Use async logging
4. Consider batching database audit logs

### Storage Considerations

For high-volume applications:

1. Implement log rotation
2. Use log aggregation services
3. Consider time-based data retention
4. Archive old request traces

## Security Considerations

### Sensitive Data

The audit log middleware automatically redacts sensitive fields:

```typescript
const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 's3Key'];
```

### Access Control

Admin endpoints require admin privileges:

```typescript
app.addHook('preHandler', adminMiddleware);
```

### IP Address Logging

Client IP addresses are logged for security analysis:

```typescript
function getClientIp(request: FastifyRequest): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim();
    }
    return request.ip;
}
```

## Integration Examples

### Frontend Integration

```typescript
// React hook for API requests with request tracing
import { v4 as uuidv4 } from 'uuid';

function useApiRequest() {
    const makeRequest = async (url: string, options: RequestInit = {}) => {
        const requestId = uuidv4();
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'X-Request-ID': requestId,
            },
        });
        
        // Store request ID for debugging
        if (!response.ok) {
            console.error(`Request failed: ${requestId}`, {
                url,
                status: response.status,
                requestId,
            });
        }
        
        return { response, requestId };
    };
    
    return { makeRequest };
}
```

### Mobile App Integration

```typescript
// React Native API client with request tracing
class BioPointApiClient {
    private async makeRequest(endpoint: string, options: RequestInit = {}) {
        const requestId = uuidv4();
        
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${this.authToken}`,
                    'X-Request-ID': requestId,
                },
            });
            
            if (!response.ok) {
                throw new ApiError(
                    `Request failed: ${response.status}`,
                    response.status,
                    requestId
                );
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error [${requestId}]:`, error);
            throw error;
        }
    }
}
```

### Load Balancer Configuration

```nginx
# Nginx configuration to preserve request IDs
upstream biopoint_api {
    server api1.biopoint.com:3000;
    server api2.biopoint.com:3000;
}

server {
    listen 80;
    server_name api.biopoint.com;
    
    location / {
        proxy_set_header X-Request-ID $request_id;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://biopoint_api;
    }
}
```

This comprehensive request tracing system provides complete visibility into API operations, enabling efficient debugging, performance monitoring, and security analysis across the entire BioPoint platform.