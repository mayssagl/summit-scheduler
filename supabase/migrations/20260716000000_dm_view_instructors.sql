-- delivery managers need to see instructor names to assign one when
-- scheduling a training (src/routes/_app.trainings.new.tsx instructor
-- picker) but profiles RLS previously only allowed reading your own row
-- (or all rows, for admins) — this adds instructor-only visibility.
drop policy if exists "profiles_dm_select_instructors" on public.profiles;
create policy "profiles_dm_select_instructors" on public.profiles
  for select using (public.get_my_role() = 'delivery_manager' and role = 'instructor');
