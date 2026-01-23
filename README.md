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

## Getting Started

See [docs/run-local.md](docs/run-local.md) for local development setup.

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
