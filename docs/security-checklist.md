# Security Checklist

## Authentication

- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] JWT access tokens with short expiry (15 minutes)
- [x] Refresh tokens stored as SHA-256 hashes
- [x] Refresh token rotation on each use
- [x] Refresh token revocation on logout
- [x] Secure token storage (expo-secure-store)

## API Security

- [x] Helmet.js security headers
- [x] CORS configuration
- [x] Rate limiting (100 req/min default)
- [x] Zod validation on all inputs
- [x] Error messages don't leak internal details

## Data Protection

- [x] Audit logging for PHI-adjacent data (labs, photos)
- [x] Sensitive fields redacted in logs
- [x] No secrets in version control
- [x] Environment variables for configuration
- [x] Research aggregates require n>=50 cohort

## Authorization

- [x] JWT verification on protected routes
- [x] User can only access own data
- [x] Admin-only endpoints protected
- [x] RBAC with USER and ADMIN roles

## Compliance Considerations

### Privacy

- Consent checkboxes for data storage
- Research program is opt-in and revocable
- No raw data shared in research aggregates
- No identifiers in aggregated outputs

### Disclaimers

- "Not medical advice" acknowledgment required
- Informational purposes only messaging
- No product sales or affiliate links

## TODO for Production

- [ ] Implement HTTPS-only cookies for refresh tokens
- [ ] Add CSRF protection
- [ ] Configure Content-Security-Policy
- [ ] Set up log aggregation (not stdout)
- [ ] Implement account lockout after failed attempts
- [ ] Add email verification
- [ ] Add password reset flow
- [ ] Encrypt sensitive database fields
- [ ] Implement proper backup strategy
- [ ] Conduct security audit
