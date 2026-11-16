-- Places inside a country (name + Google-Maps link + resolved coordinates),
-- shown as pins on the globe. Route waypoints and photo locations live
-- inside the existing routes/photos jsonb, so they need no schema change.

alter table public.world_countries
  add column places jsonb not null default '[]';
