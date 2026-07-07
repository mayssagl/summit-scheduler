-- TrainOps: file storage + tokenized student delivery (tests, surveys, certificates)
--
-- Students have no accounts (see the auth model in the login/activate screens), so the
-- /s/test, /s/survey-l1, /s/survey-l3 and /s/certificate pages are reached by an
-- unguessable share_token, not a session. Access for the `anon` role is deliberately
-- NOT granted on the underlying tables — only on a handful of SECURITY DEFINER RPCs
-- below, each of which takes a token and returns/updates exactly one row matched by
-- that token. This avoids the common mistake of a permissive `using (true)` policy on
-- the table itself, which would let anon read every row via an unfiltered REST query.

-- ═══════════════════════════════════════════════════════════════
-- SCHEMA ADDITIONS
-- ═══════════════════════════════════════════════════════════════

alter table public.trainings
  add column if not exists certificate_sentence text
    not null default 'This certifies that {student_name} has successfully completed {training_name}.',
  add column if not exists certificate_signatory_name text,
  add column if not exists certificate_logo_url text,
  add column if not exists certificate_signature_url text,
  add column if not exists doc_start_date date,
  add column if not exists doc_end_date date,
  add column if not exists po_file_url text;

alter table public.certificates
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists certificates_share_token_key on public.certificates (share_token);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('l1', 'l3')),
  en text not null,
  fr text not null,
  type text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  level text not null check (level in ('l1', 'l3')),
  share_token uuid not null default gen_random_uuid(),
  answers jsonb not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (training_id, student_id, level)
);

create unique index if not exists survey_responses_share_token_key on public.survey_responses (share_token);
create index if not exists survey_responses_training_id_idx on public.survey_responses (training_id);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  share_token uuid not null default gen_random_uuid(),
  answers jsonb not null default '{}',
  score int,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (training_id, student_id, phase)
);

create unique index if not exists test_attempts_share_token_key on public.test_attempts (share_token);
create index if not exists test_attempts_training_id_idx on public.test_attempts (training_id);

-- ═══════════════════════════════════════════════════════════════
-- HELPER (mirrors get_my_role's recursion-avoidance rationale)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.can_manage_training(p_training_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.trainings t
      where t.id = p_training_id
        and (
          (public.get_my_role() = 'delivery_manager' and t.created_by = auth.uid())
          or (public.get_my_role() = 'instructor' and t.instructor_id = auth.uid())
        )
    );
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS: new tables
-- ═══════════════════════════════════════════════════════════════

alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.test_attempts enable row level security;

drop policy if exists "survey_questions_read_all" on public.survey_questions;
create policy "survey_questions_read_all" on public.survey_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "survey_questions_admin_write" on public.survey_questions;
create policy "survey_questions_admin_write" on public.survey_questions
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

-- survey_responses: Surveys tab lives under admin/DM only (no instructor tab) — same
-- split as trainings/sessions/students/certificates, minus an instructor policy.
drop policy if exists "survey_responses_admin_all" on public.survey_responses;
create policy "survey_responses_admin_all" on public.survey_responses
  for all using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists "survey_responses_dm_own" on public.survey_responses;
create policy "survey_responses_dm_own" on public.survey_responses
  for all
  using (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id))
  with check (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id));

-- test_attempts: Tests tab lives under instructor only — same split as tests/resources.
drop policy if exists "test_attempts_admin_select" on public.test_attempts;
create policy "test_attempts_admin_select" on public.test_attempts
  for select using (public.get_my_role() = 'admin');

drop policy if exists "test_attempts_dm_select_own" on public.test_attempts;
create policy "test_attempts_dm_select_own" on public.test_attempts
  for select using (public.get_my_role() = 'delivery_manager' and public.can_manage_training(training_id));

drop policy if exists "test_attempts_instructor_all_own" on public.test_attempts;
create policy "test_attempts_instructor_all_own" on public.test_attempts
  for all
  using (public.get_my_role() = 'instructor' and public.can_manage_training(training_id))
  with check (public.get_my_role() = 'instructor' and public.can_manage_training(training_id));

