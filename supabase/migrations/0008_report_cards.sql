-- =====================================================================
-- NegoLinks Education ERP — Migration 0008: Report card support
-- Two SECURITY DEFINER helpers so the student-facing report card works
-- without breaking isolation:
--   • get_report_card_token — get/create a verification token (students
--     only after publish; staff anytime). Backs the QR code.
--   • student_position — a single student's class rank, computed over
--     peers server-side, returning only the rank (no peer data leaks).
-- Depends on: 0001–0007
-- =====================================================================

-- One verification per (document_type, reference) so tokens are stable.
create unique index if not exists uniq_docver_reference
  on public.document_verifications(document_type, reference) where reference is not null;

-- ---------- Report card verification token ----------
create or replace function public.get_report_card_token(_student uuid, _term uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _tok text; _inst uuid; _ref text;
begin
  if not (
    public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.students s
          where s.id = _student and s.institution_id = public.current_institution_id()))
    or public.is_student_self(_student)
    or public.is_my_ward(_student)
  ) then
    raise exception 'Not authorized for this report card';
  end if;

  if not (public.is_super_admin() or public.is_staff()
          or public.results_published_for(_student, _term)) then
    raise exception 'Results are not published yet';
  end if;

  _ref := _student::text || ':' || _term::text;
  select token into _tok from public.document_verifications
   where document_type = 'report_card' and reference = _ref;

  if _tok is null then
    select institution_id into _inst from public.students where id = _student;
    insert into public.document_verifications (institution_id, document_type, reference, title, issued_by)
    values (_inst, 'report_card', _ref, 'Report Card', auth.uid())
    on conflict (document_type, reference) do update set title = excluded.title
    returning token into _tok;
  end if;
  return _tok;
end $$;

-- ---------- Single-student class position (no peer data returned) ----------
create or replace function public.student_position(_student uuid, _term uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _session uuid; _inst uuid; _arm uuid; _prog uuid; _level text; _max numeric; _rank int;
begin
  if not (
    public.is_super_admin()
    or (public.is_staff() and exists (
          select 1 from public.students s
          where s.id = _student and s.institution_id = public.current_institution_id()))
    or public.is_student_self(_student)
    or public.is_my_ward(_student)
  ) then
    raise exception 'Not authorized';
  end if;

  if not (public.is_super_admin() or public.is_staff()
          or public.results_published_for(_student, _term)) then
    return null;
  end if;

  select session_id into _session from public.academic_terms where id = _term;
  select institution_id, class_arm_id, programme_id, level
    into _inst, _arm, _prog, _level
    from public.student_enrollments where student_id = _student and session_id = _session;
  select coalesce(sum(max_score), 0) into _max from public.assessment_components where institution_id = _inst;
  if _max = 0 then return null; end if;

  with roster as (
    select e.student_id from public.student_enrollments e
    where e.session_id = _session
      and ((_arm  is not null and e.class_arm_id = _arm)
        or (_prog is not null and e.programme_id = _prog and coalesce(e.level,'') = coalesce(_level,'')))
  ),
  agg as (
    select r.student_id,
           coalesce(sum(ss.score), 0) as total,
           count(distinct ss.subject_id) as taken
    from roster r
    left join public.student_scores ss on ss.student_id = r.student_id and ss.term_id = _term
    group by r.student_id
  ),
  ranked as (
    select student_id,
           rank() over (order by case when taken = 0 then 0 else (total / (taken * _max)) * 100 end desc) as rnk
    from agg
  )
  select rnk into _rank from ranked where student_id = _student;
  return _rank;
end $$;

grant execute on function
  public.get_report_card_token(uuid, uuid),
  public.student_position(uuid, uuid)
  to authenticated;

-- =====================================================================
-- End of 0008_report_cards.sql
-- =====================================================================
