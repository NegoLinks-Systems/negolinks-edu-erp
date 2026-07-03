-- =====================================================================
-- NegoLinks Education ERP — Migration 0003: People
-- Students, staff, guardians, and student↔guardian relationships.
-- Access rules: staff see their institution's people; a parent sees only
-- their wards; a student sees only themselves. Enforced via RLS.
-- Depends on: 0001_foundation.sql, 0002_branding_storage.sql
-- =====================================================================

-- ---------- Enums ----------
do $$ begin
  create type student_status as enum
    ('prospective','enrolled','graduated','transferred','withdrawn','suspended','deferred');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_status as enum
    ('active','on_leave','suspended','terminated','retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum
    ('full_time','part_time','contract','visiting','volunteer');
exception when duplicate_object then null; end $$;

-- ---------- Students ----------
create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  campus_id        uuid references public.campuses(id) on delete set null,
  user_id          uuid references auth.users(id) on delete set null,  -- portal login
  admission_number text not null,
  first_name       text not null,
  last_name        text not null,
  middle_name      text,
  date_of_birth    date,
  gender           text,
  email            citext,
  phone            text,
  address          text,
  photo_url        text,
  nationality      text,
  state_of_origin  text,
  blood_group      text,
  genotype         text,
  medical_notes    text,           -- allergies / conditions (sensitive)
  admission_date   date,
  current_level    text,           -- e.g. 'JSS1' or '100L'; structured placement lands in the Academic module
  status           student_status not null default 'enrolled',
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (institution_id, admission_number)
);
create index if not exists idx_students_institution on public.students(institution_id);
create index if not exists idx_students_user on public.students(user_id);
create index if not exists idx_students_status on public.students(institution_id, status);

-- ---------- Staff ----------
create table if not exists public.staff (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  campus_id        uuid references public.campuses(id) on delete set null,
  user_id          uuid references auth.users(id) on delete set null,
  staff_number     text not null,
  first_name       text not null,
  last_name        text not null,
  middle_name      text,
  date_of_birth    date,
  gender           text,
  email            citext,
  phone            text,
  address          text,
  photo_url        text,
  job_title        text,
  department       text,           -- loose for now; FK to departments lands in the Academic module
  employment_type  employment_type not null default 'full_time',
  qualification    text,
  date_joined      date,
  status           staff_status not null default 'active',
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (institution_id, staff_number)
);
create index if not exists idx_staff_institution on public.staff(institution_id);
create index if not exists idx_staff_user on public.staff(user_id);

-- ---------- Guardians (parents / guardians) ----------
create table if not exists public.guardians (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,   -- parent portal login
  first_name      text not null,
  last_name       text not null,
  email           citext,
  phone           text,
  whatsapp        text,
  address         text,
  occupation      text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_guardians_institution on public.guardians(institution_id);
create index if not exists idx_guardians_user on public.guardians(user_id);

-- ---------- Student ↔ Guardian (many-to-many) ----------
create table if not exists public.student_guardians (
  id                   uuid primary key default gen_random_uuid(),
  institution_id       uuid not null references public.institutions(id) on delete cascade,
  student_id           uuid not null references public.students(id) on delete cascade,
  guardian_id          uuid not null references public.guardians(id) on delete cascade,
  relationship         text not null default 'guardian',  -- father / mother / guardian / ...
  is_primary           boolean not null default false,
  is_emergency_contact boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (student_id, guardian_id)
);
create index if not exists idx_sg_student on public.student_guardians(student_id);
create index if not exists idx_sg_guardian on public.student_guardians(guardian_id);

-- ---------- updated_at triggers ----------
drop trigger if exists trg_students_updated on public.students;
create trigger trg_students_updated before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_updated on public.staff;
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

drop trigger if exists trg_guardians_updated on public.guardians;
create trigger trg_guardians_updated before update on public.guardians
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Access helper functions (SECURITY DEFINER, bypass RLS safely)
-- =====================================================================
-- Any institution member who is not a parent/student/guardian is "staff".
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role not in ('parent','student','guardian')
  );
$$;

-- Is the current user a guardian of this student?
create or replace function public.is_my_ward(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.student_guardians sg
    join public.guardians g on g.id = sg.guardian_id
    where sg.student_id = _student and g.user_id = auth.uid()
  );
$$;

-- Is this student record the current user's own?
create or replace function public.is_student_self(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.students where id = _student and user_id = auth.uid()
  );
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.students          enable row level security;
alter table public.staff             enable row level security;
alter table public.guardians         enable row level security;
alter table public.student_guardians enable row level security;

-- ----- students -----
drop policy if exists students_read on public.students;
create policy students_read on public.students
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or user_id = auth.uid()
    or public.is_my_ward(id)
  );

drop policy if exists students_manage on public.students;
create policy students_manage on public.students
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','vice_principal',
                 'admissions_officer','academic_officer']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','vice_principal',
                 'admissions_officer','academic_officer']::app_role[])));

-- ----- staff -----
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or user_id = auth.uid()
  );

drop policy if exists staff_manage on public.staff;
create policy staff_manage on public.staff
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal','vice_principal']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal','vice_principal']::app_role[])));

-- ----- guardians -----
drop policy if exists guardians_read on public.guardians;
create policy guardians_read on public.guardians
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or user_id = auth.uid()
  );

drop policy if exists guardians_manage on public.guardians;
create policy guardians_manage on public.guardians
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','admissions_officer','academic_officer']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','admissions_officer','academic_officer']::app_role[])));

-- ----- student_guardians -----
drop policy if exists sg_read on public.student_guardians;
create policy sg_read on public.student_guardians
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or public.is_my_ward(student_id)
    or public.is_student_self(student_id)
  );

drop policy if exists sg_manage on public.student_guardians;
create policy sg_manage on public.student_guardians
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','admissions_officer','academic_officer']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','admissions_officer','academic_officer']::app_role[])));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.students, public.staff, public.guardians, public.student_guardians
  to authenticated;
grant execute on function
  public.is_staff(), public.is_my_ward(uuid), public.is_student_self(uuid)
  to authenticated;

-- =====================================================================
-- End of 0003_people.sql
-- =====================================================================
