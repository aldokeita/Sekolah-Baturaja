# Auth Migration Spec — Supabase Auth → Self-Hosted Go JWT

Purpose: complete map of how the React SPA (`/Users/dk/Dev/Sekolah-Baturaja`) uses
Supabase Auth today, so the Go replacement (bcrypt + own access/refresh JWTs) covers
every real usage and nothing breaks at cutover.

Scope of what Supabase Auth currently provides:

- Password auth (`signInWithPassword`) for staff (admin / guru / pentashih) via email.
- Custom student login by **Nomor Induk Qiroati** (student ID number, not email) via an Edge Function.
- Session persistence + silent token refresh in the browser (localStorage-based).
- JWT access tokens attached as `Authorization: Bearer` to Edge Function calls.
- Server-side admin operations (create/update/deactivate/archive users, reset passwords)
  using the Supabase **service role** key inside Edge Functions.
- `auth.users` (Supabase-managed) as the identity table, joined 1:1 to app `user_profiles`.

---

## 1. Current Auth Flows

### 1.1 Auth core — `src/contexts/SupabaseAuthContext.jsx`

React context (`AuthProvider` + `useAuth`) that owns all auth state.

State: `user`, `session`, `profile`, `role`, `loading`, `profileLoading`, plus a
`userIdRef` (ref) used to avoid stale-closure bugs in `onAuthStateChange`.

**Session load / persistence (mount, lines 83–137):**
- If Supabase not configured → `clearAuthState()` and stop.
- On mount: `supabase.auth.getSession()` reads the persisted session (localStorage), then
  `handleSession()` runs.
- Subscribes to `supabase.auth.onAuthStateChange`:
  - `TOKEN_REFRESHED` / `INITIAL_SESSION` → update `session`+`user` only, **no** profile
    re-fetch (avoids spinner flash on tab-return / auto-refresh).
  - `SIGNED_IN` where the incoming user id equals `userIdRef.current` → session/user update
    only (tab-return recovery).
  - Otherwise → full `handleSession()`.
- Persistence is delegated to the Supabase client (`persistSession: true`,
  `autoRefreshToken: true`, `detectSessionInUrl: true` in `customSupabaseClient.js`).

**Profile + role resolution (`loadUserProfile`, lines 30–56):**
- Queries `user_profiles` (`id, role, display_name, status`) by user id via `.maybeSingle()`.
- Throws if no profile ("Profil akun belum tersedia") or `status !== 'active'`
  ("Akun belum aktif").
- Sets `profile` + `role`; sets `userIdRef.current`.
- `handleSession` (58–81) wraps: sets session/user, then loads profile if a user exists;
  always clears `loading` in `finally`.

**Login paths:**
- `signIn(email, password)` (167–199): direct `signInWithPassword`, then `handleSession`.
- `signInWithUsername(rawUsername, rawPassword)` (201–275) — **the real login used by the
  UI**. Branches on whether the input matches an email regex:
  - Email → `signInWithPassword` (staff), then `handleSession`.
  - Non-email → requires `enableEdgeFunctions`; invokes Edge Function
    `signin-with-nomor-induk`, receives `{ access_token, refresh_token }`, then calls
    `supabase.auth.setSession(...)` to hydrate the browser session, then `handleSession`.
- `signUp(email, password, options)` (139–165): thin wrapper over `supabase.auth.signUp`.
  Not wired into any user-facing flow (users are created by admins via `manage-user`).

**Logout (`signOut`, 277–296):** `supabase.auth.signOut()` then `clearAuthState()`
(clears local state even if the network signout errors).

**Context surface (`value`, 298–310):** `user`, `session`, `profile`, `role`, `loading`,
`profileLoading`, `signUp`, `signIn`, `signInWithUsername`, `signOut`, `refreshProfile`.

### 1.2 Route gating — `src/components/ProtectedRoute.jsx`

