-- TrainOps RBAC: base schema + row-level security
--
-- Context: the public schema was empty when this migration was written (no
-- profiles/trainings/etc. tables existed yet), so this creates the tables
-- implied by the existing frontend (src/lib/mock.ts, the trainings detail
-- page) alongside the RLS policies that enforce role-based access.
--
-- Roles (profiles.role): 'admin' | 'delivery_manager' | 'instructor'.
-- Scoping rules:
--   admin            - unrestricted on all tables below
--   delivery_manager - full access, scoped to trainings they created
--   instructor       - scoped to trainings they're assigned to; read-only
--                       except attendance and their own tests/resources

-- ═══════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null check (role in ('admin', 'delivery_manager', 'instructor')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  created_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null,
  country text,
  venue text,
  language text not null default 'EN' check (language in ('EN', 'FR')),
  num_students int not null default 0,
  start_date date,
  end_date date,
  completion_threshold int not null default 70,
  po_ref text,
  po_value numeric(12, 2),
  status text not null default 'Pending'
    check (status in ('Pending', 'Scheduled', 'Active', 'Completed', 'Cancelled')),
  instructor_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  modules text[] not null default '{}',
  nps int not null default 0,
  survey_rate int not null default 0,
  learning_gain int not null default 0,
  attendance_rate int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainings_instructor_id_idx on public.trainings (instructor_id);
create index if not exists trainings_created_by_idx on public.trainings (created_by);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Europe/Paris',
  venue text,
  module text,
  status text not null default 'Ahead' check (status in ('Done', 'Today', 'Ahead')),
  created_at timestamptz not null default now()
);

create index if not exists sessions_training_id_idx on public.sessions (training_id);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  name text not null,
  email text not null,
  dept text,
  status text not null default 'Invited' check (status in ('Active', 'Invited', 'Dropped')),
  attendance_pct int not null default 0,
  completion_pct int not null default 0,
  cert_issued boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists students_training_id_idx on public.students (training_id);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  template text not null default 'standard',
  file_url text,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists certificates_training_id_idx on public.certificates (training_id);
create index if not exists certificates_student_id_idx on public.certificates (student_id);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  -- denormalized from sessions.training_id (kept in sync by trigger below)
  -- so policies can scope on attendance directly without a nested join
  training_id uuid not null references public.trainings (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  present boolean not null default false,
  marked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists attendance_training_id_idx on public.attendance (training_id);
create index if not exists attendance_session_id_idx on public.attendance (session_id);
create index if not exists attendance_student_id_idx on public.attendance (student_id);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  question text not null,
  options jsonb not null default '[]',
  correct_option text,
  position int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists tests_training_id_idx on public.tests (training_id);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  session_id uuid references public.sessions (id),
  name text not null,
  file_url text not null,
  scope text not null default 'Whole training',
  version text not null default 'v1',
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists resources_training_id_idx on public.resources (training_id);

-- ═══════════════════════════════════════════════════════════════
-- HELPER: read the caller's role without recursive RLS lookups
-- security definer + a pinned search_path so this bypasses the
-- profiles policies below instead of triggering them recursively
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- keeps attendance.training_id in sync with its parent session so
-- RLS can scope on attendance directly, regardless of client input
create or replace function public.set_attendance_training_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select training_id into new.training_id from public.sessions where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists trg_attendance_training_id on public.attendance;
create trigger trg_attendance_training_id
  before insert or update of session_id on public.attendance
  for each row execute function public.set_attendance_training_id();

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.trainings enable row level security;
alter table public.sessions enable row level security;
alter table public.students enable row level security;
alter table public.certificates enable row level security;
alter table public.attendance enable row level security;
alter table public.tests enable row level security;
alter table public.resources enable row level security;

-- profiles: everyone can read their own row; admin can read/write all
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.get_my_role() = 'admin');

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.get_my_role() = 'admin');

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

