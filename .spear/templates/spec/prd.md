---
title: "[Product/Feature Name]"
version: "0.1.0"
status: draft # draft | review | approved | superseded
author: "[Your Name]"
date: "YYYY-MM-DD"
epic: "[EPIC-ID]"
---

# Product Requirements Document: [Product/Feature Name]

## Overview

[1-2 paragraph high-level description of what this product/feature is and why it matters. Write for someone with zero context.]

## Problem Statement

[What specific problem does this solve? Who experiences it? What is the cost of not solving it?]

**Current State:** [How things work today]
**Desired State:** [How things should work after delivery]

## Goals & Non-Goals

### Goals
1. [Measurable goal with success criteria]
2. [Measurable goal with success criteria]
3. [Measurable goal with success criteria]

### Non-Goals
1. [Explicitly out of scope — prevents scope creep]
2. [Explicitly out of scope]

## User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-001 | [role] | [action] | [benefit] | must-have |
| US-002 | [role] | [action] | [benefit] | should-have |
| US-003 | [role] | [action] | [benefit] | nice-to-have |

## Acceptance Criteria

### US-001: [Story Title]
- [ ] [Given/When/Then or concrete assertion]
- [ ] [Given/When/Then or concrete assertion]
- [ ] [Given/When/Then or concrete assertion]

### US-002: [Story Title]
- [ ] [Given/When/Then or concrete assertion]
- [ ] [Given/When/Then or concrete assertion]

## Technical Constraints

- **Language/Runtime:** [e.g., Rust 1.75+, Node 20 LTS]
- **Platform:** [e.g., Linux x86_64, iOS 16+]
- **Performance:** [e.g., p99 latency < 200ms]
- **Data:** [e.g., Must handle 10K concurrent users]
- **Compliance:** [e.g., GDPR, SOC2, HIPAA]
- **Other:** [Any additional hard constraints]

## Dependencies

| Dependency | Type | Owner | Status | Risk |
|-----------|------|-------|--------|------|
| [Service/Library/Team] | blocks/soft | [who] | [ready/in-progress/unknown] | [low/med/high] |

## Open Questions

| # | Question | Impact if Unresolved | Owner | Due Date |
|---|----------|---------------------|-------|----------|
| 1 | [Question that needs answering] | [What breaks if we guess wrong] | [who] | [date] |
| 2 | [Question that needs answering] | [What breaks if we guess wrong] | [who] | [date] |
