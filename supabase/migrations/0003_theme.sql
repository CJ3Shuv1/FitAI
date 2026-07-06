alter table public.user_settings
  add column theme text not null default 'copper'
  check (theme in ('copper', 'ocean', 'forest', 'berry', 'mono'));
