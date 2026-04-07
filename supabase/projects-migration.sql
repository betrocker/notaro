-- One-time migration: move legacy "clients" records into "projects".
-- Safe to run multiple times.

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  name text,
  note text,
  created_at timestamp without time zone default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

drop policy if exists "Users can manage own projects" on public.projects;
create policy "Users can manage own projects"
on public.projects for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.projects (id, user_id, name, note, created_at)
select
  c.id,
  c.user_id,
  c.name,
  c.note,
  c.created_at
from public.clients c
on conflict (id) do update
set
  user_id = excluded.user_id,
  name = excluded.name,
  note = excluded.note,
  created_at = excluded.created_at;
