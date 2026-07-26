-- Reading module ("Mein Regal"): per-user bookshelf, ported from the
-- standalone mein-regal HTML tool (localStorage) to Supabase.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'plan' check (status in ('done', 'open', 'plan')),
  title text not null,
  author text,
  year integer,
  genres jsonb not null default '[]',
  notes jsonb not null default '[]',
  blurb text,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "books_all_own" on public.books for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index books_user_status_idx on public.books(user_id, status);
