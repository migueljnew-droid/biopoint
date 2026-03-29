# BioPoint API Reference

## Overview

The BioPoint API is a RESTful API built with Fastify and TypeScript, providing secure access to health tracking data including biomarkers, supplement stacks, lab results, and progress photos.

## Base URL

```
Production: https://api.biopoint.com
Development: http://localhost:3000
```

## Authentication

BioPoint uses JWT-based authentication with access token rotation for enhanced security.

### Token Flow
```
1. Register/Login → Receive access_token + refresh_token
2. Include access_token in Authorization header: "Bearer {token}"
3. When access_token expires (15m), use refresh_token to get new tokens
4. Continue with new access_token
```

### Authentication Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **General endpoints**: 100 requests per minute per user
- **File upload endpoints**: 10 requests per minute per user

Rate limit headers are included in all responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Error Handling

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message"
}
```

### Common Error Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 400 | Bad Request | Invalid input data, missing required fields |
| 401 | Unauthorized | Invalid/expired token, missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist or user lacks access |
| 409 | Conflict | Resource already exists (duplicate email) |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "clh1234567890",
    "email": "user@example.com",
    "role": "USER",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- `409 Conflict`: User with this email already exists
- `400 Bad Request`: Invalid email or password format

#### POST /auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "clh1234567890",
    "email": "user@example.com",
    "role": "USER",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid email or password
- `429 Too Many Requests`: Too many failed login attempts

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token

#### POST /auth/logout
Logout user and revoke refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true
}
```

#### GET /auth/me
Get current user information.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "id": "clh1234567890",
  "email": "user@example.com",
  "role": "USER",
  "createdAt": "2024-01-15T10:30:00Z",
  "onboardingComplete": false
}
```

### Dashboard Endpoints

#### GET /dashboard
Get user's dashboard data including BioPoint score and recent logs.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "bioPointScore": {
    "score": 85,
    "breakdown": {
      "sleep": 18,
      "energy": 16,
      "focus": 17,
      "mood": 18,
      "compliance": 16
    },
    "date": "2024-01-15T00:00:00Z"
  },
  "todayLog": {
    "id": "clh1234567890",
    "date": "2024-01-15T00:00:00Z",
    "weightKg": 75.5,
    "sleepHours": 8.0,
    "sleepQuality": 9,
    "energyLevel": 8,
    "focusLevel": 8,
    "moodLevel": 9,
    "notes": "Great day overall!"
  },
  "recentLogs": [
    {
      "id": "clh1234567890",
      "date": "2024-01-15T00:00:00Z",
      "weightKg": 75.5,
      "sleepHours": 8.0,
      "sleepQuality": 9,
      "energyLevel": 8,
      "focusLevel": 8,
      "moodLevel": 9,
      "notes": "Great day overall!"
    }
  ],
  "weeklyTrend": 5,
  "scoreHistory": [
    {
      "date": "2024-01-14T00:00:00Z",
      "score": 80
    }
  ],
  "activeStacks": 2,
  "weeklyComplianceEvents": 14
}
```

#### POST /dashboard/calculate
Calculate and store BioPoint score for today.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "score": 85,
  "breakdown": {
    "sleep": 18,
    "energy": 16,
    "focus": 17,
    "mood": 18,
    "compliance": 16
  },
  "date": "2024-01-15T00:00:00Z"
}
```

### Stack Management Endpoints

#### GET /stacks
Get all user stacks with their items.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
[
  {
    "id": "clh1234567890",
    "userId": "clh1234567890",
    "name": "Morning Stack",
    "goal": "Energy and focus for morning workouts",
    "startDate": "2024-01-01T00:00:00Z",
    "isActive": true,
    "items": [
      {
        "id": "clh1234567890",
        "stackId": "clh1234567890",
        "name": "Caffeine",
        "dose": 200,
        "unit": "mg",
        "route": "Oral",
        "frequency": "Daily",
        "timing": "AM",
        "cycleJson": null,
        "notes": "Take with water",
        "isActive": true
      }
    ]
  }
]
```

#### POST /stacks
Create a new stack.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "name": "Morning Stack",
  "goal": "Energy and focus for morning workouts",
  "startDate": "2024-01-01T00:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "clh1234567890",
  "userId": "clh1234567890",
  "name": "Morning Stack",
  "goal": "Energy and focus for morning workouts",
  "startDate": "2024-01-01T00:00:00Z",
  "isActive": true,
  "items": []
}
```

#### GET /stacks/:id
Get a specific stack by ID.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "id": "clh1234567890",
  "userId": "clh1234567890",
  "name": "Morning Stack",
  "goal": "Energy and focus for morning workouts",
  "startDate": "2024-01-01T00:00:00Z",
  "isActive": true,
  "items": [
    {
      "id": "clh1234567890",
      "stackId": "clh1234567890",
      "name": "Caffeine",
      "dose": 200,
      "unit": "mg",
      "route": "Oral",
      "frequency": "Daily",
      "timing": "AM",
      "cycleJson": null,
      "notes": "Take with water",
      "isActive": true
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Stack not found

#### PUT /stacks/:id
Update a stack.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "name": "Updated Morning Stack",
  "goal": "Energy and focus for morning workouts",
  "isActive": true
}
```

**Response (200):**
```json
{
  "id": "clh1234567890",
  "userId": "clh1234567890",
  "name": "Updated Morning Stack",
  "goal": "Energy and focus for morning workouts",
  "startDate": "2024-01-01T00:00:00Z",
  "isActive": true,
  "items": []
}
```

