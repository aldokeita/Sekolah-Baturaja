# Authorization Specification — LPQ Al-Fath Maulana

Derived from all 44 Supabase migrations. This is the authoritative security spec for porting RLS to a Go+Postgres backend.

---

## 1. Role Model

### Enum: `app_role`

Four roles defined in `public.app_role`:

| Role | Description |
|------|-------------|
| `admin` | Full system access. Exactly one account, locked to `admin@lpqalfathmaulana.id`. Enforced by DB constraint and `current_user_role()` function. |
| `guru` | Teacher. Scoped access to their own classes and students. Can also hold the `pentashih` app_role. |
| `santri` | Student. Read-only access to their own records. |
| `pentashih` | Quran assessor. Access scoped via `pentashih_class_assignments` rows. |

### Source of truth: `user_profiles`

```
user_profiles(id PK -> auth.users.id, role app_role, status account_status)
```

Role is resolved by querying `user_profiles` where `id = <jwt_sub>` AND `status = 'active'`.

For admin, an additional check is required: both `user_profiles.email` and `auth.users.email` must equal `admin@lpqalfathmaulana.id`. This is enforced in `current_user_role()` (migration 20260722000100).

### Helper function semantics

All RLS policies call these `SECURITY DEFINER` helpers. Replicate their logic exactly in Go middleware:

| Supabase function | Logic |
|---|---|
| `current_user_role()` | SELECT role FROM user_profiles WHERE id = jwt_sub AND status = 'active'; for admin also validate both emails match |
| `is_admin()` | current_user_role() = 'admin' |
| `is_guru()` | current_user_role() = 'guru' |
| `is_santri()` | current_user_role() = 'santri' |
| `is_pentashih()` | current_user_role() = 'pentashih' |
| `guru_has_class_access(class_id)` | EXISTS classes WHERE id = class_id AND id_guru = jwt_sub AND deleted_at IS NULL |
| `guru_has_santri_access(santri_id)` | EXISTS class_memberships JOIN classes WHERE santri_id = ? AND membership.status = 'active' AND classes.id_guru = jwt_sub AND classes.deleted_at IS NULL |
| `pentashih_has_class_access(class_id)` | EXISTS pentashih_class_assignments WHERE pentashih_id = jwt_sub AND class_id = ? AND is_active AND scope IN ('class','both') AND date range covers today |
| `pentashih_has_mmq_access(schedule_id)` | EXISTS pentashih_class_assignments WHERE pentashih_id = jwt_sub AND mmq_schedule_id = ? AND is_active AND scope IN ('mmq','both') AND date range covers today |
| `pentashih_has_santri_access(santri_id)` | EXISTS class_memberships WHERE santri_id = ? AND status = 'active' AND pentashih_has_class_access(class_id) |
| `user_owns_santri_record(santri_id)` | jwt_sub = santri_id |
| `is_pentashih_user()` | EXISTS guru WHERE id = jwt_sub AND ('Pentashih' = ANY(roles) OR jabatan ILIKE '%pentashih%') OR jwt.user_metadata.role = 'pentashih' |

### Additional enum: `account_status`
Values: `active`, `inactive`, `suspended`. Only `active` profiles can authenticate.

---

## 2. Per-Table Authorization Rules

### 2.1 `user_profiles`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | any authenticated | own row only (`id = jwt_sub`) |

**Go rule:** Non-admin users can only read their own profile row. Only admin can insert/update/delete any profile.

---

### 2.2 `guru`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Self (`id = jwt_sub`), OR admin, OR santri whose active class is taught by this guru, OR pentashih assigned to a class taught by this guru |
| SELECT | pentashih | `is_pentashih_user()` — full read of all guru rows (migration 20260725000100 adds a broad override) |

**Note:** The latest migration (20260725000100) adds `guru_pentashih_select` policy: any user satisfying `is_pentashih_user()` can read all guru rows unconditionally. This overrides the narrower scope from 0016.

---

