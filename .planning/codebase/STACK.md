# Technology Stack

**Analysis Date:** 2026-02-19

## Languages

**Primary:**
- TypeScript 5.3.3 - All packages: `apps/api/`, `apps/mobile/`, `packages/shared/`, `db/`

**Secondary:**
- HCL (Terraform) - Infrastructure definitions in `infrastructure/terraform/`
- YAML - GitHub Actions CI/CD in `.github/workflows/`
- SQL - Database migrations in `db/prisma/migrations/`

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced via `engines` field in root `package.json`)

**Package Manager:**
- npm (workspaces)
- Lockfile: `package-lock.json` present at monorepo root

## Monorepo Build

**Orchestration:**
- Turborepo 2.0.0 - Task pipeline with caching (`turbo.json`)
  - Build order: `^build` dependency graph ensures `@biopoint/shared` builds before `@biopoint/api`
  - Tasks: `build`, `dev`, `test`, `lint`, `clean`

**Secrets Management:**
- Doppler - All dev/CI scripts run via `doppler run --` prefix
  - Config: `doppler.yaml` defines project `biopoint` with environments `dev`, `staging`, `production`
  - Integrations: GitHub Actions, Vercel, Docker
  - Every npm script that needs env vars uses `doppler run --` prefix

## Frameworks

**API Backend:**
- Fastify 4.25.0 - HTTP server (`apps/api/src/app.ts`, `apps/api/src/index.ts`)
  - `@fastify/cors` 9.0.0 - CORS with allowlist from `CORS_ORIGIN` env var
  - `@fastify/helmet` 11.1.0 - Security headers
  - `@fastify/rate-limit` 9.1.0 - Plugin registered but disabled globally; custom rate limiting via `apps/api/src/middleware/rateLimit.ts`

**Mobile App:**
- Expo SDK 54.0.32 - React Native application (`apps/mobile/`)
- React Native 0.81.5
- Expo Router 6.0.22 - File-based routing

**Shared Package:**
- Zod 3.22.4 - Schema validation and type generation (`packages/shared/src/schemas/`)
  - Schemas imported into both `@biopoint/api` and `@biopoint/mobile`

**Database ORM:**
- Prisma 5.8.0 (`@prisma/client` 5.8.0) - ORM + migrations
  - Schema: `db/prisma/schema.prisma`
  - Prisma metrics preview feature enabled

**Mobile Navigation:**
- React Navigation 7.1.8 (`@react-navigation/native`)
- Expo Router file-based routing as primary system

**Mobile State:**
- Zustand 4.5.0 - Global state (`apps/mobile/src/store/`)
  - Persisted to AsyncStorage with `zustand/middleware persist`

## TypeScript Configuration

**Base config:** `tsconfig.base.json` (extended by all packages)
- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`
- `noUnusedLocals: true`, `noUnusedParameters: true`, `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true` (strict array safety)

## Key API Dependencies

**Security:**
- `bcrypt` 5.1.1 - Password hashing (`apps/api/src/utils/auth.ts`)
- `jsonwebtoken` 9.0.2 - JWT access tokens and refresh tokens
- Node.js built-in `crypto` - AES-256-GCM PHI encryption (`apps/api/src/utils/encryption.ts`)

**AI/ML:**
- `@google/generative-ai` 0.24.1 - Gemini Flash for lab report image analysis (`apps/api/src/services/analysis.ts`)
- `openai` 6.15.0 - GPT-4o for food photo nutrition analysis (`apps/api/src/services/foodAnalysis.ts`)

**Storage:**
- `@aws-sdk/client-s3` 3.500.0 - Cloudflare R2 via S3-compatible API (`apps/api/src/utils/s3.ts`)
- `@aws-sdk/s3-request-presigner` 3.500.0 - Presigned URL generation

**Utilities:**
- `uuid` 9.0.1 - ID generation
- `dotenv` 16.3.1 - Local env loading (Doppler in CI/prod)
- `pino` (built into Fastify) + `pino-pretty` 13.1.3 - Structured JSON logging

## Key Mobile Dependencies

**Authentication:**
- `@react-native-google-signin/google-signin` 16.1.1 - Google OAuth
- `expo-apple-authentication` 8.0.8 - Apple Sign In (iOS)
- `expo-local-authentication` 17.0.8 - Biometric auth (Face ID/Touch ID)
- `expo-secure-store` 15.0.8 - Encrypted token storage (Keychain/Keystore)

**Health Platform:**
- `react-native-health` 1.19.0 - Apple HealthKit bridge (iOS only)
  - Reads: HeartRate, StepCount, SleepAnalysis, HeartRateVariability, Weight

**Payments:**
- `react-native-purchases` 9.6.13 - RevenueCat SDK
  - Plans: `free`, `monthly`, `yearly`
  - Entitlement key: `premium`

**UI:**
- `expo-linear-gradient` 15.0.8
- `react-native-chart-kit` 6.12.0
- `react-native-svg` 15.12.1
- `react-native-reanimated` 4.1.1
- `expo-haptics` 15.0.8
- `react-native-markdown-display` 7.0.2

**Networking:**
- `axios` 1.6.5 - HTTP client for API calls

## Testing

**API (Vitest):**
- `vitest` 1.2.0 - Test runner (`apps/api/vitest.config.ts`)
- `@vitest/coverage-v8` 1.2.0 - Coverage with v8 provider
- `supertest` 6.3.4 - HTTP integration testing
- `@faker-js/faker` 8.4.1 - Test data generation
- Coverage thresholds: 80% lines/functions/statements, 75% branches

**Mobile (Jest):**
- `jest` - Test runner (`apps/mobile/jest.config.js`)

**Load Testing:**
- Custom k6/Node scripts in `tests/load/`

## Infrastructure as Code

- Terraform - All cloud resources managed in `infrastructure/terraform/`
  - Providers: `kislerdm/neon` ~0.6.0, `cloudflare/cloudflare` ~4.0, `DataDog/datadog` ~3.0

## Configuration

**Environment management:**
- Doppler handles all secrets in all environments
- Three environments: `dev`, `staging`, `production`
- `doppler.yaml` - Service-to-secret mapping configuration

**TypeScript build:**
- `tsconfig.base.json` - Shared compiler options
- Each workspace extends it with path-specific overrides

**API server:** Port `3000` by default (`PORT` env var), host `0.0.0.0`

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- Doppler CLI (required for `dev:api`, `dev:mobile` scripts)
- Docker (for test database via `docker-compose.test.yml`)
- Xcode (iOS development for HealthKit, Apple Sign In, biometrics)

**Test containers (docker-compose.test.yml):**
- `postgres:15-alpine` on port 5433
- `redis:7-alpine` on port 6380
- `minio/minio` (S3-compatible) on port 9001

**Production:**
- Kubernetes deployment (`k8s/production/`, `k8s/staging/`)
- Cloudflare for DNS, WAF, load balancing, CDN
- Neon serverless PostgreSQL (branching: main, staging, dev)
- Cloudflare R2 for file storage (S3-compatible)

---

*Stack analysis: 2026-02-19*
