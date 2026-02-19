# Technology Stack

**Project:** BioPoint — HIPAA-Compliant Health Tracking App
**Researched:** 2026-02-19
**Milestone:** Security Hardening + Production Deployment (Phases 5+)
**Scope:** Render deployment, SAST/DAST, Redis rate limiting, App Store tooling, test coverage

---

## Context: Existing Stack (Do Not Re-Research)

Phases 1-4 are complete. The existing foundation is:

| Layer | Technology | Version |
|-------|------------|---------|
| Mobile | Expo React Native | 54.0.x |
| API | Fastify | 4.25.0 |
| Database | Neon PostgreSQL + Prisma | - |
| Storage | Cloudflare R2 (S3-compatible) | - |
| Secrets | Doppler | - |
| ORM | Prisma | - |
| Monorepo | Turborepo | 2.x |
| API Tests | Vitest + @vitest/coverage-v8 | 1.2.0 |

This document only covers the **additions** needed for security hardening and production deployment.

---

## Recommended Additions

### 1. Deployment: Render HIPAA Workspace

**Recommendation: Upgrade to Render HIPAA-Enabled Workspace immediately.**

| Detail | Value |
|--------|-------|
| BAA Available | Yes — self-serve from dashboard |
| Plan Required | Organization or Enterprise |
| HIPAA Fee | +20% on all usage, minimum $250/month |
| Redis/Key Value | Included (Redis-compatible, runs on HIPAA-restricted hosts) |
| Data Encryption | AES-128+ at rest, TLS in transit |
| Upgrade Reversible | **NO — irreversible action** |

**Why Render over AWS/GCP for this milestone:** BioPoint already runs on Render. Migrating to AWS would be a separate project. Render now has genuine HIPAA infrastructure with BAA signing, access-restricted hosts, audit logging, and RBAC — sufficient for a risk score reduction from 2.5 to below 2.0. Starting price is $250/month minimum.

**What Render handles vs. what you must implement:**

| Render Handles | You Must Implement |
|----------------|--------------------|
| Host isolation (HIPAA restricted) | Application-level PHI access logging |
| TLS encryption in transit | Field-level PHI encryption (already done in Phase 3) |
| AES-128 at rest for databases | Role-based access at API layer |
| Audit logs (platform events) | HIPAA audit trails for PHI access |
| RBAC for infrastructure access | User session management, MFA |
| Intrusion detection (IDS) | Application error monitoring |

**Critical:** Upgrading to HIPAA workspace is irreversible. Test on a staging workspace first before switching production.