### 2.3 `santri`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Self (`id = jwt_sub`), OR guru has santri access (active class taught by jwt_sub), OR pentashih has santri access (via class assignment), OR admin |
| SELECT | pentashih (broad) | `is_pentashih_user()` — full read of all santri rows (migration 20260725000100) |

**Note:** Same broad override added in 20260725000100 via `santri_pentashih_select`. Both the scoped and broad pentashih select policies exist simultaneously; the broad one makes the scoped one redundant for pentashih.

---

### 2.4 `classes`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `id_guru = jwt_sub`, OR pentashih_has_class_access(id), OR santri has active membership in this class |
| SELECT | pentashih (broad) | `is_pentashih_user()` — all classes (migration 20260725000100) |

---

### 2.5 `class_memberships`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR guru_has_class_access(class_id), OR pentashih_has_class_access(class_id) |
| SELECT | pentashih (broad) | `is_pentashih_user()` — all rows (migration 20260725000100) |

---

### 2.6 `class_mutations`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |

---

### 2.7 `pentashih_class_assignments`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `pentashih_id = jwt_sub` (own assignments only) |

---

### 2.8 `attendance`

Two overlapping policies apply. Both must be consulted (Postgres OR logic for permissive policies):

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `user_id = jwt_sub`, OR (class_id IS NOT NULL AND guru_has_class_access(class_id)), OR (class_id IS NOT NULL AND pentashih_has_class_access(class_id)) |
| ALL (insert/update/delete) | authenticated | Admin, OR (class_id IS NOT NULL AND guru_has_class_access(class_id)) |

**Note:** Guru can write attendance for their own classes. Pentashih can only read. Santri can only see their own record.

---

### 2.9 `payments`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always (direct table revoked from anon/authenticated by default; re-granted to authenticated) |
| SELECT | santri | `santri_id = jwt_sub` (own payments only) |

**Note:** `payments` and `expenses` have `REVOKE ALL FROM anon, authenticated` then selectively re-granted. Guru accesses payment data only through the `payment_status_summary` view.

---

### 2.10 `expenses`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |

No other role can access expenses directly.

---

### 2.11 `payment_status_summary` (view, not table)

This is a view with WHERE clause filtering, not table RLS. Logic:

| Who sees rows |
|---|
| Admin: all rows |
| Santri: rows where `santri_id = jwt_sub` |
| Guru: rows where `guru_has_class_access(class_id)` |

In Go: query the underlying tables with the same filter logic rather than the view.

---

### 2.12 `hafalan_items`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | any authenticated | `is_active = true`, OR admin |

---

### 2.13 `hafalan_progress`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |
| INSERT | authenticated | Admin, OR guru_has_santri_access(santri_id) |
| UPDATE | authenticated | Admin, OR guru_has_santri_access(santri_id) |

---

### 2.14 `murojaah_submissions`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR `target_guru_id = jwt_sub`, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |
| INSERT | authenticated | `santri_id = jwt_sub`, OR admin |
| UPDATE | authenticated | Admin, OR `target_guru_id = jwt_sub`, OR guru_has_santri_access(santri_id) |

**Note:** Santri submits their own. The assigned guru (target_guru_id) or any guru with class access can update/review.

---

### 2.15 `academic_calendar`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | anon | `is_public = true` |
| SELECT | authenticated | `is_public = true`, OR admin, OR guru, OR santri, OR pentashih (any logged-in user) |

---

### 2.16 `mmq_schedule`

Final effective policies (0016 base, not overridden by fix_mmq_rls_policies.sql which is a src/ file — not a migration and likely not applied to production):

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR is_guru(), OR pentashih_has_mmq_access(id) |

---

### 2.17 `mmq_attendance`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR `guru_id = jwt_sub`, OR pentashih_has_mmq_access(schedule_id) |
| INSERT | authenticated | Admin, OR `guru_id = jwt_sub` |

---

### 2.18 `mmq_notulensi`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR is_guru(), OR pentashih_has_mmq_access(schedule_id) |
| INSERT | authenticated | Admin, OR EXISTS guru WHERE id = jwt_sub AND is_notulen = true |

---

### 2.19 `website_content`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | anon | `is_public = true` |
| SELECT | authenticated | `is_public = true`, OR admin |

