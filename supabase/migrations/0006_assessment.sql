-- =====================================================================
-- NegoLinks Education ERP — Migration 0006: Assessment & scores
-- Configurable score components (CA, Test, Exam…) and per-student scores.
-- Grading/positions/GPA are computed from these + the institution's
-- grading scale. Score reads stay staff-only until the publish workflow
-- (next migration) opens a path for students and parents.
-- Depends on: 0001–0005
-- =====================================================================

-- ---------- Assessment components (the columns of a score sheet) ----------
create table if not exists public.assessment_components (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,                 -- 'CA1', 'Test', 'Exam'
  max_score      numeric(6,2) not null default 100,
  sort_order     int not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_components_institution on public.assessment_components(institution_id);

-- ---------- Student scores (one per student/subject/term/component) ----------
create table if not exists public.student_scores (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  term_id        uuid not null references public.academic_terms(id) on delete cascade,
  component_id   uuid not null references public.assessment_components(id) on delete cascade,
  class_arm_id   uuid references public.class_arms(id) on delete set null,   -- school scope
  programme_id   uuid references public.programmes(id) on delete set null,   -- tertiary scope
  level          text,
  score          numeric(6,2) not null default 0,
  recorded_by    uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now(),
  unique (student_id, subject_id, term_id, component_id)
);
create index if not exists idx_scores_sheet on public.student_scores(subject_id, term_id, class_arm_id);
create index if not exists idx_scores_prog on public.student_scores(programme_id, level, term_id, subject_id);
create index if not exists idx_scores_student on public.student_scores(student_id, term_id);

-- ---------- updated_at ----------
drop trigger if exists trg_components_updated on public.assessment_components;
create trigger trg_components_updated before update on public.assessment_components
  for each row execute function public.set_updated_at();

drop trigger if exists trg_scores_updated on public.student_scores;
create trigger trg_scores_updated before update on public.student_scores
  for each row execute function public.set_updated_at();

-- ---------- Access helper ----------
create or replace function public.can_enter_results()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_academic_manager() or exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('teacher','class_teacher','lecturer')
  );
$$;

-- ---------- RLS ----------
alter table public.assessment_components enable row level security;
alter table public.student_scores        enable row level security;

drop policy if exists components_read on public.assessment_components;
create policy components_read on public.assessment_components
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists components_manage on public.assessment_components;
create policy components_manage on public.assessment_components
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()));

-- Scores: staff only (publish workflow will add a student/parent read path).
drop policy if exists scores_read on public.student_scores;
create policy scores_read on public.student_scores
  for select using (
    public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff())
  );
drop policy if exists scores_manage on public.student_scores;
create policy scores_manage on public.student_scores
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.assessment_components, public.student_scores to authenticated;
grant execute on function public.can_enter_results() to authenticated;

-- =====================================================================
-- End of 0006_assessment.sql
-- =====================================================================
