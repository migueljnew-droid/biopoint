# BioPoint Developer Onboarding Guide

## Welcome to BioPoint! 🚀

This guide will help you get up and running with the BioPoint development environment, understand our architecture, and contribute effectively to the project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Code Review Guidelines](#code-review-guidelines)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Procedures](#deployment-procedures)
8. [Useful Resources](#useful-resources)

## Prerequisites

### Required Software

Before starting, ensure you have the following installed:

```bash
# Node.js 18+ (we recommend using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Git
git --version  # Should be 2.30+

# PostgreSQL 14+ (local development)
# On macOS:
brew install postgresql
brew services start postgresql

# On Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Docker (optional, for containerized development)
docker --version  # Should be 20.10+
```

### Recommended Tools

```bash
# VS Code extensions
# Install these extensions for optimal development experience:
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension prisma.prisma

# Command line tools
npm install -g @prisma/client
npm install -g turbo
```

## Environment Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/biopoint.git
cd biopoint

# Install dependencies
npm install

# Install Turbo for monorepo management
npm install -g turbo
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Generate required secrets
npm run generate:secrets

# Set up your local environment variables
# Edit .env file with your configuration
```

**Required Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/biopoint"

# Authentication
JWT_SECRET="your-jwt-secret-minimum-32-characters"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

# AWS S3 (for file uploads)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET="biopoint-uploads"

# API Configuration
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8081"
PORT=3000
```

### 3. Database Setup

```bash
# Create local database
createdb biopoint

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Generate Prisma client
npm run db:generate
```

### 4. Development Services

```bash
# Start all services for development
npm run dev

# Or start services individually:
npm run dev:api      # API server only
npm run dev:mobile   # Mobile development
npm run dev:web      # Web development (if applicable)
```

### 5. Mobile Development Setup

```bash
# Install Expo CLI
npm install -g @expo/cli

# Navigate to mobile app
cd apps/mobile

# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## Architecture Overview

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web App       │    │   Admin Panel   │
│   (React Native)│    │   (Next.js)     │    │   (React)       │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     API Gateway       │
                    │    (Fastify API)      │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Business Logic      │
                    │   (Services Layer)    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Data Access Layer   │
                    │    (Prisma ORM)       │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
│   PostgreSQL    │    │   AWS S3        │    │   Redis Cache   │
│   (Neon)        │    │   (File Storage)│    │   (Sessions)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

#### Backend (API)
- **Framework**: Fastify with TypeScript
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **File Storage**: AWS S3 with presigned URLs
- **Caching**: Redis (for session management)
- **Validation**: Zod schemas
- **Testing**: Jest with Supertest

#### Mobile App
- **Framework**: Expo React Native
- **Language**: TypeScript (strict mode)
- **Navigation**: Expo Router (file-based)
- **State Management**: Zustand
- **API Client**: Axios with interceptors
- **Storage**: Expo Secure Store
- **UI**: Native components with custom styling

#### Monorepo Structure
```
biopoint/
├── apps/
│   ├── api/              # Fastify API server
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── shared/           # Shared types and schemas
│   └── db/               # Database configuration
├── db/
│   └── prisma/           # Database schema and migrations
├── docs/                 # Documentation
├── scripts/              # Utility scripts
└── tools/                # Development tools
```

### Key Design Patterns

#### 1. Repository Pattern
```typescript
// packages/db/src/repositories/UserRepository.ts
export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
  }

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
        profile: {
          create: {}
        }
      }
    });
  }
}
```

#### 2. Service Layer Pattern
```typescript
// apps/api/src/services/AuthService.ts
export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private tokenService: TokenService
  ) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !await verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = await this.tokenService.generateTokens(user);
    return { user, tokens };
  }
}
```

#### 3. Middleware Pattern
```typescript
// apps/api/src/middleware/auth.ts
export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  try {
    const decoded = verifyAccessToken(token);
    (request as any).userId = decoded.userId;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
};
```

## Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/user-profile-enhancement

# 2. Make changes following coding standards
# 3. Write tests for your changes
# 4. Run tests locally
npm run test
npm run test:integration

# 5. Check code quality
npm run lint
npm run type-check

# 6. Commit changes
git commit -m "feat: enhance user profile with new fields"

# 7. Push and create pull request
git push origin feature/user-profile-enhancement
```

### 2. Database Changes

```bash
# 1. Create migration
npm run db:migrate:create -- --name add-user-preferences

# 2. Edit migration file in db/prisma/migrations/
# 3. Apply migration locally
npm run db:migrate

# 4. Generate Prisma client
npm run db:generate

# 5. Update shared schemas if needed
# Edit packages/shared/src/schemas/
```

### 3. API Development

```typescript
// 1. Create route file
// apps/api/src/routes/feature.ts

// 2. Define validation schemas
// packages/shared/src/schemas/feature.ts

// 3. Implement route handlers
// apps/api/src/handlers/featureHandler.ts

// 4. Add tests
// apps/api/src/routes/__tests__/feature.test.ts

// 5. Update API documentation
// docs/api-reference.md
```

### 4. Mobile App Development

```typescript
// 1. Create screen component
// apps/mobile/src/screens/FeatureScreen.tsx

// 2. Add navigation route
// apps/mobile/app/(tabs)/feature.tsx

// 3. Create API service
// apps/mobile/src/services/featureService.ts

// 4. Add state management
// apps/mobile/src/store/featureStore.ts

// 5. Write tests
// apps/mobile/src/screens/__tests__/FeatureScreen.test.tsx
```

