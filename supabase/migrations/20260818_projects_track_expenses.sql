-- Optional ledger tracking for projects. Safe to re-run.
-- When track_expenses is false, spend stays on the project only
-- (no Money feed, no account balance change, no net-worth impact).

alter table public.projects
  add column if not exists track_expenses boolean default true;

update public.projects
  set track_expenses = true
  where track_expenses is null;