Consumes `useAuth()` → `{ user, loading, profileLoading, role }`. Gates on `allowedRoles`.
Notable behavior: once authorized (`hasAuthorized` ref), background profile refreshes and
transient "no user" do **not** unmount children or bounce to `/login` — prevents
mid-session flicker. Redirects unauthorized to `/login`, forbidden-role to `/dashboard`.
**Go parity note:** role gating is client-side UX only; the server (Go API) must enforce
role on every protected endpoint.

### 1.3 Login page — `src/pages/LoginPage.jsx`

Calls `signInWithUsername(username, password)` (line 183). Wraps `recordLoginAttempt`
(line 84) to log success/failure with device info. Uses `LOGIN_SECURITY_CONSENT_KEY`
for a one-time security notice.

### 1.4 Degraded mode — `src/lib/customSupabaseClient.js`

When env vars are missing, `createUnconfiguredClient()` returns stubs for every
`auth.*` method (getSession → null session, signInWithPassword → error, etc.). Go client
wrapper must preserve the same graceful "not configured" contract so the app still boots.

---

## 2. Full Inventory of Auth Call Sites

`supabase.auth.*` and directly-related identity calls across `src/`.

| # | File | Line(s) | Call | Purpose |
|---|------|---------|------|---------|
| 1 | contexts/SupabaseAuthContext.jsx | 94 | `auth.getSession()` | Initial session load on mount |
| 2 | contexts/SupabaseAuthContext.jsx | 105 | `auth.onAuthStateChange()` | Subscribe to auth events (refresh, sign-in, sign-out) |
| 3 | contexts/SupabaseAuthContext.jsx | 150 | `auth.signUp()` | Email sign-up wrapper (not user-facing) |
| 4 | contexts/SupabaseAuthContext.jsx | 178 | `auth.signInWithPassword()` | `signIn()` staff email login |
| 5 | contexts/SupabaseAuthContext.jsx | 217 | `auth.signInWithPassword()` | `signInWithUsername()` staff email branch |
| 6 | contexts/SupabaseAuthContext.jsx | 239 | `functions.invoke('signin-with-nomor-induk')` | Student ID login (Edge Function) |
| 7 | contexts/SupabaseAuthContext.jsx | 254 | `auth.setSession()` | Hydrate browser session from student-login tokens |
| 8 | contexts/SupabaseAuthContext.jsx | 279 | `auth.signOut()` | Logout |
| 9 | components/Navbar.jsx | 95, 139 | `useAuth().signOut()` | Logout trigger in nav |
| 10 | hooks/useAuthSession.js | 10 | `auth.getSession()` | Read session for validity check |
| 11 | hooks/useAuthSession.js | 31 | `auth.refreshSession()` | Manual refresh when token expires < 60s |
| 12 | hooks/useMediaPlayer.js | 41 | `auth.getUser()` | Get current user id to load media settings |
| 13 | lib/storageAdapters.js | 158, 161 | `auth.getSession()` → `access_token` | Bearer token for signed-upload Edge Function |
| 14 | lib/edgeFunctionAdapters.js | 22, 24 | `auth.getSession()` → `access_token` | Bearer token for generic authenticated Edge Function calls |
| 15 | lib/loginSecurityAdapters.js | 22, 23 | `auth.getSession()` → `access_token` | Optional Bearer for `record-login-attempt` (success only) |
| 16 | lib/whatsappGroupLinksAdapters.js | 61 | `auth.getUser()` | Get user id for `updated_by` audit field |
| 17 | utils/diagnosticSantriDataFlow.js | 8, 144, 145 | `auth.getSession()` → `access_token` | Diagnostic tooling; reads token |
| 18 | verify_mmq_policies.js | 18 | `auth.getSession()` | RLS/policy verification script |
| 19 | lib/customSupabaseClient.js | 58–64 | stub `auth.*` | Degraded-mode no-config fallbacks |

Edge Function invocations that depend on the Bearer token (server enforces auth):

