-- =====================================================================
-- NegoLinks Education ERP — Migration 0013: Executive dashboard
-- One SECURITY DEFINER function aggregates institution-wide metrics in a
-- single round trip. Gated to leadership roles (finance figures are
-- sensitive), so teachers/parents/students cannot call it.
-- Depends on: 0001–0012
-- =====================================================================

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _inst uuid := public.current_institution_id(); res jsonb;
begin
  if not (
    public.is_super_admin()
    or (_inst is not null and public.has_any_role(
        'institution_admin','principal','vice_principal','proprietor','rector','provost',
        'registrar','bursar','accountant','dean','head_of_department'))
  ) then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'students_active',   (select count(*) from public.students where institution_id = _inst and status = 'active'),
    'students_total',    (select count(*) from public.students where institution_id = _inst),
    'staff_total',       (select count(*) from public.staff    where institution_id = _inst),
    'fees_paid',         coalesce((select sum(amount_paid) from public.invoices where institution_id = _inst and status <> 'cancelled'), 0),
    'fees_outstanding',  coalesce((select sum(balance)     from public.invoices where institution_id = _inst and status <> 'cancelled'), 0),
    'attendance_total',  (select count(*) from public.attendance_records where institution_id = _inst and date >= current_date - 30),
    'attendance_present',(select count(*) from public.attendance_records where institution_id = _inst and date >= current_date - 30 and status = 'present'),
    'exams_total',       (select count(*) from public.cbt_exams where institution_id = _inst),
    'attempts_total',    (select count(*) from public.cbt_attempts where institution_id = _inst and status = 'graded'),
    'exam_avg',          coalesce((select avg(case when total > 0 then score / total * 100 else 0 end)
                                    from public.cbt_attempts where institution_id = _inst and status = 'graded'), 0),
    'by_level',          coalesce((
      select jsonb_agg(jsonb_build_object('label', lvl, 'count', c) order by c desc)
      from (
        select coalesce(nullif(current_level, ''), 'Unassigned') as lvl, count(*) c
        from public.students where institution_id = _inst and status = 'active'
        group by 1 order by c desc limit 12
      ) t), '[]'::jsonb)
  ) into res;

  res := res || jsonb_build_object(
    'fees_invoiced', (res->>'fees_paid')::numeric + (res->>'fees_outstanding')::numeric,
    'attendance_rate', case when (res->>'attendance_total')::numeric > 0
      then round((res->>'attendance_present')::numeric / (res->>'attendance_total')::numeric * 100, 1) else null end
  );
  return res;
end $$;

grant execute on function public.admin_dashboard() to authenticated;

-- =====================================================================
-- End of 0013_admin_dashboard.sql
-- =====================================================================
