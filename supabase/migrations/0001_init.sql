-- FitAI initial schema
-- Every table is scoped to auth.uid() via RLS. No default values that leak
-- Cedric's personal data — new users start with empty rows everywhere.

create extension if not exists "pgcrypto";

-- ---------- profiles (BMR/TDEE inputs) ----------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight numeric,
  height numeric,
  age integer,
  goal text check (goal in ('bulk','cut','maintenance')),
  activity_factor numeric,
  protein_per_kg numeric,
  fat_percent numeric,
  kcal_adjust numeric,
  sugar_percent numeric,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- ---------- training_days ----------
create table public.training_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  sub text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.training_days enable row level security;
create policy "training_days_all_own" on public.training_days for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- exercises ----------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references public.training_days(id) on delete cascade,
  name text not null,
  sets integer,
  weight numeric,
  notes text,
  is_pr boolean not null default false,
  manual_group text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
create policy "exercises_all_own" on public.exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index exercises_day_id_idx on public.exercises(day_id);

-- ---------- exercise_links (auto sync-group decisions) ----------
create table public.exercise_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  norm_name text not null,
  status text not null check (status in ('linked','dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, norm_name)
);

alter table public.exercise_links enable row level security;
create policy "exercise_links_all_own" on public.exercise_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- nutrition_entries (one row per calendar date, all 7 weekdays) ----------
create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  text text,
  kcal numeric,
  protein numeric,
  carbs numeric,
  fett numeric,
  zucker numeric,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.nutrition_entries enable row level security;
create policy "nutrition_entries_all_own" on public.nutrition_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- recipes ----------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kcal_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fett_per_serving numeric,
  zucker_per_serving numeric,
  image_url text,
  cook_time_minutes integer,
  difficulty text check (difficulty in ('einfach','mittel','anspruchsvoll')),
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
create policy "recipes_all_own" on public.recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- nutrition_recipe_entries (recipe portions logged on a given day) ----------
create table public.nutrition_recipe_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  qty numeric not null default 1,
  kcal numeric,
  protein numeric,
  carbs numeric,
  fett numeric,
  zucker numeric,
  created_at timestamptz not null default now()
);

alter table public.nutrition_recipe_entries enable row level security;
create policy "nutrition_recipe_entries_all_own" on public.nutrition_recipe_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index nutrition_recipe_entries_date_idx on public.nutrition_recipe_entries(user_id, date);

-- ---------- shopping_list_items ----------
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.shopping_list_items enable row level security;
create policy "shopping_list_items_all_own" on public.shopping_list_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- weight_log ----------
create table public.weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.weight_log enable row level security;
create policy "weight_log_all_own" on public.weight_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- user_settings (AI provider keys, nutrition method) ----------
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_provider text not null default 'gemini' check (ai_provider in ('groq','gemini')),
  groq_key text,
  gemini_key text,
  pexels_key text,
  api_ninjas_key text,
  nutrition_method text not null default 'ai' check (nutrition_method in ('ai','apininjas')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "user_settings_all_own" on public.user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- storage bucket for transient plan uploads (PDF/PNG/XLSX) ----------
insert into storage.buckets (id, name, public)
values ('plan-uploads', 'plan-uploads', false)
on conflict (id) do nothing;

create policy "plan_uploads_all_own"
  on storage.objects for all
  using (bucket_id = 'plan-uploads' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'plan-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
