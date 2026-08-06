-- Certificates: configurable logo side + a second (co-)signatory.

alter table public.trainings
  add column if not exists certificate_logo_position text
    not null default 'right' check (certificate_logo_position in ('left', 'right')),
  add column if not exists certificate_signatory2_name text,
  add column if not exists certificate_signature2_url text;

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
    'logo_position', t.certificate_logo_position,
    'signature_url', t.certificate_signature_url,
    'signatory2_name', t.certificate_signatory2_name,
    'signature2_url', t.certificate_signature2_url,
    'verification_id', 'TO-' || upper(left(c.id::text, 8))
  )
  from public.certificates c
  join public.students s on s.id = c.student_id
  join public.trainings t on t.id = c.training_id
  where c.share_token = p_token;
$$;
