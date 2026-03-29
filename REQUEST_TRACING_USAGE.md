# Request Tracing Usage Guide

This guide demonstrates how to use the comprehensive request tracing system implemented for the BioPoint API.

## Quick Start

### 1. Basic Request with Auto-Generated Request ID

```bash
curl -X GET https://api.biopoint.com/health
```

Response:
```http
HTTP/1.1 200 OK
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600
}
```

### 2. Request with Custom Request ID

```bash
curl -X GET https://api.biopoint.com/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Request-ID: my-custom-trace-id"
```

Response:
```http
HTTP/1.1 200 OK
X-Request-ID: my-custom-trace-id
Content-Type: application/json

{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe"
}
```

### 3. Error Response with Request ID

```bash
curl -X GET https://api.biopoint.com/nonexistent \
  -H "X-Request-ID: error-trace-id"
```

Response:
```http
HTTP/1.1 404 Not Found
X-Request-ID: error-trace-id
Content-Type: application/json

{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Route GET:/nonexistent not found",
  "requestId": "error-trace-id"
}
```

## Frontend Integration Examples

### React/Next.js Integration

```typescript
// utils/apiClient.ts
import { v4 as uuidv4 } from 'uuid';

class BioPointApiClient {
    private baseUrl: string;
    private authToken: string | null = null;

    constructor(baseUrl: string = 'https://api.biopoint.com') {
        this.baseUrl = baseUrl;
    }

    setAuthToken(token: string) {
        this.authToken = token;
    }

    async request<T>(
        endpoint: string, 
        options: RequestInit = {},
        requestId?: string
    ): Promise<T> {
        const traceId = requestId || uuidv4();
        
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
                    'X-Request-ID': traceId,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new BioPointApiError(
                    error.message || `Request failed: ${response.status}`,
                    response.status,
                    traceId,
                    error.requestId
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof BioPointApiError) {
                throw error;
            }
            
            // Network or other errors
            throw new BioPointApiError(
                'Network error occurred',
                0,
                traceId
            );
        }
    }

    // Convenience methods
    async get<T>(endpoint: string, requestId?: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' }, requestId);
    }

    async post<T>(endpoint: string, data: any, requestId?: string): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        }, requestId);
    }

    async put<T>(endpoint: string, data: any, requestId?: string): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        }, requestId);
    }

    async delete<T>(endpoint: string, requestId?: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' }, requestId);
    }
}

class BioPointApiError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public clientRequestId: string,
        public serverRequestId?: string
    ) {
        super(message);
        this.name = 'BioPointApiError';
    }
}

// Usage example
export const apiClient = new BioPointApiClient();

// In your components
async function loadUserProfile() {
    const requestId = uuidv4();
    
    try {
        const profile = await apiClient.get('/profile', requestId);
        console.log('Profile loaded:', profile);
    } catch (error) {
        if (error instanceof BioPointApiError) {
            console.error('API Error:', {
                message: error.message,
                statusCode: error.statusCode,
                clientRequestId: error.clientRequestId,
                serverRequestId: error.serverRequestId,
            });
            
            // You can now use the request ID to trace the error
            // in the logs or admin interface
            alert(`Error loading profile. Request ID: ${error.clientRequestId}`);
        } else {
            console.error('Unexpected error:', error);
        }
    }
}
```

### React Hook for Request Tracing

```typescript
// hooks/useRequestTracing.ts
import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiClient, BioPointApiError } from '../utils/apiClient';

interface RequestState<T> {
    data: T | null;
    loading: boolean;
    error: BioPointApiError | null;
    requestId: string | null;
}

interface UseRequestTracingReturn<T> extends RequestState<T> {
    execute: (endpoint: string, options?: RequestInit) => Promise<T | null>;
    reset: () => void;
}

export function useRequestTracing<T = any>(): UseRequestTracingReturn<T> {
    const [state, setState] = useState<RequestState<T>>({
        data: null,
        loading: false,
        error: null,
        requestId: null,
    });

    const execute = useCallback(async (
        endpoint: string, 
        options: RequestInit = {}
    ): Promise<T | null> => {
        const requestId = uuidv4();
        
        setState(prev => ({
            ...prev,
            loading: true,
            error: null,
            requestId,
        }));

        try {
            const data = await apiClient.request<T>(endpoint, options, requestId);
            
            setState(prev => ({
                ...prev,
                data,
                loading: false,
            }));
            
            return data;
        } catch (error) {
            if (error instanceof BioPointApiError) {
                setState(prev => ({
                    ...prev,
                    error,
                    loading: false,
                }));
            } else {
                // Convert unexpected errors to BioPointApiError
                const unexpectedError = new BioPointApiError(
                    'An unexpected error occurred',
                    0,
                    requestId
                );
                
                setState(prev => ({
                    ...prev,
                    error: unexpectedError,
                    loading: false,
                }));
            }
            
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            data: null,
            loading: false,
            error: null,
            requestId: null,
        });
    }, []);

    return {
        ...state,
        execute,
        reset,
    };
}

// Usage example
function UserProfile() {
    const { data: profile, loading, error, requestId, execute } = useRequestTracing();

    useEffect(() => {
        execute('/profile');
    }, [execute]);

    if (loading) return <div>Loading...</div>;
    
    if (error) {
        return (
            <div className="error">
                <p>Error loading profile: {error.message}</p>
                <p>Request ID: {error.clientRequestId}</p>
                <button onClick={() => execute('/profile')}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1>User Profile</h1>
            {profile && (
                <div>
                    <p>Name: {profile.name}</p>
                    <p>Email: {profile.email}</p>
                </div>
            )}
        </div>
    );
}
```

