-- TrainOps: tag test questions with a module so pre/post scores can be broken
-- down per skill (Surveys > L2 "Per-skill mastery" table, and the
-- generate-group-insights edge function, which already expects this column).

alter table public.tests
  add column if not exists module text;
