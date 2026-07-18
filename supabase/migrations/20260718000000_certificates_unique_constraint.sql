-- "Issue certificates" (useIssueCertificates in src/lib/queries.ts) upserts on
-- (training_id, student_id) via onConflict, but no matching unique constraint
-- existed on public.certificates — Postgres rejects that upsert with
-- "no unique or exclusion constraint matching the ON CONFLICT specification"
-- (42P10), so certificates were never actually created despite the button
-- reporting no error to the DM.

-- defensive dedupe first: keep the earliest row per (training_id, student_id)
-- in case any duplicates already exist, so the constraint below can be added.
delete from public.certificates c
where c.id in (
  select id from (
    select id, row_number() over (
      partition by training_id, student_id
      order by created_at asc, id asc
    ) as rn
    from public.certificates
  ) ranked
  where rn > 1
);

alter table public.certificates
  add constraint certificates_training_id_student_id_key unique (training_id, student_id);
