# SPEC-WEB-001: BioPoint Web Dashboard
## GENESIS UI/UX Gold Standard Spec

---

## Vision
A dark, immersive health intelligence dashboard that feels like a mission control for your biology. Not a health app — a **command center**. Think Bloomberg Terminal meets Whoop meets a $30K agency portfolio. When someone opens biopointapp.com, they should feel like they just gained access to something exclusive.

---

## Design Direction

**Tone:** Clinical luxury. Precision science meets dark elegance.
**Not:** Generic SaaS. Not a fitness app. Not pastel wellness.
**One thing to remember:** The glowing teal data on deep black, like biomarkers on a medical-grade display.

### The Gold Standard Test
"Would this feel out of place next to a $50K biohacking lab setup?" If yes, push harder.

---

## Design System

### Color Palette (Dark OLED + Teal Accent)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0A0A0F` | Main background (matches mobile) |
| `--bg-elevated` | `#12121A` | Cards, panels |
| `--bg-surface` | `#1A1A25` | Inputs, hover states |
| `--glass` | `rgba(255,255,255,0.04)` | Glass card fill |
| `--glass-border` | `rgba(255,255,255,0.08)` | Glass card border |
| `--accent` | `#22D3EE` | Primary accent (cyan/teal) |
| `--accent-glow` | `rgba(34,211,238,0.15)` | Glow effects |
| `--success` | `#10B981` | In range, positive |
| `--error` | `#EF4444` | Out of range, negative |
| `--warning` | `#F59E0B` | Amber alerts |
| `--text-primary` | `#F1F5F9` | Headings, primary text |
| `--text-secondary` | `#94A3B8` | Body text |
| `--text-muted` | `#64748B` | Labels, captions |

### Typography

**BANNED:** Inter, Roboto, Arial, system fonts.

