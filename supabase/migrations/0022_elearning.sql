-- =====================================================================
-- NegoLinks Education ERP — Migration 0022: E-learning
-- Lesson materials on a course, assignments, and student submissions.
-- Students submit and teachers grade through SECURITY DEFINER functions
-- (so a student can't write their own grade); students have no direct
-- write access to submissions. Reading is governed by RLS.
-- Depends on: 0001–0021
-- =====================================================================

do $$ begin
  create type material_kind as enum ('file','link','video','note');
exception when duplicate_object then null; end $$;

create table if not exists public.lesson_materials (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  title          text not null,
  description    text,
  kind           material_kind not null default 'link',
  url            text,                          -- external link or storage path
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_materials_subject on public.lesson_materials(subject_id);
create index if not exists idx_materials_institution on public.lesson_materials(institution_id);

create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  title          text not null,
  instructions   text,
  due_date       timestamptz,
  max_points     numeric(6,2) not null default 100,
  published      boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_assignments_subject on public.assignments(subject_id);
create index if not exists idx_assignments_institution on public.assignments(institution_id, published);

create table if not exists public.assignment_submissions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  content        text,
  file_url       text,
  submitted_at   timestamptz not null default now(),
  grade          numeric(6,2),
  feedback       text,
  graded_by      uuid references auth.users(id) on delete set null,
  graded_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_submissions_student on public.assignment_submissions(student_id);

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['lesson_materials','assignments'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s;
      create trigger trg_%1$s_updated before update on public.%1$s
      for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- RLS  (can_enter_results() = teachers + academic managers)
-- =====================================================================
alter table public.lesson_materials       enable row level security;
alter table public.assignments            enable row level security;
alter table public.assignment_submissions enable row level security;

-- materials: any institution member may view; teachers manage.
drop policy if exists materials_read on public.lesson_materials;
create policy materials_read on public.lesson_materials
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists materials_manage on public.lesson_materials;
create policy materials_manage on public.lesson_materials
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- assignments: members see published; staff see all; teachers manage.
drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and (public.is_staff() or published)));
drop policy if exists assignments_manage on public.assignments;
create policy assignments_manage on public.assignments
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- submissions: a student reads their own; staff read all. Writes via functions.
drop policy if exists submissions_read on public.assignment_submissions;
create policy submissions_read on public.assignment_submissions
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and (public.is_staff() or public.is_student_self(student_id)))
  );
-- teachers may remove submissions (cleanup); the controlled writes are functions.
drop policy if exists submissions_manage on public.assignment_submissions;
create policy submissions_manage on public.assignment_submissions
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- =====================================================================
-- submit_assignment — student submits/updates their own work
-- =====================================================================
create or replace function public.submit_assignment(_assignment uuid, _content text, _file_url text)
returns void language plpgsql security definer set search_path = public as $$
declare a record; _student uuid;
begin
  select * into a from public.assignments where id = _assignment;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if not a.published then raise exception 'This assignment is not open'; end if;
  select id into _student from public.students where user_id = auth.uid() and institution_id = a.institution_id limit 1;
  if _student is null then raise exception 'No student profile is linked to your account'; end if;
  if exists (select 1 from public.assignment_submissions where assignment_id = _assignment and student_id = _student and graded_at is not null) then
    raise exception 'Your submission has been graded and can no longer be changed';
  end if;

  insert into public.assignment_submissions (institution_id, assignment_id, student_id, content, file_url, submitted_at)
  values (a.institution_id, _assignment, _student, nullif(_content,''), nullif(_file_url,''), now())
  on conflict (assignment_id, student_id)
    do update set content = excluded.content, file_url = excluded.file_url, submitted_at = now();
end $$;

-- =====================================================================
-- grade_submission — teacher grades a submission
-- =====================================================================
create or replace function public.grade_submission(_submission uuid, _grade numeric, _feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare s record; _inst uuid := public.current_institution_id();
begin
  if not (public.is_super_admin() or public.can_enter_results()) then raise exception 'Not authorized'; end if;
  select * into s from public.assignment_submissions where id = _submission;
  if s.id is null then raise exception 'Submission not found'; end if;
  if s.institution_id <> _inst and not public.is_super_admin() then raise exception 'Not allowed'; end if;
  update public.assignment_submissions
     set grade = _grade, feedback = nullif(_feedback,''), graded_by = auth.uid(), graded_at = now()
   where id = _submission;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.lesson_materials, public.assignments, public.assignment_submissions to authenticated;
grant execute on function public.submit_assignment(uuid, text, text) to authenticated;
grant execute on function public.grade_submission(uuid, numeric, text) to authenticated;

-- =====================================================================
-- End of 0022_elearning.sql
-- =====================================================================
