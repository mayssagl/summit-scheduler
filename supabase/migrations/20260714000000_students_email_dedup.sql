-- TrainOps: dedupe students by (training_id, email) so CSV imports upsert
-- instead of creating duplicate rows on re-import or overlapping emails (FR-4).

alter table public.students
  add constraint students_training_id_email_key unique (training_id, email);
