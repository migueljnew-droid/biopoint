---
title: "[System/Feature] Architecture"
version: "0.1.0"
status: draft # draft | review | approved | superseded
author: "[Your Name]"
date: "YYYY-MM-DD"
prd_ref: "[PRD filename or ID]"
---

# Architecture: [System/Feature Name]

## System Context

[How does this system fit into the broader landscape? What are its boundaries?]

**Actors:**
- [Actor 1]: [role and interaction pattern]
- [Actor 2]: [role and interaction pattern]

**External Systems:**
- [System A]: [what it provides / consumes]
- [System B]: [what it provides / consumes]

## Component Diagram

```
┌─────────────────────────────────────────────┐
│                  [System Name]               │
│                                              │
│  ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │ [Comp A] │───>│ [Comp B] │───>│[Comp C]│ │
│  └──────────┘    └──────────┘    └────────┘ │
│       │                               │      │
│       v                               v      │
│  ┌──────────┐                   ┌────────┐  │
│  │ [Comp D] │                   │[Comp E]│  │
│  └──────────┘                   └────────┘  │
└─────────────────────────────────────────────┘
        │                               │
        v                               v
   [External A]                    [External B]
```

[Brief description of each component's responsibility.]

## Data Flow

### [Primary Flow Name]
1. [Actor/System] sends [what] to [Component A]
2. [Component A] validates and forwards to [Component B]
3. [Component B] persists to [Store] and emits [Event]
4. [Component C] consumes [Event] and [action]

### [Secondary Flow Name]
1. [Step-by-step as above]

## API Contracts

### [Endpoint/Interface 1]
- **Method:** `[GET/POST/gRPC/event]`
- **Path:** `[/api/v1/resource]`
- **Request:**
  ```json
  {
    "field": "[type] — [description]"
  }
  ```
- **Response (success):**
  ```json
  {
    "field": "[type] — [description]"
  }
  ```
- **Error codes:** `[400, 404, 500 — when each occurs]`

### [Endpoint/Interface 2]
[Same structure as above]

## Technology Choices

| Choice | Selected | Alternatives Considered | Rationale |
|--------|----------|------------------------|-----------|
| Language | [e.g., Rust] | [Go, TypeScript] | [Why this wins for this use case] |
| Database | [e.g., PostgreSQL] | [SQLite, DynamoDB] | [Why this wins] |
| Queue | [e.g., NATS] | [RabbitMQ, Kafka] | [Why this wins] |
| Framework | [e.g., Axum] | [Actix, Warp] | [Why this wins] |

## Security Considerations

- **Authentication:** [How users/services prove identity]
- **Authorization:** [How permissions are enforced]
- **Data at rest:** [Encryption approach]
- **Data in transit:** [TLS, mTLS, etc.]
- **Secrets management:** [How secrets are stored and rotated]
- **Attack surface:** [Known exposure points and mitigations]

## Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Latency (p50) | [e.g., < 50ms] | [e.g., OpenTelemetry traces] |
| Latency (p99) | [e.g., < 200ms] | [e.g., OpenTelemetry traces] |
| Throughput | [e.g., 1K req/s] | [e.g., Load test with k6] |
| Memory | [e.g., < 256MB RSS] | [e.g., Prometheus metrics] |
| Startup | [e.g., < 2s] | [e.g., Time-to-first-request] |

## Memory References

[Link to past architectural decisions, ADRs, or retrospectives that informed this design.]

- [Decision/context]: [link or file path]
- [Decision/context]: [link or file path]

> If no prior context exists, state: "Greenfield — no prior decisions to reference."