## Code Review Guidelines

### Pull Request Requirements

#### 1. PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling implemented
```

#### 2. Code Quality Standards

**Backend Code Standards:**
```typescript
// ✅ Good: Proper error handling
app.get('/users/:id', async (request, reply) => {
  try {
    const user = await userService.findById(request.params.id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return user;
  } catch (error) {
    logger.error('Failed to fetch user', { error, userId: request.params.id });
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ❌ Bad: Missing error handling
app.get('/users/:id', async (request, reply) => {
  const user = await userService.findById(request.params.id);
  return user;
});
```

**Mobile Code Standards:**
```typescript
// ✅ Good: Proper TypeScript typing and error handling
interface UserProfileProps {
  userId: string;
  onUpdate: (user: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await userService.getUser(userId);
        setUser(userData);
      } catch (err) {
        setError('Failed to load user');
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!user) return <NotFoundMessage />;

  return <UserDetails user={user} onUpdate={onUpdate} />;
};

// ❌ Bad: Missing types and error handling
const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    userService.getUser(userId).then(setUser);
  }, []);

  return <Text>{user.name}</Text>;
};
```

### 3. Security Review Checklist

- [ ] Input validation implemented
- [ ] Authentication required for protected endpoints
- [ ] Authorization checks in place
- [ ] Sensitive data encrypted
- [ ] No hardcoded secrets
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Rate limiting implemented
- [ ] Audit logging added
- [ ] Error messages don't leak sensitive information

### 4. Performance Review

- [ ] Database queries optimized
- [ ] Indexes added for frequent queries
- [ ] N+1 queries eliminated
- [ ] Caching implemented where appropriate
- [ ] Bundle size optimized (mobile)
- [ ] Images optimized
- [ ] API response times acceptable
- [ ] Memory usage efficient

## Testing Strategy

### 1. Test Structure

```
apps/
├── api/
│   └── src/
│       ├── __tests__/        # Integration tests
│       └── routes/
│           └── __tests__/    # Unit tests
└── mobile/
    └── src/
        ├── __tests__/        # Component tests
        └── screens/
            └── __tests__/    # Screen tests
```

### 2. Testing Guidelines

#### Backend Testing
```typescript
// apps/api/src/routes/__tests__/auth.test.ts
describe('Auth Routes', () => {
  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'securePassword123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return 409 for duplicate email', async () => {
      // Create user first
      await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'securePassword123'
        });

      // Try to create same user again
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'securePassword123'
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });
  });
});
```

#### Mobile Testing
```typescript
// apps/mobile/src/screens/__tests__/LoginScreen.test.tsx
describe('LoginScreen', () => {
  it('should render login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('should show validation errors for invalid input', async () => {
    const { getByText, getByTestId } = render(<LoginScreen />);
    
    fireEvent.press(getByText('Sign In'));
    
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
    });
  });

  it('should login successfully with valid credentials', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
      tokens: { accessToken: 'token' }
    });

    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));
    
    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });
});
```

### 3. Test Coverage Requirements

- **Unit Tests**: > 80% coverage
- **Integration Tests**: > 70% coverage
- **End-to-End Tests**: Critical user flows
- **Security Tests**: Authentication, authorization, input validation

## Deployment Procedures

### 1. Development Deployment

```bash
# Deploy to staging environment
git checkout staging
git merge feature/your-feature
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Monitor deployment
npm run monitor:staging
```

### 2. Production Deployment

```bash
# 1. Create release branch
git checkout -b release/v1.2.0

# 2. Update version numbers
npm run version:bump -- 1.2.0

# 3. Create release notes
npm run release:notes

# 4. Deploy to production
git checkout main
git merge release/v1.2.0
npm run deploy:production

# 5. Post-deployment verification
npm run health:full
npm run test:production
```

### 3. Rollback Procedures

```bash
# Quick rollback to previous version
npm run rollback:production

# Database rollback (if needed)
npm run db:rollback -- --steps=1

# Verify rollback
npm run health:full
```

## Useful Resources

### Documentation
- [API Reference](./api-reference.md)
- [Database Schema](./data-model.md)
- [Mobile App Guide](./mobile-app.md)
- [Deployment Guide](./deploy.md)

### External Resources
- [Fastify Documentation](https://www.fastify.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs)

### Development Tools
- **API Testing**: Postman collection in `/tools/postman/`
- **Database GUI**: TablePlus, pgAdmin
- **Mobile Debugging**: React Native Debugger
- **Performance**: Flipper, Reactotron

### Team Communication
- **Slack**: #biopoint-dev
- **GitHub**: Repository issues and discussions
- **Documentation**: This wiki
- **Code Reviews**: Pull request reviews

### Getting Help

If you get stuck or have questions:

1. **Check Documentation**: Start with this guide and linked docs
2. **Search Issues**: Check GitHub issues for similar problems
3. **Ask Team**: Post in #biopoint-dev Slack channel
4. **Office Hours**: Weekly dev team meetings
5. **Code Review**: Create a draft PR for early feedback

---

**Welcome to the team! We're excited to have you contribute to BioPoint. 🎉**

*This guide is a living document. Please suggest improvements and updates as you go through your onboarding process.*