-- =====================================================================
-- NegoLinks Education ERP — Migration 0005: Attendance
-- Student attendance (daily by arm, or by subject/course) and staff
-- attendance, plus an atomic save_attendance() that replaces a class's
-- marks for a day in one transaction. Enrollment rosters come from 0004.
-- Depends on: 0001–0004
-- =====================================================================

do $$ begin
  create type attendance_status as enum ('present','absent','late','excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_attendance_status as enum ('present','absent','late','on_leave');
exception when duplicate_object then null; end $$;

-- ---------- Student attendance ----------
create table if not exists public.attendance_records (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  date           date not null,
  student_id     uuid not null references public.students(id) on delete cascade,
  status         attendance_status not null default 'present',
  class_arm_id   uuid references public.class_arms(id) on delete set null,   -- school context
  subject_id     uuid references public.subjects(id) on delete set null,     -- course/period context
  session_id     uuid references public.academic_sessions(id) on delete set null,
  term_id        uuid references public.academic_terms(id) on delete set null,
  note           text,
  recorded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_att_student_date on public.attendance_records(student_id, date);
create index if not exists idx_att_arm_date on public.attendance_records(class_arm_id, date);
-- One daily record per student; one per student per subject when subject-scoped.
create unique index if not exists uniq_att_daily
  on public.attendance_records(student_id, date) where subject_id is null;
create unique index if not exists uniq_att_subject
  on public.attendance_records(student_id, date, subject_id) where subject_id is not null;

-- ---------- Staff attendance ----------
create table if not exists public.staff_attendance (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  date           date not null,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  status         staff_attendance_status not null default 'present',
  check_in       time,
  check_out      time,
  note           text,
  recorded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (staff_id, date)
);
create index if not exists idx_staffatt_date on public.staff_attendance(institution_id, date);

-- =====================================================================
-- Access helpers
-- =====================================================================
create or replace function public.is_staff_record_self(_staff uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = _staff and user_id = auth.uid());
$$;

create or replace function public.can_mark_attendance()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_academic_manager() or exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('teacher','class_teacher','lecturer')
  );
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.attendance_records enable row level security;
alter table public.staff_attendance   enable row level security;

-- students' attendance: staff read all; student reads own; parent reads ward's.
drop policy if exists att_read on public.attendance_records;
create policy att_read on public.attendance_records
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or public.is_student_self(student_id)
    or public.is_my_ward(student_id)
  );
drop policy if exists att_manage on public.attendance_records;
create policy att_manage on public.attendance_records
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_mark_attendance()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_mark_attendance()));

-- staff attendance: managers read all; a staff member reads their own.
drop policy if exists staffatt_read on public.staff_attendance;
create policy staffatt_read on public.staff_attendance
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_academic_manager() or public.is_staff_record_self(staff_id)))
  );
drop policy if exists staffatt_manage on public.staff_attendance;
create policy staffatt_manage on public.staff_attendance
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal','vice_principal']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal','vice_principal']::app_role[])));

-- =====================================================================
-- Atomic save: replace one class/subject's marks for a date.
-- SECURITY INVOKER so the att_manage policy is enforced for the caller.
-- =====================================================================
create or replace function public.save_attendance(
  _institution uuid, _date date, _class_arm uuid, _subject uuid,
  _session uuid, _term uuid, _records jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.attendance_records
   where institution_id = _institution
     and date = _date
     and class_arm_id is not distinct from _class_arm
     and subject_id   is not distinct from _subject;

  insert into public.attendance_records
    (institution_id, date, student_id, status, class_arm_id, subject_id, session_id, term_id, recorded_by)
  select _institution, _date, (r->>'student_id')::uuid, (r->>'status')::attendance_status,
         _class_arm, _subject, _session, _term, auth.uid()
  from jsonb_array_elements(_records) r;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.attendance_records, public.staff_attendance to authenticated;
grant execute on function
  public.is_staff_record_self(uuid), public.can_mark_attendance(),
  public.save_attendance(uuid, date, uuid, uuid, uuid, uuid, jsonb)
  to authenticated;

-- =====================================================================
-- End of 0005_attendance.sql
-- =====================================================================
