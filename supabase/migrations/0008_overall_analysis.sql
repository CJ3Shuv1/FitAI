-- Stores the last cross-domain "Gesamtanalyse" so re-runs can show deltas
-- against the previous snapshot, same pattern as nutrition_entries.

create table public.overall_analysis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.overall_analysis enable row level security;

create policy "overall_analysis_all_own" on public.overall_analysis for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
