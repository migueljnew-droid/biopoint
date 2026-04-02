<p align="center">
  <img src="public/icon.png" alt="BioPoint" width="80" />
</p>

<h1 align="center">BioPoint Web Dashboard</h1>

<p align="center">
  <strong>Your Biohacking Command Center — Web Edition</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Zustand-4-443E38" alt="Zustand" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel" alt="Vercel" />
</p>

---

Web companion to the **BioPoint iOS app**. Track supplement stacks, analyze lab reports with AI, chat with The Oracle, and monitor your BioPoint Score.

<details>
<summary><strong>Stack</strong></summary>

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Framer Motion |
| State | Zustand |
| Styling | Tailwind CSS 4 + Gold Standard Design System |
| API Client | Axios with JWT auto-refresh interceptor |
| Charts | Recharts |
| Icons | Lucide React |
| Fonts | Satoshi + General Sans + JetBrains Mono |

</details>

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | BioPoint API base URL (e.g. `https://biopoint-api.onrender.com/api`) |

<details>
<summary><strong>Auth Flow</strong></summary>

- **Access token**: in-memory only (not persisted — cleared on page refresh)
- **Refresh token**: `localStorage` key `bp_refresh`
- 401 responses trigger silent token refresh with request queue
- Failed refresh redirects to `/login`

</details>

## Routes

| Path | Description |
|------|-------------|
| `/login` | Login / Register |
| `/dashboard` | BioPoint Score, metrics, today's stack |
| `/stacks` | Supplement & peptide protocol management |
| `/labs` | Upload & analyze lab reports (AI-powered) |
| `/oracle` | AI health chat (Gemini-powered) |

## Deployment

Live at **[app.biopointapp.com](https://app.biopointapp.com)**. Deployed on Vercel.

```bash
npm run build
```

---

<p align="center">
  <sub>Built by <strong>GoldenMind Enterprize LLC</strong></sub>
</p>
