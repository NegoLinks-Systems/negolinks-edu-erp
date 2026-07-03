-- =====================================================================
-- NegoLinks Education ERP — Migration 0019: Transcript support
-- Adds credit units to courses and a function that returns a student's
-- per-term, per-course score totals across all sessions. The function is
-- SECURITY INVOKER, so existing RLS on student_scores governs visibility:
-- a student sees only their own published results; staff see all; another
-- student's id simply yields nothing.
-- Depends on: 0001–0018
-- =====================================================================

alter table public.subjects add column if not exists credit_units int not null default 3;

create or replace function public.get_student_course_totals(_student uuid)
returns table (
  session_id uuid, session_name text, session_start date,
  term_id uuid, term_name text, term_start date,
  subject_id uuid, code text, title text, credit_units int,
  total numeric, obtainable numeric
)
language sql stable security invoker set search_path = public as $$
  select se.id, se.name, se.starts_on,
         t.id, t.name, t.starts_on,
         sub.id, sub.code, sub.title, coalesce(sub.credit_units, 1),
         coalesce(sum(ss.score), 0), coalesce(sum(c.max_score), 0)
  from public.student_scores ss
  join public.assessment_components c on c.id = ss.component_id
  join public.subjects sub on sub.id = ss.subject_id
  join public.academic_terms t on t.id = ss.term_id
  join public.academic_sessions se on se.id = t.session_id
  where ss.student_id = _student
  group by se.id, se.name, se.starts_on, t.id, t.name, t.starts_on, sub.id, sub.code, sub.title, sub.credit_units
  order by se.starts_on nulls last, t.starts_on nulls last, sub.code nulls last, sub.title;
$$;

grant execute on function public.get_student_course_totals(uuid) to authenticated;

-- =====================================================================
-- End of 0019_transcript.sql
-- =====================================================================