-- ═══════════════════════════════════════════════════════════════
-- STORAGE: one bucket, path-prefixed by resource type + training id
-- e.g. resources/<training_id>/<file>, certificates/<training_id>/<file>
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('trainops-files', 'trainops-files', true)
on conflict (id) do nothing;

drop policy if exists "trainops_files_public_read" on storage.objects;
create policy "trainops_files_public_read" on storage.objects
  for select using (bucket_id = 'trainops-files');

drop policy if exists "trainops_files_insert" on storage.objects;
create policy "trainops_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'trainops-files'
    and public.can_manage_training(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "trainops_files_update" on storage.objects;
create policy "trainops_files_update" on storage.objects
  for update
  using (bucket_id = 'trainops-files' and public.can_manage_training(((storage.foldername(name))[2])::uuid))
  with check (bucket_id = 'trainops-files' and public.can_manage_training(((storage.foldername(name))[2])::uuid));

drop policy if exists "trainops_files_delete" on storage.objects;
create policy "trainops_files_delete" on storage.objects
  for delete using (bucket_id = 'trainops-files' and public.can_manage_training(((storage.foldername(name))[2])::uuid));

-- ═══════════════════════════════════════════════════════════════
-- TOKEN RPCs — the only way the `anon` role touches the tables above
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_test_attempt(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'training_name', t.name,
    'phase', a.phase,
    'submitted', a.submitted_at is not null,
    'score', a.score,
    'answers', a.answers,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options) order by q.position)
      from public.tests q
      where q.training_id = a.training_id and q.phase = a.phase
    ), '[]'::jsonb)
  )
  from public.test_attempts a
  join public.trainings t on t.id = a.training_id
  where a.share_token = p_token;
$$;

create or replace function public.submit_test_attempt(p_token uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.test_attempts%rowtype;
  v_total int;
  v_correct int;
  v_score int;
begin
  select * into v_attempt from public.test_attempts where share_token = p_token;
  if not found then
    raise exception 'Invalid or expired link';
  end if;

  select count(*), count(*) filter (where p_answers->>(q.id::text) = q.correct_option)
  into v_total, v_correct
  from public.tests q
  where q.training_id = v_attempt.training_id and q.phase = v_attempt.phase;

  v_score := case when v_total > 0 then round(v_correct * 100.0 / v_total) else 0 end;

  update public.test_attempts
  set answers = p_answers, score = v_score, submitted_at = now()
  where share_token = p_token;

  return jsonb_build_object('score', v_score);
end;
$$;

create or replace function public.get_survey_response(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'training_name', t.name,
    'level', r.level,
    'submitted', r.submitted_at is not null,
    'answers', r.answers,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'en', q.en, 'fr', q.fr, 'type', q.type) order by q.position)
      from public.survey_questions q
      where q.level = r.level
    ), '[]'::jsonb)
  )
  from public.survey_responses r
  join public.trainings t on t.id = r.training_id
  where r.share_token = p_token;
$$;

create or replace function public.submit_survey_response(p_token uuid, p_answers jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.survey_responses
  set answers = p_answers, submitted_at = now()
  where share_token = p_token;
$$;

create or replace function public.get_certificate(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'student_name', s.name,
    'training_name', t.name,
    'client', t.client,
    'issued_at', c.issued_at,
    'sentence', t.certificate_sentence,
    'signatory_name', t.certificate_signatory_name,
    'logo_url', t.certificate_logo_url,
    'signature_url', t.certificate_signature_url,
    'verification_id', 'TO-' || upper(left(c.id::text, 8))
  )
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.trainings t on t.id = c.training_id
  where c.share_token = p_token;
$$;

grant execute on function public.get_test_attempt(uuid) to anon, authenticated;
grant execute on function public.submit_test_attempt(uuid, jsonb) to anon, authenticated;
grant execute on function public.get_survey_response(uuid) to anon, authenticated;
grant execute on function public.submit_survey_response(uuid, jsonb) to anon, authenticated;
grant execute on function public.get_certificate(uuid) to anon, authenticated;
