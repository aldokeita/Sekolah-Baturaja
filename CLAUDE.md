# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

School management system with an Indonesian-language UI, deployed on Vercel.

The app is **mid-migration**: it began as a different school-management product and is being converted
into **SDN Baturaja**, a general public elementary school. Legacy data contracts may remain for
compatibility, but current naming and the design system must follow SDN Baturaja.

Read `AGENTS.md` for operational rules, `docs/HANDOFF.md` before continuing migration work (it holds
the binding decisions and known traps), and `AI_DEVELOPMENT_GUIDE.md` as a reference handbook — only
the sections a given task needs.

## Commands

```bash
npm run dev        # Vite dev server on port 3000
npm run build      # tools/build.js — generates LLMS metadata, then vite build
npm run preview    # Preview production build on port 3000
npm run lint       # ESLint (flat config, --quiet)
```

No JS test framework is configured. Validation is `npm run lint` + `npm run build` + the guard
scripts in `scripts/validate-*.ps1`.

Go is **not installed** on the dev machine — Docker is the only way to compile or run the backend:

```bash
cd backend && docker compose up -d --build
```

That builds the Go API on `:8080` and starts PostgreSQL on `:5432` (database `lpq_db`).

## Architecture

**Stack:** React 18 + Vite 7 + Go API + PostgreSQL + Tailwind CSS + shadcn/ui + React Router 6

**Path alias:** `@` → `./src`

**Node version:** 22 (see `.nvmrc`)

### Data layer — goes through the Go backend, not Supabase

There is **no Supabase client in this app.** `@supabase/supabase-js` is not a dependency, and
`src/lib/customSupabaseClient.js` no longer exists. Any doc still describing `supabase.from()` calls
is stale.

- `src/lib/apiClient.js` — the single HTTP client. Centralised JWT handling with automatic refresh.
  `publicFetch` is the unauthenticated variant for public pages; `clearTokens` is logout.
- `src/lib/*Adapters.js` — domain-specific data access (finance, attendance, MMQ, app config,
  storage, …). Components call adapters; adapters call `apiClient`. Never fetch from a component.
- `src/lib/featureFlags.js` — toggles read from `import.meta.env`.

### Backend

- Go API in `backend/`, one handler file per domain in `backend/internal/handler/` (17 files),
  registered in `backend/main.go`.
- **Authorization lives in Go**, not in the database: `backend/internal/middleware/auth.go` provides
  `RequireAuth` (JWT) and `RequireRole`. The pool connects as the `postgres` superuser, so **RLS
  policies do not gate live requests** — treat them as legacy and defence-in-depth, not enforcement.
  Adding a route means adding its role check in Go.
- `backend/internal/handler/appconfig.go` keeps an allowlist, `validConfigKeys`. A new app-config key
  must be added there or writes are rejected.
- Key-value app settings live in the `website_content` table, keyed via
  `APP_CONFIG_KEYS` in `src/lib/appConfigAdapters.js`.

### Database

- 57 ordered SQL migrations in `supabase/migrations/`. The directory name is historical — these are
  applied to local PostgreSQL by `backend/init/01_migrate.sh` during container init.
- Always add a **new** migration; never edit one that has been applied.
- Writing a migration is not applying it. A migration that is only written while code already
  references its columns breaks every login. Apply an individual file with:

  ```powershell
  Get-Content "supabase\migrations\<name>.sql" -Raw |
    docker compose -f backend\docker-compose.yml exec -T db psql -U postgres -d lpq_db
  ```

- Verify a column really landed with `\d <table>` before trusting it.

### Edge functions (dormant)

`supabase/functions/` holds 6 Deno functions (signed uploads, user management, login attempts,
password reset). They are **not on the live path** — the Go API replaced them. Nothing in `src/`
calls them; only the `enableEdgeFunctions` flag references the concept, and it defaults to `false`.

### Routing & roles

Single-page app with `react-router-dom`. **Five** role-based dashboards in
`src/components/dashboard/`, routed by `src/pages/DashboardPage.jsx`:

| Dashboard | Role value | Notes |
|---|---|---|
| `AdminDashboard` | `admin` | Full system management |
| `GuruDashboard` | `guru` | Teacher view |
| `TataUsahaDashboard` | `tata_usaha` | Administrative staff |
| `PentashihDashboard` | `pentashih` | **Labelled "Wakil Kepala Sekolah"** in the UI |
| `SantriDashboard` | `santri` | Student view |

The `'pentashih'` value is deliberately unchanged in the database — only its label is translated, via
`ROLE_LABELS` in `GuruManagement.jsx`. Changing the stored value would break existing data and RLS.

Auth flows through `src/contexts/AuthContext.jsx` (**not** `SupabaseAuthContext.jsx`) and is gated
per-route by `src/components/ProtectedRoute.jsx`.

### UI system

One visual direction, applied with different density for public and back-office contexts:

- **Public site (SDN Baturaja):** `src/components/sdnb/` with `PublicLayout`, `SiteNav`,
  `SiteFooter`, and page bodies in `sdnb/generated/`. Styled by `src/styles/sdnb*.css`.
- **Dashboards:** inherit the same color, typography, and surface system through
  `src/styles/sdnb-dashboard.css`; use solid dark surfaces, quiet dividers, and indigo focus states.
  shadcn/ui primitives stay in `src/components/ui/`.

### Key directories

```
src/components/dashboard/admin/   — 37 admin management panels
src/components/dashboard/shared/  — shared dashboard widgets
src/components/sdnb/              — public SDN Baturaja site (layout, nav, footer, page bodies)
src/components/ui/                — shadcn/ui primitives
src/contexts/                     — AuthContext + ThemeContext
src/hooks/                        — custom hooks (attendance, search, media)
src/lib/                          — apiClient, adapters, feature flags, utilities
src/pages/                        — 19 route-level pages
backend/internal/handler/         — Go API handlers, one per domain
supabase/migrations/              — 57 ordered SQL migrations (applied to local Postgres)
scripts/                          — operational + validation scripts
tools/                            — build scripts (LLMS generator)
```

## Environment

Copy `.env.example` to `.env.local`:

```
VITE_API_URL=http://localhost:8080   # Go backend
VITE_ENABLE_EDGE_FUNCTIONS=false
VITE_ENABLE_DEFERRED_FEATURES=false
VITE_ENABLE_TAHFIZH=false            # optional tahfizh programme
```

There are no `VITE_SUPABASE_*` variables. `VITE_ENABLE_TAHFIZH` gates the Tingkat column, its
history, and the "Metode Mengaji" admin panel; the underlying data stays intact when off.

## Conventions

- Adapters own all API access — components never call `apiClient` or `fetch` directly
- Implement features end-to-end: migration → apply → handler + role check → adapter → validation → UI
- A field counts as done only when it can be created, saved, edited, and survives a refresh
- Partial updates for edit forms (don't send the full payload)
- Don't hardcode data that should come from the API, and don't swap dynamic data for dummy content
- Don't disable a field just because the schema lacks it — extend the schema
- Don't remove or downgrade functionality merely to silence an error
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`

## Agent skills

### Issue tracker

Issues live in this repository's GitHub Issues; use `gh` for operations. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo; use root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Coding-behaviour guidelines

`.claude/skills/karpathy-guidelines/` — think before coding, simplicity first, surgical changes,
goal-driven execution. Project-scoped, so it loads only in this repo. Its closing section maps the
four principles onto this codebase: which validation chain counts as verification (there is no
component test framework), and why `docs/HANDOFF.md` must be read before "fixing" anything that
looks wrong. Upstream is <https://github.com/multica-ai/andrej-karpathy-skills> (MIT).
