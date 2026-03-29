# BioPoint Encryption Key Management Procedures

## Overview

This document outlines the procedures for managing encryption keys used to protect PHI data in BioPoint. These procedures ensure HIPAA compliance and maintain the security of encrypted data.

## Key Management Principles

### HIPAA Requirements
- **§164.312(a)(2)(iv)**: Encryption at rest implementation
- **Annual Key Rotation**: Required for compliance
- **Access Control**: Restricted key access
- **Audit Trail**: Complete key lifecycle logging

### Security Principles
- **Separation of Duties**: Key creation, usage, and destruction separated
- **Least Privilege**: Minimum access required
- **Defense in Depth**: Multiple security layers
- **Zero Trust**: No implicit trust in any component

## Key Hierarchy

```
Master Key (Doppler) → Data Encryption Keys → Field-Level Encryption
     ↑                        ↑                      ↑
Hardware Security Module   Application Layer    Database Storage
```

### Key Types

| Key Type | Purpose | Rotation Frequency | Storage |
|----------|---------|-------------------|---------|
| Master Key | Encrypt data encryption keys | Annual | HSM/Doppler |
| Data Encryption Key | Encrypt PHI data | Annual | Encrypted with Master Key |
| Session Key | Temporary encryption | Per-session | Memory only |

## Key Generation

### Requirements
- **Algorithm**: AES-256-GCM
- **Key Length**: 256 bits (32 bytes)
- **Randomness**: Cryptographically secure random number generator
- **Uniqueness**: Each key must be unique

### Generation Procedure

1. **Verify Environment**
   ```bash
   # Check system entropy
   cat /proc/sys/kernel/random/entropy_avail
   
   # Should be >1000 for secure key generation
   ```

2. **Generate Key**
   ```bash
   # Using Node.js crypto
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Verify key properties
   node -e "
     const key = require('crypto').randomBytes(32);
     console.log('Length:', key.length);
     console.log('Entropy:', key.toString('hex').match(/[0-9a-f]{2}/g).length);
   "
   ```

3. **Validate Key**
   ```bash
   # Test encryption/decryption
   node -e "
     const crypto = require('crypto');
     const key = crypto.randomBytes(32);
     const cipher = crypto.createCipher('aes-256-gcm', key);
     const encrypted = cipher.update('test', 'utf8', 'base64') + cipher.final('base64');
     console.log('Encryption successful:', encrypted.length > 0);
   "
   ```

## Key Storage

### Doppler Configuration

1. **Environment Setup**
   ```bash
   # Configure Doppler for production
   doppler setup --project biopoint --config production
   
   # Verify configuration
   doppler configs list
   ```

2. **Key Storage**
   ```bash
   # Store encryption key
   doppler secrets set ENCRYPTION_KEY "base64_encoded_key" --config production
   
   # Store key version
   doppler secrets set ENCRYPTION_KEY_VERSION "$(date +%Y%m%d%H%M%S)" --config production
   
   # Verify storage
   doppler secrets get ENCRYPTION_KEY --plain
   ```

3. **Access Control**
   ```bash
   # Set access controls
   doppler configs access production --restrict
   
   # Add authorized users
   doppler configs access add user@company.com --config production
   ```

### Backup Storage

1. **Encrypted Backup**
   ```bash
   # Create encrypted backup
   gpg --cipher-algo AES256 --compress-algo 2 \
       --symmetric --output encryption_key_backup.gpg \
       encryption_key.txt
   
   # Store in secure location
   aws s3 cp encryption_key_backup.gpg \
       s3://biopoint-secure-backups/keys/
   ```

2. **Verification**
   ```bash
   # Test backup decryption
   gpg --decrypt encryption_key_backup.gpg > restored_key.txt
   
   # Compare with original
   diff encryption_key.txt restored_key.txt
   ```

## Key Distribution

### Secure Distribution Process

1. **Generate Distribution Package**
   ```bash
   # Create secure package
   tar -czf key_package.tar.gz encryption_key.txt key_metadata.json
   
   # Encrypt package
   gpg --encrypt --recipient security@biopoint.com key_package.tar.gz
   ```

2. **Transfer Protocol**
   - Use secure file transfer (SFTP/HTTPS)
   - Verify recipient identity
   - Confirm receipt
   - Secure deletion of temporary files

3. **Installation**
   ```bash
   # Decrypt package
   gpg --decrypt key_package.tar.gz.gpg > key_package.tar.gz
   
   # Extract and install
   tar -xzf key_package.tar.gz
   doppler secrets set ENCRYPTION_KEY "$(cat encryption_key.txt)"
   ```

## Key Rotation

### Annual Rotation Schedule

| Month | Environment | Responsible Party |
|-------|-------------|-------------------|
| January | Development | DevOps Team |
| April | Staging | Security Team |
| July | Production | Security Team |
| October | DR Environment | Operations Team |

### Rotation Procedure

1. **Pre-Rotation Checklist**
   - [ ] Database backup completed
   - [ ] System health verified
   - [ ] Maintenance window scheduled
   - [ ] Rollback plan prepared

2. **Execute Rotation**
   ```bash
   # Run automated rotation script
   ./scripts/rotate-encryption-keys.sh production --force
   
   # Monitor progress
   tail -f logs/encryption-rotation.log
   ```

3. **Post-Rotation Validation**
   - [ ] Verify all data re-encrypted
   - [ ] Test application functionality
   - [ ] Confirm audit logs updated
   - [ ] Update documentation

### Emergency Rotation

**Trigger Conditions:**
- Key compromise suspected
- Security incident
- Personnel changes
- Compliance requirement

