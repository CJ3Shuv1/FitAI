-- Food library: a shared, curated set of common foods (user_id null) that
-- every user can read, plus room for users to add their own entries.
-- Used by the manual recipe builder to auto-fill macros without an AI call.

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  kcal_per_100g numeric not null,
  protein_per_100g numeric not null,
  carbs_per_100g numeric not null,
  fett_per_100g numeric not null,
  zucker_per_100g numeric not null default 0,
  default_unit text not null default 'g' check (default_unit in ('g', 'ml', 'Stück')),
  piece_weight_g numeric,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

create policy "foods_select_shared_or_own" on public.foods
  for select using (user_id is null or auth.uid() = user_id);

create policy "foods_insert_own" on public.foods
  for insert with check (auth.uid() = user_id);

create policy "foods_update_own" on public.foods
  for update using (auth.uid() = user_id);

create policy "foods_delete_own" on public.foods
  for delete using (auth.uid() = user_id);

create index foods_name_idx on public.foods using gin (to_tsvector('simple', name));

-- Seed: ~60 common foods, values per 100g (approximate, typical references).
insert into public.foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fett_per_100g, zucker_per_100g, default_unit, piece_weight_g) values
('Banane', 89, 1.1, 23, 0.3, 12, 'Stück', 120),
('Apfel', 52, 0.3, 14, 0.2, 10, 'Stück', 180),
('Ei (Hühnerei, Größe M)', 155, 13, 1.1, 11, 1.1, 'Stück', 55),
('Hähnchenbrust (roh)', 165, 31, 0, 3.6, 0, 'g', null),
('Putenbrust (roh)', 135, 30, 0, 1.7, 0, 'g', null),
('Rindfleisch, mager (roh)', 250, 26, 0, 15, 0, 'g', null),
('Schweinefilet (roh)', 143, 21, 0, 6, 0, 'g', null),
('Lachs (roh)', 208, 20, 0, 13, 0, 'g', null),
('Thunfisch (Dose, in Wasser)', 116, 26, 0, 1, 0, 'g', null),
('Reis, weiß (gekocht)', 130, 2.7, 28, 0.3, 0.1, 'g', null),
('Reis, weiß (roh)', 365, 7, 80, 0.7, 0.1, 'g', null),
('Reis, Vollkorn (gekocht)', 111, 2.6, 23, 0.9, 0.4, 'g', null),
('Nudeln (gekocht)', 158, 5.8, 31, 0.9, 0.6, 'g', null),
('Kartoffeln (gekocht)', 87, 1.9, 20, 0.1, 0.8, 'g', null),
('Süßkartoffel (gekocht)', 86, 1.6, 20, 0.1, 4.2, 'g', null),
('Couscous (gekocht)', 112, 3.8, 23, 0.2, 0, 'g', null),
('Quinoa (gekocht)', 120, 4.4, 21, 1.9, 0, 'g', null),
('Haferflocken', 389, 16.9, 66, 6.9, 0, 'g', null),
('Vollkornbrot', 247, 13, 41, 3.3, 4, 'g', null),
('Vollkorntoast', 265, 11, 43, 4, 5, 'g', null),
('Magerquark', 67, 12, 4, 0.2, 4, 'g', null),
('Naturjoghurt', 61, 3.5, 4.7, 3.3, 4.7, 'g', null),
('Griechischer Joghurt', 97, 9, 4, 5, 4, 'g', null),
('Hüttenkäse', 98, 11, 3.4, 4.3, 3.4, 'g', null),
('Milch 1,5%', 47, 3.4, 4.8, 1.5, 4.8, 'ml', null),
('Mandelmilch (ungesüßt)', 13, 0.5, 0.3, 1.1, 0.1, 'ml', null),
('Hafermilch', 47, 1, 6.6, 1.5, 4, 'ml', null),
('Gouda', 356, 25, 2.2, 27, 2.2, 'g', null),
('Feta', 264, 14, 4, 21, 4, 'g', null),
('Butter', 717, 0.9, 0.1, 81, 0.1, 'g', null),
('Olivenöl', 884, 0, 0, 100, 0, 'g', null),
('Erdnussbutter', 588, 25, 20, 50, 6, 'g', null),
('Mandeln', 579, 21, 22, 50, 4, 'g', null),
('Walnüsse', 654, 15, 14, 65, 2.6, 'g', null),
('Chiasamen', 486, 17, 42, 31, 0, 'g', null),
('Leinsamen', 534, 18, 29, 42, 0.3, 'g', null),
('Whey Protein Pulver', 380, 80, 6, 4, 3, 'g', null),
('Tofu', 76, 8, 1.9, 4.8, 0.5, 'g', null),
('Avocado', 160, 2, 9, 15, 0.7, 'Stück', 200),
('Brokkoli', 34, 2.8, 7, 0.4, 1.7, 'g', null),
('Spinat', 23, 2.9, 3.6, 0.4, 0.4, 'g', null),
('Paprika', 31, 1, 6, 0.3, 4.2, 'g', null),
('Tomate', 18, 0.9, 3.9, 0.2, 2.6, 'Stück', 120),
('Gurke', 15, 0.7, 3.6, 0.1, 1.7, 'g', null),
('Zwiebel', 40, 1.1, 9.3, 0.1, 4.2, 'Stück', 110),
('Karotten', 41, 0.9, 10, 0.2, 4.7, 'g', null),
('Zucchini', 17, 1.2, 3.1, 0.3, 2.5, 'g', null),
('Champignons', 22, 3.1, 3.3, 0.3, 2, 'g', null),
('Erbsen (TK, gekocht)', 81, 5.4, 14, 0.4, 5.7, 'g', null),
('Linsen (gekocht)', 116, 9, 20, 0.4, 1.8, 'g', null),
('Kichererbsen (gekocht)', 164, 8.9, 27, 2.6, 0, 'g', null),
('Kidneybohnen (gekocht)', 127, 8.7, 22.8, 0.5, 0, 'g', null),
('Honig', 304, 0.3, 82, 0, 82, 'g', null),
('Zucker', 400, 0, 100, 0, 100, 'g', null),
('Rosinen', 299, 3.1, 79, 0.5, 59, 'g', null),
('Datteln', 282, 2.5, 75, 0.4, 63, 'Stück', 8),
('Reiswaffeln', 387, 8.2, 81, 2.8, 0.5, 'Stück', 9),
('Ketchup', 112, 1.3, 27, 0.2, 22, 'g', null),
('Senf', 66, 4.4, 5, 3.4, 3, 'g', null),
('Sojasauce', 60, 6, 6, 0, 1, 'g', null);
