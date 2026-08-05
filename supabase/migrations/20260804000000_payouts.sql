-- Per-instructor payout rate, Stripe Connect account linkage, and a
-- payout_requests table tracking the requested -> processing -> paid/failed
-- lifecycle for instructor payouts.

alter table public.profiles
  add column if not exists payout_rate numeric not null default 450,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_onboarding_status text not null default 'not_started';

alter table public.profiles
  drop constraint if exists profiles_stripe_onboarding_status_check;
alter table public.profiles
  add constraint profiles_stripe_onboarding_status_check
  check (stripe_onboarding_status in ('not_started', 'pending', 'complete'));

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id),
  amount numeric not null,
  currency text not null default 'eur',
  period_start date,
  period_end date,
  status text not null default 'requested',
  stripe_transfer_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_requests_status_check check (status in ('requested', 'processing', 'paid', 'failed'))
);

create index if not exists payout_requests_instructor_id_idx on public.payout_requests (instructor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payout_requests_updated_at on public.payout_requests;
create trigger trg_payout_requests_updated_at
  before update on public.payout_requests
  for each row execute function public.set_updated_at();

alter table public.payout_requests enable row level security;

-- instructors: read + create their own requests, but only while still
-- 'requested' — once admin moves it to processing/paid/failed they can't
-- edit it out from under that state.
drop policy if exists "payout_requests_instructor_select_own" on public.payout_requests;
create policy "payout_requests_instructor_select_own" on public.payout_requests
  for select using (instructor_id = auth.uid());

drop policy if exists "payout_requests_instructor_insert_own" on public.payout_requests;
create policy "payout_requests_instructor_insert_own" on public.payout_requests
  for insert with check (instructor_id = auth.uid() and status = 'requested');

-- admin: full read/write across all payout requests
drop policy if exists "payout_requests_admin_all" on public.payout_requests;
create policy "payout_requests_admin_all" on public.payout_requests
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');
