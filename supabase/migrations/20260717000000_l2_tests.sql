-- L2 pre/post test system: publish lifecycle for the existing tests/test_attempts
-- pair. `tests` rows are individual questions with no container row, so
-- status/published_at/created_by need a home — this adds the slim one-row-per-phase
-- table the existing model is missing, rather than duplicating those fields onto
-- every question row.

-- reconcile schema drift: `module` already exists live (added out-of-band) but was
-- never captured in a migration — this is a no-op on the real DB, documents intent.
alter table public.tests add column if not exists module text;

create table if not exists public.test_publications (
  training_id uuid not null references public.trainings (id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  primary key (training_id, phase)
);

alter table public.test_publications enable row level security;

-- same three-way split as tests/test_attempts (can_manage_training covers
-- admin | owning DM | assigned instructor).
drop policy if exists "test_publications_admin_select" on public.test_publications;
create policy "test_publications_admin_select" on public.test_publications
  for select using (public.get_my_role() = 'admin');

drop policy if exists "test_publications_dm_select_own" on public.test_publications;
create policy "test_publications_dm_select_own" on public.test_publications
  for select using (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id));

drop policy if exists "test_publications_instructor_all_own" on public.test_publications;
create policy "test_publications_instructor_all_own" on public.test_publications
  for all
  using (public.get_my_role() = 'instructor' and public.can_manage_training(training_id))
  with check (public.get_my_role() = 'instructor' and public.can_manage_training(training_id));
