# BioPoint Encryption at Rest Documentation

## Overview

BioPoint implements field-level encryption for Protected Health Information (PHI) to ensure HIPAA compliance. This document describes the encryption architecture, implementation details, and operational procedures.

## HIPAA Compliance

### Regulatory Requirements

- **HIPAA Security Rule §164.312(a)(2)(iv)**: Encryption at rest is an "addressable" requirement
- **NIST SP 800-111**: Guidelines for storage encryption
- **AES-256-GCM**: Industry-standard encryption algorithm

### Compliance Status

✅ **Implemented**: Field-level encryption for all PHI data  
✅ **HIPAA Compliant**: AES-256-GCM encryption with proper key management  
✅ **Audit Ready**: Comprehensive logging and audit trail  
✅ **Key Rotation**: Annual key rotation schedule implemented  

## Architecture

### Encryption Strategy

**Application-Level Encryption**: Data is encrypted before storage in the database
- **Advantages**: Portable across database systems, fine-grained control, transparent to applications
- **Algorithm**: AES-256-GCM with authenticated encryption
- **Key Management**: Doppler for secure key storage and rotation

### Encryption Scope

| Model | Fields Encrypted | PHI Classification |
|-------|------------------|-------------------|
| Profile | dateOfBirth | Direct PHI |
| LabMarker | value | Indirect PHI |
| LabReport | notes | Potential PHI |
| DailyLog | notes | Potential PHI |
| StackItem | notes | Potential PHI |
| ProgressPhoto | notes | Potential PHI |

### Data Flow

```
Application → Prisma Middleware → Encryption Layer → Database
     ↑                                              ↓
Decrypted Data ← Decryption Layer ← Encrypted Data
```

## Implementation Details

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Length**: 12 bytes (GCM recommended)
- **Tag Length**: 16 bytes (authentication tag)

### Encrypted Data Format

```json
{
  "encrypted": "base64_encoded_ciphertext",
  "iv": "base64_encoded_initialization_vector",
  "tag": "base64_encoded_authentication_tag",
  "version": "key_version_timestamp",
  "algorithm": "aes-256-gcm"
}
```

### Key Management

#### Key Storage
- **Primary**: Doppler secrets management
- **Backup**: Encrypted backup in secure storage
- **Access**: Restricted to authorized personnel only

#### Key Hierarchy
```
Master Key (Doppler) → Data Encryption Keys → Field-Level Encryption
```

#### Key Rotation
- **Frequency**: Annual rotation (HIPAA requirement)
- **Method**: Zero-downtime re-encryption
- **Validation**: Automated validation after rotation

## Setup and Configuration

### Prerequisites

1. **Doppler CLI** installed and configured
2. **Node.js** version 20 or higher
3. **PostgreSQL** database access
4. **Encryption key** generated and stored in Doppler

### Environment Variables

```bash
# Required for encryption
ENCRYPTION_KEY=base64_encoded_32_byte_key
ENCRYPTION_KEY_VERSION=key_version_timestamp

# Database connection
DATABASE_URL=postgresql://user:pass@host:port/database
```

### Initial Setup

1. **Generate Encryption Key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Store in Doppler**:
   ```bash
   doppler secrets set ENCRYPTION_KEY "your_generated_key" --config production
   doppler secrets set ENCRYPTION_KEY_VERSION "$(date +%Y%m%d%H%M%S)" --config production
   ```

3. **Run Database Migration**:
   ```bash
   npm run db:migrate
   ```

4. **Validate Encryption Setup**:
   ```bash
   npm run test:encryption
   ```

## Operational Procedures

### Key Rotation

#### Automated Rotation (Recommended)
```bash
# Annual rotation (run via cron or CI/CD)
./scripts/rotate-encryption-keys.sh production

# Dry run to test the process
./scripts/rotate-encryption-keys.sh production --dry-run
```

#### Manual Rotation
```bash
# Step 1: Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Step 2: Generate new key
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Step 3: Update Doppler secrets
doppler secrets set ENCRYPTION_KEY "$NEW_KEY" --config production

# Step 4: Re-encrypt data
node scripts/reencrypt-model.js Profile 1000 0.1 production
```

### Monitoring and Alerting

#### Key Metrics
- **Encryption/Decryption Success Rate**: >99.9%
- **Key Rotation Duration**: <30 minutes
- **Failed Operations**: <0.1%

#### Log Monitoring
```bash
# Monitor encryption operations
tail -f logs/encryption.log | grep -E "(ENCRYPT|DECRYPT|ERROR)"

# Monitor key rotation
tail -f logs/encryption-rotation.log
```

### Backup and Recovery

#### Database Backup
```bash
# Create encrypted backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Verify backup
gunzip -c backup_$(date +%Y%m%d).sql.gz | head -20
```

