# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LPQ Al-Fath Maulana — Islamic school (TPQ) management system. React SPA with Supabase backend, deployed on Vercel. Indonesian language UI.

Read `AGENTS.md` for operational rules and `AI_DEVELOPMENT_GUIDE.md` for the full development handbook (read only relevant sections per task).

## Commands

```bash
npm run dev        # Vite dev server on port 3000
npm run build      # Generates LLMS metadata then runs vite build
npm run preview    # Preview production build on port 3000
npm run lint       # ESLint (flat config, --quiet)
```

No test framework is configured. Validation is lint + build.

## Architecture

**Stack:** React 18 + Vite 7 + Supabase + Tailwind CSS + shadcn/ui + React Router 6

**Path alias:** `@` → `./src`

**Node version:** 22 (see `.nvmrc`)

### Routing & Roles

Single-page app with `react-router-dom`. Four role-based dashboards:
- `AdminDashboard` — full system management
- `GuruDashboard` — teacher view
- `PentashihDashboard` — Quran assessment reviewer
- `SantriDashboard` — student view

Auth flows through `src/contexts/SupabaseAuthContext.jsx` which loads `user_profiles` to determine role. Protected routes gate on role via `src/components/ProtectedRoute.jsx`.

### Data Layer

- `src/lib/customSupabaseClient.js` — Supabase client with graceful no-config fallback (proxy returns `{ data: null, error }` when env vars missing)
- `src/lib/*Adapters.js` — domain-specific data access (finance, attendance, MMQ, storage, etc.). All Supabase queries go through adapters.
- `src/lib/featureFlags.js` — toggles for edge functions, deferred features, games, backup/restore

### Backend

- Supabase project with 44 migrations in `supabase/migrations/`
- Edge functions in `supabase/functions/` (Deno): auth helpers, signed uploads, login attempts
- RLS policies are migration-managed — never edit deployed migrations, create new ones

### UI System

Design system: "LPQ Aurora Neo-Glass" — frosted glass, aurora teal-cyan-blue-violet palette, neumorphic depth, spring animations. Uses shadcn/ui components in `src/components/ui/`, domain components in `src/components/`.

### Key Directories

```
src/components/dashboard/admin/  — 36 admin management panels
src/components/dashboard/shared/ — shared dashboard widgets
src/contexts/                    — Auth + Theme providers
src/hooks/                       — custom hooks (attendance, search, media)
src/lib/                         — Supabase client, adapters, utilities
src/pages/                       — route-level page components
supabase/migrations/             — ordered SQL migrations
supabase/functions/              — Deno edge functions
tools/                           — build scripts (LLMS generator)
```

## Environment

Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app runs in degraded mode without them (no data, no auth).

## Conventions

- Adapters own all Supabase queries — components don't call `supabase.from()` directly
- Implement features end-to-end: migration → RLS → adapter → validation → UI
- Partial updates for edit forms (don't send full payload)
- Don't hardcode data that should come from Supabase
- Don't disable fields or features just because schema doesn't support them yet — extend the schema
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
