# TrainOps

A B2B training-operations platform for a company that runs corporate training programs
(negotiation skills, cybersecurity, etc. delivered to a client's staff). It tracks a training
from creation through delivery: scheduling sessions, enrolling students, running
satisfaction/learning/behaviour surveys, issuing certificates, and calculating instructor
payouts.

Three internal roles use the app — **Admin**, **Delivery Manager**, and **Instructor** — each
scoped to the trainings they're allowed to see, enforced both in the UI and via Postgres
Row-Level Security. Students never log in; they're reached entirely through single-use emailed
links (surveys, tests, certificates).

See [PROJECT_BRIEFING.md](PROJECT_BRIEFING.md) for a plain-language walkthrough of how the app
works and [ROLES.md](ROLES.md) for the full permissions/RLS policy breakdown.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React 19) + [TanStack Router](https://tanstack.com/router)
- [Supabase](https://supabase.com) — Postgres, Auth, Row-Level Security, Edge Functions
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) (Radix primitives)
- Vite

## Getting started

```bash
npm install
```

Create a `.env` file in the project root with your Supabase project credentials:

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Then run the dev server:

```bash
npm run dev
```

### Other scripts

| Command             | Description                        |
| -------------------- | ----------------------------------- |
| `npm run build`      | Production build                   |
| `npm run build:dev`  | Development-mode build             |
| `npm run preview`    | Preview a production build locally |
| `npm run lint`       | Lint the codebase                  |
| `npm run format`     | Format with Prettier               |

## Database

Migrations live in `supabase/migrations` and are applied manually via the Supabase SQL editor
(not auto-deployed on push — see PROJECT_BRIEFING.md §11). Edge Functions live in
`supabase/functions`, including `send-student-email`, which is the sole path for all outbound
student email (welcome messages, surveys, test invites, certificates) via SendGrid.

## Deployment

This project is connected to [Lovable](https://lovable.dev) and currently only builds
successfully for **Cloudflare** via Lovable's Publish button. Netlify/Render targets are
blocked by an upstream bug in the beta Nitro build tooling — see PROJECT_BRIEFING.md §10 for
details.

> [!IMPORTANT]
> This project is connected to Lovable. Avoid rewriting published git history (force pushes,
> rebasing/amending/squashing already-pushed commits) — it rewrites history on Lovable's side
> and can cause the user to lose project history. Commits pushed to the connected branch sync
> back to Lovable, so keep the branch in a working state.

## Known limitations

- No cron/scheduled job triggers surveys — L1/L3 survey sends are "lazy," firing whenever an
  admin or delivery manager has the Dashboard open past the due date.
- Sending email requires a SendGrid account with a verified sender; until then sends fail
  loudly with a toast rather than silently.
- Database migrations must be run manually against the live database after being added to the
  repo.
