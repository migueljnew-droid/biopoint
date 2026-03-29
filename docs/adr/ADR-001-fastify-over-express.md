# ADR-001: Fastify vs Express for API Framework

## Status
Accepted

## Date
2024-01-15

## Context

When starting the BioPoint project, we needed to choose a web framework for our REST API. The main contenders were Express.js (the most popular Node.js framework) and Fastify (a newer, performance-focused framework).

### Requirements
- High performance with low overhead
- Strong TypeScript support
- Built-in validation and serialization
- Good plugin ecosystem
- Active development and community support
- Easy testing capabilities

## Decision

We chose **Fastify** as our API framework.

### Reasons for Choosing Fastify

1. **Superior Performance**: Fastify provides 2-3x better performance than Express with lower memory usage
2. **Built-in Validation**: Schema-based validation using JSON Schema
3. **TypeScript First**: Excellent TypeScript support out of the box
4. **Modern Architecture**: Plugin-based architecture that's more maintainable
5. **Built-in Serialization**: Automatic response serialization based on schemas
6. **Active Development**: Regular updates and improvements

### Implementation

```typescript
// server.ts
import Fastify from 'fastify';
import { config } from './config';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  },
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      useDefaults: true,
      coerceTypes: true,
    },
  },
});

// Register plugins
await app.register(helmet);
await app.register(cors, { origin: config.CORS_ORIGIN });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Register routes
await app.register(authRoutes, { prefix: '/auth' });
await app.register(userRoutes, { prefix: '/users' });
```

### Schema Validation

```typescript
// schemas/auth.ts
export const LoginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        user: UserResponseSchema,
        tokens: TokenResponseSchema,
      },
    },
  },
};

// routes/auth.ts
app.post('/login', { schema: LoginSchema }, async (request, reply) => {
  const { email, password } = request.body;
  // ... authentication logic
});
```

## Consequences

### Positive
- **Better Performance**: API response times improved by ~40%
- **Type Safety**: Full TypeScript support with compile-time checking
- **Automatic Validation**: Request/response validation without manual checks
- **Reduced Boilerplate**: Less code needed for common tasks
- **Better Testing**: Easier to test with built-in utilities

### Negative
- **Learning Curve**: Team needed to learn Fastify-specific patterns
- **Smaller Ecosystem**: Fewer community plugins compared to Express
- **Migration Effort**: Existing Express knowledge not directly transferable
- **Documentation**: Less comprehensive documentation than Express

### Migration Path

If we ever need to migrate away from Fastify:
1. Abstract framework-specific code into adapters
2. Maintain clear separation between business logic and HTTP handling
3. Use dependency injection for framework services
4. Keep validation schemas framework-agnostic

## Alternatives Considered

### Express.js
**Pros:**
- Most popular Node.js framework
- Huge ecosystem of middleware
- Extensive documentation
- Large community support

**Cons:**
- Slower performance
- Manual validation required
- Limited TypeScript support
- Older architecture

### Koa.js
**Pros:**
- Modern async/await support
- Lightweight and flexible
- Good performance

**Cons:**
- Smaller ecosystem than Express
- Less mature than Fastify
- More boilerplate required

### NestJS
**Pros:**
- Full-featured framework
- Excellent TypeScript support
- Built-in dependency injection

**Cons:**
- Heavy framework with learning curve
- Overkill for our use case
- More complex than needed

## References

- [Fastify Documentation](https://www.fastify.io/docs/)
- [Fastify vs Express Performance Benchmark](https://github.com/fastify/benchmarks)
- [TypeScript Support in Fastify](https://www.fastify.io/docs/latest/Reference/TypeScript/)
- [JSON Schema Validation](https://json-schema.org/)

## Decision Makers

- **Tech Lead**: Approved technical decision
- **Backend Team**: Consensus on framework choice
- **DevOps Team**: Confirmed deployment compatibility

## Status Update

**2024-03-15**: Successfully implemented and deployed. Performance metrics show 40% improvement in response times. Team productivity increased due to automatic validation and better TypeScript support.

**2024-06-15**: Six months in production. No major issues encountered. Team comfortable with Fastify patterns. Considering adoption of additional Fastify plugins for monitoring and logging.