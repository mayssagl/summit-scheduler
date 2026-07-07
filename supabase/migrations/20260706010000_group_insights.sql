-- TrainOps: AI-generated group insights for the training detail "Group report" tab.
-- Populated by the generate-group-insights Edge Function (admin, or the delivery
-- manager who owns the training) — same access split as sessions/students/certificates.

create table if not exists public.group_insights (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null unique references public.trainings (id) on delete cascade,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table public.group_insights enable row level security;

drop policy if exists "group_insights_admin_all" on public.group_insights;
create policy "group_insights_admin_all" on public.group_insights
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists "group_insights_dm_own" on public.group_insights;
create policy "group_insights_dm_own" on public.group_insights
  for all
  using (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id))
  with check (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id));
