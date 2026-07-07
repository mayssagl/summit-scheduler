# TrainOps — Roles & Access Control

Three roles, stored in `profiles.role`: `admin`, `delivery_manager`, `instructor`.
Students have no accounts (see the auth model in the login/activate screens) and are out of scope here.

## How enforcement works

Two independent layers, both required — neither alone is sufficient:

1. **Frontend guard** ([src/components/role-route.tsx](src/components/role-route.tsx)) — blocks
   navigation and hides UI. Convenient, but a user can bypass client-side JS.
2. **Database RLS** ([supabase/migrations/20260705120000_rbac.sql](supabase/migrations/20260705120000_rbac.sql)) —
   the actual security boundary. Every query, from this app or any other client hitting the
   same Supabase project, is filtered by these policies regardless of what the frontend does.

`src/lib/auth.tsx` is the single source of truth for "who is signed in and what's their role" —
it fetches `profiles.role` once per session and exposes `{ session, user, role, loading }` via
`useAuth()`. `loading` stays `true` until both the session *and* the role have resolved, so guards
never flash a redirect before the role is known.

## Route access matrix

| Route | Admin | Delivery Manager | Instructor | Guard |
|---|:-:|:-:|:-:|---|
| `/dashboard` | ✅ | ✅ | ✅ | `RoleRoute` (default = all roles), applied once at [_app.tsx](src/routes/_app.tsx) |
| `/calendar` | ✅ | ✅ | ✅ | same |
| `/trainings`, `/trainings/$id` | ✅ | ✅ | ✅ | same |
| `/payout` | ✅ | ✅ | ✅ | same |
| `/trainings/new` | ✅ | ✅ | ❌ | `RoleRoute allowed={["admin","delivery_manager"]}` on [_app.trainings.new.tsx](src/routes/_app.trainings.new.tsx) |
| `/surveys` | ✅ | ❌ | ❌ | `RoleRoute allowed={["admin"]}` on [_app.surveys.tsx](src/routes/_app.surveys.tsx) |
| `/team` | ✅ | ❌ | ❌ | `RoleRoute allowed={["admin"]}` on [_app.team.tsx](src/routes/_app.team.tsx) |

**Naming note:** the task brief referenced `/my-trainings` and `/team/instructors`. The app's
actual routes are `/trainings` (list + `/trainings/new` + `/trainings/$id`) and a single `/team`
page with internal Delivery-Manager/Instructor tabs — there's no separate `/team/instructors`
route. The rules above were mapped onto the routes that actually exist.

`RoleRoute` (unauthenticated → `/login`; wrong role → `/dashboard`) is the only route guard
component; the earlier `ProtectedRoute` (auth-only, no role check) was replaced by it — it's just
`RoleRoute` with its default `allowed` (all three roles).

## Sidebar nav ([app-shell.tsx](src/components/app-shell.tsx))

Nav item visibility is driven by the **real** signed-in role (`useAuth().role`), matching the
route guards above 1:1 so nothing is ever shown that the user can't open:

- **Admin:** Dashboard, Calendar, My trainings, Payout, Surveys, Team
- **Delivery Manager:** Dashboard, Calendar, My trainings, Payout
- **Instructor:** Dashboard, Calendar, My trainings, Payout

**Update:** `src/lib/mock.ts` and the mock `lib/role.tsx` "view as" switcher have since been
deleted. Every page now reads/writes real Supabase data through `src/lib/queries.ts` (React Query
hooks) — nav visibility and tab-bar selection were already governed by `useAuth().role`, and now
every table conditional (which trainings/sessions a DM or instructor sees) comes from RLS scoping
the query results server-side, not client-side filtering by a hardcoded id.

**Everything below is now real** (see "Full functionality pass" further down for what backs each
piece): trainings/sessions/students/attendance CRUD, certificate template + issuance + downloads,
Tests question bank + publishing, Resources file upload, the Surveys question bank, and Team
invites. The only things that are still deliberately not real: the qualitative Group Report insight
text (editable, but not persisted anywhere), and the certificate template editor's "Doc
start/end"/logo/signature fields have no dedicated UI validation beyond what's described below.