| Role | Font | Weight | Source |
|------|------|--------|--------|
| Display / H1 | **Satoshi** | 700-900 | [Fontshare](https://fontshare.com) |
| Headings / H2-H4 | **Satoshi** | 500-700 | Fontshare |
| Body | **General Sans** | 400-500 | Fontshare |
| Mono / Data | **JetBrains Mono** | 400-500 | Google Fonts |

**Why Satoshi:** Geometric precision with personality. Feels technical without being cold. Perfect for a biohacking brand — clinical but human.

**Why JetBrains Mono:** Biomarker values, lab data, and the Oracle chat need a mono font that looks intentional, not like a code editor accident.

### Spacing System
```
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px
--space-2xl: 48px
--space-3xl: 64px
--space-4xl: 96px
```

### Border Radius
```
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 24px
--radius-full: 9999px
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 14** (App Router) | SSR, file routing, Vercel-native |
| Styling | **Tailwind CSS** | Utility-first, dark mode built-in |
| Motion | **Framer Motion** | React-native animation library, GPU-accelerated |
| Charts | **Recharts** | Composable, dark-theme friendly, React-native |
| Icons | **Lucide React** | Consistent with mobile, 1000+ icons |
| State | **Zustand** | Same as mobile — shared patterns |
| Auth | **JWT + httpOnly cookies** | Secure web auth (no localStorage tokens) |
| Forms | **React Hook Form + Zod** | Type-safe validation |
| Deploy | **Vercel** | biopointapp.com, auto-SSL, edge |

---

## Techniques (from Gold Standard Engine)

### Must-Have (Phase 1)
| # | Technique | Where |
|---|-----------|-------|
| T1 | Lenis smooth scroll | Global |
| T21 | Button micro-interactions (sweep, lift) | All CTAs |
| T23 | Card hover effects (3D tilt, spotlight glow) | Dashboard cards, stack cards |
| T25 | Toast notifications (slide-in, auto-dismiss) | Actions feedback |
| T27 | Skeleton loading (shimmer) | All data-fetching states |
| T31 | Cursor-tracking element glow | Hero section, score card |

### Phase 2+
| # | Technique | Where |
|---|-----------|-------|
| T2 | Text splitting animations | Page headings on route change |
| T13 | Marquee/infinite scroll | Biomarker ticker strip |
| T14 | CSS Scroll-Driven Animations | Trend charts parallax |
| T15 | View Transitions API | Page-to-page transitions |
| T24 | Navigation choreography | Sidebar collapse/expand |

---

## Component Architecture

### Layout
```
AppShell
├── Sidebar (collapsible, 240px → 64px)
│   ├── Logo
│   ├── NavItem: Dashboard
│   ├── NavItem: Stacks
│   ├── NavItem: Labs
│   ├── NavItem: Fasting
│   ├── NavItem: Oracle
│   ├── NavItem: Daily Log
│   ├── NavItem: Progress
│   ├── NavItem: Community
│   └── UserMenu (bottom)
├── TopBar (search, notifications, profile)
└── MainContent (scrollable, max-w-7xl)
```

### Core Components
| Component | Description |
|-----------|-------------|
| `GlassCard` | Frosted glass card matching mobile GlassView. `bg-white/[0.04]`, `backdrop-blur-xl`, `border border-white/[0.08]`, `rounded-xl` |
| `MetricCard` | Score/stat display with large number, label, trend indicator, optional sparkline |
| `DataTable` | Sortable table with glass rows, sticky header, inline actions |
| `ChartCard` | GlassCard wrapper for Recharts with consistent axis styling |
| `StatusBadge` | IN RANGE (green), OUT OF RANGE (red), NORMAL pill badges |
| `StackCard` | Protocol card with items list, compliance checkmarks, active/inactive toggle |
| `OracleChat` | Chat interface with markdown rendering, typing indicator, message bubbles |
| `BiomarkerRow` | Name + value + unit + ref range + status — consistent across labs & trends |
| `FastingTimer` | Circular progress ring with elapsed time, protocol name, start/stop |
| `ScoreRing` | Large circular gauge (0-100) with animated fill, gradient stroke |

---

## Pages & Routes

```
/                   → Landing page (existing, upgraded)
/login              → Auth page (login/register tabs)
/dashboard          → BioPoint Score, Today's Stack, Quick Stats, Oracle card
/stacks             → All stacks, create/edit/delete
/stacks/[id]        → Stack detail with items
/labs               → Lab reports list, upload, trends tab
/labs/[id]          → Report detail with markers
/oracle             → Full AI chat interface
/fasting            → Protocol selection, timer, history
/log                → Daily logging form + calendar
/progress           → Progress photos grid + compare
/community          → Posts, shared stacks (Phase 5)
/settings           → Profile, password, export, delete
```

---

## Phase Breakdown

### Phase 1: Foundation + Auth + Dashboard + Stacks
**Goal:** Users can log in, see their score, and manage stacks.

| Task | Description |
|------|-------------|
| 1.1 | Next.js 14 project scaffold (App Router, Tailwind, Framer Motion, Zustand) |
| 1.2 | Design tokens (CSS variables, Tailwind config, Satoshi + General Sans + JetBrains Mono) |
| 1.3 | AppShell layout (Sidebar + TopBar + MainContent) |
| 1.4 | GlassCard, MetricCard, StatusBadge, StackCard components |
| 1.5 | Auth pages (login/register with JWT, httpOnly cookies, refresh rotation) |
| 1.6 | Dashboard page (ScoreRing, trend chart, Today's Stack, quick stats) |
| 1.7 | Stacks page (list all, create modal, edit/delete, mark taken) |
| 1.8 | Skeleton loading states for all pages |
| 1.9 | Lenis smooth scroll + button micro-interactions + card hover effects |
| 1.10 | Deploy to Vercel at biopointapp.com |

### Phase 2: Labs + Biomarkers + Oracle
**Goal:** Full lab analysis and AI chat on web.

| Task | Description |
|------|-------------|
| 2.1 | Labs page (report list, drag-drop upload, analyze button) |
| 2.2 | Trends tab with Recharts line charts, biomarker history tables |
| 2.3 | Analysis modal (markers with values, flags, insights) |
| 2.4 | Oracle chat page (message input, streaming-style response, markdown) |
| 2.5 | Biomarker ticker strip (marquee of latest values) |

### Phase 3: Fasting + Daily Logs + Nutrition
**Goal:** Complete daily tracking experience.

| Task | Description |
|------|-------------|
| 3.1 | Fasting page (protocol cards, circular timer, history/streaks) |
| 3.2 | Daily Log page (form with sliders, calendar heatmap) |
| 3.3 | Nutrition page (food log, AI photo analysis) |
| 3.4 | Correlation insights (what's working panel) |

### Phase 4: Settings + Profile + Polish
**Goal:** Account management and visual polish.

| Task | Description |
|------|-------------|
| 4.1 | Settings page (profile edit, password change) |
| 4.2 | Data export (GDPR download) |
| 4.3 | Account deletion flow |
| 4.4 | View Transitions API (page-to-page) |
| 4.5 | Text splitting animations on headings |
| 4.6 | Performance optimization (Lighthouse 90+) |

### Phase 5: Community + Sharing
**Goal:** Social features.

| Task | Description |
|------|-------------|
| 5.1 | Community feed (posts) |
| 5.2 | Shared stacks (public links) |
| 5.3 | User profiles |

---

## Signature Moments (What Makes It Memorable)

1. **ScoreRing animation** — On dashboard load, the BioPoint Score ring fills up from 0 to current value with a teal gradient stroke and a subtle glow pulse. Takes 1.2s. This is the first thing users see.

2. **Biomarker ticker** — A horizontal marquee strip below the header showing latest biomarker values scrolling: "HEMOGLOBIN 16.6 g/dL ✓ • HEMATOCRIT 49.7% ✓ • WBC 3.9 K/uL ✓". Teal values, green checkmarks.

3. **Oracle typing effect** — When The Oracle responds, text appears with a subtle per-character reveal (not word-by-word). The AI icon pulses with a teal glow while generating.

4. **Glass depth** — Cards have 3 depth levels: surface (subtle), elevated (medium blur), and floating (heavy blur + shadow). Consistent across all pages.

5. **Cursor glow** — On the dashboard, a subtle radial gradient follows the cursor, illuminating nearby cards slightly. Disabled on mobile.

---

## API Compatibility
Zero backend changes. All endpoints already exist and are documented in the mobile app's service layer. Web uses identical JWT auth flow with httpOnly cookies instead of SecureStore.

---

## Success Criteria
- [ ] Users sign in with same credentials as mobile
- [ ] All data syncs real-time (same API, same DB)
- [ ] Stacks created on web appear on mobile instantly
- [ ] Lab analysis works (drag & drop upload → AI → markers)
- [ ] Oracle chat works with real health data
- [ ] Lighthouse Performance > 90
- [ ] Responsive: 375px → 2560px
- [ ] Passes Gold Standard pre-delivery checklist
- [ ] At least 3 signature moments implemented
- [ ] Typography is Satoshi/General Sans (not Inter/Roboto)
