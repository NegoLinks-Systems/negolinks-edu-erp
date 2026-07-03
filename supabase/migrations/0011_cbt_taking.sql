-- =====================================================================
-- NegoLinks Education ERP — Migration 0011: CBT exam-taking & grading
-- Students never read questions/options directly. These SECURITY DEFINER
-- functions are the only path: start_attempt serves a sanitized paper
-- (no correct answers), save_answer autosaves, submit_attempt grades
-- server-side against the real answers. Each function authorises itself.
-- Depends on: 0001–0010
-- =====================================================================

do $$ begin
  create type attempt_status as enum ('in_progress','submitted','graded','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.cbt_attempts (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  exam_id        uuid not null references public.cbt_exams(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  status         attempt_status not null default 'in_progress',
  score          numeric(8,2) not null default 0,
  total          numeric(8,2) not null default 0,
  focus_losses   int not null default 0,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz
);
create index if not exists idx_attempts_exam on public.cbt_attempts(exam_id);
create index if not exists idx_attempts_student on public.cbt_attempts(student_id);

create table if not exists public.cbt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.cbt_attempts(id) on delete cascade,
  question_id         uuid not null references public.questions(id) on delete cascade,
  institution_id      uuid not null references public.institutions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  answer_text         text,
  is_correct          boolean,
  marks_awarded       numeric(6,2) not null default 0,
  sort_order          int not null default 1,
  unique (attempt_id, question_id)
);
create index if not exists idx_answers_attempt on public.cbt_answers(attempt_id);

-- ---------- Access helper + RLS ----------
create or replace function public.can_view_attempt(_attempt uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cbt_attempts a where a.id = _attempt and (
      public.is_super_admin()
      or (a.institution_id = public.current_institution_id() and (public.is_staff() or public.is_student_self(a.student_id)))
    )
  );
$$;

alter table public.cbt_attempts enable row level security;
alter table public.cbt_answers  enable row level security;

drop policy if exists attempts_read on public.cbt_attempts;
create policy attempts_read on public.cbt_attempts
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and (public.is_staff() or public.is_student_self(student_id)))
  );
-- Writes happen through the definer functions below; managers may delete/reset.
drop policy if exists attempts_manage on public.cbt_attempts;
create policy attempts_manage on public.cbt_attempts
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()));

drop policy if exists answers_read on public.cbt_answers;
create policy answers_read on public.cbt_answers
  for select using (public.can_view_attempt(attempt_id));
drop policy if exists answers_manage on public.cbt_answers;
create policy answers_manage on public.cbt_answers
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_academic_manager()));

-- =====================================================================
-- start_attempt — create or resume an attempt; returns a sanitized paper
-- =====================================================================
create or replace function public.start_attempt(_exam_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _student uuid; _att uuid; _now timestamptz := now(); _total numeric := 0; _attempts int; e record;
begin
  select id into _student from public.students
    where user_id = auth.uid() and institution_id = public.current_institution_id() limit 1;
  if _student is null then raise exception 'No student profile is linked to your account'; end if;

  select * into e from public.cbt_exams where id = _exam_id;
  if e.id is null then raise exception 'Exam not found'; end if;
  if e.institution_id <> public.current_institution_id() then raise exception 'Not allowed'; end if;
  if e.status <> 'published' then raise exception 'This exam is not open'; end if;
  if e.opens_at is not null and _now < e.opens_at then raise exception 'This exam has not opened yet'; end if;
  if e.closes_at is not null and _now > e.closes_at then raise exception 'This exam has closed'; end if;

  if e.class_arm_id is not null and not exists (
      select 1 from public.student_enrollments en
      where en.student_id = _student and en.class_arm_id = e.class_arm_id
        and (e.session_id is null or en.session_id = e.session_id)) then
    raise exception 'This exam is not assigned to you';
  end if;
  if e.programme_id is not null and not exists (
      select 1 from public.student_enrollments en
      where en.student_id = _student and en.programme_id = e.programme_id
        and coalesce(en.level,'') = coalesce(e.level,'')
        and (e.session_id is null or en.session_id = e.session_id)) then
    raise exception 'This exam is not assigned to you';
  end if;

  select id into _att from public.cbt_attempts
    where exam_id = _exam_id and student_id = _student and status = 'in_progress' limit 1;

  if _att is null then
    select count(*) into _attempts from public.cbt_attempts
      where exam_id = _exam_id and student_id = _student and status in ('submitted','graded','expired');
    if _attempts >= e.max_attempts then raise exception 'You have no attempts remaining'; end if;

    select coalesce(sum(coalesce(eq.marks, q.marks)), 0) into _total
      from public.cbt_exam_questions eq join public.questions q on q.id = eq.question_id
      where eq.exam_id = _exam_id;

    insert into public.cbt_attempts (institution_id, exam_id, student_id, total, status)
    values (e.institution_id, _exam_id, _student, _total, 'in_progress') returning id into _att;

    insert into public.cbt_answers (attempt_id, question_id, institution_id, sort_order)
      select _att, eq.question_id, e.institution_id, eq.sort_order
      from public.cbt_exam_questions eq where eq.exam_id = _exam_id;
  end if;

  return jsonb_build_object(
    'attempt_id', _att,
    'exam', jsonb_build_object('id', e.id, 'title', e.title, 'duration_minutes', e.duration_minutes, 'instructions', e.instructions),
    'started_at', (select started_at from public.cbt_attempts where id = _att),
    'questions', (
      select coalesce(jsonb_agg(qd order by qd->>'__ord'), '[]'::jsonb) from (
        select jsonb_build_object(
          'question_id', a.question_id, 'type', q.type, 'text', q.text,
          'marks', coalesce(eq.marks, q.marks),
          'selected_option_ids', to_jsonb(coalesce(a.selected_option_ids, '{}')),
          'answer_text', a.answer_text,
          'options', (
            select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text)
              order by case when e.shuffle_options then md5(_att::text || o.id::text) else lpad(o.sort_order::text, 6, '0') end), '[]'::jsonb)
            from public.question_options o where o.question_id = q.id
          ),
          '__ord', case when e.shuffle_questions then md5(_att::text || a.question_id::text) else lpad(a.sort_order::text, 6, '0') end
        ) as qd
        from public.cbt_answers a
        join public.questions q on q.id = a.question_id
        left join public.cbt_exam_questions eq on eq.exam_id = _exam_id and eq.question_id = a.question_id
        where a.attempt_id = _att
      ) s
    )
  );