## Training detail tabs ([_app.trainings.$id.tsx](src/routes/_app.trainings.$id.tsx))

Tab set is driven by real role (`useAuth().role`), passed down as a prop to the `Sessions` and
`Students` sub-components (they no longer read role themselves):

- **Admin / Delivery Manager:** Overview, Sessions, Students, Attendance, Certificates, Surveys, Group report, Payout
- **Instructor:** Sessions, Students, Attendance, Tests, Resources

## Database schema & RLS

The public schema was **empty** in the linked Supabase project when this was written (verified by
querying the REST API directly — every table below returned `PGRST205: not found in schema
cache`). The migration therefore creates the base tables (shaped to match `src/lib/mock.ts` and
the training detail page) in addition to the RLS policies.

`public.get_my_role()` is a `security definer` function that reads `profiles.role` for
`auth.uid()`. Every policy below calls it instead of querying `profiles` directly — querying
`profiles` from within a `profiles` policy would recurse. `security definer` (owned by `postgres`,
which bypasses RLS in Supabase) breaks that cycle.

| Table | Admin | Delivery Manager | Instructor |
|---|---|---|---|
| `profiles` | select/insert/update all | select own row only | select own row only |
| `trainings` | all, unrestricted | all, where `created_by = auth.uid()` | select, where `instructor_id = auth.uid()` |
| `sessions` | all | all, parent training `created_by = auth.uid()` | select, parent training `instructor_id = auth.uid()` |
| `students` | all | all, parent training `created_by = auth.uid()` | select, parent training `instructor_id = auth.uid()` |
| `certificates` | all | all, parent training `created_by = auth.uid()` | select, parent training `instructor_id = auth.uid()` |
| `attendance` | all | all, parent training `created_by = auth.uid()` | **select + insert + update**, parent training `instructor_id = auth.uid()` (they record it) |
| `tests` | select only | select only, parent training `created_by = auth.uid()` | **all** (full CRUD), parent training `instructor_id = auth.uid()` |
| `resources` | select only | select only, parent training `created_by = auth.uid()` | **all** (full CRUD), parent training `instructor_id = auth.uid()` |

`sessions`, `students`, `certificates`, `tests`, `resources` scope through their parent `trainings`
row via an `exists (select 1 from trainings ...)` subquery — there's no direct `created_by`/
`instructor_id` column on those tables, so the parent training is the source of truth for who's
allowed to touch them. `attendance` denormalizes `training_id` directly onto the row (via a
`before insert or update of session_id` trigger that derives it from `session_id`, ignoring
whatever the client sends) so its policies don't need a second-level join through `sessions`.

**Admin bootstrap** is the one remaining gap: RLS means a client can never insert the *first*
`profiles` row with `role = 'admin'` (nothing satisfies `get_my_role() = 'admin'` yet). Insert the
first admin's profile row via the Supabase SQL editor (which runs as `postgres` and bypasses RLS)
or the service-role key — not through the app. Every admin after that can be created through
Team → Invite, which is real (see below).

## Full functionality pass — storage, invites, and student delivery

A second migration, [supabase/migrations/20260706000000_storage_and_student_delivery.sql](supabase/migrations/20260706000000_storage_and_student_delivery.sql),
and a server-side function close every remaining "button doesn't do anything" gap. **Both need
setup steps from you before they work — see below.**

### Team invites (real)

[src/lib/invite-user.ts](src/lib/invite-user.ts) is a `createServerFn` — its handler
body (and the service-role key it reads) is stripped from the browser bundle and only runs on the
server. It deliberately does **not** live under `src/lib/server/` — this project's Vite
import-protection plugin denies any client import from a path matching `**/server/**` outright,
regardless of `createServerFn` usage, so the file lives alongside the rest of `src/lib/`. It:
1. Verifies the caller is a currently-authenticated **admin** (checks their JWT against `profiles.role`
   using the anon client — this call cannot be used to escalate a non-admin).
