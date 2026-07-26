-- Curated exercise library tagged by muscle group, used to suggest
-- alternatives for an exercise in the training plan (e.g. "Bankdrücken"
-- swapped for another chest exercise if the equipment isn't free).
-- Same shared/global + user-additions pattern as public.foods.

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null check (muscle_group in (
    'brust', 'ruecken', 'schultern', 'bizeps', 'trizeps', 'beine', 'core', 'ganzkoerper'
  )),
  created_at timestamptz not null default now()
);

alter table public.exercise_library enable row level security;

create policy "exercise_library_select_shared_or_own" on public.exercise_library
  for select using (user_id is null or auth.uid() = user_id);

create policy "exercise_library_insert_own" on public.exercise_library
  for insert with check (auth.uid() = user_id);

create policy "exercise_library_update_own" on public.exercise_library
  for update using (auth.uid() = user_id);

create policy "exercise_library_delete_own" on public.exercise_library
  for delete using (auth.uid() = user_id);

insert into public.exercise_library (name, muscle_group) values
-- Brust
('Bankdrücken (Langhantel)', 'brust'),
('Bankdrücken (Kurzhantel)', 'brust'),
('Schrägbankdrücken (Kurzhantel)', 'brust'),
('Schrägbankdrücken (Langhantel)', 'brust'),
('Brustpresse', 'brust'),
('Cable Flys', 'brust'),
('Butterfly', 'brust'),
('Dips', 'brust'),
('Liegestütze', 'brust'),
('Pec Deck', 'brust'),
-- Rücken
('Klimmzüge', 'ruecken'),
('Klimmzug eng', 'ruecken'),
('Latzug breit', 'ruecken'),
('Latzug eng', 'ruecken'),
('Rudern Maschine unilateral', 'ruecken'),
('Chest-Supported Row', 'ruecken'),
('T-Bar Rudern', 'ruecken'),
('Langhantelrudern', 'ruecken'),
('Kurzhantelrudern einarmig', 'ruecken'),
('Überzüge Kabel', 'ruecken'),
('Butterfly Reverse', 'ruecken'),
('Facepulls', 'ruecken'),
('Hyperextensions', 'ruecken'),
-- Schultern
('Schulterdrücken (KH/Maschine)', 'schultern'),
('Schulterdrücken KH', 'schultern'),
('Schulterdrücken Langhantel', 'schultern'),
('Seitheben (KH/Maschine)', 'schultern'),
('Seitheben einarmig Kabel', 'schultern'),
('Frontheben', 'schultern'),
('Shrugs', 'schultern'),
('Arnold Press', 'schultern'),
-- Trizeps
('Trizeps-Drücken (Kabel) einarmig', 'trizeps'),
('Seilzug-Pushdown (Rope)', 'trizeps'),
('Trizeps-Dips', 'trizeps'),
('Skullcrusher', 'trizeps'),
('Enges Bankdrücken', 'trizeps'),
('Kickbacks', 'trizeps'),
-- Bizeps
('Gerade Curls Kabelturm', 'bizeps'),
('Hammer Curls', 'bizeps'),
('Bayesian Curls', 'bizeps'),
('Konzentrationscurls', 'bizeps'),
('Langhantelcurls', 'bizeps'),
('Klimmzug eng (Bizeps-Fokus)', 'bizeps'),
-- Beine
('Kniebeugen (Langhantel)', 'beine'),
('Beinpresse', 'beine'),
('Ausfallschritte', 'beine'),
('Beinstrecker', 'beine'),
('Beinbeuger', 'beine'),
('Rumänisches Kreuzheben', 'beine'),
('Wadenheben', 'beine'),
('Hip Thrust', 'beine'),
-- Core
('Pallof Press', 'core'),
('Plank', 'core'),
('Side Plank', 'core'),
('Hanging Knee Raises', 'core'),
('Cable Crunch', 'core'),
('Ab Wheel Rollout', 'core'),
('Russian Twist', 'core'),
-- Ganzkörper
('Kreuzheben', 'ganzkoerper'),
('Kettlebell Swing', 'ganzkoerper'),
('Burpees', 'ganzkoerper'),
('Clean and Press', 'ganzkoerper');
