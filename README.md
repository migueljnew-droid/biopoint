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

## Project Structure

```
/biopoint
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── api/             # Fastify API server
├── packages/
│   └── shared/          # Zod schemas & shared types
├── db/
│   └── prisma/          # Database schema & migrations
└── docs/                # Documentation
```

## License

Private - All rights reserved.
