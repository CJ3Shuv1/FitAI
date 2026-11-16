-- "Meine Welt": one row per user and country (ISO 3166-1 alpha-3), with
-- status, optional dates, note, km, photo references and Google-Maps links.
-- Photo files live in the private storage bucket "world-photos" under
-- <user_id>/<iso3>/<uuid>.jpg; the row only keeps their paths.

create table public.world_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  iso3 text not null,
  status text not null check (status in ('visited', 'planned', 'wish')),
  date_from date,
  date_to date,
  note text,
  km numeric,
  photos jsonb not null default '[]',
  routes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, iso3)
);

alter table public.world_countries enable row level security;

create policy "world_countries_all_own" on public.world_countries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('world-photos', 'world-photos', false)
on conflict (id) do nothing;

create policy "world_photos_all_own"
  on storage.objects for all
  using (bucket_id = 'world-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'world-photos' and auth.uid()::text = (storage.foldername(name))[1]);
