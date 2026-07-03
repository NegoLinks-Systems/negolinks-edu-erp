-- =====================================================================
-- NegoLinks Education ERP — Migration 0021: Finance reports
-- One SECURITY DEFINER function aggregates revenue, collection trend,
-- outstanding-by-level, payment-method split and top debtors in a single
-- call, gated to finance/leadership roles. Joins payments → invoices to
-- avoid assuming an institution column on payments.
-- Depends on: 0001–0020
-- =====================================================================

create or replace function public.finance_report()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _inst uuid := public.current_institution_id(); res jsonb;
begin
  if not (public.is_super_admin() or (_inst is not null and public.has_any_role(
      'institution_admin','principal','vice_principal','bursar','accountant','proprietor'))) then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'collected',   coalesce((select sum(amount_paid) from public.invoices where institution_id = _inst and status <> 'cancelled'), 0),
    'outstanding', coalesce((select sum(balance)     from public.invoices where institution_id = _inst and status <> 'cancelled'), 0),

    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object('month', m, 'amount', amt) order by m) from (
        select to_char(p.created_at, 'YYYY-MM') m, sum(p.amount) amt
        from public.payments p join public.invoices i on i.id = p.invoice_id
        where i.institution_id = _inst and p.created_at >= date_trunc('month', now()) - interval '11 months'
        group by 1) t), '[]'::jsonb),

    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'amount', amt) order by amt desc) from (
        select p.method::text method, sum(p.amount) amt
        from public.payments p join public.invoices i on i.id = p.invoice_id
        where i.institution_id = _inst group by 1) t), '[]'::jsonb),

    'by_level', coalesce((
      select jsonb_agg(jsonb_build_object('label', lvl, 'outstanding', amt) order by amt desc) from (
        select coalesce(nullif(s.current_level, ''), 'Unassigned') lvl, sum(i.balance) amt
        from public.invoices i join public.students s on s.id = i.student_id
        where i.institution_id = _inst and i.status <> 'cancelled'
        group by 1 having sum(i.balance) > 0 order by amt desc limit 12) t), '[]'::jsonb),

    'top_debtors', coalesce((
      select jsonb_agg(jsonb_build_object('name', nm, 'admission', adm, 'balance', bal) order by bal desc) from (
        select s.first_name || ' ' || s.last_name nm, s.admission_number adm, sum(i.balance) bal
        from public.invoices i join public.students s on s.id = i.student_id
        where i.institution_id = _inst and i.status <> 'cancelled'
        group by s.id, s.first_name, s.last_name, s.admission_number
        having sum(i.balance) > 0 order by bal desc limit 10) t), '[]'::jsonb)
  ) into res;

  res := res || jsonb_build_object('invoiced', (res->>'collected')::numeric + (res->>'outstanding')::numeric);
  return res;
end $$;

grant execute on function public.finance_report() to authenticated;

-- =====================================================================
-- End of 0021_finance_reports.sql
-- =====================================================================
