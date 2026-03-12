-- Meal Menu Planner - Supabase schema + RLS
-- Run this in Supabase SQL editor.

-- 1) Extensions
create extension if not exists pgcrypto;

-- 2) Helper: updated_at
$&
-- Helper: auto-fill user_id from auth.uid()
create or replace function public.fill_user_id_from_auth()
returns trigger
language plpgsql
as 2204
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
2204;


-- 3) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4) Dishes
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dishes_user_id_idx on public.dishes(user_id);

create trigger dishes_set_updated_at
before update on public.dishes
for each row execute function public.set_updated_at();

alter table public.dishes enable row level security;

create policy "dishes_select_own" on public.dishes
  for select
  using (user_id = auth.uid());

create policy "dishes_insert_own" on public.dishes
  for insert
  with check (user_id = auth.uid());

create policy "dishes_update_own" on public.dishes
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "dishes_delete_own" on public.dishes
  for delete
  using (user_id = auth.uid());

-- Auto-fill user_id for dishes
drop trigger if exists dishes_fill_user_id on public.dishes;
create trigger dishes_fill_user_id
before insert on public.dishes
for each row execute function public.fill_user_id_from_auth();

-- 5) Dish ingredients
create table if not exists public.dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_name text not null,
  grams_per_portion numeric not null,
  price_per_gram numeric,
  price_per_unit numeric,
  unit_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dish_ingredients_user_dish_idx on public.dish_ingredients(user_id, dish_id);

create trigger dish_ingredients_set_updated_at
before update on public.dish_ingredients
for each row execute function public.set_updated_at();

alter table public.dish_ingredients enable row level security;

create policy "dish_ingredients_select_own" on public.dish_ingredients
  for select
  using (user_id = auth.uid());

create policy "dish_ingredients_insert_own" on public.dish_ingredients
  for insert
  with check (user_id = auth.uid());

create policy "dish_ingredients_update_own" on public.dish_ingredients
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "dish_ingredients_delete_own" on public.dish_ingredients
  for delete
  using (user_id = auth.uid());

drop trigger if exists dish_ingredients_fill_user_id on public.dish_ingredients;
create trigger dish_ingredients_fill_user_id
before insert on public.dish_ingredients
for each row execute function public.fill_user_id_from_auth();

-- 6) Menu entries
create table if not exists public.menu_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','late_snack')),
  dish_id uuid references public.dishes(id) on delete set null,
  portions numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_entries_user_week_meal_idx on public.menu_entries(user_id, weekday, meal_type);

create trigger menu_entries_set_updated_at
before update on public.menu_entries
for each row execute function public.set_updated_at();

alter table public.menu_entries enable row level security;

create policy "menu_entries_select_own" on public.menu_entries
  for select
  using (user_id = auth.uid());

create policy "menu_entries_insert_own" on public.menu_entries
  for insert
  with check (user_id = auth.uid());

create policy "menu_entries_update_own" on public.menu_entries
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "menu_entries_delete_own" on public.menu_entries
  for delete
  using (user_id = auth.uid());

-- Auto-fill user_id for menu entries
drop trigger if exists menu_entries_fill_user_id on public.menu_entries;
create trigger menu_entries_fill_user_id
before insert on public.menu_entries
for each row execute function public.fill_user_id_from_auth();

-- 7) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The auth schema triggers need to be created there:
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
