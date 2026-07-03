-- =====================================================================
-- NegoLinks Education ERP — Migration 0004: Academic structure
-- Shared time dimension (sessions/terms) + a unified subjects/courses
-- table, with a school hierarchy (classes → arms) and a tertiary
-- hierarchy (faculties → departments → programmes) side by side.
-- The institution type decides which the UI exposes — no schema fork.
-- Depends on: 0001–0003
-- =====================================================================

do $$ begin
  create type programme_award as enum
    ('certificate','diploma','national_diploma','higher_national_diploma',
     'degree','postgraduate','professional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type enrollment_status as enum ('active','completed','withdrawn','repeating');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Time dimension (every institution type uses this)
-- =====================================================================
create table if not exists public.academic_sessions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,              -- e.g. '2024/2025'
  starts_on      date,
  ends_on        date,
  is_current     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_sessions_institution on public.academic_sessions(institution_id);

create table if not exists public.academic_terms (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  name           text not null,              -- 'First Term' / 'First Semester'
  sort_order     int not null default 1,
  starts_on      date,
  ends_on        date,
  is_current     boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (session_id, name)
);
create index if not exists idx_terms_session on public.academic_terms(session_id);

-- Only one current session and one current term per institution.
create unique index if not exists uniq_current_session
  on public.academic_sessions(institution_id) where is_current;
create unique index if not exists uniq_current_term
  on public.academic_terms(institution_id) where is_current;

-- =====================================================================
-- School hierarchy
-- =====================================================================
create table if not exists public.classes (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,              -- 'JSS 1', 'Primary 4'
  level_order    int not null default 1,     -- promotion ordering
  next_class_id  uuid references public.classes(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_classes_institution on public.classes(institution_id);

create table if not exists public.class_arms (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  class_id         uuid not null references public.classes(id) on delete cascade,
  name             text not null,            -- 'A', 'Gold'
  capacity         int,
  class_teacher_id uuid references public.staff(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (class_id, name)
);
create index if not exists idx_arms_class on public.class_arms(class_id);

-- =====================================================================
-- Tertiary hierarchy
-- =====================================================================
create table if not exists public.faculties (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  code           text,
  dean_id        uuid references public.staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_faculties_institution on public.faculties(institution_id);

create table if not exists public.departments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  faculty_id     uuid references public.faculties(id) on delete set null,
  name           text not null,
  code           text,
  hod_id         uuid references public.staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_departments_institution on public.departments(institution_id);

create table if not exists public.programmes (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id  uuid references public.departments(id) on delete set null,
  name           text not null,              -- 'B.Sc Computer Science'
  code           text,
  award          programme_award,
  duration_years numeric(3,1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_programmes_institution on public.programmes(institution_id);

-- =====================================================================
-- Unified subjects / courses (schools leave credit_units & department null)
-- =====================================================================
create table if not exists public.subjects (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  code           text,                       -- 'MTH101' or null
  title          text not null,              -- 'Mathematics'
  credit_units   int,
  department_id  uuid references public.departments(id) on delete set null,
  is_elective    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, code)
);
create index if not exists idx_subjects_institution on public.subjects(institution_id);

-- =====================================================================
-- Placement & teaching (backbone for attendance and results)
-- =====================================================================
create table if not exists public.student_enrollments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  class_arm_id   uuid references public.class_arms(id) on delete set null,   -- school
  programme_id   uuid references public.programmes(id) on delete set null,   -- tertiary
  level          text,                                                        -- '100','200'
  status         enrollment_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, session_id)
);
create index if not exists idx_enroll_arm on public.student_enrollments(class_arm_id);
create index if not exists idx_enroll_programme on public.student_enrollments(programme_id);
create index if not exists idx_enroll_session on public.student_enrollments(session_id);

create table if not exists public.teaching_assignments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  session_id     uuid references public.academic_sessions(id) on delete cascade,
  class_arm_id   uuid references public.class_arms(id) on delete set null,
  programme_id   uuid references public.programmes(id) on delete set null,
  level          text,
  created_at     timestamptz not null default now(),
  unique (staff_id, subject_id, session_id, class_arm_id, programme_id)
);
create index if not exists idx_teach_staff on public.teaching_assignments(staff_id);
create index if not exists idx_teach_subject on public.teaching_assignments(subject_id);

-- =====================================================================
-- Triggers
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'academic_sessions','classes','class_arms','faculties','departments',
    'programmes','subjects','student_enrollments'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- Selecting a current session/term clears the previous one automatically.
create or replace function public.enforce_single_current_session()
returns trigger language plpgsql as $$
begin
  if new.is_current then
    update public.academic_sessions set is_current = false
      where institution_id = new.institution_id and id <> new.id and is_current;
  end if;
  return new;
end $$;
drop trigger if exists trg_session_current on public.academic_sessions;
create trigger trg_session_current before insert or update on public.academic_sessions
  for each row execute function public.enforce_single_current_session();

create or replace function public.enforce_single_current_term()
returns trigger language plpgsql as $$
begin
  if new.is_current then
    update public.academic_terms set is_current = false
      where institution_id = new.institution_id and id <> new.id and is_current;
  end if;
  return new;
end $$;
drop trigger if exists trg_term_current on public.academic_terms;
create trigger trg_term_current before insert or update on public.academic_terms
  for each row execute function public.enforce_single_current_term();

-- =====================================================================
-- Access helper + RLS
-- =====================================================================
create or replace function public.is_academic_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in
      ('institution_admin','principal','vice_principal','academic_officer',
       'dean','head_of_department','rector','provost')
  );
$$;

-- Structure tables: readable by any institution member (portals need them);
-- writable by academic managers. Applied uniformly via a loop.
do $$
declare t text;
begin
  foreach t in array array[
    'academic_sessions','academic_terms','classes','class_arms',
    'faculties','departments','programmes','subjects'
  ] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %1$s_read on public.%1$s;', t);
    execute format(
      'create policy %1$s_read on public.%1$s for select
       using (public.is_super_admin() or institution_id = public.current_institution_id());', t);

    execute format('drop policy if exists %1$s_manage on public.%1$s;', t);
    execute format(
      'create policy %1$s_manage on public.%1$s for all
       using (public.is_super_admin() or (institution_id = public.current_institution_id()
              and public.is_academic_manager()))
       with check (public.is_super_admin() or (institution_id = public.current_institution_id()
              and public.is_academic_manager()));', t);
  end loop;
end $$;

-- student_enrollments: staff see all; a student sees their own; a parent their ward's.
alter table public.student_enrollments enable row level security;
drop policy if exists enroll_read on public.student_enrollments;
create policy enroll_read on public.student_enrollments
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or public.is_student_self(student_id)
    or public.is_my_ward(student_id)
  );
drop policy if exists enroll_manage on public.student_enrollments;
create policy enroll_manage on public.student_enrollments
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and (public.is_academic_manager() or public.has_role('admissions_officer'))))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and (public.is_academic_manager() or public.has_role('admissions_officer'))));

-- teaching_assignments: staff read; academic managers manage.
alter table public.teaching_assignments enable row level security;
drop policy if exists teach_read on public.teaching_assignments;
create policy teach_read on public.teaching_assignments
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
  );
drop policy if exists teach_manage on public.teaching_assignments;
create policy teach_manage on public.teaching_assignments
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.is_academic_manager()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.is_academic_manager()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.academic_sessions, public.academic_terms, public.classes, public.class_arms,
  public.faculties, public.departments, public.programmes, public.subjects,
  public.student_enrollments, public.teaching_assignments
  to authenticated;
grant execute on function public.is_academic_manager() to authenticated;

-- =====================================================================
-- End of 0004_academic_structure.sql
-- =====================================================================
