create extension if not exists pgcrypto;

create or replace function public.fill_user_id_from_auth()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own" on public.profiles
      for select using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own" on public.profiles
      for update using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dishes_user_id_idx on public.dishes(user_id);

drop trigger if exists dishes_set_updated_at on public.dishes;
create trigger dishes_set_updated_at
before update on public.dishes
for each row execute function public.set_updated_at();

alter table public.dishes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dishes' and policyname = 'dishes_select_own'
  ) then
    create policy "dishes_select_own" on public.dishes for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dishes' and policyname = 'dishes_insert_own'
  ) then
    create policy "dishes_insert_own" on public.dishes for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dishes' and policyname = 'dishes_update_own'
  ) then
    create policy "dishes_update_own" on public.dishes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dishes' and policyname = 'dishes_delete_own'
  ) then
    create policy "dishes_delete_own" on public.dishes for delete using (user_id = auth.uid());
  end if;
end $$;

drop trigger if exists dishes_fill_user_id on public.dishes;
create trigger dishes_fill_user_id
before insert on public.dishes
for each row execute function public.fill_user_id_from_auth();

create table if not exists public.ingredient_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('weight', 'piece', 'volume')),
  package_amount numeric not null default 1,
  package_unit text not null check (package_unit in ('kg', 'g', 'pcs', 'l', 'ml')),
  package_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ingredient_products_user_id_idx on public.ingredient_products(user_id);
create index if not exists ingredient_products_user_name_idx on public.ingredient_products(user_id, name);

drop trigger if exists ingredient_products_set_updated_at on public.ingredient_products;
create trigger ingredient_products_set_updated_at
before update on public.ingredient_products
for each row execute function public.set_updated_at();

drop trigger if exists ingredient_products_fill_user_id on public.ingredient_products;
create trigger ingredient_products_fill_user_id
before insert on public.ingredient_products
for each row execute function public.fill_user_id_from_auth();

alter table public.ingredient_products enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ingredient_products' and policyname = 'ingredient_products_select_own'
  ) then
    create policy "ingredient_products_select_own" on public.ingredient_products for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ingredient_products' and policyname = 'ingredient_products_insert_own'
  ) then
    create policy "ingredient_products_insert_own" on public.ingredient_products for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ingredient_products' and policyname = 'ingredient_products_update_own'
  ) then
    create policy "ingredient_products_update_own" on public.ingredient_products for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ingredient_products' and policyname = 'ingredient_products_delete_own'
  ) then
    create policy "ingredient_products_delete_own" on public.ingredient_products for delete using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredient_products(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity_per_portion numeric not null default 0,
  usage_unit text not null check (usage_unit in ('g', 'pcs', 'l', 'ml')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dish_ingredients_user_dish_idx on public.dish_ingredients(user_id, dish_id);
create index if not exists dish_ingredients_user_ingredient_idx on public.dish_ingredients(user_id, ingredient_id);

drop trigger if exists dish_ingredients_set_updated_at on public.dish_ingredients;
create trigger dish_ingredients_set_updated_at
before update on public.dish_ingredients
for each row execute function public.set_updated_at();

drop trigger if exists dish_ingredients_fill_user_id on public.dish_ingredients;
create trigger dish_ingredients_fill_user_id
before insert on public.dish_ingredients
for each row execute function public.fill_user_id_from_auth();

alter table public.dish_ingredients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dish_ingredients' and policyname = 'dish_ingredients_select_own'
  ) then
    create policy "dish_ingredients_select_own" on public.dish_ingredients for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dish_ingredients' and policyname = 'dish_ingredients_insert_own'
  ) then
    create policy "dish_ingredients_insert_own" on public.dish_ingredients for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dish_ingredients' and policyname = 'dish_ingredients_update_own'
  ) then
    create policy "dish_ingredients_update_own" on public.dish_ingredients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'dish_ingredients' and policyname = 'dish_ingredients_delete_own'
  ) then
    create policy "dish_ingredients_delete_own" on public.dish_ingredients for delete using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.menu_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_events_user_id_idx on public.menu_events(user_id);