---

### 2.20 `news`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | anon | `status = 'published'` |
| SELECT | authenticated | `status = 'published'`, OR admin |

---

### 2.21 `announcements`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | anon | `status = 'published'` AND (`valid_until IS NULL` OR `valid_until >= today`) |
| SELECT | authenticated | (published AND not expired), OR admin |

---

### 2.22 `feedbacks`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| INSERT | anon | always (open submission) |

No other role reads feedbacks except admin.

---

### 2.23 `notifications`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | `recipient_id = jwt_sub` |
| UPDATE | authenticated | `recipient_id = jwt_sub` (e.g. mark read); new value must also have `recipient_id = jwt_sub` |

---

### 2.24 `santri_notes`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | authenticated | Admin, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |
| INSERT | authenticated | Admin, OR guru_has_santri_access(santri_id) |
| UPDATE | authenticated | Admin, OR guru_has_santri_access(santri_id) |

Santri cannot read their own notes.

---

### 2.25 `login_logs`

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | admin | always |
| DELETE | admin | always |

Direct INSERT is revoked. Logs are written only via the `record_login_attempt()` SECURITY DEFINER function (callable by anon and authenticated), which applies its own rate limiting.

---

### 2.26 `character_assessment_items`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | any authenticated | `is_active = true`, OR admin |

---

### 2.27 `santri_character_scores`

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |
| INSERT | authenticated | Admin, OR guru_has_santri_access(santri_id) |
| UPDATE | authenticated | Admin, OR guru_has_santri_access(santri_id) |

---

### 2.28 `santri_character_strengths`

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | authenticated | Admin, OR `santri_id = jwt_sub`, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id) |
| INSERT | authenticated | Admin, OR guru_has_santri_access(santri_id) |
| UPDATE | authenticated | Admin, OR guru_has_santri_access(santri_id) |
| DELETE | authenticated | Admin, OR guru_has_santri_access(santri_id) |

---

### 2.29 `santri_behavior_records`

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| SELECT | guru | guru_has_santri_access(santri_id) |
| INSERT | guru | guru_has_santri_access(santri_id) |
| UPDATE | guru | guru_has_santri_access(santri_id) |

Santri and pentashih cannot access behavior records.

---

### 2.30 `jilid_history`

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | authenticated | Admin, OR guru_has_santri_access(santri_id), OR pentashih_has_santri_access(santri_id), OR `santri_id = jwt_sub` |
| INSERT | authenticated | (Admin OR guru_has_santri_access(santri_id)) AND `changed_by = jwt_sub` |
| UPDATE | admin | always |
| DELETE | admin | always |
| SELECT | pentashih (broad) | `is_pentashih_user()` — added by migration 20260725000200 |

**Note:** Insert requires both scope access AND that `changed_by` equals the actor. This is an audit-integrity constraint baked into the policy.

---

### 2.31 `whatsapp_group_links`

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | authenticated | Admin, OR is_guru() (migration 20260724000100 expanded from admin-only) |
| INSERT | admin | always |
| UPDATE | admin | always |
| DELETE | admin | always |

---

### 2.32 Storage: `avatars` bucket

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | any authenticated | always (all avatars readable by logged-in users) |
| ALL | admin | always |
| ALL (write) | authenticated | Path must be `santri/<jwt_sub>/profile.webp` OR `guru/<jwt_sub>/profile.webp` (own profile only) |
| ALL | guru | Path pattern `santri/<uuid>/profile.webp` where uuid is a santri in guru's class (`guru_has_santri_access`) |

---

### 2.33 Storage: `website-assets` bucket (public)

| Op | Who | Condition |
|----|-----|-----------|
| SELECT | anon, authenticated | always (public bucket) |
| ALL | admin | always |

---

### 2.34 Storage: `murojaah-recordings` bucket

| Op | Who | Condition |
|----|-----|-----------|
| ALL | admin | always |
| INSERT | authenticated | First path segment must equal `jwt_sub` (own folder) |
| SELECT | authenticated | First path segment = `jwt_sub`, OR guru_has_santri_access(first_segment_as_uuid), OR pentashih_has_santri_access(first_segment_as_uuid), OR admin |