#### Key Backup
```bash
# Export keys from Doppler
doppler secrets get ENCRYPTION_KEY --plain > encryption_key_backup.txt
# Store securely and encrypt the backup file
```

#### Recovery Procedure
1. **Restore Database**: Use standard PostgreSQL restore procedures
2. **Restore Keys**: Import keys back to Doppler
3. **Validate**: Run encryption validation tests
4. **Verify**: Check data integrity and accessibility

## Security Considerations

### Access Control

#### Principle of Least Privilege
- **Database Users**: Read/write access to encrypted columns only
- **Application**: No direct access to encryption keys
- **Operations**: Key access restricted to authorized personnel

#### Audit Trail
- **Key Access**: All key access is logged
- **Data Access**: Database queries are audited
- **Rotation Events**: Key rotation events are recorded

### Data Protection

#### In Transit
- **TLS 1.3**: All data transmission encrypted
- **Certificate Pinning**: Prevent MITM attacks
- **Perfect Forward Secrecy**: Ephemeral key exchange

#### At Rest
- **Database**: Field-level encryption for PHI
- **Backups**: Encrypted backup storage
- **Logs**: Sensitive data redacted from logs

### Incident Response

#### Key Compromise
1. **Immediate**: Rotate compromised key
2. **Assessment**: Determine scope of exposure
3. **Notification**: Inform relevant stakeholders
4. **Documentation**: Record incident and response

#### Data Breach
1. **Containment**: Isolate affected systems
2. **Assessment**: Determine data accessed
3. **Notification**: HIPAA breach notification procedures
4. **Recovery**: Restore from secure backups

## Testing and Validation

### Unit Tests
```bash
# Run encryption tests
npm run test:encryption

# Run security tests
npm run test:security
```

### Integration Tests
```bash
# Test with real database
npm run test:integration:encryption

# Performance tests
npm run test:performance:encryption
```

### Validation Scripts
```bash
# Validate encryption setup
node -e "
  const { validateEncryptionSetup } = require('./apps/api/src/utils/encryption.js');
  validateEncryptionSetup().then(console.log);
"

# Check for unencrypted PHI
node scripts/check-unencrypted-phi.js
```

## Performance Considerations

### Encryption Overhead
- **CPU**: ~2-5% additional CPU usage
- **Memory**: ~1MB per 1000 encrypted records
- **Latency**: ~1-2ms per encryption/decryption operation

### Optimization Strategies
- **Batch Processing**: Process multiple records together
- **Caching**: Cache decrypted data in memory (carefully)
- **Indexing**: Index encrypted fields for queries
- **Connection Pooling**: Reuse database connections

### Capacity Planning
- **Database Size**: Encrypted data ~1.5x larger than plaintext
- **Backup Storage**: Include encryption overhead in capacity planning
- **Network Bandwidth**: Minimal impact due to field-level encryption

## Troubleshooting

### Common Issues

#### Encryption/Decryption Failures
```bash
# Check key validity
node -e "
  const { isValidEncryptionKey } = require('./apps/api/src/utils/encryption.js');
  console.log('Key valid:', isValidEncryptionKey(process.env.ENCRYPTION_KEY));
"

# Validate setup
npm run test:encryption
```

#### Key Rotation Issues
```bash
# Check rotation logs
tail -f logs/encryption-rotation.log

# Verify key versions
doppler secrets get ENCRYPTION_KEY_VERSION --plain
```

#### Database Connection Issues
```bash
# Test database connectivity
npm run db:status

# Check migration status
npm run db:migrate:status
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=encryption:* npm run dev

# Verbose rotation logging
./scripts/rotate-encryption-keys.sh development --verbose
```

## Compliance Documentation

### Audit Requirements
- **Annual Key Rotation**: Documented and automated
- **Access Logs**: Complete audit trail maintained
- **Incident Response**: Documented procedures
- **Risk Assessment**: Regular security assessments

### Certifications
- **HIPAA Compliance**: Self-assessment completed
- **Security Review**: Third-party penetration testing
- **Code Review**: Security-focused code review

### Documentation Maintenance
- **Version Control**: All documentation in Git
- **Review Schedule**: Quarterly documentation review
- **Change Management**: Document all encryption changes

## Support and Contacts

### Technical Support
- **Email**: security@biopoint.com
- **Slack**: #security-team
- **Emergency**: +1-XXX-XXX-XXXX

### Escalation Procedures
1. **Level 1**: Development team
2. **Level 2**: Security team
3. **Level 3**: CTO/CISO
4. **Level 4**: Executive team

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Next Review**: April 2026  
**Owner**: Security Team  
**Approved By**: CISO