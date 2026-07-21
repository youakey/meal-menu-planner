-- Baseline migration documenting changes that were already applied to the live
-- database out-of-band (menu_events table, menu_entries.event_id/ingredient_id/item_type,
-- weekday 1-7, 'ml' unit support). This file is a no-op against the current prod DB
-- (all statements are idempotent / IF NOT EXISTS) — it exists so schema.sql and the
-- migrations folder describe reality going forward. Do NOT re-run destructively.

create table if not exists public.menu_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_entries add column if not exists event_id uuid references public.menu_events(id) on delete cascade;
alter table public.menu_entries add column if not exists ingredient_id uuid references public.ingredient_products(id) on delete set null;
alter table public.menu_entries add column if not exists item_type text not null default 'dish';

-- weekday constraint was widened live from 1-5 to 1-7; keep in sync defensively
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'menu_entries_weekday_check'
  ) then
    alter table public.menu_entries drop constraint menu_entries_weekday_check;
  end if;
  alter table public.menu_entries add constraint menu_entries_weekday_check check (weekday between 1 and 7);
end $$;