#### DELETE /stacks/:id
Delete a stack.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true
}
```

### Stack Item Management

#### POST /stacks/:id/items
Add an item to a stack.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "name": "Caffeine",
  "dose": 200,
  "unit": "mg",
  "route": "Oral",
  "frequency": "Daily",
  "timing": "AM",
  "cycleJson": {
    "daysOn": 5,
    "daysOff": 2
  },
  "notes": "Take with water",
  "isActive": true
}
```

**Response (201):**
```json
{
  "id": "clh1234567890",
  "stackId": "clh1234567890",
  "name": "Caffeine",
  "dose": 200,
  "unit": "mg",
  "route": "Oral",
  "frequency": "Daily",
  "timing": "AM",
  "cycleJson": {
    "daysOn": 5,
    "daysOff": 2
  },
  "notes": "Take with water",
  "isActive": true
}
```

#### PUT /stacks/:id/items/:itemId
Update a stack item.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "dose": 250,
  "notes": "Take with water on empty stomach"
}
```

**Response (200):**
```json
{
  "id": "clh1234567890",
  "stackId": "clh1234567890",
  "name": "Caffeine",
  "dose": 250,
  "unit": "mg",
  "route": "Oral",
  "frequency": "Daily",
  "timing": "AM",
  "cycleJson": {
    "daysOn": 5,
    "daysOff": 2
  },
  "notes": "Take with water on empty stomach",
  "isActive": true
}
```

#### DELETE /stacks/:id/items/:itemId
Delete a stack item.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true
}
```

### Compliance Tracking

#### POST /stacks/compliance
Log a compliance event (taking a supplement).

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "stackItemId": "clh1234567890",
  "takenAt": "2024-01-15T08:00:00Z",
  "notes": "Took with breakfast"
}
```

**Response (201):**
```json
{
  "id": "clh1234567890",
  "stackItemId": "clh1234567890",
  "stackItemName": "Caffeine",
  "takenAt": "2024-01-15T08:00:00Z",
  "notes": "Took with breakfast"
}
```

#### GET /stacks/compliance
Get compliance history.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 7)

**Response (200):**
```json
[
  {
    "id": "clh1234567890",
    "stackItemId": "clh1234567890",
    "stackItemName": "Caffeine",
    "takenAt": "2024-01-15T08:00:00Z",
    "notes": "Took with breakfast"
  }
]
```

### Reminder Management

#### GET /stacks/items/:itemId/reminders
Get reminders for a stack item.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
[
  {
    "id": "clh1234567890",
    "userId": "clh1234567890",
    "stackItemId": "clh1234567890",
    "time": "08:00",
    "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
    "isActive": true
  }
]
```

#### POST /stacks/items/:itemId/reminders
Create a reminder for a stack item.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "time": "08:00",
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6]
}
```

**Response (201):**
```json
{
  "id": "clh1234567890",
  "userId": "clh1234567890",
  "stackItemId": "clh1234567890",
  "time": "08:00",
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
  "isActive": true
}
```

#### DELETE /stacks/items/:itemId/reminders/:id
Delete a reminder.

**Headers:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "success": true
}
```

## Request/Response Examples

### Complete Authentication Flow

```bash
# 1. Register new user
curl -X POST https://api.biopoint.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securePassword123"
  }'

# 2. Login
curl -X POST https://api.biopoint.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securePassword123"
  }'

# 3. Use access token for authenticated request
curl -X GET https://api.biopoint.com/dashboard \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 4. Refresh token when expired
curl -X POST https://api.biopoint.com/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Stack Management Example

```bash
# Create a new stack
curl -X POST https://api.biopoint.com/stacks \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Energy Stack",
    "goal": "Improve morning energy and focus",
    "startDate": "2024-01-01T00:00:00Z"
  }'

# Add items to the stack
curl -X POST https://api.biopoint.com/stacks/clh1234567890/items \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Caffeine",
    "dose": 200,
    "unit": "mg",
    "frequency": "Daily",
    "timing": "AM"
  }'

# Log compliance
curl -X POST https://api.biopoint.com/stacks/compliance \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "stackItemId": "clh1234567890",
    "notes": "Took with breakfast"
  }'
```

## Webhooks (Future)

BioPoint supports webhooks for real-time notifications. Contact support to configure webhook endpoints.

### Available Events
- `user.created` - New user registration
- `stack.created` - New stack created
- `compliance.logged` - Compliance event logged
- `lab.uploaded` - Lab report uploaded

### Webhook Payload
```json
{
  "event": "compliance.logged",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "userId": "clh1234567890",
    "stackItemId": "clh1234567890",
    "takenAt": "2024-01-15T08:00:00Z"
  }
}
```

## SDKs and Libraries

### Official Libraries
- **JavaScript/TypeScript**: `@biopoint/api-client`
- **React Native**: Built-in API client in mobile app

### Community Libraries
- **Python**: `biopoint-python` (community maintained)
- **Swift**: `BioPointSDK` (community maintained)

## Support

For API support, please contact:
- Email: api-support@biopoint.com
- Documentation: https://docs.biopoint.com
- Status Page: https://status.biopoint.com

## Changelog

### v1.0.0 (Current)
- Initial API release
- Authentication system
- Stack management
- Compliance tracking
- Dashboard metrics

### Upcoming (v1.1.0)
- Lab report upload
- Progress photo management
- Community features
- Advanced analytics