# Running Tests - BioPoint Developer Guide

## Quick Start

### Run All Tests
```bash
# Run all tests across all workspaces
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Run Specific Test Suites
```bash
# API tests only
npm run test:api

# Mobile app tests only
npm run test:mobile

# Database tests only
npm run test:db

# Security tests
npm run test:security

# Compliance tests
npm run test:compliance

# Integration tests
npm run test:integration
```

## Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Set up test database (first time only)
docker-compose -f docker-compose.test.yml up -d

# Wait for database to be ready
npm run test:db:wait
```

### 2. Environment Variables
Create `.env.test` in the root directory:
```env
# Database
DATABASE_URL_TEST=postgresql://biopoint_test:test_password@localhost:5433/biopoint_test

# JWT Secret for tests
JWT_SECRET=test-jwt-secret-key-at-least-32-characters-long

# S3 Mock (MinIO)
S3_ENDPOINT=http://localhost:9001
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=biopoint-test-bucket

# Redis (for rate limiting)
REDIS_URL=redis://localhost:6380
```

## Test Database Management

### Start Test Database
```bash
# Start all test services (PostgreSQL, Redis, MinIO)
docker-compose -f docker-compose.test.yml up -d

# Check status
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs -f
```

### Stop Test Database
```bash
# Stop all test services
docker-compose -f docker-compose.test.yml down

# Remove data volumes (careful!)
docker-compose -f docker-compose.test.yml down -v
```

### Reset Test Database
```bash
# Reset test database data
npm run test:db:reset

# Or manually connect and clean
psql -h localhost -p 5433 -U biopoint_test -d biopoint_test
# Run: SELECT cleanup_test_data();
```

## Running API Tests

### Basic API Testing
```bash
# Run all API tests
cd apps/api && npm test

# Run specific test file
cd apps/api && npm test auth.test.ts

# Run tests matching pattern
cd apps/api && npm test -- --grep "authentication"

# Run tests in watch mode
cd apps/api && npm run test:watch
```

### API Test Coverage
```bash
# Run tests with coverage
cd apps/api && npm run test:coverage

# View coverage report
cd apps/api && open coverage/index.html

# Generate coverage badge
cd apps/api && npm run test:coverage -- --reporter=json-summary
```

### API Integration Tests
```bash
# Run integration tests only
cd apps/api && npm run test:integration

# Run specific integration test suite
cd apps/api && npm test -- src/__tests__/integration/auth.test.ts

# Run with verbose output
cd apps/api && npm test -- --reporter=verbose
```

### API Security Tests
```bash
# Run security tests
cd apps/api && npm run test:security

# Run specific security test
cd apps/api && npm test -- src/__tests__/security/rate-limiting.test.ts

# Run with security-focused output
cd apps/api && npm test -- --reporter=verbose --grep "security"
```

### API Compliance Tests
```bash
# Run HIPAA compliance tests
cd apps/api && npm run test:compliance

# Run audit logging tests
cd apps/api && npm test -- src/__tests__/compliance/audit-logging.test.ts

# Run with compliance reporting
cd apps/api && npm test -- --reporter=json --outputFile=compliance-report.json
```

## Running Mobile Tests

### Basic Mobile Testing
```bash
# Run all mobile tests
cd apps/mobile && npm test

# Run tests in watch mode
cd apps/mobile && npm run test:watch

# Run tests with coverage
cd apps/mobile && npm run test:coverage
```

### Mobile Component Testing
```bash
# Run component tests
cd apps/mobile && npm test -- --testPathPattern=components

# Run navigation tests
cd apps/mobile && npm test -- --testPathPattern=navigation

# Run screen tests
cd apps/mobile && npm test -- --testPathPattern=screens
```

### Mobile Integration Testing
```bash
# Run API integration tests
cd apps/mobile && npm run test:integration

# Run with network mocking
cd apps/mobile && npm test -- --testPathPattern=integration
```

## Test Utilities

### Using Test Helpers
```typescript
// Generate test data
import { TestHelpers } from '../utils/testHelpers';

const userData = TestHelpers.generateUserData({
  email: 'test@example.com',
  role: 'ADMIN'
});

const labReportData = TestHelpers.generateLabReportData();
const largePayload = TestHelpers.generateLargePayload(1024); // 1KB
```

### Database Testing
```typescript
// Setup test database
import { setupTestDatabase, teardownTestDatabase } from '../utils/testDatabase';

let testDb;

beforeEach(async () => {
  testDb = await setupTestDatabase();
});

afterEach(async () => {
  await teardownTestDatabase();
});

// Create test data
const user = await testDb.createTestUser({
  email: 'test@example.com',
  password: 'TestPassword123!'
});

const labReport = await testDb.createTestLabReport(user.id, {
  filename: 'test-report.pdf'
});

// Check audit logs
const auditLogs = await testDb.getAuditLogs(user.id);
```

### API Client Usage
```typescript
// Create API client
import { createApiClient } from '../utils/apiClient';

let apiClient;

beforeEach(async () => {
  apiClient = await createApiClient();
});

afterEach(async () => {
  await apiClient.teardown();
});

// Make API calls
const response = await apiClient.register(userData);
const loginResponse = await apiClient.login(credentials);
const profileResponse = await apiClient.getProfile(token);
```

