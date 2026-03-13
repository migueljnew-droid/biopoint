---
id: "DEC-001"
type: "decision"
title: "BioPoint ships on Web + iOS + Android"
summary: "Chairman directive: BioPoint must launch on web, iPhone, and Android — not iOS only"
category: "platform"
tags: ["platform", "web", "ios", "android", "expo"]
created: "2026-03-13"
---

# Decision: Multi-Platform Launch

**Chairman directive (March 13, 2026):** BioPoint must ship on web + iOS + Android.

**Impact:**
- Phase 6 (App Store Submission) expands to include Google Play + web deployment
- Expo already supports all 3 platforms — no architecture change needed
- RevenueCat supports iOS + Android (keys already scaffolded)
- Web deployment needs a hosting target (Vercel or static export from Fly.io)
- All current code (calculator, peptide DB, API) works cross-platform

**No code changes required for Phase 1** — Expo React Native components render on all platforms.