drop trigger if exists menu_events_set_updated_at on public.menu_events;
create trigger menu_events_set_updated_at
before update on public.menu_events
for each row execute function public.set_updated_at();

drop trigger if exists menu_events_fill_user_id on public.menu_events;
create trigger menu_events_fill_user_id
before insert on public.menu_events
for each row execute function public.fill_user_id_from_auth();

alter table public.menu_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_events' and policyname = 'menu_events_select_own'
  ) then
    create policy "menu_events_select_own" on public.menu_events for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_events' and policyname = 'menu_events_insert_own'
  ) then
    create policy "menu_events_insert_own" on public.menu_events for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_events' and policyname = 'menu_events_update_own'
  ) then
    create policy "menu_events_update_own" on public.menu_events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_events' and policyname = 'menu_events_delete_own'
  ) then
    create policy "menu_events_delete_own" on public.menu_events for delete using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.menu_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.menu_events(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','late_snack')),
  dish_id uuid references public.dishes(id) on delete set null,
  ingredient_id uuid references public.ingredient_products(id) on delete set null,
  item_type text not null default 'dish',
  portions numeric not null default 1,
  variant_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_entries add column if not exists variant_name text;
alter table public.menu_entries add column if not exists event_id uuid references public.menu_events(id) on delete cascade;
alter table public.menu_entries add column if not exists ingredient_id uuid references public.ingredient_products(id) on delete set null;
alter table public.menu_entries add column if not exists item_type text not null default 'dish';

create index if not exists menu_entries_user_week_meal_idx on public.menu_entries(user_id, weekday, meal_type);
create index if not exists menu_entries_event_id_idx on public.menu_entries(event_id);

drop trigger if exists menu_entries_set_updated_at on public.menu_entries;
create trigger menu_entries_set_updated_at
before update on public.menu_entries
for each row execute function public.set_updated_at();

drop trigger if exists menu_entries_fill_user_id on public.menu_entries;
create trigger menu_entries_fill_user_id
before insert on public.menu_entries
for each row execute function public.fill_user_id_from_auth();

alter table public.menu_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_entries' and policyname = 'menu_entries_select_own'
  ) then
    create policy "menu_entries_select_own" on public.menu_entries for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_entries' and policyname = 'menu_entries_insert_own'
  ) then
    create policy "menu_entries_insert_own" on public.menu_entries for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_entries' and policyname = 'menu_entries_update_own'
  ) then
    create policy "menu_entries_update_own" on public.menu_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_entries' and policyname = 'menu_entries_delete_own'
  ) then
    create policy "menu_entries_delete_own" on public.menu_entries for delete using (user_id = auth.uid());
  end if;
end $$;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('dish', 'ingredient')),
  dish_id uuid references public.dishes(id) on delete cascade,
  ingredient_id uuid references public.ingredient_products(id) on delete cascade,
  portions numeric,
  quantity numeric,
  quantity_unit text check (quantity_unit in ('g', 'pcs', 'l', 'ml')),
  source_menu_entry_id uuid references public.menu_entries(id) on delete set null,
  title_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cart_items_user_idx on public.cart_items(user_id);

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

drop trigger if exists cart_items_fill_user_id on public.cart_items;
create trigger cart_items_fill_user_id
before insert on public.cart_items
for each row execute function public.fill_user_id_from_auth();

alter table public.cart_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_items_select_own'
  ) then
    create policy "cart_items_select_own" on public.cart_items for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_items_insert_own'
  ) then
    create policy "cart_items_insert_own" on public.cart_items for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_items_update_own'
  ) then
    create policy "cart_items_update_own" on public.cart_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_items_delete_own'
  ) then
    create policy "cart_items_delete_own" on public.cart_items for delete using (user_id = auth.uid());
  end if;
end $$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