## Mock Services

### S3 Service Mocking
```typescript
import { setupS3Mocks, resetS3Mocks, createMockS3UploadResponse } from '../mocks/s3Service';

beforeEach(() => {
  setupS3Mocks();
});

afterEach(() => {
  resetS3Mocks();
});

// Custom mock response
mockS3Service.uploadFile.mockResolvedValueOnce(
  createMockS3UploadResponse('test.pdf', 'uploads/test.pdf')
);
```

### AI Service Mocking
```typescript
import { setupAIMocks, resetAIMocks, createMockAIAnalysisResponse } from '../mocks/aiService';

beforeEach(() => {
  setupAIMocks();
});

afterEach(() => {
  resetAIMocks();
});

// Custom mock response
mockAIService.analyzeLabReport.mockResolvedValueOnce(
  createMockAIAnalysisResponse()
);
```

## Coverage Analysis

### View Coverage Reports
```bash
# API coverage
cd apps/api && npm run test:coverage
open coverage/index.html

# Mobile coverage
cd apps/mobile && npm run test:coverage
open coverage/lcov-report/index.html

# Overall coverage
npm run test:coverage
```

### Coverage Thresholds
The project enforces minimum coverage thresholds:
```
Lines: 80%
Functions: 80%
Branches: 75%
Statements: 80%
```

### Generate Coverage Badge
```bash
# Generate coverage badge
cd apps/api && npm run test:coverage -- --reporter=json-summary

# Update README with coverage
cat coverage/coverage-summary.json
```

## Debugging Tests

### Verbose Output
```bash
# Run with verbose output
cd apps/api && npm test -- --reporter=verbose

# Run specific test with verbose output
cd apps/api && npm test -- auth.test.ts --reporter=verbose

# Debug mode
cd apps/api && npm test -- --reporter=verbose --no-coverage
```

### Test Isolation
```bash
# Run single test file
cd apps/api && npm test -- auth.test.ts

# Run tests matching pattern
cd apps/api && npm test -- --grep "should register"

# Skip certain tests
cd apps/api && npm test -- --grep "should register" --invert
```

### Debug with Node.js Inspector
```bash
# Debug tests with Chrome DevTools
cd apps/api && node --inspect-brk ./node_modules/.bin/vitest run auth.test.ts

# Then open Chrome and go to chrome://inspect
```

## Performance Testing

### Measure Test Performance
```bash
# Run with performance timing
cd apps/api && npm test -- --reporter=verbose --duration

# Profile slow tests
cd apps/api && npm test -- --reporter=verbose --slow 1000
```

### Optimize Test Performance
```bash
# Run tests in parallel (default)
cd apps/api && npm test -- --pool=threads

# Run tests sequentially (for debugging)
cd apps/api && npm test -- --pool=forks --poolOptions.forks.singleFork
```

## Continuous Integration

### GitHub Actions
Tests run automatically on:
- Push to main branch
- Pull requests
- Scheduled nightly runs

### Local CI Simulation
```bash
# Run full CI pipeline locally
npm run test:all

# Run security tests only
npm run test:security

# Run compliance tests only
npm run test:compliance
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check if test database is running
docker-compose -f docker-compose.test.yml ps

# Restart test database
docker-compose -f docker-compose.test.yml restart postgres-test

# Check database logs
docker-compose -f docker-compose.test.yml logs postgres-test
```

#### Port Already in Use
```bash
# Find process using port 5433
lsof -i :5433

# Kill process
kill -9 <PID>

# Or use different port
echo "DATABASE_URL_TEST=postgresql://biopoint_test:test_password@localhost:5434/biopoint_test" > .env.test
```

#### Tests Timing Out
```bash
# Increase test timeout
cd apps/api && npm test -- --testTimeout=60000

# Check for hanging tests
cd apps/api && npm test -- --reporter=verbose --bail
```

#### Coverage Not Generating
```bash
# Install coverage dependencies
cd apps/api && npm install @vitest/coverage-v8

# Clear coverage cache
cd apps/api && rm -rf coverage

# Regenerate coverage
cd apps/api && npm run test:coverage
```

### Getting Help

1. **Check Test Logs**: Always run with `--reporter=verbose` for detailed output
2. **Database State**: Ensure test database is clean and running
3. **Environment Variables**: Verify all required env vars are set
4. **Dependencies**: Run `npm install` to ensure all packages are installed
5. **Docker Services**: Check that all test services are running

## Best Practices

### Test Organization
- Keep tests close to source files
- Use descriptive test names
- Group related tests in describe blocks
- Use beforeEach/afterEach for setup/teardown

### Test Data Management
- Use factories for test data generation
- Clean up test data after each test
- Avoid hardcoded values
- Use unique identifiers for test data

### Test Isolation
- Each test should be independent
- Don't rely on test execution order
- Clean up state between tests
- Use fresh test database for each test run

### Performance
- Keep individual tests fast (<1 second)
- Use parallel execution when possible
- Mock external services
- Avoid real network calls in unit tests

This guide should help you run and maintain the BioPoint test suite effectively. For additional help, consult the team or create an issue in the repository.