## Mobile App Integration (React Native)

```typescript
// services/apiService.ts
import { v4 as uuidv4 } from 'uuid';

class BioPointMobileAPI {
    private baseURL: string;
    private authToken: string | null = null;

    constructor(baseURL: string = 'https://api.biopoint.com') {
        this.baseURL = baseURL;
    }

    setAuthToken(token: string) {
        this.authToken = token;
    }

    async makeRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any,
        requestId?: string
    ): Promise<T> {
        const traceId = requestId || uuidv4();
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
                    'X-Request-ID': traceId,
                },
                ...(body && { body: JSON.stringify(body) }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new MobileAPIError(
                    responseData.message || `Request failed: ${response.status}`,
                    response.status,
                    traceId,
                    responseData.requestId
                );
            }

            return responseData;
        } catch (error) {
            if (error instanceof MobileAPIError) {
                throw error;
            }
            
            // Network or parsing errors
            throw new MobileAPIError(
                'Network error occurred',
                0,
                traceId
            );
        }
    }

    // BioPoint-specific methods
    async getBioPointHistory(requestId?: string) {
        return this.makeRequest('/biopoint/history', 'GET', undefined, requestId);
    }

    async getLabMarkers(requestId?: string) {
        return this.makeRequest('/markers', 'GET', undefined, requestId);
    }

    async uploadLabReport(data: FormData, requestId?: string) {
        const traceId = requestId || uuidv4();
        
        return fetch(`${this.baseURL}/labs/upload`, {
            method: 'POST',
            headers: {
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
                'X-Request-ID': traceId,
            },
            body: data,
        });
    }
}

class MobileAPIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public clientRequestId: string,
        public serverRequestId?: string
    ) {
        super(message);
        this.name = 'MobileAPIError';
    }
}

// Usage with error handling
export const mobileAPI = new BioPointMobileAPI();

// React Native component example
function BioPointDashboard() {
    const [bioPointHistory, setBioPointHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requestId, setRequestId] = useState(null);

    const loadBioPointHistory = async () => {
        const traceId = uuidv4();
        setRequestId(traceId);
        setLoading(true);
        setError(null);

        try {
            const history = await mobileAPI.getBioPointHistory(traceId);
            setBioPointHistory(history);
        } catch (error) {
            setError(error);
            console.error('BioPoint history load failed:', {
                message: error.message,
                statusCode: error.statusCode,
                requestId: error.clientRequestId,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBioPointHistory();
    }, []);

    if (loading) return <ActivityIndicator size="large" />;
    
    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load data</Text>
                <Text style={styles.requestIdText}>Request ID: {error.clientRequestId}</Text>
                <Button title="Retry" onPress={loadBioPointHistory} />
                <Button 
                    title="Copy Request ID" 
                    onPress={() => Clipboard.setString(error.clientRequestId)} 
                />
            </View>
        );
    }

    return (
        <ScrollView>
            {bioPointHistory.map((item, index) => (
                <BioPointCard key={index} data={item} />
            ))}
        </ScrollView>
    );
}
```

## Admin and Debugging

### Using the Request Tracing API

#### Get Request Trace
```bash
# Get complete trace for a specific request
curl -X GET "https://api.biopoint.com/admin/request/550e8400-e29b-41d4-a716-446655440000/logs" \
  -H "Authorization: Bearer ADMIN_TOKEN"
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
```bash
# Get recent requests with filtering
curl -X GET "https://api.biopoint.com/admin/requests?limit=50&userId=user-123&action=READ" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Get System Health
```bash
# Get detailed system health and metrics
curl -X GET "https://api.biopoint.com/admin/health/detailed" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Log Filtering Examples

#### Using jq for JSON Log Filtering
```bash
# Filter logs by request ID
cat app.log | jq 'select(.reqId == "550e8400-e29b-41d4-a716-446655440000")'

# Filter by user ID
cat app.log | jq 'select(.userId == "user-123")'

# Filter by specific status code
cat app.log | jq 'select(.statusCode == 500)'

# Filter database queries for a request
cat app.log | jq 'select(.reqId == "550e8400-e29b-41d4-a716-446655440000" and .db)'

