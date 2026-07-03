-- =====================================================================
-- NegoLinks Education ERP — Migration 0010: CBT authoring
-- Question bank (categories, questions, options) and exams that pull
-- questions from the bank. Questions/options are STAFF-ONLY: students
-- never read correct answers — the exam-taking flow (next migration)
-- serves sanitized questions via a definer function.
-- Depends on: 0001–0009
-- =====================================================================

do $$ begin
  create type question_type as enum ('single_choice','multiple_choice','true_false','short_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_difficulty as enum ('easy','medium','hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cbt_exam_status as enum ('draft','published','closed');
exception when duplicate_object then null; end $$;

-- ---------- Categories ----------
create table if not exists public.question_categories (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  subject_id     uuid references public.subjects(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
create index if not exists idx_qcat_institution on public.question_categories(institution_id);

-- ---------- Questions ----------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category_id    uuid references public.question_categories(id) on delete set null,
  subject_id     uuid references public.subjects(id) on delete set null,
  type           question_type not null default 'single_choice',
  text           text not null,
  marks          numeric(6,2) not null default 1,
  difficulty     question_difficulty not null default 'medium',
  answer_text    text,                       -- for short_answer auto-marking
  explanation    text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_questions_institution on public.questions(institution_id);
create index if not exists idx_questions_category on public.questions(category_id);
create index if not exists idx_questions_subject on public.questions(subject_id);

create table if not exists public.question_options (
  id             uuid primary key default gen_random_uuid(),
  question_id    uuid not null references public.questions(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  text           text not null,
  is_correct     boolean not null default false,
  sort_order     int not null default 1,
  created_at     timestamptz not null default now()
);
create index if not exists idx_options_question on public.question_options(question_id);

-- ---------- Exams ----------
create table if not exists public.cbt_exams (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  title            text not null,
  subject_id       uuid references public.subjects(id) on delete set null,
  session_id       uuid references public.academic_sessions(id) on delete set null,
  term_id          uuid references public.academic_terms(id) on delete set null,
  class_arm_id     uuid references public.class_arms(id) on delete set null,   -- school scope
  programme_id     uuid references public.programmes(id) on delete set null,   -- tertiary scope
  level            text,
  duration_minutes int not null default 30,
  pass_mark        numeric(6,2) not null default 50,
  opens_at         timestamptz,
  closes_at        timestamptz,
  shuffle_questions boolean not null default true,
  shuffle_options  boolean not null default true,
  max_attempts     int not null default 1,
  instructions     text,
  status           cbt_exam_status not null default 'draft',
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_exams_institution on public.cbt_exams(institution_id);
create index if not exists idx_exams_status on public.cbt_exams(institution_id, status);

create table if not exists public.cbt_exam_questions (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.cbt_exams(id) on delete cascade,
  question_id    uuid not null references public.questions(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  sort_order     int not null default 1,
  marks          numeric(6,2),               -- optional override of question.marks
  created_at     timestamptz not null default now(),
  unique (exam_id, question_id)
);
create index if not exists idx_examq_exam on public.cbt_exam_questions(exam_id);

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['question_categories','questions','cbt_exams'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- RLS  (can_enter_results() = academic managers + teachers/lecturers)
-- =====================================================================
alter table public.question_categories enable row level security;
alter table public.questions           enable row level security;
alter table public.question_options    enable row level security;
alter table public.cbt_exams           enable row level security;
alter table public.cbt_exam_questions  enable row level security;

-- categories: staff read; authors manage.
drop policy if exists qcat_read on public.question_categories;
create policy qcat_read on public.question_categories
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists qcat_manage on public.question_categories;
create policy qcat_manage on public.question_categories
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- questions & options: STAFF-ONLY read (they contain correct answers).
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists questions_manage on public.questions;
create policy questions_manage on public.questions
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

drop policy if exists options_read on public.question_options;
create policy options_read on public.question_options
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists options_manage on public.question_options;
create policy options_manage on public.question_options
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- exams: staff see all; students see published ones (metadata only).
drop policy if exists exams_read on public.cbt_exams;
create policy exams_read on public.cbt_exams
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and (public.is_staff() or status = 'published'))
  );
drop policy if exists exams_manage on public.cbt_exams;
create policy exams_manage on public.cbt_exams
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- exam↔question links: staff only (the taking flow serves these via a definer fn).
drop policy if exists examq_read on public.cbt_exam_questions;
create policy examq_read on public.cbt_exam_questions
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists examq_manage on public.cbt_exam_questions;
create policy examq_manage on public.cbt_exam_questions
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- =====================================================================
-- Atomic question save (question + its options) — SECURITY INVOKER
-- =====================================================================
create or replace function public.save_question(_q jsonb, _options jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare _id uuid; _inst uuid;
begin
  _inst := (_q->>'institution_id')::uuid;
  _id := nullif(_q->>'id', '')::uuid;

  if _id is null then
    insert into public.questions (institution_id, category_id, subject_id, type, text, marks, difficulty, answer_text, explanation, created_by)
    values (_inst, nullif(_q->>'category_id','')::uuid, nullif(_q->>'subject_id','')::uuid,
            (_q->>'type')::question_type, _q->>'text', coalesce((_q->>'marks')::numeric, 1),
            coalesce((_q->>'difficulty')::question_difficulty, 'medium'), nullif(_q->>'answer_text',''), nullif(_q->>'explanation',''), auth.uid())
    returning id into _id;
  else
    update public.questions set
      category_id = nullif(_q->>'category_id','')::uuid, subject_id = nullif(_q->>'subject_id','')::uuid,
      type = (_q->>'type')::question_type, text = _q->>'text', marks = coalesce((_q->>'marks')::numeric, 1),
      difficulty = coalesce((_q->>'difficulty')::question_difficulty, 'medium'),
      answer_text = nullif(_q->>'answer_text',''), explanation = nullif(_q->>'explanation','')
     where id = _id;
  end if;

  delete from public.question_options where question_id = _id;
  insert into public.question_options (question_id, institution_id, text, is_correct, sort_order)
  select _id, _inst, o->>'text', coalesce((o->>'is_correct')::boolean, false), coalesce((o->>'sort_order')::int, ord::int)
  from jsonb_array_elements(_options) with ordinality as t(o, ord);

  return _id;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.question_categories, public.questions, public.question_options,
  public.cbt_exams, public.cbt_exam_questions to authenticated;
grant execute on function public.save_question(jsonb, jsonb) to authenticated;

-- =====================================================================
-- End of 0010_cbt_authoring.sql
-- =====================================================================
