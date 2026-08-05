# TrainOps — Project Briefing

What this app does, how its main pieces work, and what's worth walking your supervisor
through — written in plain terms, not just code comments. See [ROLES.md](ROLES.md) for the
full technical breakdown of permissions/database policies if they ask for detail there.

## 1. What TrainOps is

A B2B training-operations platform for a company that runs corporate training programs
(the kind delivered to a client's staff — negotiation skills, cybersecurity, etc.). It tracks
a training from creation through delivery: scheduling sessions, enrolling students, running
satisfaction/learning/behaviour surveys, issuing certificates, and calculating instructor
payouts. Three internal roles use it (admin, delivery manager, instructor); the students
themselves never log in — they're reached entirely through single-use emailed links.

## 2. Roles, in one paragraph

**Admin** sees and manages everything. **Delivery Manager** sees only the trainings they
created. **Instructor** sees only trainings they're assigned to teach, with a narrower set of
tabs (attendance, tests, resources — not payouts or certificates). This is enforced twice:
once in the UI (so people don't see options they can't use) and independently at the database
level via Postgres Row-Level Security, which is the actual security boundary — the UI check
alone could be bypassed by anyone editing requests directly. Full policy table in
[ROLES.md](ROLES.md).

## 3. The core workflow

1. **Create a training** (My trainings → New training) — name, client, country, venue,
   language, student count, dates, and optionally a linked PO/contract document.
2. **Schedule sessions** — single dates or a recurring weekly pattern, generated automatically.
3. **Add students** — one at a time, or bulk CSV import (deduplicated by email — see §5).
4. **Deliver the training** — mark attendance per session; session status (Ahead/Today/Done)
   is now computed automatically from the date, not a manual toggle (see §4).
5. **Surveys run in three stages** (L1 Satisfaction, L2 Learning/tests, L3 Behaviour) — L1
   sends when the training finishes, L3 sends a month later, both automatically (see §6).
6. **Certificates** are issued to students who cross the completion threshold, and emailed to
   them automatically.
7. **Payouts** are calculated per instructor from sessions actually delivered.

## 4. Session status is now automatic

**What to tell your supervisor:** nothing in the original build ever updated a session's
status in the database — it was permanently stuck on "Ahead" regardless of whether the
session date had already passed. This silently broke the Dashboard's delivery chart,
instructor payout totals, and the Sessions tab status column (all read that stuck value).

**The fix:** instead of relying on a stored value nothing ever changes, every place that needs
"has this session happened yet" now derives it live from the session's own date, every time
it's displayed. No maintenance needed — it's always correct.

## 5. Students: CSV import with deduplication

Bulk-adding students via CSV upsert-by-email instead of plain insert, so re-uploading a CSV or
overlapping rows update the existing student record rather than creating duplicates.
Enforced at the database level with a unique constraint on (training, email), not just app logic.

## 6. Student email notifications — how they actually work

This is worth explaining carefully, since it involves an external service and has real
limitations you should be upfront about.

**Architecture:** a Supabase Edge Function (`send-student-email`) is the only thing that
sends email. It's called in the background whenever: a new student is added ("welcome"), a
survey is sent, a test is published, or a certificate is issued. It verifies the caller is a
real admin/delivery-manager, looks up the student and training, builds the right email, and
sends it via a transactional email API (SendGrid).

**Automatic survey sending:** L1 (satisfaction) fires as soon as a training's end date has
passed; L3 (behaviour) fires 30 days after that, matching the original spec ("arrives one
month after completion"). Both are idempotent — a training is never surveyed twice.

**Important limitation to flag to your supervisor:** there is no background job/cron running
this. It's a "lazy" check — it runs whenever an admin or delivery manager has the Dashboard
open. In practice this means a finished training's survey goes out within one dashboard visit
of the trigger date, not necessarily the exact instant it becomes due. A fully "always-on"
version would need a scheduled job (Supabase's pg_cron), which is a bigger infrastructure step
not yet set up.

**Email delivery caveat:** SendGrid's free tier requires verifying at least one sender address
before it will deliver anywhere (a one-time email-confirmation step, no cost). Until that's
done, sending will visibly fail with a clear error rather than silently doing nothing — that
was itself a bug we found and fixed (the failure used to be swallowed silently; now it surfaces
a toast so it's never a mystery).

## 7. The Calendar

A month view where each training is a single colored bar spanning its start→end date
(color = status: pending/scheduled/active/completed/cancelled), not one dot per day. Scoped
per role the same way as everything else. Clicking a bar opens that training. Weeks with too
many overlapping trainings collapse into a "+N more" popover rather than growing unbounded.

## 8. Dashboard

Stat cards (active trainings, students enrolled, avg NPS, pending payouts), a 6-month delivery
chart, per-instructor payout breakdown, a recent-activity feed (certificates issued, surveys
sent, AI reports generated), and top clients — all computed from real data, no placeholders.

## 9. Settings page

Any signed-in user can now change their own email or password from Settings in the sidebar —
previously there was no self-service account management at all.

## 10. Deployment

**This app currently only builds successfully for Cloudflare** (via Lovable's own Publish
button). We tested Netlify and Render deployment targets directly and found a genuine bug in
this project's build tooling (Nitro, still in beta) — one of its internal dependencies
(`nf3`) tries to import another package (`@vercel/nft`) in a way that fails under Node's
strict module rules, regardless of which non-Cloudflare target is picked. This is an upstream
tooling bug, not something introduced by our changes, and it currently blocks Netlify/Render
builds entirely (confirmed by actually running both build attempts, not guessing).

**What to tell your supervisor:** deploying via Lovable/Cloudflare works today and is the
recommended path — Cloudflare's free tier is comparable to Netlify's (global edge hosting,
custom domains, generous limits). Moving to Netlify or Render specifically would require either
waiting for an upstream fix to this beta tooling, or investing time in a fragile manual patch —
not recommended unless there's a hard requirement for one of those platforms specifically.

## 11. Known gaps worth being upfront about

- Database migrations are applied manually via the Supabase SQL editor, not auto-deployed —
  a few times during development a migration existed as a file but hadn't actually been run
  against the live database yet, causing confusing "column not found" errors until caught.
- Another developer is also actively working on this codebase in parallel (visible in git
  history) — some features described here may have been extended or restyled since this was
  written.
- Survey/certificate email sending depends on the SendGrid account staying configured
  (API key + verified sender) — if that lapses, sends fail loudly (a toast), not silently.
