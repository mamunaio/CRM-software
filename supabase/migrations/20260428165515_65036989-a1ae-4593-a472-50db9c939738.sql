-- Email templates
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;
create policy "own email_templates" on public.email_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Activities (notes + status changes)
create type public.activity_type as enum ('note', 'status_change', 'follow_up');
create type public.activity_entity as enum ('contact', 'lead');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type public.activity_entity not null,
  entity_id uuid not null,
  type public.activity_type not null default 'note',
  content text not null,
  created_at timestamptz not null default now()
);
create index idx_activities_entity on public.activities(entity_type, entity_id);
alter table public.activities enable row level security;
create policy "own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Monthly revenue goals (one per user per month)
create table public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month date not null, -- first day of month
  target numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.monthly_goals enable row level security;
create policy "own monthly_goals" on public.monthly_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger function (idempotent)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_email_templates_updated before update on public.email_templates
  for each row execute function public.set_updated_at();
create trigger trg_monthly_goals_updated before update on public.monthly_goals
  for each row execute function public.set_updated_at();
