# External Integrations

**Analysis Date:** 2026-02-19

## AI / ML Services

**Lab Report Analysis (Gemini):**
- Service: Google Gemini Flash
- SDK: `@google/generative-ai` 0.24.1
- Model: `gemini-flash-latest`
- Auth: `GEMINI_API_KEY` env var
- Usage: Analyzes blood work / lab report images via multimodal prompt → returns structured JSON with biomarkers, flags (HIGH/LOW/NORMAL), and health summary
- File: `apps/api/src/services/analysis.ts`
- Route: `POST /labs/:id/analyze`

**Food Photo Nutrition Analysis (OpenAI):**
- Service: OpenAI GPT-4o
- SDK: `openai` 6.15.0
- Model: `gpt-4o` (vision, `detail: low`)
- Auth: `OPENAI_API_KEY` env var
- Usage: Analyzes food photos → returns macronutrient breakdown (calories, protein, carbs, fat, fiber) with confidence score
- File: `apps/api/src/services/foodAnalysis.ts`
- Route: `POST /nutrition/analyze-food` (requires valid OpenAI key)

## Data Storage

**Primary Database (Neon PostgreSQL):**
- Provider: Neon (serverless PostgreSQL)
- PostgreSQL version: configured via Terraform (`infrastructure/terraform/neon/main.tf`)
- ORM: Prisma 5.8.0
- Connection: `DATABASE_URL` env var (pooled endpoint for app, direct endpoint for admin)
- Connection pooling: Neon built-in pooling — prod: 20 connections, staging: 10, dev: 5
- Branching: main, staging, development branches (Neon feature)
- Read replicas: `us-west-2` and `eu-central-1` (Terraform-managed, optional)
- Backups: Daily at 2 AM UTC via Neon project settings
- Database roles: `app_user` (R/W), `readonly_user` (SELECT only), `datadog` (monitoring, `pg_monitor`)
- Schema: `db/prisma/schema.prisma`
- Migrations: `db/prisma/migrations/`
- Private networking: AWS PrivateLink (optional, Terraform-configurable)

**Test Database:**
- `postgres:15-alpine` via Docker (`docker-compose.test.yml`)
- Port: 5433 (to avoid colliding with dev DB on 5432)
- Connection: `DATABASE_URL_TEST` env var, defaults to `postgresql://biopoint_test:test_password@localhost:5433/biopoint_test`

**File Storage (Cloudflare R2):**
- Service: Cloudflare R2 (S3-compatible object storage)
- SDK: `@aws-sdk/client-s3` 3.500.0 + `@aws-sdk/s3-request-presigner` 3.500.0
- Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `AWS_REGION` (set to `auto` for R2)
- Bucket: `S3_BUCKET` env var (dev: `biopoint-uploads-dev`, staging: `biopoint-uploads-staging`, prod: `biopoint-uploads-prod`)
- File: `apps/api/src/utils/s3.ts`
- Presigned URL expiry (HIPAA-tiered):
  - PHI lab documents: 5 minutes (`labs/` prefix)
  - Progress photos: 10 minutes (`photos/` prefix)
  - General content: 30 minutes
- S3 key pattern: `{folder}/{userId}/{timestamp}-{sanitizedFilename}`
- URL revocation: tracked in `RevokedUrl` table, checked before serving
- Download logging: all access logged to `DownloadLog` table with IP + user agent

**Test Object Storage:**
- `minio/minio` via Docker (`docker-compose.test.yml`) on port 9001
- Simulates S3/R2 API locally

**Caching:**
- Redis 7 (test environment only via Docker on port 6380)
- No Redis used in production code paths — rate limiting uses PostgreSQL (`RateLimit` table)

## Authentication & Identity

**Custom JWT Auth (API):**
- Implementation: `apps/api/src/middleware/auth.ts`, `apps/api/src/utils/auth.ts`
- Access token: JWT signed with `JWT_SECRET`, expiry: `JWT_ACCESS_EXPIRES` (default: `15m`)
- Refresh token: Hashed with bcrypt, stored in `RefreshToken` table, expiry: `JWT_REFRESH_EXPIRES` (default: `7d`)
- Token rotation: Refresh tokens are rotated on use (old token revoked, new one issued)
- Account lockout: tracked in `AccountLockout` table (configurable attempts/duration)

**Google Sign In (Mobile):**
- SDK: `@react-native-google-signin/google-signin` 16.1.1
- File: `apps/mobile/src/services/socialAuth.ts`
- Flow: Native Google Sign In → idToken sent to API for verification
- Gracefully mocked in Expo Go dev builds