Sources: [Render HIPAA Blog](https://render.com/blog/introducing-hipaa-enabled-workspaces), [Render HIPAA Docs](https://render.com/docs/hipaa-compliance), [Paubox Render Review](https://www.paubox.com/blog/is-render.com-hipaa-compliant-2025-update)

---

### 2. Redis for Rate Limiting

**Recommendation: Render Key Value (Redis-compatible) + ioredis + @fastify/rate-limit**

The API already has `@fastify/rate-limit ^9.1.0` installed. The missing piece is a persistent Redis store.

**Use Render's managed Key Value store** (not self-hosted Redis, not Upstash):
- Runs on HIPAA-restricted hosts when inside HIPAA workspace
- Already included in Render pricing
- Redis-compatible — works with `ioredis` natively
- No BAA complexity with a third-party Redis provider
- `appendfsync everysec` on paid instances (at most 1 second of write loss on restart)

**Do NOT use:**
- **In-memory store** (default) — resets on every deploy, useless for distributed rate limiting
- **Upstash** — HTTP-based, not compatible with `ioredis`, and introduces a separate vendor requiring its own BAA
- **Self-hosted Redis on Render** — more ops overhead, no benefit over managed Key Value

**Packages to add:**

| Package | Version | Purpose |
|---------|---------|---------|
| `ioredis` | `^5.3.2` | Redis client (required by @fastify/rate-limit for external store) |

`@fastify/rate-limit` is already installed at `^9.1.0`. No version change needed.

**Critical ioredis configuration for rate limiting:**
```typescript
// Customize these — defaults are NOT optimal for rate limiting
const redis = new Redis(process.env.REDIS_URL, {
  connectTimeout: 500,          // fail fast, don't block requests
  maxRetriesPerRequest: 1,      // don't retry aggressively
  lazyConnect: true,
});
```

**Rate limit config pattern:**
```typescript
await fastify.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  redis,
  skipOnError: true,            // don't block requests if Redis is down
  keyGenerator: (request) =>    // per-user limiting
    request.user?.id ?? request.ip,
});
```

**Per-route tighter limits for PHI endpoints:**
```typescript
fastify.get('/api/lab-results', {
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
}, handler);
```

Confidence: HIGH — official @fastify/rate-limit documentation explicitly requires ioredis for external stores.

Sources: [@fastify/rate-limit GitHub](https://github.com/fastify/fastify-rate-limit), [Elitedev Fastify Redis guide](https://js.elitedev.in/js/build-a-high-performance-api-gateway-with-fastify-redis-and-rate-limiting-in-nodejs/)

---

### 3. SAST: Static Application Security Testing

**Recommendation: Semgrep (free tier) + npm audit in CI**

| Tool | Version | Purpose | Cost |
|------|---------|---------|------|
| `semgrep` | CLI, latest | SAST for TypeScript/Node.js | Free (OSS rules) |
| `npm audit` | Built-in npm | SCA — known CVE scanning | Free |

**Why Semgrep over alternatives:**
- **vs CodeQL:** Semgrep is faster to configure, has a TypeScript-native ruleset, and the free registry covers OWASP Top 10 immediately. CodeQL requires GitHub Actions and is better for large cross-file dataflow analysis.
- **vs Snyk Code:** Snyk's free tier limits scans. Semgrep's free registry is unlimited for CI use.
- **vs SonarQube:** SonarQube requires self-hosting or a paid cloud plan. Semgrep runs in a Docker container in any CI.

**Semgrep rulesets to run (add to CI):**
```bash
semgrep --config p/typescript \
        --config p/javascript \
        --config p/security-audit \
        --config p/owasp-top-ten \
        --error              # fail CI on findings
```

**Limitation to know:** Semgrep Community Edition analyzes within single-file boundaries. Cross-file dataflow vulnerabilities require the Semgrep AppSec Platform ($40/dev/month). For BioPoint's risk reduction goal (2.5 → below 2.0), single-file analysis is sufficient for the current milestone.

**SCA — keep npm audit in CI:**
```bash
npm audit --audit-level=high   # fail on high/critical CVEs only
```

**Add to CI pipeline as separate jobs:**
1. `semgrep scan` — on every PR
2. `npm audit` — on every PR
3. Dependabot alerts — enable on GitHub repository settings

Confidence: HIGH for Semgrep; HIGH for npm audit.

Sources: [Semgrep TypeScript docs](https://semgrep.dev/docs/languages/javascript), [Semgrep JS security blog](https://semgrep.dev/blog/2025/a-technical-deep-dive-into-semgreps-javascript-vulnerability-detection/), [OX Security SAST roundup](https://www.ox.security/blog/static-application-security-sast-tools/)

---

### 4. DAST: Dynamic Application Security Testing

**Recommendation: OWASP ZAP in CI against staging environment**

| Tool | Version | Purpose | Cost |
|------|---------|---------|------|
| `owasp/zap2docker-stable` | Docker, latest | DAST scan against running API | Free |

**Why ZAP over StackHawk:**
- StackHawk starts at ~$49/month for teams and is built on ZAP anyway
- ZAP's Docker image (`owasp/zap2docker-stable`) runs identically in GitHub Actions
- For a Fastify REST API with OpenAPI spec, `zap-api-scan` mode is purpose-built

**Do NOT use:**
- **StackHawk** at this stage — adds cost with no capability advantage over raw ZAP for a single API
- **DAST against production** — always scan staging only; ZAP will send attack payloads

**CI integration pattern (GitHub Actions):**
```yaml
- name: ZAP API Scan
  uses: zaproxy/action-api-scan@v0.7.0
  with:
    target: 'https://staging.biopoint.app/api'
    format: openapi
    rules_file_name: '.zap/rules.tsv'  # tune false positives
    fail_action: true                   # fail CI on Medium+ findings
```

**Prerequisite:** BioPoint API must expose an OpenAPI spec (e.g., via `@fastify/swagger`). If not already present, add it.

Confidence: HIGH — OWASP ZAP is the standard free DAST tool, well-documented for REST APIs.

Sources: [StackHawk ZAP guide](https://www.stackhawk.com/blog/guide-to-zap-application-security-testing/), [OpsMx ZAP API guide](https://www.opsmx.com/blog/blog/ensuring-api-security-with-owasp-zap-a-step-by-step-guide/), [ZAP GitHub Action](https://github.com/zaproxy/action-api-scan)

---

### 5. API Test Coverage (Fastify/TypeScript)

**Recommendation: Vitest is already installed and configured correctly. The gap is test quantity, not tooling.**

The existing setup is already production-grade:

```
vitest ^1.2.0           → UPGRADE to ^3.x (v4.x has known React coverage bug; v1.2.0 is EOL)
@vitest/coverage-v8     → UPGRADE to ^3.x (matches vitest)
```

**Why upgrade from 1.2.0 to 3.x (not 4.x):**
- Vitest 1.x is receiving no new fixes
- Vitest 4.x (current: 4.0.18) has a known bug where React components defined as inline arrow functions produce incorrect V8 coverage — not relevant to Fastify, but could affect mobile
- Vitest 3.x (latest stable: 3.2.x) includes the AST-based V8 remapping that matches Istanbul accuracy
- Vitest 3.x → 4.x is a minor migration; can do it after coverage milestone is achieved

**The existing vitest.config.ts is already correct.** Thresholds are set:
```typescript
thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
```

**What's missing is actual test files.** Current coverage is ~1%. The work is writing tests, not changing tools. Priority order for fastest coverage gain:

1. Route handler unit tests (pure function input/output — highest coverage per LOC)
2. Service layer tests with mocked Prisma client
3. Middleware tests (auth, rate limit, CORS)
4. Integration tests (route → service → mock DB)
5. Security-specific tests (already started in `src/__tests__/security/`)

**Add one missing tool:**

| Package | Version | Purpose |
|---------|---------|---------|
| `@vitest/ui` | `^3.x` | Coverage HTML dashboard in dev (optional but useful) |

Confidence: HIGH — vitest config already exists and is well-structured. This is an execution gap, not a tooling gap.

Sources: [Vitest coverage guide](https://vitest.dev/guide/coverage), [@vitest/coverage-v8 npm](https://www.npmjs.com/package/@vitest/coverage-v8), [Fastify vitest discussion](https://github.com/fastify/fastify/discussions/3838), [Vitest vs Jest 2025](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)

---

### 6. Mobile Test Coverage (Expo React Native)

**Recommendation: jest + jest-expo + @testing-library/react-native**

The mobile app currently has no test setup (no `__tests__` directory, no jest config). This is the primary gap.

| Package | Purpose | Install Command |
|---------|---------|----------------|
| `jest` | Test runner (React Native standard) | `npx expo install jest-expo jest` |
| `jest-expo` | Expo-specific Jest preset, mocks native SDK | `npx expo install jest-expo` |
| `@testing-library/react-native` | Component testing (replaces deprecated react-test-renderer) | `npm install --save-dev @testing-library/react-native` |
| `@testing-library/jest-native` | Additional matchers (toBeVisible, toHaveTextContent) | `npm install --save-dev @testing-library/jest-native` |

**Why Jest (not Vitest) for mobile:**
- Vitest does not support React Native's Metro bundler
- `jest-expo` is the official, maintained preset from the Expo team
- React Native's native module mocking requires Jest's module system
- `@testing-library/react-native` targets Jest specifically

**Why NOT Detox (E2E) for this milestone:**
- Detox requires Expo prebuild (ejecting from managed workflow)
- Adds significant CI complexity (macOS runner required for iOS E2E)
- Reaching 80% unit/component coverage is the milestone goal
- Detox is appropriate for a future "QA hardening" milestone

**jest.config.js for mobile:**
```javascript
module.exports = {
  preset: 'jest-expo/universal',   // test iOS, Android, web, Node
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70, statements: 80 }
  }
};
```

**Priority for mobile coverage:**
1. Custom hooks (pure logic, easiest to test)
2. API client functions
3. Form validation logic
4. Screen components (render + user interaction with RNTL)

Confidence: HIGH — this is the official Expo documentation recommendation for 2025.

Sources: [Expo Jest docs](https://docs.expo.dev/develop/unit-testing/), [jest-expo npm](https://www.npmjs.com/package/jest-expo), [RNTL guide 2025](https://www.creolestudios.com/react-native-testing-with-jest-and-rtl/)

---

### 7. iOS App Store Submission

**Recommendation: EAS CLI + EAS Build + EAS Submit**

| Tool | Purpose |
|------|---------|
| `eas-cli` | CLI for build, submit, update (install globally, NOT in devDependencies) |
| EAS Build | Cloud builds with managed signing credentials |
| EAS Submit | Automated upload to App Store Connect / TestFlight |
| EAS Update | OTA updates post-submission (JS-only changes) |

**Install globally (not in devDependencies — this is the Expo official recommendation):**
```bash
npm install -g eas-cli
eas login
eas build:configure
```

**Add `eas.json` to repo root:**
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "production": {
      "ios": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleId": "YOUR_APPLE_ID"
      }
    }
  }
}
```

**Submission flow:**
1. `eas build --platform ios --profile production` — builds and manages signing certs
2. `eas submit --platform ios` — uploads to App Store Connect, appears in TestFlight
3. Manual step: Complete metadata in App Store Connect, submit for App Review

**Prerequisites checklist:**
- Apple Developer Program account ($99/year)
- App record created in App Store Connect
- Privacy policy URL (required for health apps handling PHI)
- HIPAA compliance attestation in the App Review privacy questionnaire
- App privacy nutrition label filled in App Store Connect
- Healthcare entitlements if using HealthKit (react-native-health)

**Why not manual Xcode submission:**
- EAS Submit works from any OS (Windows/Linux/macOS) — Xcode only works on macOS
- EAS manages provisioning profiles and certificates automatically
- `--auto-submit` flag chains build + submit in one command for CI

Confidence: HIGH — official Expo documentation, actively maintained.

Sources: [EAS Build docs](https://docs.expo.dev/build/introduction/), [EAS Submit iOS](https://docs.expo.dev/submit/ios/), [EAS Submit intro](https://docs.expo.dev/submit/introduction/), [Expo EAS guide 2025](https://pagepro.co/blog/publishing-expo-react-native-app-to-ios-and-android/)

---

### 8. Fastify Version: Upgrade from v4 to v5

**Recommendation: Upgrade to Fastify v5 before deploying to production.**

Fastify v4 EOL was **June 30, 2025**. It is currently unsupported. Running unsupported software with PHI is a HIPAA risk — no security patches will be issued for v4.

**Impact assessment:**
- ~20 breaking changes documented in migration guide
- Most impactful: `jsonShortHand` removed — all schemas need explicit `type` property
- Performance gain: ~5-10% faster
- Node.js v20+ only (BioPoint's `engines.node >= 20` already satisfies this)
- Plugin ecosystem: `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit` all have v5-compatible versions

**Upgrade approach:**
1. Upgrade `fastify` to `^5.0.0`
2. Upgrade all `@fastify/*` plugins to latest
3. Run existing vitest suite to catch breaking changes
4. Fix schema definitions (add `type: 'object'` where missing)

Confidence: HIGH — Fastify v4 EOL is confirmed June 30, 2025.

Sources: [Fastify v5 migration guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/), [Fastify v5 analysis](https://encore.dev/blog/fastify-v5), [Fastify npm](https://www.npmjs.com/package/fastify)

---

### 9. Secrets Management: Doppler (Keep, No Change)

**Recommendation: Keep Doppler. No change needed.**

Doppler already satisfies HIPAA secrets management requirements:
- SOC 2 Type II, HIPAA, GDPR compliance built-in
- Audit logging for secret access
- Environment-scoped secrets (dev/staging/production)
- RBAC and secret versioning
- Already integrated in BioPoint (`doppler.yaml` exists)

**What Doppler does NOT cover** (pair with Semgrep):
- Does not scan source code for accidentally hardcoded secrets
- Does not provide IaC secrets scanning

**Add to CI alongside Doppler:** `semgrep --config p/secrets` to catch any accidental secrets in code.

Confidence: HIGH — Doppler HIPAA compliance is documented.

Sources: [Doppler vs Infisical 2025](https://www.doppler.com/blog/infisical-doppler-secrets-management-comparison-2025), [Secrets management guide 2025](https://www.pulumi.com/blog/secrets-management-tools-guide/)

---

## Complete Additions Summary

| Category | Tool | Version | Action |
|----------|------|---------|--------|
| Infrastructure | Render HIPAA Workspace | - | Enable (irreversible) + sign BAA |
| Redis | Render Key Value (managed) | - | Provision paid instance in HIPAA workspace |
| Redis client | `ioredis` | `^5.3.2` | `npm install ioredis -w @biopoint/api` |
| SAST | Semgrep CLI | latest | Add to CI (`semgrep --config p/typescript p/security-audit`) |
| SCA | `npm audit` | built-in | Add `--audit-level=high` step to CI |
| DAST | OWASP ZAP Docker | `zaproxy/action-api-scan@v0.7.0` | GitHub Actions step against staging |
| API tests | `vitest` | Upgrade to `^3.x` | `npm upgrade vitest @vitest/coverage-v8` |
| Mobile tests | `jest-expo` | via `npx expo install` | `npx expo install jest-expo jest` |
| Mobile tests | `@testing-library/react-native` | latest | `npm install --save-dev @testing-library/react-native` |
| Mobile tests | `@testing-library/jest-native` | latest | `npm install --save-dev @testing-library/jest-native` |
| App Store | `eas-cli` | `>= 12.0.0` | `npm install -g eas-cli` (global, not devDep) |
| API framework | `fastify` | Upgrade to `^5.x` | Required (v4 EOL June 2025) |

---

## What NOT to Use

| Tool | Why Not |
|------|---------|
| Upstash Redis | HTTP-based, incompatible with ioredis + @fastify/rate-limit, separate BAA vendor |
| Self-hosted Redis on Render | More ops overhead than managed Key Value, same cost |
| StackHawk DAST | Paid ($49+/month), built on ZAP anyway — use raw ZAP |
| Snyk (paid) | Semgrep free covers the same TypeScript surface for this milestone |
| Detox (E2E mobile) | Requires Expo prebuild, macOS CI runner, overkill for coverage milestone |
| jest-expo-enzyme | Deprecated — Enzyme does not support React 18/19 |
| `react-test-renderer` | Deprecated — does not support React 19 (BioPoint uses React 19.1.0) |
| Fastify v4 | EOL June 30, 2025 — no security patches |
| Vitest 4.x for mobile | Known inline arrow function coverage bug affecting React components |

---

## Installation Commands

```bash
# API additions
npm install ioredis -w @biopoint/api
npm upgrade vitest @vitest/coverage-v8 -w @biopoint/api  # upgrade to ^3.x

# Mobile test setup
cd apps/mobile
npx expo install jest-expo jest
npm install --save-dev @testing-library/react-native @testing-library/jest-native

# App Store submission (global, not in project)
npm install -g eas-cli

# Fastify v5 upgrade
npm install fastify@^5.0.0 @fastify/cors@latest @fastify/helmet@latest @fastify/rate-limit@latest -w @biopoint/api
```

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Render HIPAA workspace | HIGH | Official Render docs + pricing page |
| Redis: ioredis + @fastify/rate-limit | HIGH | Official @fastify/rate-limit docs explicitly require ioredis |
| Render Key Value for Redis | HIGH | Official Render docs confirm Redis-compatible, HIPAA workspace support |
| Semgrep SAST | HIGH | Semgrep docs + community evidence, TypeScript support verified |
| OWASP ZAP DAST | HIGH | OWASP official, zaproxy GitHub action is maintained |
| Vitest upgrade (v1 → v3) | HIGH | npm verified, v4.0.18 is latest but v3 safer for React |
| Mobile: jest-expo + RNTL | HIGH | Official Expo documentation |
| EAS CLI for App Store | HIGH | Official Expo EAS documentation |
| Fastify v5 upgrade | HIGH | Confirmed EOL date June 30, 2025 |
| Doppler keep (no change) | HIGH | Already integrated, HIPAA compliant |
