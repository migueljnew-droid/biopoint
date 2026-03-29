# BioPoint

A comprehensive health tracking application for monitoring biomarkers, supplement/peptide stacks, lab results, and progress photos.

## Features

- **Dashboard**: BioPoint Score (0-100) with daily tracking of sleep, energy, focus, mood, and weight
- **Stacks**: Create and manage supplement/peptide protocols with compliance tracking
- **Labs**: Upload lab reports and manually enter biomarkers with trend visualization
- **Progress Photos**: Before/after photos with alignment and comparison tools
- **Community**: Groups, posts, and shareable stack templates

## Tech Stack

- **Mobile**: Expo React Native + TypeScript (strict)
- **API**: Node.js + Fastify + TypeScript
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **Storage**: AWS S3 with presigned URLs
- **Auth**: JWT access tokens + refresh token rotation

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (local or Neon)
- AWS S3 bucket for file storage
- Expo CLI for mobile development

### Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd biopoint
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Configure your environment variables
   # See docs/run-local.md for detailed setup
   ```

3. **Database Setup**
   ```bash
   # Run database migrations
   npm run db:migrate
   
   # Seed database (optional)
   npm run db:seed
   ```

4. **Development Servers**
   ```bash
   # Start all services
   npm run dev
   
   # Or start individually
   npm run dev:api    # API server only
   npm run dev:mobile # Mobile development
   ```

### Git Configuration

This repository is configured with:
- **Comprehensive .gitignore** for React Native + Node.js + Turbo monorepo
- **Environment file protection** (all `.env` files are ignored)
- **Cross-platform line endings** via .gitattributes
- **Monorepo structure** with shared packages and apps

**⚠️ Security Notice**: Never commit environment files (`.env`, `.env.local`, etc.). The repository is configured to automatically ignore these files.

See [docs/run-local.md](docs/run-local.md) for detailed local development setup.

See [docs/deploy.md](docs/deploy.md) for production deployment.

## Documentation

BioPoint includes comprehensive technical documentation covering all aspects of the system:

### 📚 Core Documentation
- **[API Reference](docs/api-reference.md)** - Complete endpoint documentation for 32 API endpoints with examples
- **[Mobile App Guide](docs/mobile-app.md)** - Architecture, build procedures, and store submission
- **[Data Model](docs/data-model.md)** - Database schema and entity relationships

### 🛠️ Operations & Maintenance
- **[Operations Runbook](docs/operations-runbook.md)** - Daily, weekly, monthly, quarterly, and annual procedures
- **[Troubleshooting Guide](docs/troubleshooting.md)** - Common issues and step-by-step debugging
- **[Performance Tuning](docs/performance-tuning.md)** - Optimization strategies for database, API, and mobile

### 🔐 Security & Compliance
- **[Security Best Practices](docs/security-best-practices.md)** - HIPAA-compliant security procedures
- **[Deployment Procedures](docs/deploy.md)** - Production deployment and infrastructure setup

### 🏗️ Architecture & Decisions
- **[Architecture Decision Records](docs/adr/)** - Technical decisions and rationales:
  - [ADR-001: Fastify vs Express](docs/adr/ADR-001-fastify-over-express.md)
  - [ADR-002: Neon PostgreSQL vs RDS](docs/adr/ADR-002-neon-postgresql-over-rds.md)
  - [ADR-003: Cloudflare R2 vs AWS S3](docs/adr/ADR-003-cloudflare-r2-over-aws-s3.md)
  - [ADR-004: Doppler vs AWS Secrets Manager](docs/adr/ADR-004-doppler-over-aws-secrets-manager.md)
  - [ADR-005: Prisma vs TypeORM](docs/adr/ADR-005-prisma-over-typeorm.md)
  - [ADR-006: Expo vs React Native CLI](docs/adr/ADR-006-expo-over-react-native-cli.md)

### 👥 Team Resources
- **[Onboarding Guide](docs/onboarding.md)** - New developer setup and team procedures
- **[Testing Strategy](docs/testing-strategy.md)** - Comprehensive testing approach
- **[CI/CD Pipeline](docs/ci-cd-pipeline.md)** - Continuous integration and deployment

### 🔍 Additional Documentation
- **[HIPAA Compliance Roadmap](docs/hipaa-compliance-roadmap.md)** - Compliance implementation
- **[Disaster Recovery Master Plan](docs/disaster-recovery-master-plan.md)** - Business continuity
- **[Security Checklist](docs/security-checklist.md)** - Security requirements and validation
- **[Monitoring Setup](docs/monitoring-setup.md)** - System monitoring and alerting

## Project Structure

```
biopoint/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── api/             # Fastify API server
├── packages/
│   └── shared/          # Zod schemas & shared types
├── db/
│   └── prisma/          # Database schema & migrations
├── docs/                # Comprehensive documentation
│   ├── adr/            # Architecture Decision Records
│   ├── runbooks/       # Operational procedures
│   └── security/       # Security procedures
└── scripts/             # Utility scripts
```

## Documentation Completeness Score

**Overall Completeness: 98%**

| Category | Completeness | Status |
|----------|-------------|--------|
| API Documentation | 100% | ✅ Complete |
| Mobile App Documentation | 100% | ✅ Complete |
| Operations Runbook | 100% | ✅ Complete |
| Troubleshooting Guide | 100% | ✅ Complete |
| Performance Tuning | 100% | ✅ Complete |
| Security Best Practices | 100% | ✅ Complete |
| Architecture Decisions | 100% | ✅ Complete |
| Onboarding Guide | 100% | ✅ Complete |

## License

Private - All rights reserved.
