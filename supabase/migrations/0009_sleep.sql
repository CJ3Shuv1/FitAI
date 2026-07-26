-- Sleep log: one row per calendar date, hours slept (approximate).

create table public.sleep_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  hours numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.sleep_log enable row level security;

create policy "sleep_log_all_own" on public.sleep_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index sleep_log_user_date_idx on public.sleep_log(user_id, date);
