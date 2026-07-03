-- =====================================================================
-- NegoLinks Education ERP — Migration 0016: Hostel
-- Blocks → rooms → allocations. Triggers stop a room being allocated past
-- capacity, and a partial unique index stops a student holding two beds.
-- Depends on: 0001–0015
-- =====================================================================

do $$ begin
  create type hostel_gender as enum ('male','female','mixed');
exception when duplicate_object then null; end $$;

create table if not exists public.hostels (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  name            text not null,
  gender          hostel_gender not null default 'mixed',
  warden_staff_id uuid references public.staff(id) on delete set null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_hostels_institution on public.hostels(institution_id);

create table if not exists public.hostel_rooms (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  hostel_id      uuid not null references public.hostels(id) on delete cascade,
  room_number    text not null,
  capacity       int not null default 1 check (capacity > 0),
  floor          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hostel_id, room_number)
);
create index if not exists idx_rooms_hostel on public.hostel_rooms(hostel_id);

create table if not exists public.hostel_allocations (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  room_id        uuid not null references public.hostel_rooms(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  session_id     uuid references public.academic_sessions(id) on delete set null,
  allocated_at   date not null default current_date,
  vacated_at     date,
  created_at     timestamptz not null default now()
);
create index if not exists idx_alloc_room on public.hostel_allocations(room_id);
create index if not exists idx_alloc_student on public.hostel_allocations(student_id);
-- one active bed per student
create unique index if not exists ux_alloc_active on public.hostel_allocations(student_id) where vacated_at is null;

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['hostels','hostel_rooms'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;
      create trigger trg_%1$s_updated before update on public.%1$s
      for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- capacity guard
create or replace function public.hostel_alloc_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vacated_at is null then
    if (select count(*) from public.hostel_allocations a where a.room_id = new.room_id and a.vacated_at is null)
       >= (select capacity from public.hostel_rooms where id = new.room_id) then
      raise exception 'Room is full';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_alloc_before on public.hostel_allocations;
create trigger trg_alloc_before before insert on public.hostel_allocations
  for each row execute function public.hostel_alloc_before();

-- ---------- Access helper + RLS ----------
create or replace function public.is_hostel_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
                 and role in ('institution_admin','principal','vice_principal'));
$$;

alter table public.hostels            enable row level security;
alter table public.hostel_rooms       enable row level security;
alter table public.hostel_allocations enable row level security;

drop policy if exists hostels_read on public.hostels;
create policy hostels_read on public.hostels
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists hostels_manage on public.hostels;
create policy hostels_manage on public.hostels
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()));

drop policy if exists rooms_read on public.hostel_rooms;
create policy rooms_read on public.hostel_rooms
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists rooms_manage on public.hostel_rooms;
create policy rooms_manage on public.hostel_rooms
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()));

drop policy if exists alloc_read on public.hostel_allocations;
create policy alloc_read on public.hostel_allocations
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_hostel_staff() or public.is_student_self(student_id) or public.is_my_ward(student_id)))
  );
drop policy if exists alloc_manage on public.hostel_allocations;
create policy alloc_manage on public.hostel_allocations
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_hostel_staff()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.hostels, public.hostel_rooms, public.hostel_allocations to authenticated;
grant execute on function public.is_hostel_staff() to authenticated;

-- =====================================================================
-- End of 0016_hostel.sql
-- =====================================================================