| File | Line(s) | Function | Purpose |
|------|---------|----------|---------|
| components/dashboard/admin/GuruManagement.jsx | 109, 278, 292 | `manage-user` | Create/update/deactivate guru accounts |
| components/dashboard/admin/SantriManagement.jsx | 794, 846 | `manage-user` | Create/update santri accounts |
| components/dashboard/admin/SantriDewasaManagement.jsx | 483, 495 | `manage-user` | Create/update adult-santri accounts |
| lib/santriArchiveAdapters.js | 68 | `manage-user` | Archive/restore santri |
| components/dashboard/admin/BackupRestoreManagement.jsx | 355 | `auth.signInWithPassword()` | Re-auth (password confirm) before backup/restore |
| components/dashboard/admin/BackupRestoreManagement.jsx | 395, 548 | `backup-database` / `restore-database` | DB backup/restore (edge fns not in scope of this audit dir) |

Auth-token-attaching helpers (the JWT read/attach layer): `edgeFunctionAdapters.js`,
`storageAdapters.js`, `loginSecurityAdapters.js` — all read `session.access_token` and set
`Authorization: Bearer <token>` + `apikey: <anon key>`.

**Count:** ~19 distinct `supabase.auth.*` call sites in `src/` (excluding the stub file:
~18 live), plus ~7 Edge Function invocation sites that rely on the access token, plus one
`signInWithPassword` used for re-auth confirmation in Backup/Restore.

---

## 3. Edge Function Responsibilities (and required Go equivalents)

All functions share helpers in `supabase/functions/_shared/`:
- `cors.ts` — origin allowlist (localhost plus `ALLOWED_ORIGINS`), preflight. The `*.vercel.app`
  wildcard that used to be here is gone: this project does not use Vercel, and a pattern that wide
  granted CORS to anyone who could publish on that domain.
- `response.ts` — envelope `{ ok: true, data }` / `{ ok: false, error: { code, message } }`.
- `auth.ts` `getUserFromRequest(req)` — reads `Authorization` header, validates the token
  via service-role `auth.getUser(token)`, returns the user.
- `roles.ts` — `getUserRole`, `requireRole` (throws `FORBIDDEN`), `isGuruForSantri`
  (checks `class_memberships` → `classes.id_guru`). Role read from `user_profiles`, requires
  `status === 'active'`.
- `supabaseAdmin.ts` — service-role and anon clients from env.
- `validation.ts` — `normalizeNomorInduk`, `requireString`, `validateRole`, upload validators.
- `rateLimit.ts` — `consumePersistentRateLimit` → RPC `consume_auth_rate_limit`
  (IP + alias hashed via SHA-256; default 5 attempts / 300s window / 900s block).
- `safeLogger.ts` — redacts password/token/access_token/refresh_token/internal_email;
  `maskIdentifier` masks middle of identifiers; `requestId`.

### 3.1 `signin-with-nomor-induk` (student login) — see §4 (special)

### 3.2 `manage-user` (18.9K, largest)
Admin-only (`requireRole(['admin'])`). Actions: `create | update | deactivate | archive | restore`.
- **create:** builds an auth user via service-role `auth.admin.createUser`. Staff use their
  real email; santri get a placeholder `pending+<uuid>@auth.lpqalfathmaulana.local`, then are
  rewritten to `santri+<userId>@auth.lpqalfathmaulana.local`. Inserts `user_profiles`, then
  `santri` or `guru` row. For santri with a nomor induk, inserts an `auth_login_aliases` row
  (`alias_type='nomor_induk_qiroati'`, `internal_email`, `is_active`). Rolls back the auth user
  on any downstream insert failure. Enforces unique nomor induk.
- **update (santri):** partial field updates; if nomor induk changes, syncs the auth-user
  **password to the nomor induk** (`updateUserById({ password })`), upserts the alias, and
  checks for duplicates. Also mirrors display_name/phone/status into `user_profiles`.
- **update (guru/staff):** updates auth email + `user_metadata` (role, display_name), then
  RPC `update_guru_account`; rolls back the auth email/metadata on failure.
