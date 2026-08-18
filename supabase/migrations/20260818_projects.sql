-- Projects: named containers for related expenses. Idempotent.

create table if not exists public.projects (
  id                  uuid        default gen_random_uuid() primary key,
  created_by          uuid        references auth.users(id) on delete cascade not null,
  name                text        not null,
  description         text,
  emoji               text        default '📁',
  color               text        default 'indigo',
  project_type        text        check (project_type in ('capital', 'general')) not null default 'general',
  budget              numeric(15,2),
  status              text        check (status in ('active', 'completed', 'paused')) default 'active',
  start_date          date        default current_date,
  end_date            date,
  linked_asset_id     uuid,
  exclude_from_charts boolean     default true,
  track_expenses      boolean     default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  is_deleted          boolean     default false
);

alter table public.projects enable row level security;

drop policy if exists "projects_own" on public.projects;
create policy "projects_own" on public.projects
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

alter table public.transactions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_transactions_project_id
  on public.transactions(project_id)
  where project_id is not null;