# Filter audit logs
cat app.log | jq 'select(.audit)'

# Get all errors for a specific time range
cat app.log | jq 'select(.time > 1705750800000 and .time < 1705754400000 and .level >= 40)'
```

#### Using grep for Simple Filtering
```bash
# Find all logs for a specific request
grep "reqId=550e8400-e29b-41d4-a716-446655440000" app.log

# Find all errors
grep -E '"level":(40|50|60)' app.log

# Find all database queries
grep '"db"' app.log

# Find all authentication attempts
grep '"Authentication attempt"' app.log
```

### Debugging Workflow

#### 1. User Reports an Issue
```
User: "I'm getting an error when trying to view my lab results"
Support: "Can you provide the Request ID from the error message?"
User: "Sure, it's: my-custom-request-id-123"
```

#### 2. Investigate Using Request Trace
```bash
# Get the complete request trace
curl -X GET "https://api.biopoint.com/admin/request/my-custom-request-id-123/logs" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### 3. Analyze Logs
```bash
# Filter application logs for this request
cat app.log | jq 'select(.reqId == "my-custom-request-id-123")'

# Check for database errors
cat app.log | jq 'select(.reqId == "my-custom-request-id-123" and .db and .db.status == "error")'

# Check for authentication issues
cat app.log | jq 'select(.reqId == "my-custom-request-id-123" and .msg | contains("Authentication"))'
```

#### 4. Check Audit Logs
```bash
# Get audit logs for the request
curl -X GET "https://api.biopoint.com/admin/request/my-custom-request-id-123/logs" \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq '.auditLogs'
```

### Performance Monitoring

#### Monitor Request Duration
```bash
# Find slow requests (response time > 1000ms)
cat app.log | jq 'select(.responseTime > 1000) | {reqId, url, responseTime, statusCode}'

# Find slow database queries
cat app.log | jq 'select(.db and .db.duration > 100) | {reqId, db, msg}'
```

#### Monitor Error Rates
```bash
# Count errors by status code
cat app.log | jq 'select(.statusCode >= 400) | .statusCode' | sort | uniq -c

# Find 5xx errors with request IDs
cat app.log | jq 'select(.statusCode >= 500) | {reqId, url, statusCode, msg}'
```

#### Monitor Authentication Failures
```bash
# Find authentication failures
cat app.log | jq 'select(.msg | contains("Authentication failed")) | {reqId, ip: .ip, msg}'
```

## Best Practices

### 1. Always Include Request IDs in Error Messages
```typescript
// Good
throw new Error(`Failed to load data. Request ID: ${requestId}`);

// Better
throw new BioPointApiError(
    'Failed to load user profile',
    500,
    requestId,
    'Please contact support with this Request ID'
);
```

### 2. Log Request IDs in Client Applications
```typescript
// Log to console for development
console.error('API Error:', {
    message: error.message,
    statusCode: error.statusCode,
    requestId: error.requestId,
    timestamp: new Date().toISOString()
});

// Send to error tracking service
Sentry.captureException(error, {
    tags: {
        requestId: error.requestId,
        endpoint: '/profile'
    }
});
```

### 3. Use Consistent Request IDs Across Related Operations
```typescript
// Generate one request ID for multiple related API calls
const requestId = uuidv4();

const [profile, labs, markers] = await Promise.all([
    apiClient.get('/profile', requestId),
    apiClient.get('/labs', requestId),
    apiClient.get('/markers', requestId)
]);
```

### 4. Implement Request ID Persistence
```typescript
// Store request ID in localStorage for debugging
const requestId = uuidv4();
localStorage.setItem('lastRequestId', requestId);

// Include in user feedback
try {
    await apiClient.post('/feedback', {
        message: userFeedback,
        requestId: localStorage.getItem('lastRequestId')
    });
} catch (error) {
    alert(`Error submitting feedback. Request ID: ${error.requestId}`);
}
```

### 5. Monitor Request Patterns
```typescript
// Implement request monitoring
class RequestMonitor {
    private requests: Map<string, RequestMetrics> = new Map();

    recordRequest(requestId: string, endpoint: string) {
        this.requests.set(requestId, {
            startTime: Date.now(),
            endpoint,
            status: 'pending'
        });
    }

    recordResponse(requestId: string, statusCode: number) {
        const metrics = this.requests.get(requestId);
        if (metrics) {
            metrics.duration = Date.now() - metrics.startTime;
            metrics.status = statusCode < 400 ? 'success' : 'error';
            metrics.statusCode = statusCode;
        }
    }

    getSlowRequests(threshold = 1000) {
        return Array.from(this.requests.values())
            .filter(m => m.duration > threshold)
            .sort((a, b) => b.duration - a.duration);
    }
}
```

This comprehensive usage guide provides everything needed to effectively use the request tracing system for debugging, monitoring, and maintaining the BioPoint API.