- **deactivate:** sets `user_profiles.status='inactive'` + bans auth user (`ban_duration=876000h`).
- **archive/restore (santri only):** bans/unbans auth user + RPC `set_santri_archive_state`.
- Protects the official admin (`admin@lpqalfathmaulana.id`) from modification.

**Go equivalent must:** provide an admin-only user-management endpoint that (a) hashes an
initial/updated password with bcrypt into the app's own users table, (b) creates
`user_profiles` + `santri`/`guru` rows transactionally with rollback, (c) manages the
`auth_login_aliases` (nomor-induk → internal identity) mapping incl. uniqueness, (d) supports
soft states equivalent to Supabase ban: `deactivate` (inactive), `archive`/`restore`
(revoke/allow login) — replacing `ban_duration`, and (e) keeps the santri
password-in-sync-with-nomor-induk behavior (or redesigns it — see risks).

### 3.3 `reset-user-password` (1.9K)
Admin-only. Validates `new_password` ≥ 8 chars, then service-role
`auth.admin.updateUserById(targetUserId, { password })`.
**Go:** admin endpoint that bcrypt-hashes the new password and writes it to the user record;
same min-length validation; role check.

### 3.4 `record-login-attempt` (3.7K)
Public (no auth required for failures). Rate-limited via RPC `consume_auth_rate_limit`
(30/300s). On `status==='success'` and a Bearer header present, resolves user id + role via
service-role `auth.getUser(token)` + `user_profiles`. Inserts a `login_logs` row (username,
status, IP, city/country from Cloudflare headers, device, user agent).
**Go:** login-audit endpoint; must accept optional Bearer to attribute successful logins;
keep IP/geo header extraction and rate limiting; write to `login_logs`.

### 3.5 `generate-signed-upload-url` (2.6K)
Requires a valid session (`getUserFromRequest`) + a role. Authorizes by bucket/path:
admins anything; `avatars` self-paths for guru/pentashih/santri; guru for their own santri
(`isGuruForSantri`); `murojaah-recordings` owner-only. Returns a Supabase Storage signed
upload URL (2h expiry).
**Go:** must issue equivalent signed/pre-authorized upload URLs for whatever object store
replaces Supabase Storage, with the same ownership/role authorization checks. This is
storage-coupled, not purely auth — flag for storage migration too.

### 3.6 `_shared` — port every helper above into Go middleware/utilities.

---

## 4. Special: Nomor Induk (Student ID) Login

This is the non-standard flow and the highest-value thing to get right.

**Client side** (`SupabaseAuthContext.signInWithUsername`, lines 233–269):
1. If the username is **not** an email, it is treated as a student credential.
2. Requires `enableEdgeFunctions`; calls `functions.invoke('signin-with-nomor-induk', { username, password })`.
3. Expects `{ ok: true, data: { session: { access_token, refresh_token, ... }, user } }`.
4. Calls `supabase.auth.setSession({ access_token, refresh_token })` to hydrate the browser
   session, then `handleSession()` to load profile/role.

**Server side** (`supabase/functions/signin-with-nomor-induk/index.ts`):
1. Reads `username` (aka `nomor_induk_qiroati`) + `password`. Normalizes; a value with no
   whitespace can be a nomor induk.
2. Rate-limits per IP + identifier (5/300s, 900s block) via `consume_auth_rate_limit`.
3. **Alias lookup (service role):**
   - Direct: `auth_login_aliases` where `alias_type='nomor_induk_qiroati'` and
     `normalized_alias` = the input, `is_active=true`.
   - Fallback (nickname login): if no direct alias, matches `santri.nama_panggilan ILIKE input`
     (limit 25), filters to active santri, then finds their aliases. So a student can log in by
     **either** their nomor induk **or** their nickname.
4. Loads `user_profiles` (role/status) and `santri.nomor_induk_qiroati` for candidates.
5. For each candidate whose profile is `role==='santri'` and `status==='active'`, attempts an
   anon `signInWithPassword({ email: internal_email, password })`.
6. **Self-heal:** if that fails but the supplied password equals the stored (normalized)
   nomor induk, it resets the auth user's password to that value
   (`admin.updateUserById({ password })`) and retries. (Legacy accounts where the auth password
   drifted from the nomor induk get repaired on login.)