2. Calls `supabase.auth.admin.inviteUserByEmail` with a service-role client (bypasses RLS, as any
   admin-level operation must).
3. Inserts the new `profiles` row (`role`, `status: 'invited'`).

**Setup required:** add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase → Project Settings → API — the
`service_role` secret, not the `anon` key) to your server environment (`.env` for local dev; your
host's env var settings in production). It must **not** be prefixed `VITE_` or it would be inlined
into the client bundle. Without it, the invite dialog shows a clear error instead of silently
failing. Whether the invited person actually *receives* an email depends on your Supabase project's
configured email provider — that's unrelated to this code.

### File storage (real)

Migration 2 creates a single public-read bucket, `trainops-files`, with write access gated by a
`can_manage_training(training_id)` helper (same admin/DM-own/instructor-own logic as the RBAC
migration, factored out since 3 storage policies would otherwise repeat it). Paths are prefixed by
kind: `resources/<training_id>/...`, `certificates/<training_id>/...`, `documents/<training_id>/...`
(PO/contract attachments). Wired to: the Resources tab (upload/list/download), the certificate
template's logo/signature uploads, and the New Training wizard's PO attachment.

### Certificates, Tests, Surveys — real data, downloadable "PDF"

- **Certificates**: template (sentence/signatory/logo/signature) is saved to columns on
  `trainings`; "Issue certificates" inserts a `certificates` row per eligible student
  (`certificates.share_token` is what the student-facing link uses); "Download" / "Download all"
  generate a real file via [src/lib/export-html.ts](src/lib/export-html.ts) — **an .html file, not
  a literal .pdf** (no PDF library is installed; it opens/prints fine in any browser). Same
  approach for the Group Report download.
- **Tests**: the `tests` table (question bank per training/phase) now has real CRUD from the
  instructor's Tests tab. "Publish & send" inserts one `test_attempts` row per active student
  (unique per training+student+phase) and surfaces a copyable `/s/test/<token>` link per student —
  it does **not** send an email (no email provider configured); the instructor copies/shares the
  link manually.
- **Surveys**: `survey_questions` (global, not per-training — matches the existing admin page's
  design) is now really persisted from `/surveys`, replacing the local-only seed it had before.
  "Send / resend" on a training's Surveys tab works the same way as tests: inserts
  `survey_responses` rows and surfaces `/s/survey-l1/<token>` / `/s/survey-l3/<token>` links.

### Student-facing pages — now real, token-gated

`/s/test/$token`, `/s/survey-l1/$token`, `/s/survey-l3/$token`, `/s/certificate/$token` were fully
static/hardcoded before (literally "Emma Chen" for every visitor, regardless of token). They now
look up real data — but students have no accounts, so there's no session to check. Instead, each
page calls a `SECURITY DEFINER` Postgres RPC (`get_test_attempt`, `submit_test_attempt`,
`get_survey_response`, `submit_survey_response`, `get_certificate`) that takes the token as its only
input and returns/updates exactly the one row matching it. The `anon` role has **no direct table
grants** on `test_attempts` / `survey_responses` / `certificates` — only `EXECUTE` on these RPCs —
specifically so an unfiltered REST query can't enumerate every student's data; each function does
its own `where share_token = ...` internally regardless of what the caller sends.

The survey pages dynamically render a rating widget per question based on its `type` (`1-5` → star
buttons, `0-10 NPS` → number grid, `Frequency` → chips, `Open` → textarea) rather than hardcoding
the question text, so editing the question bank on `/surveys` actually changes what students see —
an improvement over the original design, where the student pages were entirely disconnected from
the admin question editor even in the pre-mock-removal version of this app.

Test scores are computed server-side in `submit_test_attempt` (compares submitted answers against
`tests.correct_option`) and are visible to instructors on the Tests tab, but — matching the original
design's stated intent — never shown back to the student.
