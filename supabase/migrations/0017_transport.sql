-- =====================================================================
-- NegoLinks Education ERP — Migration 0017: Transport
-- Vehicles, routes (with fares + stops), and student assignments. A route
-- can't be filled past its assigned vehicle's capacity; a partial unique
-- index keeps a student on at most one active route.
-- Depends on: 0001–0016
-- =====================================================================

do $$ begin
  create type vehicle_status as enum ('active','maintenance','inactive');
exception when duplicate_object then null; end $$;

create table if not exists public.vehicles (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  plate_number   text,
  model          text,
  capacity       int not null default 1 check (capacity > 0),
  driver_name    text,
  driver_phone   text,
  status         vehicle_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_vehicles_institution on public.vehicles(institution_id);

create table if not exists public.transport_routes (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  description    text,
  fare           numeric(12,2) not null default 0,
  vehicle_id     uuid references public.vehicles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_routes_institution on public.transport_routes(institution_id);

create table if not exists public.route_stops (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  route_id       uuid not null references public.transport_routes(id) on delete cascade,
  name           text not null,
  sequence       int not null default 1,
  pickup_time    text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_stops_route on public.route_stops(route_id);

create table if not exists public.transport_assignments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  route_id       uuid not null references public.transport_routes(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  stop_id        uuid references public.route_stops(id) on delete set null,
  session_id     uuid references public.academic_sessions(id) on delete set null,
  assigned_at    date not null default current_date,
  ended_at       date,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tassign_route on public.transport_assignments(route_id);
create index if not exists idx_tassign_student on public.transport_assignments(student_id);
create unique index if not exists ux_transport_active on public.transport_assignments(student_id) where ended_at is null;

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['vehicles','transport_routes'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;
      create trigger trg_%1$s_updated before update on public.%1$s
      for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- capacity guard (against the route's assigned vehicle)
create or replace function public.transport_assign_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare _cap int;
begin
  if new.ended_at is null then
    select v.capacity into _cap from public.transport_routes r join public.vehicles v on v.id = r.vehicle_id where r.id = new.route_id;
    if _cap is not null and (select count(*) from public.transport_assignments a where a.route_id = new.route_id and a.ended_at is null) >= _cap then
      raise exception 'Route is at vehicle capacity';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_tassign_before on public.transport_assignments;
create trigger trg_tassign_before before insert on public.transport_assignments
  for each row execute function public.transport_assign_before();

-- ---------- Access helper + RLS ----------
create or replace function public.is_transport_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
                 and role in ('institution_admin','principal','vice_principal'));
$$;

alter table public.vehicles              enable row level security;
alter table public.transport_routes      enable row level security;
alter table public.route_stops           enable row level security;
alter table public.transport_assignments enable row level security;

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists vehicles_manage on public.vehicles;
create policy vehicles_manage on public.vehicles
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()));

drop policy if exists routes_read on public.transport_routes;
create policy routes_read on public.transport_routes
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists routes_manage on public.transport_routes;
create policy routes_manage on public.transport_routes
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()));

drop policy if exists stops_read on public.route_stops;
create policy stops_read on public.route_stops
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists stops_manage on public.route_stops;
create policy stops_manage on public.route_stops
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()));

drop policy if exists tassign_read on public.transport_assignments;
create policy tassign_read on public.transport_assignments
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_transport_staff() or public.is_student_self(student_id) or public.is_my_ward(student_id)))
  );
drop policy if exists tassign_manage on public.transport_assignments;
create policy tassign_manage on public.transport_assignments
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_transport_staff()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.vehicles, public.transport_routes, public.route_stops, public.transport_assignments to authenticated;
grant execute on function public.is_transport_staff() to authenticated;

-- =====================================================================
-- End of 0017_transport.sql
-- =====================================================================