**Apple Sign In (Mobile, iOS only):**
- SDK: `expo-apple-authentication` 8.0.8
- File: `apps/mobile/src/services/socialAuth.ts`
- Scopes: `FULL_NAME`, `EMAIL`
- Gracefully mocked in Expo Go dev builds

**Biometric Auth (Mobile):**
- SDK: `expo-local-authentication` 17.0.8
- File: `apps/mobile/src/services/biometricService.ts`
- Supports: Face ID, Touch ID, fingerprint
- Used to gate access to sensitive app screens

**Secure Token Storage (Mobile):**
- SDK: `expo-secure-store` 15.0.8
- File: `apps/mobile/src/store/secureStorage.ts`
- Uses iOS Keychain / Android Keystore
- Web fallback: `localStorage` (development only)

## Payments & Subscriptions

**RevenueCat (Mobile):**
- SDK: `react-native-purchases` 9.6.13
- File: `apps/mobile/src/store/subscriptionStore.ts`
- API keys: `REVENUECAT_PUBLIC_KEY` (iOS: `appl_...`, Android: `goog_...`) — hardcoded placeholder, must be replaced
- Plans: `free`, `monthly`, `yearly`
- Entitlement: `premium`
- Operations: `getOfferings()`, `purchasePackage()`, `restorePurchases()`, `getCustomerInfo()`

## Health Platform Integration

**Apple HealthKit (Mobile, iOS only):**
- SDK: `react-native-health` 1.19.0
- File: `apps/mobile/src/services/healthKitService.ts`
- Read permissions: HeartRate, StepCount, SleepAnalysis, HeartRateVariability, Weight
- Write permissions: None (read-only)
- Android: Returns 0/false — not supported

## Secrets Management

**Doppler:**
- All environment secrets managed via Doppler
- Config: `doppler.yaml`
- Project: `biopoint`
- Environments: `dev`, `staging`, `production`
- CLI used in all dev scripts: `doppler run -- <command>`
- GitHub Actions integration via `DOPPLER_TOKEN` secret + `dopplerhq/cli-action@v3`
- Vercel integration (staging + production)
- Docker integration (all environments)
- Secrets audit trail: `doppler activity` command

## CDN, WAF, and DNS

**Cloudflare:**
- DNS: A records for `api.*`, `app.*`, `web.*` subdomains (proxied)
- Load balancer: Primary + backup pools, session affinity via cookie, health checks every 30s
- WAF custom rules (Terraform): blocks SQL injection, XSS, path traversal, known scanner user-agents
- Managed WAF: OWASP CRS (paranoia levels 1-3), Cloudflare Managed Ruleset
- Rate limiting: Global, API endpoints, Auth endpoints (10-minute mitigation for auth)
- DDoS protection: Cloudflare L7 protection
- TLS: Let's Encrypt advanced cert, TLS 1.2 min, TLS 1.3 on, HSTS (1 year + subdomains)
- Security headers injected: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`, `HSTS`
- Bot management: JS challenge, fight mode enabled
- Config: `infrastructure/terraform/cloudflare/`

## Monitoring & Observability

**Datadog (planned/infrastructure-only):**
- Terraform config: `infrastructure/terraform/datadog/main.tf`
- APM tracer code: `apps/api/src/config/monitoring.ts` (imports `dd-trace`)
- Note: `dd-trace` and `@datadog/datadog-api-client` are NOT in `package.json` — code exists but package not installed. The feature is infrastructure-ready but not wired to dependencies.
- Env vars required: `DATADOG_ENABLED=true`, `SERVICE_VERSION`
- Dashboards: DB performance, storage, application, security, infrastructure health
- Monitors/alerts: High CPU (>80%), High Memory (>85%), DB down, Error rate >5%, Response time >2s, WAF block rate, Storage >80%
- SLOs: 99.9% availability (30d), p95 response <1s (30d)
- Synthetic tests: API and app health checks every 5 minutes
- PagerDuty webhook integration configured in Terraform

**Sentry (planned/infrastructure-only):**
- Code: `apps/api/src/utils/sentry.ts`, `apps/api/src/config/monitoring.ts`
- Note: `@sentry/node` and `@sentry/types` are NOT in `package.json` — code exists with full PII-scrubbing implementation but package not installed.
- Env vars required: `SENTRY_ENABLED=true`, `SENTRY_DSN`
- Features implemented: Error categories, severity levels, PHI scrubbing from queries, header redaction, transaction tracing

**Structured Logging (Pino, active):**
- Logger: Pino (built into Fastify)
- Dev: `pino-pretty` for human-readable output
- Production: JSON format (stdout)
- Request-scoped loggers with `reqId` and `userId` bindings
- File: `apps/api/src/utils/logger.ts`

## CI/CD & Deployment

**GitHub Actions:**
- CI pipeline: `.github/workflows/ci.yml`
  - Jobs: `lint`, `test` (unit/integration/e2e matrix), `security-scan`, `build`, `type-check`, `quality-gates`, `notify`
  - Coverage threshold: 80% (enforced in `quality-gates` job)
  - Secrets scan: Gitleaks (`gitleaks/gitleaks-action@v2`)
  - Dependency audit: Snyk (`snyk/actions/node@master`, medium severity threshold)
  - PHI encryption validation: `npm run encryption:validate`
- Additional workflows: `deploy-staging.yml`, `deploy-production.yml`, `rollback-production.yml`, `terraform-plan.yml`, `terraform-apply.yml`, `security-scan.yml`, `secrets-audit.yml`, `backup-verification.yml`
- Turbo cache: `TURBO_TOKEN` + `TURBO_TEAM` secrets for remote caching
- Coverage upload: Codecov (`codecov/codecov-action@v4`, `CODECOV_TOKEN`)
- Slack notifications on failure: `#devops-alerts` channel