7. On success returns the session tokens + `{ user: { id, role: 'santri' } }`. All failures
   return a generic `INVALID_LOGIN` ("Username santri atau password salah.").

**Identity model:** santri have no real email. A synthetic `internal_email`
(`santri+<userId>@auth.lpqalfathmaulana.local`) is the auth identity; the nomor induk (and
nickname) map to it through `auth_login_aliases`. The nomor induk doubles as the password by
default.

**Go equivalent must:**
- Accept `{ username, password }`; branch email vs non-email exactly as the client does today
  (or move the branch server-side).
- Resolve the app user by nomor induk **or** nickname against `auth_login_aliases` + `santri`.
- Verify the password with bcrypt against the app user record.
- Enforce role `santri` + active status.
- Return the app's own `{ access_token, refresh_token }` in the same envelope shape
  (`{ ok, data: { session, user } }`) so `signInWithUsername` needs minimal change.
- Keep per-IP + per-identifier rate limiting.
- Decide the fate of the "password == nomor induk" self-heal: with bcrypt there is no drift to
  repair, so this can likely be dropped — but confirm no accounts rely on it at cutover.
- Keep failures generic (no user enumeration).

---

## 5. JWT / Access-Token Read & Attach Points

Where the access token is read from the session and attached to requests:

- `lib/edgeFunctionAdapters.js:18–48` — `invokeAuthenticatedEdgeFunction`: reads
  `session.access_token`, sets `Authorization: Bearer` + `apikey`. Generic path for authed
  Edge Functions.
- `lib/storageAdapters.js:158–189` — `invokeSignedUploadFunction`: same, for
  `generate-signed-upload-url`.
- `lib/loginSecurityAdapters.js:22–23` — attaches Bearer to `record-login-attempt` only on
  success.
- `utils/diagnosticSantriDataFlow.js:144–145` — reads token for diagnostics.

Server-side token validation happens in `_shared/auth.ts` (`getUserFromRequest`) and in
`record-login-attempt` via `admin.auth.getUser(token)`.

**Go parity:** the Go API issues its own signed JWT access token; the client keeps reading
`session.access_token` and attaching `Authorization: Bearer`. The Go middleware validates the
JWT signature/expiry and resolves the user + role (replacing `admin.auth.getUser`). The
`apikey` anon-key header is a Supabase artifact and can be dropped once Edge Functions are
gone.

---

## 6. Supabase-Managed Auth (`auth.users`) vs App `user_profiles`

**Depends on `auth.users` (Supabase-managed) today:**
- Password storage + verification (`signInWithPassword`, `admin.updateUserById({ password })`).
- Access/refresh JWT issuance, expiry, and refresh (`getSession`, `refreshSession`,
  `setSession`, `onAuthStateChange`, autoRefresh).
- Account disable via `ban_duration` (used for deactivate/archive).
- User creation/deletion (`auth.admin.createUser` / `deleteUser`).
- `user_metadata` (role, display_name) mirrored on the auth user (guru update path).
- Synthetic email identities for santri.
- Token → user resolution server-side (`auth.getUser(token)`).

**App-owned tables (survive the migration, referenced by user id = auth user id):**
- `user_profiles` — `id` (= auth user id), `role`, `display_name`, `status`, `email`, `phone`,
  audit fields. **Source of truth for role + active status.**
- `santri` — student records (incl. `nomor_induk_qiroati`, `nama_panggilan`, status "Aktif").
- `guru` — teacher records (incl. `roles[]`, `email`).
- `auth_login_aliases` — nomor induk / nickname → `internal_email` + `auth_user_id` mapping.
- `login_logs` — login audit trail.
- RPCs: `consume_auth_rate_limit`, `set_santri_archive_state`, `update_guru_account`.

