-- Additive migration for: event folders, event type (weekly/custom), guest count,
-- calendar-backed event days, and per-event customizable meal types.
-- No existing rows are deleted or altered destructively. Run backfill blocks once.

create table if not exists public.menu_event_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists menu_event_folders_user_id_idx on public.menu_event_folders(user_id);

drop trigger if exists menu_event_folders_fill_user_id on public.menu_event_folders;
create trigger menu_event_folders_fill_user_id
before insert on public.menu_event_folders
for each row execute function public.fill_user_id_from_auth();

alter table public.menu_event_folders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_folders' and policyname='menu_event_folders_select_own') then
    create policy "menu_event_folders_select_own" on public.menu_event_folders for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_folders' and policyname='menu_event_folders_insert_own') then
    create policy "menu_event_folders_insert_own" on public.menu_event_folders for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_folders' and policyname='menu_event_folders_update_own') then
    create policy "menu_event_folders_update_own" on public.menu_event_folders for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_folders' and policyname='menu_event_folders_delete_own') then
    create policy "menu_event_folders_delete_own" on public.menu_event_folders for delete using (user_id = auth.uid());
  end if;
end $$;

alter table public.menu_events
  add column if not exists folder_id uuid references public.menu_event_folders(id) on delete set null,
  add column if not exists event_type text not null default 'weekly',
  add column if not exists guest_count text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_events_event_type_check'
  ) then
    alter table public.menu_events add constraint menu_events_event_type_check check (event_type in ('weekly','custom'));
  end if;
end $$;

create table if not exists public.menu_event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.menu_events(id) on delete cascade,
  day_index smallint not null,
  calendar_date date,
  created_at timestamptz not null default now(),
  unique (event_id, day_index)
);

create index if not exists menu_event_days_event_id_idx on public.menu_event_days(event_id);

alter table public.menu_event_days enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_days' and policyname='menu_event_days_select_own') then
    create policy "menu_event_days_select_own" on public.menu_event_days for select using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_days' and policyname='menu_event_days_insert_own') then
    create policy "menu_event_days_insert_own" on public.menu_event_days for insert with check (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_days' and policyname='menu_event_days_update_own') then
    create policy "menu_event_days_update_own" on public.menu_event_days for update using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_days' and policyname='menu_event_days_delete_own') then
    create policy "menu_event_days_delete_own" on public.menu_event_days for delete using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
end $$;

create table if not exists public.menu_event_meal_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.menu_events(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, key)
);

create index if not exists menu_event_meal_types_event_id_idx on public.menu_event_meal_types(event_id);

alter table public.menu_event_meal_types enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_meal_types' and policyname='menu_event_meal_types_select_own') then
    create policy "menu_event_meal_types_select_own" on public.menu_event_meal_types for select using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_meal_types' and policyname='menu_event_meal_types_insert_own') then
    create policy "menu_event_meal_types_insert_own" on public.menu_event_meal_types for insert with check (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_meal_types' and policyname='menu_event_meal_types_update_own') then
    create policy "menu_event_meal_types_update_own" on public.menu_event_meal_types for update using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='menu_event_meal_types' and policyname='menu_event_meal_types_delete_own') then
    create policy "menu_event_meal_types_delete_own" on public.menu_event_meal_types for delete using (
      exists (select 1 from public.menu_events e where e.id = event_id and e.user_id = auth.uid())
    );
  end if;
end $$;

-- Backfill: give every existing event 7 weekday-days and the 4 legacy meal types,
-- so existing menu_entries keep resolving under the new model. Pure INSERT, idempotent.
insert into public.menu_event_days (event_id, day_index, calendar_date)
select e.id, d.day_index, null
from public.menu_events e
cross join (select generate_series(1,7) as day_index) d
on conflict (event_id, day_index) do nothing;

insert into public.menu_event_meal_types (event_id, key, label, sort_order)
select e.id, m.key, m.label, m.sort_order
from public.menu_events e
cross join (
  values
    ('breakfast', 'Завтрак', 0),
    ('lunch', 'Обед', 1),
    ('dinner', 'Ужин', 2),
    ('late_snack', 'Полдник', 3)
) as m(key, label, sort_order)
on conflict (event_id, key) do nothing;

-- Loosen the meal_type enum: custom per-event meal types are no longer a fixed set.
-- No data is altered or removed; only the CHECK constraint is dropped. Validity is
-- now enforced in the application against menu_event_meal_types.key for the event.
alter table public.menu_entries drop constraint if exists menu_entries_meal_type_check;