-- trainings
drop policy if exists "trainings_admin_all" on public.trainings;
create policy "trainings_admin_all" on public.trainings
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists "trainings_dm_own" on public.trainings;
create policy "trainings_dm_own" on public.trainings
  for all
  using (public.get_my_role() = 'delivery_manager' and created_by = auth.uid())
  with check (public.get_my_role() = 'delivery_manager' and created_by = auth.uid());

drop policy if exists "trainings_instructor_select_own" on public.trainings;
create policy "trainings_instructor_select_own" on public.trainings
  for select using (public.get_my_role() = 'instructor' and instructor_id = auth.uid());

-- sessions / students / certificates: scoped through the parent training
do $$
declare
  tbl text;
begin
  foreach tbl in array array['sessions', 'students', 'certificates'] loop
    execute format('drop policy if exists "%1$s_admin_all" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_admin_all" on public.%1$s for all using (public.get_my_role() = ''admin'') with check (public.get_my_role() = ''admin'')',
      tbl
    );

    execute format('drop policy if exists "%1$s_dm_own" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_dm_own" on public.%1$s for all
        using (
          public.get_my_role() = ''delivery_manager''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.created_by = auth.uid())
        )
        with check (
          public.get_my_role() = ''delivery_manager''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.created_by = auth.uid())
        )',
      tbl
    );

    execute format('drop policy if exists "%1$s_instructor_select_own" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_instructor_select_own" on public.%1$s for select
        using (
          public.get_my_role() = ''instructor''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.instructor_id = auth.uid())
        )',
      tbl
    );
  end loop;
end $$;

-- attendance: same scoping, but instructors can also insert/update
-- (they're the ones recording it) for their own assigned trainings
drop policy if exists "attendance_admin_all" on public.attendance;
create policy "attendance_admin_all" on public.attendance
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists "attendance_dm_own" on public.attendance;
create policy "attendance_dm_own" on public.attendance
  for all
  using (
    public.get_my_role() = 'delivery_manager'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.created_by = auth.uid())
  )
  with check (
    public.get_my_role() = 'delivery_manager'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.created_by = auth.uid())
  );

drop policy if exists "attendance_instructor_select_own" on public.attendance;
create policy "attendance_instructor_select_own" on public.attendance
  for select
  using (
    public.get_my_role() = 'instructor'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.instructor_id = auth.uid())
  );

drop policy if exists "attendance_instructor_insert_own" on public.attendance;
create policy "attendance_instructor_insert_own" on public.attendance
  for insert
  with check (
    public.get_my_role() = 'instructor'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.instructor_id = auth.uid())
  );

drop policy if exists "attendance_instructor_update_own" on public.attendance;
create policy "attendance_instructor_update_own" on public.attendance
  for update
  using (
    public.get_my_role() = 'instructor'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.instructor_id = auth.uid())
  )
  with check (
    public.get_my_role() = 'instructor'
    and exists (select 1 from public.trainings t where t.id = attendance.training_id and t.instructor_id = auth.uid())
  );

-- tests / resources: instructors get full CRUD on their own trainings;
-- admin and DM are read-only (DM scoped to trainings they created)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['tests', 'resources'] loop
    execute format('drop policy if exists "%1$s_admin_select" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_admin_select" on public.%1$s for select using (public.get_my_role() = ''admin'')',
      tbl
    );

    execute format('drop policy if exists "%1$s_dm_select_own" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_dm_select_own" on public.%1$s for select
        using (
          public.get_my_role() = ''delivery_manager''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.created_by = auth.uid())
        )',
      tbl
    );

    execute format('drop policy if exists "%1$s_instructor_all_own" on public.%1$s', tbl);
    execute format(
      'create policy "%1$s_instructor_all_own" on public.%1$s for all
        using (
          public.get_my_role() = ''instructor''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.instructor_id = auth.uid())
        )
        with check (
          public.get_my_role() = ''instructor''
          and exists (select 1 from public.trainings t where t.id = %1$s.training_id and t.instructor_id = auth.uid())
        )',
      tbl
    );
  end loop;
end $$;
