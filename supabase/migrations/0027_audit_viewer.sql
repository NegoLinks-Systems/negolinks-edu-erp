-- =====================================================================
-- NegoLinks — Migration 0027: Audit Trail viewer (enterprise §10)
--
-- Read-only access to the audit trail for administrators. audit_logs is
-- append-only (no delete grant to anyone, including super admin). This
-- adds a scoped, filterable read function + an actor-name join view.
-- Depends on: 0001 (audit_logs, profiles)
-- =====================================================================

-- Who may view the audit trail (institution admins + oversight roles).
create or replace function public.can_view_audit()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('institution_admin','principal','vice_principal','rector','provost','proprietor','registrar')
    );
$$;

-- Paginated, filterable audit read — scoped to the caller's institution.
create or replace function public.audit_list(
  _search text default null,
  _action text default null,
  _limit int default 100,
  _offset int default 0
)
returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text,
  entity text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare _inst uuid;
begin
  select institution_id into _inst from public.profiles where id = auth.uid();
  if not public.can_view_audit() then raise exception 'You do not have access to the audit trail'; end if;

  return query
    select a.id, a.actor_id,
           coalesce(p.full_name, '—') as actor_name,
           coalesce(p.email::text, '') as actor_email,
           a.action, a.entity, a.entity_id, a.metadata, a.created_at
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor_id
    where (public.is_super_admin() or a.institution_id = _inst)
      and (_action is null or _action = '' or a.action = _action)
      and (_search is null or _search = '' or
           a.action ilike '%'||_search||'%' or
           coalesce(a.entity,'') ilike '%'||_search||'%' or
           coalesce(p.full_name,'') ilike '%'||_search||'%')
    order by a.created_at desc
    limit greatest(1, least(_limit, 500))
    offset greatest(0, _offset);
end $$;

-- Distinct action types (for the filter dropdown).
create or replace function public.audit_actions()
returns table (action text) language plpgsql stable security definer set search_path = public as $$
declare _inst uuid;
begin
  select institution_id into _inst from public.profiles where id = auth.uid();
  if not public.can_view_audit() then raise exception 'You do not have access to the audit trail'; end if;
  return query
    select distinct a.action from public.audit_logs a
    where (public.is_super_admin() or a.institution_id = _inst)
    order by a.action;
end $$;

grant execute on function public.can_view_audit()                 to authenticated;
grant execute on function public.audit_list(text, text, int, int) to authenticated;
grant execute on function public.audit_actions()                  to authenticated;

-- =====================================================================
-- End of 0027_audit_viewer.sql
-- =====================================================================