end $$;

-- ---------- save_answer (autosave) ----------
create or replace function public.save_answer(_attempt uuid, _question uuid, _option_ids uuid[], _text text)
returns void language plpgsql security definer set search_path = public as $$
declare a record; _student uuid;
begin
  select * into a from public.cbt_attempts where id = _attempt;
  if a.id is null then raise exception 'Attempt not found'; end if;
  select id into _student from public.students where user_id = auth.uid() limit 1;
  if a.student_id <> _student then raise exception 'Not your attempt'; end if;
  if a.status <> 'in_progress' then raise exception 'This attempt has been submitted'; end if;
  update public.cbt_answers
     set selected_option_ids = coalesce(_option_ids, '{}'), answer_text = _text
   where attempt_id = _attempt and question_id = _question;
end $$;

-- ---------- bump_focus (anti-cheat counter) ----------
create or replace function public.bump_focus(_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.cbt_attempts set focus_losses = focus_losses + 1
   where id = _attempt and status = 'in_progress'
     and student_id = (select id from public.students where user_id = auth.uid() limit 1);
end $$;

-- ---------- submit_attempt (grades server-side) ----------
create or replace function public.submit_attempt(_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; e record; _student uuid; _score numeric;
begin
  select * into a from public.cbt_attempts where id = _attempt;
  if a.id is null then raise exception 'Attempt not found'; end if;
  select id into _student from public.students where user_id = auth.uid() limit 1;
  if a.student_id <> _student and not public.is_staff() and not public.is_super_admin() then
    raise exception 'Not your attempt';
  end if;
  if a.status <> 'in_progress' then
    return jsonb_build_object('score', a.score, 'total', a.total,
      'percent', case when a.total > 0 then round(a.score / a.total * 100, 2) else 0 end);
  end if;

  select * into e from public.cbt_exams where id = a.exam_id;

  update public.cbt_answers ans
     set is_correct = sub.correct,
         marks_awarded = case when sub.correct then sub.marks else 0 end
  from (
    select a2.id, coalesce(eq.marks, q.marks) as marks,
      case q.type
        when 'short_answer' then
          (a2.answer_text is not null and q.answer_text is not null
           and lower(btrim(a2.answer_text)) = lower(btrim(q.answer_text)))
        else (
          (select coalesce(array_agg(o.id order by o.id), '{}') from public.question_options o where o.question_id = q.id and o.is_correct)
          = (select coalesce(array_agg(x order by x), '{}') from unnest(coalesce(a2.selected_option_ids, '{}'::uuid[])) x)
        )
      end as correct
    from public.cbt_answers a2
    join public.questions q on q.id = a2.question_id
    left join public.cbt_exam_questions eq on eq.exam_id = a.exam_id and eq.question_id = a2.question_id
    where a2.attempt_id = _attempt
  ) sub
  where ans.id = sub.id;

  select coalesce(sum(marks_awarded), 0) into _score from public.cbt_answers where attempt_id = _attempt;
  update public.cbt_attempts set status = 'graded', submitted_at = now(), score = _score where id = _attempt;

  return jsonb_build_object('score', _score, 'total', a.total,
    'percent', case when a.total > 0 then round(_score / a.total * 100, 2) else 0 end,
    'pass_mark', e.pass_mark);
end $$;

-- ---------- get_attempt_review (after grading) ----------
create or replace function public.get_attempt_review(_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if not public.can_view_attempt(_attempt) then raise exception 'Not authorized'; end if;
  select * into a from public.cbt_attempts where id = _attempt;
  if a.status <> 'graded' then raise exception 'Results are not available yet'; end if;

  return jsonb_build_object(
    'score', a.score, 'total', a.total,
    'percent', case when a.total > 0 then round(a.score / a.total * 100, 2) else 0 end,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'text', q.text, 'type', q.type, 'is_correct', ans.is_correct,
        'marks', ans.marks_awarded, 'max', coalesce(eq.marks, q.marks),
        'your_options', (select jsonb_agg(o.text) from public.question_options o where o.id = any(ans.selected_option_ids)),
        'correct_options', (select jsonb_agg(o.text) from public.question_options o where o.question_id = q.id and o.is_correct),
        'answer_text', ans.answer_text, 'correct_answer', q.answer_text, 'explanation', q.explanation
      ) order by ans.sort_order), '[]'::jsonb)
      from public.cbt_answers ans
      join public.questions q on q.id = ans.question_id
      left join public.cbt_exam_questions eq on eq.exam_id = a.exam_id and eq.question_id = ans.question_id
      where ans.attempt_id = _attempt
    )
  );
end $$;

-- ---------- Grants ----------
grant select on public.cbt_attempts, public.cbt_answers to authenticated;
grant execute on function
  public.can_view_attempt(uuid),
  public.start_attempt(uuid), public.save_answer(uuid, uuid, uuid[], text),
  public.bump_focus(uuid), public.submit_attempt(uuid), public.get_attempt_review(uuid)
  to authenticated;

-- =====================================================================
-- End of 0011_cbt_taking.sql
-- =====================================================================