---

### 2.35 `auth_login_aliases`

RLS enabled. `REVOKE ALL FROM anon, authenticated`. Only accessible via `service_role` and the `record_login_attempt` / `set_santri_archive_state` SECURITY DEFINER functions.

---

### 2.36 `auth_rate_limits`

RLS enabled. `REVOKE ALL FROM anon, authenticated`. Writable only via `consume_auth_rate_limit()` SECURITY DEFINER function (callable by service_role only).

---

## 3. Tables With RLS Enabled (complete list)

| Table | RLS |
|-------|-----|
| user_profiles | yes |
| guru | yes |
| santri | yes |
| auth_login_aliases | yes (locked down) |
| auth_rate_limits | yes (locked down) |
| classes | yes |
| class_memberships | yes |
| class_mutations | yes |
| pentashih_class_assignments | yes |
| attendance | yes |
| payments | yes |
| expenses | yes |
| hafalan_items | yes |
| hafalan_progress | yes |
| murojaah_submissions | yes |
| academic_calendar | yes |
| mmq_schedule | yes |
| mmq_attendance | yes |
| mmq_notulensi | yes |
| website_content | yes |
| news | yes |
| announcements | yes |
| feedbacks | yes |
| notifications | yes |
| santri_notes | yes |
| login_logs | yes |
| character_assessment_items | yes |
| santri_character_scores | yes |
| santri_character_strengths | yes |
| santri_behavior_records | yes |
| jilid_history | yes |
| whatsapp_group_links | yes |
| storage.objects | yes (via storage bucket policies) |

---

## 4. Supabase-Specific Function Replacement Guide

### 4.1 `auth.uid()`

Returns the UUID of the currently authenticated user from the JWT.

**Go equivalent:**
```go
// Extract from JWT claims after verification
sub, _ := claims["sub"].(string)
userID, _ := uuid.Parse(sub)
```

In middleware: parse the JWT, extract `sub` claim as UUID, inject into context. All authorization checks use this value.

---

### 4.2 `auth.jwt()`

Returns the full JWT payload as JSONB.

**Go equivalent:**
```go
// Full claims map from JWT middleware
claims := ctx.Value(claimsKey).(jwt.MapClaims)
// Access nested fields:
userMetadata, _ := claims["user_metadata"].(map[string]interface{})
role, _ := userMetadata["role"].(string)
```

Used in `is_pentashih_user()` as a fallback: `auth.jwt() -> 'user_metadata' ->> 'role' = 'pentashih'`. In Go, check `claims["user_metadata"]["role"]`.

---

### 4.3 `auth.role()`

Returns the Postgres role of the current connection (`anon`, `authenticated`, `service_role`).

**Go equivalent:**

In Go there is no equivalent Postgres connection role. Instead:
- Unauthenticated requests = no valid JWT = treat as anonymous
- Authenticated requests = valid JWT with `sub` = treat as authenticated
- Internal service operations = use a separate privileged DB connection or a service token

For the `update_guru_account()` / `set_santri_archive_state()` functions that check `auth.role() = 'service_role'`: these are admin-only RPCs. In Go, guard them with an admin JWT check or a separate internal service credential — never expose them to browser clients.

---

### 4.4 `current_setting('request.headers', true)`

Used in `record_login_attempt()` to read `x-forwarded-for` / `cf-connecting-ip`.

**Go equivalent:**
```go
ip := r.Header.Get("CF-Connecting-IP")
if ip == "" {
    ip = strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]
}
if ip == "" {
    ip = r.RemoteAddr
}
```

Pass as a parameter to the Go function implementing login logging. Do not rely on Postgres headers.

---

### 4.5 `extensions.digest(value, 'sha256')`

Used for IP and alias hashing in `record_login_attempt()` / `consume_auth_rate_limit()`.

**Go equivalent:**
```go
import "crypto/sha256"
import "encoding/hex"

h := sha256.Sum256([]byte(value))
hash := hex.EncodeToString(h[:])
```