**Emergency Procedure:**
```bash
# Immediate key rotation
./scripts/rotate-encryption-keys.sh production --emergency

# Notify stakeholders
echo "Emergency key rotation completed" | \
    mail -s "BioPoint Security Alert" security@biopoint.com

# Document incident
echo "Emergency rotation: $(date)" >> logs/security-incidents.log
```

## Key Revocation

### Revocation Triggers
- Key compromise
- Personnel departure
- System decommission
- Security breach

### Revocation Procedure

1. **Immediate Actions**
   ```bash
   # Revoke access in Doppler
   doppler configs access revoke user@company.com --config production
   
   # Generate new key
   NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
   ```

2. **Data Re-encryption**
   ```bash
   # Re-encrypt all data with new key
   ./scripts/rotate-encryption-keys.sh production --force
   ```

3. **Verification**
   ```bash
   # Verify old key no longer works
   doppler secrets get ENCRYPTION_KEY_PREVIOUS --plain
   
   # Confirm all data accessible
   npm run test:encryption
   ```

## Key Recovery

### Disaster Recovery

1. **Key Loss Scenario**
   ```bash
   # Restore from backup
   aws s3 cp s3://biopoint-secure-backups/keys/encryption_key_backup.gpg .
   
   # Decrypt backup
   gpg --decrypt encryption_key_backup.gpg > restored_key.txt
   
   # Restore to Doppler
   doppler secrets set ENCRYPTION_KEY "$(cat restored_key.txt)"
   ```

2. **Database Recovery**
   ```bash
   # Restore database from backup
   pg_dump $DATABASE_URL > current_backup.sql
   psql $DATABASE_URL < backup_before_key_loss.sql
   
   # Verify data integrity
   npm run test:encryption
   ```

### Business Continuity

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 1 hour

**Recovery Steps:**
1. Assess damage and scope
2. Activate disaster recovery site
3. Restore keys from secure backup
4. Verify system functionality
5. Resume normal operations

## Monitoring and Alerting

### Key Metrics

| Metric | Threshold | Alert Level |
|--------|-----------|-------------|
| Failed Decryptions | >1% | Critical |
| Key Access Rate | >100/hour | Warning |
| Rotation Duration | >2 hours | Warning |
| Backup Age | >24 hours | Warning |

### Monitoring Setup

```bash
# Set up log monitoring
echo "Failed decryption" | grep -c /var/log/biopoint/encryption.log

# Configure alerts
cat > /etc/prometheus/rules/encryption.yml << EOF
groups:
  - name: encryption
    rules:
      - alert: HighDecryptionFailures
        expr: rate(encryption_failures[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of encryption failures"
EOF
```

### Audit Logging

```bash
# Enable detailed logging
echo "ENCRYPTION_LOG_LEVEL=debug" >> .env

# Centralize logs
aws logs create-log-group --log-group-name biopoint-encryption
```

## Compliance and Documentation

### Audit Trail Requirements

**Required Documentation:**
- Key generation logs
- Distribution records
- Rotation history
- Access logs
- Incident reports

**Retention Period:** 7 years (HIPAA requirement)

### Compliance Checklist

**Quarterly Review:**
- [ ] Key inventory verified
- [ ] Access controls reviewed
- [ ] Rotation schedule confirmed
- [ ] Backup procedures tested
- [ ] Documentation updated

**Annual Audit:**
- [ ] Third-party security assessment
- [ ] Penetration testing
- [ ] Compliance certification
- [ ] Policy review and update

### Documentation Standards

**Key Documentation:**
- Key lifecycle procedures
- Incident response plans
- Recovery procedures
- Training materials
- Compliance reports

**Version Control:**
- All documents in Git
- Change approval process
- Regular review cycles
- Distribution tracking

## Training and Awareness

### Required Training

**Security Team:**
- Key management procedures
- Incident response
- Compliance requirements
- Technical implementation

**Development Team:**
- Encryption implementation
- Secure coding practices
- Key usage guidelines
- Error handling

**Operations Team:**
- Key rotation procedures
- Monitoring and alerting
- Backup and recovery
- Troubleshooting

### Training Schedule

| Role | Initial Training | Annual Refresher | Incident Training |
|------|-----------------|------------------|-------------------|
| Security Team | 8 hours | 4 hours | As needed |
| Development | 4 hours | 2 hours | As needed |
| Operations | 6 hours | 3 hours | As needed |

## Incident Response

### Key Compromise Response

1. **Immediate Actions (0-15 minutes)**
   - Isolate affected systems
   - Document incident
   - Notify security team

2. **Short-term Actions (15 minutes - 2 hours)**
   - Generate new keys
   - Rotate compromised keys
   - Verify system integrity

3. **Long-term Actions (2-24 hours)**
   - Full security assessment
   - Compliance notification
   - Incident documentation

### Communication Plan

**Internal Communication:**
```
Security Team → CTO → Executive Team → Board
```

**External Communication:**
```
Legal Counsel → Regulators → Customers → Public
```

**Timeline:**
- Security team: Immediate
- Executive team: Within 1 hour
- Regulators: Within 24 hours (HIPAA requirement)
- Customers: Within 60 days (HIPAA requirement)

## Contact Information

### Emergency Contacts

**Security Team:**
- Primary: security@biopoint.com
- Escalation: +1-XXX-XXX-XXXX
- On-call: pagerduty security rotation

**Management:**
- CTO: cto@biopoint.com
- CISO: ciso@biopoint.com
- CEO: ceo@biopoint.com

### Vendor Contacts

**Doppler Support:**
- Support: support@doppler.com
- Emergency: +1-XXX-XXX-XXXX

**Cloud Provider:**
- AWS Support: AWS Support Console
- Emergency: +1-XXX-XXX-XXXX

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Next Review:** April 2026  
**Owner:** Security Team  
**Approved By:** CISO, CTO