**Hosting:**
- Kubernetes: `k8s/production/`, `k8s/staging/` manifests
- Cloudflare: CDN and load balancing fronts API

## Notifications

**Email (NotificationService, stubbed):**
- File: `apps/api/src/services/notificationService.ts`
- Config: `EMAIL_NOTIFICATIONS_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL`
- Default SMTP host: `smtp.gmail.com:587`
- Status: `sendEmail()` method logs to console — **real SMTP transport not implemented**. Contains TODO comment for nodemailer/SES integration.
- Triggers: Account lockout notifications, security alerts

**Slack (NotificationService, active):**
- File: `apps/api/src/services/notificationService.ts`
- Config: `SLACK_NOTIFICATIONS_ENABLED`, `SLACK_WEBHOOK_URL`, `SLACK_CHANNEL`
- Default channel: `#security-alerts`
- Triggers: Account lockout events, security alerts
- Transport: Direct HTTP `fetch()` to Slack Incoming Webhook URL

## Webhooks & Callbacks

**Incoming:**
- None detected — no webhook receiver endpoints in route files

**Outgoing:**
- Slack Incoming Webhook (security alerts, account lockouts)
- PagerDuty webhook (via Datadog monitor integration, Terraform-configured)

## Environment Variables Reference

**Required for API to start:**
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - Base64-encoded 32-byte key for AES-256-GCM PHI encryption
- `AWS_ACCESS_KEY_ID` - Cloudflare R2 access key
- `AWS_SECRET_ACCESS_KEY` - Cloudflare R2 secret
- `S3_BUCKET` - R2 bucket name
- `S3_ENDPOINT` - R2 S3-compatible endpoint URL

**Required for AI features:**
- `GEMINI_API_KEY` - Lab report image analysis
- `OPENAI_API_KEY` - Food photo nutrition analysis

**Optional:**
- `ENCRYPTION_KEY_VERSION` - Key rotation version (default: `1`)
- `JWT_ACCESS_EXPIRES` - Access token TTL (default: `15m`)
- `JWT_REFRESH_EXPIRES` - Refresh token TTL (default: `7d`)
- `AWS_REGION` - R2 region (default: `auto`)
- `CORS_ORIGIN` - Comma-separated allowed origins
- `PORT` - Server port (default: `3000`)
- `RATE_LIMIT_MAX` - Max requests per window
- `RATE_LIMIT_WINDOW` - Rate limit window
- `SENTRY_DSN` - Sentry project DSN (when `@sentry/node` is installed)
- `SENTRY_ENABLED` - Enable Sentry (`true`/`false`)
- `DATADOG_ENABLED` - Enable Datadog APM (`true`/`false`)
- `EMAIL_NOTIFICATIONS_ENABLED` - Enable email alerts
- `SLACK_NOTIFICATIONS_ENABLED` - Enable Slack alerts
- `SLACK_WEBHOOK_URL` - Slack incoming webhook URL
- `SLACK_CHANNEL` - Slack channel for alerts
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` - Email config
- `SUPPORT_EMAIL` - Support email address shown in user notifications

**Mobile:**
- `API_BASE_URL` - Backend API base URL
- `APP_ENV` - App environment (`development`, `staging`, `production`)

---

*Integration audit: 2026-02-19*
