-- =====================================================================
-- NegoLinks Education ERP — Migration 0018: Inventory
-- Items with live stock levels, categories, and a movement ledger.
-- Every movement (receive / issue / adjust) carries a signed change; a
-- trigger applies it, records the running balance, and blocks issuing
-- more than is in stock. Internal — staff only.
-- Depends on: 0001–0017
-- =====================================================================

do $$ begin
  create type movement_type as enum ('receive','issue','adjust');
exception when duplicate_object then null; end $$;

create table if not exists public.inventory_categories (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);

create table if not exists public.inventory_items (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category_id    uuid references public.inventory_categories(id) on delete set null,
  name           text not null,
  sku            text,
  unit           text not null default 'unit',
  quantity       int not null default 0,
  reorder_level  int not null default 0,
  unit_cost      numeric(12,2),
  location       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_items_institution on public.inventory_items(institution_id);
create index if not exists idx_items_category on public.inventory_items(category_id);

create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  item_id        uuid not null references public.inventory_items(id) on delete cascade,
  type           movement_type not null,
  change         int not null,                 -- signed: + receive, - issue, ± adjust
  issued_to      text,
  note           text,
  balance_after  int not null default 0,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_movements_item on public.stock_movements(item_id, created_at desc);

-- updated_at on items & categories
do $$
declare t text;
begin
  foreach t in array array['inventory_categories','inventory_items'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;
      create trigger trg_%1$s_updated before update on public.%1$s
      for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- apply a movement to item stock, capture running balance, block oversell
create or replace function public.stock_movement_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare _qty int;
begin
  update public.inventory_items set quantity = quantity + new.change where id = new.item_id returning quantity into _qty;
  if _qty is null then raise exception 'Item not found'; end if;
  if _qty < 0 then raise exception 'Insufficient stock'; end if;
  new.balance_after := _qty;
  return new;
end $$;
drop trigger if exists trg_movement_before on public.stock_movements;
create trigger trg_movement_before before insert on public.stock_movements
  for each row execute function public.stock_movement_before();

-- ---------- Access helper + RLS (internal: staff only) ----------
create or replace function public.is_inventory_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
                 and role in ('institution_admin','principal','vice_principal','bursar'));
$$;

alter table public.inventory_categories enable row level security;
alter table public.inventory_items      enable row level security;
alter table public.stock_movements      enable row level security;

drop policy if exists invcat_read on public.inventory_categories;
create policy invcat_read on public.inventory_categories
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists invcat_manage on public.inventory_categories;
create policy invcat_manage on public.inventory_categories
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()));

drop policy if exists items_read on public.inventory_items;
create policy items_read on public.inventory_items
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists items_manage on public.inventory_items;
create policy items_manage on public.inventory_items
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()));

drop policy if exists movements_read on public.stock_movements;
create policy movements_read on public.stock_movements
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists movements_manage on public.stock_movements;
create policy movements_manage on public.stock_movements
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_inventory_staff()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.inventory_categories, public.inventory_items, public.stock_movements to authenticated;
grant execute on function public.is_inventory_staff() to authenticated;

-- =====================================================================
-- End of 0018_inventory.sql
-- =====================================================================