---

### 4.6 `now()` / `current_date`

Standard SQL. Use `time.Now().UTC()` in Go; pass as a parameter or use `NOW()` in queries.

---

### 4.7 SECURITY DEFINER functions

All helper functions (`current_user_role`, `is_admin`, `guru_has_class_access`, etc.) are `SECURITY DEFINER`. This means they run as the function owner (superuser), bypassing RLS themselves, and see all rows.

**Go equivalent:** In Go middleware, implement these as plain functions that query the DB with a privileged connection (or no RLS context). They are not subject to the policies being enforced — they are the enforcement layer.

---

### 4.8 `is_pentashih_user()` vs `is_pentashih()`

Two overlapping checks exist:

- `is_pentashih()` (0015): checks `user_profiles.role = 'pentashih'`
- `is_pentashih_user()` (0025): checks `guru.roles` array OR `guru.jabatan` ILIKE '%pentashih%' OR JWT user_metadata role

The newer `is_pentashih_user()` is broader — a guru account with `roles = ARRAY['Pentashih']` or the jabatan field matching will pass even if `user_profiles.role` is `'guru'`. In Go, implement both checks and OR them where the newer policies are used.

---

## 5. Anon vs Authenticated Access Summary

| Resource | Anon can | Notes |
|----------|----------|-------|
| website_content | SELECT where is_public | |
| news | SELECT where published | |
| announcements | SELECT where published AND not expired | |
| academic_calendar | SELECT where is_public | |
| feedbacks | INSERT | open form submission |
| website-assets storage | SELECT | public bucket |
| All other tables | nothing | |

---

## 6. Service Role (backend-only) Functions

These RPCs must NEVER be exposed via API routes accessible to browser clients. Callable only with service_role credentials:

| Function | Purpose |
|----------|---------|
| `consume_auth_rate_limit()` | Internal rate limiter |
| `set_santri_archive_state()` | Archive/restore santri account |
| `update_guru_account()` | Update guru profile and role atomically |

In Go: implement these as internal service-layer operations, not HTTP handlers reachable from the frontend.

---

## 7. Top Tricky Policies

### 7.1 Admin identity is doubly-constrained

`current_user_role()` (migration 20260722000100) requires BOTH `user_profiles.email` AND `auth.users.email` to equal `admin@lpqalfathmaulana.id` for the admin role to resolve. A DB constraint also enforces that only one user_profiles row can have `role = 'admin'`.

In Go: after fetching `user_profiles.role`, if role is `admin`, additionally verify that the JWT email claim matches `admin@lpqalfathmaulana.id`. If it does not, downgrade to `unauthenticated` or return 403. Never trust the role field alone for admin.

### 7.2 Dual pentashih identity system

Two separate mechanisms grant pentashih access that must be OR'd together:
1. `user_profiles.role = 'pentashih'` + `pentashih_class_assignments` rows (scoped access per class/MMQ schedule, with date range and scope type checks)
2. `is_pentashih_user()` = checks `guru.roles` array contains 'Pentashih' OR `guru.jabatan` ILIKE '%pentashih%' OR JWT user_metadata role = 'pentashih' (added in migration 20260725000100, grants broad read access to classes/guru/santri/class_memberships)

The broad policies added in 20260725000100 coexist with the scoped policies from 0016. A pentashih user satisfying `is_pentashih_user()` gets full read on classes/guru/santri/class_memberships regardless of assignment scope. For write operations, only the scoped assignment check applies.

### 7.3 `jilid_history` insert requires both scope AND `changed_by = jwt_sub`

```sql
WITH CHECK (
  (is_admin() OR guru_has_santri_access(santri_id))
  AND changed_by = auth.uid()
)
```

The insert is only allowed if (a) the actor has write access to the santri AND (b) the `changed_by` column in the new row equals the actor's UUID. This is an audit integrity constraint embedded in RLS. In Go: when inserting a jilid_history row, always set `changed_by` to the authenticated user's ID, and enforce this at the service layer — do not accept `changed_by` from client input.

