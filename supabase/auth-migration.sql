-- Replace the UUID below with the id of the auth.users row that should own
-- the existing records before you run this migration.
do $$
declare
  target_user_id uuid := nullif(
    'a1c8da62-ab84-48eb-b978-4313577582a8',
    'a1c8da62-ab84-48eb-b978-4313577582a8'
  )::uuid;
begin
  if target_user_id is null then
    raise exception 'Set target_user_id in supabase/auth-migration.sql before running the migration.';
  end if;

  alter table public.areas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

  alter table public.projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

  alter table public.todos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

  update public.areas
  set user_id = target_user_id
  where user_id is null;

  update public.projects
  set user_id = target_user_id
  where user_id is null;

  update public.todos
  set user_id = target_user_id
  where user_id is null;
end $$;

alter table public.areas
alter column user_id set default auth.uid(),
alter column user_id set not null;

alter table public.projects
alter column user_id set default auth.uid(),
alter column user_id set not null;

alter table public.todos
alter column user_id set default auth.uid(),
alter column user_id set not null;

drop policy if exists "Public read areas" on public.areas;
drop policy if exists "Public write areas" on public.areas;
drop policy if exists "Public read projects" on public.projects;
drop policy if exists "Public write projects" on public.projects;
drop policy if exists "Public read todos" on public.todos;
drop policy if exists "Public write todos" on public.todos;

drop policy if exists "Users can read own areas" on public.areas;
create policy "Users can read own areas"
on public.areas for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own areas" on public.areas;
create policy "Users can manage own areas"
on public.areas for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects"
on public.projects for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own projects" on public.projects;
create policy "Users can manage own projects"
on public.projects for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own todos" on public.todos;
create policy "Users can read own todos"
on public.todos for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own todos" on public.todos;
create policy "Users can manage own todos"
on public.todos for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
