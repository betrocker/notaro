create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  created_at timestamp without time zone default now(),
  trial_started_at timestamp with time zone default timezone('utc'::text, now()),
  trial_ends_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days')
);

create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  name text,
  phone text,
  address text,
  note text,
  created_at timestamp without time zone default now()
);

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  name text,
  note text,
  created_at timestamp without time zone default now()
);

create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text,
  description text,
  checklist_items jsonb not null default '[]'::jsonb,
  price numeric,
  status text,
  scheduled_date date,
  deadline_date date,
  created_at timestamp without time zone default now(),
  completed_at timestamp with time zone,
  archived_at timestamp with time zone
);

alter table public.jobs
  add column if not exists checklist_items jsonb not null default '[]'::jsonb;

alter table public.jobs
  add column if not exists deadline_date date;

create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  title text,
  amount numeric,
  created_at timestamp without time zone default now()
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  amount numeric,
  payment_date date,
  note text
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_number text not null,
  sequence_number integer not null,
  year integer not null,
  issued_at date not null default current_date,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.job_images (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  image_url text,
  created_at timestamp without time zone default timezone('utc'::text, now()),
  user_id uuid default auth.uid() references public.users(id) on delete cascade,
  kind text not null default 'before',
  storage_path text
);

create table if not exists public.job_invoice_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  title text not null,
  unit text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total numeric not null default 0,
  position integer not null default 1,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_client_id_idx on public.jobs(client_id);
create index if not exists jobs_scheduled_date_idx on public.jobs(scheduled_date);
create index if not exists invoices_user_id_idx on public.invoices(user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', null)
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.job_images enable row level security;
alter table public.job_invoice_items enable row level security;

drop policy if exists "Users can read own user row" on public.users;
create policy "Users can read own user row"
on public.users for select
using (auth.uid() = id);

drop policy if exists "Users can manage own user row" on public.users;
create policy "Users can manage own user row"
on public.users for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can manage own clients" on public.clients;
create policy "Users can manage own clients"
on public.clients for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own projects" on public.projects;
create policy "Users can manage own projects"
on public.projects for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own jobs" on public.jobs;
create policy "Users can manage own jobs"
on public.jobs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoices" on public.invoices;
create policy "Users can manage own invoices"
on public.invoices for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own job images" on public.job_images;
create policy "Users can manage own job images"
on public.job_images for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoice items" on public.job_invoice_items;
create policy "Users can manage own invoice items"
on public.job_invoice_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own expenses via jobs" on public.expenses;
create policy "Users can manage own expenses via jobs"
on public.expenses for all
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = expenses.job_id and jobs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs
    where jobs.id = expenses.job_id and jobs.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own payments via jobs" on public.payments;
create policy "Users can manage own payments via jobs"
on public.payments for all
using (
  exists (
    select 1
    from public.jobs
    where jobs.id = payments.job_id and jobs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.jobs
    where jobs.id = payments.job_id and jobs.user_id = auth.uid()
  )
);