**Cutover implication:** the Go system must own everything currently in `auth.users`
(password hashes via bcrypt, its own users table keyed by the same UUIDs, token issue/verify,
disable/ban flags) while continuing to join to the existing `user_profiles`/`santri`/`guru`
tables by user id. Preserving the existing UUIDs is essential — they are foreign keys
throughout the app.

---

## 7. Go JWT Parity Checklist

Authentication:
- [ ] `POST /auth/login` — staff email + password (bcrypt verify) → issue access + refresh JWT.
- [ ] `POST /auth/login` (or same endpoint) — student nomor-induk **or** nickname + password
      (bcrypt verify), role=santri + active check. Same response envelope
      `{ ok, data: { session: { access_token, refresh_token, expires_at, expires_in, token_type }, user } }`.
- [ ] Resolve student identity via `auth_login_aliases` (nomor induk) + `santri.nama_panggilan`
      (nickname) fallback.
- [ ] `POST /auth/refresh` — refresh token → new access token (replaces `refreshSession`,
      `autoRefreshToken`).
- [ ] `POST /auth/logout` — invalidate/rotate refresh token (replaces `signOut`).
- [ ] `GET /auth/session` or `/auth/me` — validate token, return user + profile
      (replaces `getSession` + `user_profiles` fetch).
- [ ] Token validation middleware → user id + role (replaces `_shared/auth.ts` + `roles.ts`),
      requiring `user_profiles.status === 'active'`.

Password / account management (admin, role-gated):
- [ ] User create: bcrypt-hash password, create app user + `user_profiles` + `santri`/`guru`
      transactionally with rollback; manage `auth_login_aliases`; enforce unique nomor induk;
      protect official admin.
- [ ] User update: staff (email/role/display) and santri (fields + nomor-induk alias sync).
- [ ] Password reset (≥ 8 chars) with bcrypt.
- [ ] Deactivate / archive / restore = login-enable flags replacing `ban_duration`;
      keep `set_santri_archive_state` behavior.

Session handling (client):
- [ ] Client keeps reading `session.access_token` and attaching `Authorization: Bearer`
      (edgeFunctionAdapters, storageAdapters, loginSecurityAdapters).
- [ ] Replace `supabase.auth.setSession` after student login with storing the Go-issued tokens
      (localStorage or, preferably, httpOnly cookies — security upgrade).
- [ ] Preserve degraded-mode "not configured" contract (`customSupabaseClient` stub parity).
- [ ] Preserve `onAuthStateChange`-equivalent behavior enough that `ProtectedRoute` does not
      flash the spinner / bounce mid-session (the `userIdRef` / silent-refresh nuance).

Security / operational:
- [ ] Per-IP + per-identifier login rate limiting (port `consume_auth_rate_limit`).
- [ ] Generic error messages on login (no user enumeration).
- [ ] Login audit logging (`login_logs`) with IP/geo/device.
- [ ] Signed upload URL authorization (bucket/path/ownership + `isGuruForSantri`) — coupled to
      storage migration.
- [ ] Redact secrets in logs (port `safeLogger`).
- [ ] Preserve existing user UUIDs (FKs across app).
- [ ] Server-side role enforcement on every protected endpoint (client `ProtectedRoute` is UX only).

Riskiest cutover areas:
1. **Student nomor-induk login** — dual-key (nomor induk OR nickname) lookup + the
   "password == nomor induk" self-heal. Must migrate every santri's password into bcrypt
   hashes (seed from current nomor induk) and confirm no account depends on the drift-repair.
2. **Password migration** — bcrypt hashes must be generated for all existing users; Supabase
   password hashes are not portable. Plan a forced-reset or seed-from-nomor-induk strategy.
3. **Session shape / refresh** — `setSession`, `refreshSession`, `onAuthStateChange` and the
   anti-flicker logic in `ProtectedRoute` must behave equivalently or the UX regresses.
4. **`manage-user` transactional integrity** — multi-table create/rollback and alias
   uniqueness must be preserved to avoid orphaned records.
5. **UUID preservation** — user ids are foreign keys across `user_profiles`, `santri`, `guru`,
   aliases, logs; any id remapping breaks the app.
