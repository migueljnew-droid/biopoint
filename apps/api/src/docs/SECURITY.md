# BioPoint API Security Documentation

## Input Sanitization and Validation

### Overview

The BioPoint API implements comprehensive input sanitization to prevent various injection attacks and ensure data integrity in compliance with HIPAA requirements (§164.312(a)(1) Access controls, §164.312(c)(1) Integrity).

### Security Layers

1. **Prisma ORM Protection**: Primary defense against SQL injection through parameterized queries
2. **Input Sanitization Middleware**: Secondary layer for all incoming data
3. **Schema Validation**: Zod schemas for type and format validation
4. **Content-Type Validation**: Specific validation for file uploads
5. **Audit Logging**: Comprehensive logging of sanitization events

### Implemented Protections

#### 1. XSS (Cross-Site Scripting) Prevention

**Techniques Used:**
- HTML entity encoding for special characters
- Removal of `<script>` tags and their content
- Sanitization of `javascript:` URLs
- Removal of dangerous HTML attributes (onclick, onload, etc.)
- Markdown sanitization for embedded HTML

**Implementation:**
```typescript
// Utility functions
encodeHtmlEntities(str: string): string
stripDangerousHtml(input: string): string
sanitizeMarkdown(input: string): string
```

**Applied To:**
- All user-generated content (profile fields, notes, goals)
- Community posts and comments
- File metadata and descriptions

#### 2. SQL Injection Prevention

**Primary Protection:**
- Prisma ORM uses parameterized queries (already implemented)

**Additional Validation:**
- Pattern matching for SQL keywords and operators
- Blocking of SQL comment sequences (-- /* */)
- Detection of UNION-based attacks
- Prevention of stacked queries

**Implementation:**
```typescript
validateSQLInput(input: string): boolean
```

**Applied To:**
- All string inputs that could be used in database queries
- Search parameters and filters
- User input in authentication flows

#### 3. Command Injection Prevention

**Techniques Used:**
- Removal of backticks (`) for command substitution
- Blocking of $() command substitution patterns
- Removal of && and || logical operators
- Sanitization of ; command chaining
- Removal of > and < redirection operators

**Implementation:**
```typescript
sanitizeCommandInput(input: string): string
```

**Applied To:**
- All user input that might be processed by system commands
- File paths and names
- Configuration parameters

#### 4. Path Traversal Prevention

**Techniques Used:**
- Removal of `../` sequences
- Blocking of absolute paths (/etc/passwd)
- Sanitization of Windows paths (C:\\)
- Removal of UNC paths (\\\\server\\share)
- Normalization of path separators

**Implementation:**
```typescript
sanitizeFilePath(input: string): string
generateSafeS3Key(userId: string, folder: 'labs' | 'photos', filename: string): string
```

**Applied To:**
- File upload names and paths
- S3 key generation
- File system operations

#### 5. NoSQL Injection Prevention

**Note:** Not applicable as we use PostgreSQL with Prisma ORM

**Implemented For Completeness:**
- Detection of MongoDB operators ($eq, $ne, etc.)
- Prevention of prototype pollution
- Validation of object keys

**Implementation:**
```typescript
validateNoSQLInput(input: any): boolean
```

#### 6. LDAP Injection Prevention

**Note:** Not applicable as we don't use LDAP integration

**Implemented For Completeness:**
- Blocking of LDAP special characters (*, (, ), \\, /, \\x00)
- Validation of distinguished names

**Implementation:**
```typescript
validateLDAPInput(input: string): boolean
```

#### 7. XML External Entity (XXE) Prevention

**Note:** Not applicable as we don't parse XML

**Implemented For Completeness:**
- Detection of ENTITY declarations
- Blocking of SYSTEM and PUBLIC keywords
- Validation of CDATA sections

**Implementation:**
```typescript
validateXMLInput(input: string): boolean
```

### Middleware Implementation

#### General Sanitization Middleware

Applied to all routes that accept user input:

```typescript
// Applied to: auth, profile, community, and other user-facing routes
app.addHook('preHandler', sanitizationMiddleware);
```

**Features:**
- Sanitizes request body, parameters, query strings, and headers
- Logs sanitization events for security monitoring
- Configurable rejection on validation failure
- Recursive sanitization for nested objects

#### File Upload Sanitization Middleware

Specialized middleware for file-related endpoints:

```typescript
// Applied to: photo upload, lab results upload
app.addHook('preHandler', fileUploadSanitizationMiddleware);
```

**Features:**
- Content-type validation against allowed types
- Filename sanitization with path traversal protection
- Extension validation
- MIME type verification

#### S3 Key Validation Middleware

Specialized middleware for S3 operations:

```typescript
// Applied to: photo presign, file upload endpoints
app.addHook('preHandler', s3KeyValidationMiddleware);
```

**Features:**
- Path traversal detection in S3 keys
- Validation of S3 key format
- User ID validation
- Folder type validation

### Content Type Restrictions

#### Allowed Image Types (Progress Photos)
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/webp`
- `image/heic`

#### Allowed Document Types (Lab Results)
- `application/pdf`
- `text/csv`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Input Length Restrictions

- Maximum input length: 10,000 characters
- Maximum filename length: 255 characters
- Maximum field lengths defined in Zod schemas

### Error Handling

**Validation Failures:**
- Returns 400 Bad Request with descriptive error messages
- Logs sanitization events for security monitoring
- Does not expose internal system details

**Error Response Format:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Request validation failed",
  "details": "Specific validation error message"
}
```

### Audit Logging

All sanitization events are logged with:
- Action: 'SANITIZE'
- Entity Type: 'Request'
- Entity ID: 'input_sanitization'
- Metadata: Sanitized fields and request details

### Testing Coverage

Comprehensive test suite covers:
- XSS payload detection and sanitization
- SQL injection pattern recognition
- Command injection prevention
- Path traversal blocking
- NoSQL injection detection
- LDAP injection prevention
- XXE attack prevention
- Input length validation
- File upload sanitization
- Header sanitization
- Parameter sanitization
- Error handling scenarios

### Configuration

Sanitization middleware can be configured:

```typescript
updateSanitizationConfig({
  enabled: true,
  logSanitization: true,
  rejectOnValidationFailure: true,
  maxInputLength: 10000,
});
```

### Performance Considerations

- Sanitization is applied only to user-controlled input
- Efficient regex patterns for validation
- Minimal performance impact on legitimate requests
- Caching of validation patterns

### Compliance Notes

**HIPAA §164.312(a)(1) - Access Controls:**
- Input validation prevents unauthorized access attempts
- Sanitization ensures only legitimate data is processed
- Audit logging provides access attempt tracking

**HIPAA §164.312(c)(1) - Integrity:**
- Input sanitization prevents data corruption
- Validation ensures data consistency
- Audit trails maintain data integrity records

### Security Considerations

1. **Defense in Depth**: Multiple layers of protection
2. **Fail Secure**: Reject on validation failure by default
3. **Principle of Least Privilege**: Minimal necessary input acceptance
4. **Security by Design**: Built into the architecture, not bolted on
5. **Continuous Monitoring**: Audit logging for security events

### Future Enhancements

1. **Rate Limiting Integration**: Combine with existing rate limiting
2. **Machine Learning**: Advanced pattern detection
3. **Behavioral Analysis**: User input pattern analysis
4. **Real-time Threat Intelligence**: Integration with threat feeds
5. **Advanced Encoding Detection**: Multi-byte character validation

### Maintenance

Regular updates should include:
- New attack pattern detection
- Updated validation rules
- Performance optimization
- Security testing expansion
- Documentation updates