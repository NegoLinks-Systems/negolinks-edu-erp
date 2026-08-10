-- =====================================================================
-- NegoLinks — Migration 0026: Demo Data Management (enterprise §6)
--
-- Super-admin-only tooling to load / delete / reload realistic demo data
-- for demonstrations, training, and QA. Every demo row is tagged with
-- meta->>'demo' = 'true' so deletion is surgical and never touches real
-- business data. A per-institution demo_mode flag drives the DEMO banner.
-- Depends on: 0001 (institutions, audit_logs), 0003 (students, staff)
-- =====================================================================

-- ---------- Demo mode flag on the institution ----------
alter table public.institutions add column if not exists demo_mode boolean not null default false;

-- (is_super_admin() is already defined in 0001_foundation.sql)

-- ---------- Internal: wipe demo rows for an institution ----------
create or replace function public._demo_wipe(_inst uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.students where institution_id = _inst and (meta->>'demo') = 'true';
  delete from public.staff    where institution_id = _inst and (meta->>'demo') = 'true';
end $$;

-- ---------- Load demo data ----------
-- _scenario: 'small' | 'medium' | 'large' | 'multi_branch' | 'heavy'
create or replace function public.demo_load(_scenario text default 'medium')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _inst uuid;
  _n_students int;
  _n_staff int;
  _first text[] := array['Amara','Chidi','Ngozi','Emeka','Fatima','Yusuf','Blessing','Tunde','Zainab','Ifeoma','Segun','Halima','Obinna','Grace','Musa','Chioma','Kunle','Aisha','Emeka','Ada','Bello','Ruth','Ibrahim','Peace','Uche','Hauwa','Femi','Esther','Sani','Joy'];
  _last  text[] := array['Okafor','Bello','Adeyemi','Okonkwo','Abubakar','Eze','Danjuma','Balogun','Mohammed','Nwosu','Oyelaran','Sule','Adewale','Ogbonna','Ibrahim','Chukwu','Aliyu','Okoro','Yakubu','Nnaji'];
  _levels_school text[] := array['JSS1','JSS2','JSS3','SS1','SS2','SS3'];
  _levels_tert   text[] := array['100L','200L','300L','400L'];
  _titles text[] := array['Teacher','Senior Teacher','Head of Department','Lecturer','Bursar','Registrar','Counsellor','Lab Technician','Librarian','Coordinator'];
  _is_tert boolean;
  i int;
  _fn text; _ln text; _lvl text;
begin
  select id into _inst from public.institutions where id = (select institution_id from public.profiles where id = auth.uid());
  if _inst is null then raise exception 'No institution linked to your account'; end if;
  if not public.is_super_admin() then raise exception 'Only a super administrator can manage demo data'; end if;

  select (type in ('university','polytechnic','college','professional_academy')) into _is_tert
    from public.institutions where id = _inst;

  _n_students := case _scenario
    when 'small' then 40 when 'medium' then 150 when 'large' then 400
    when 'multi_branch' then 300 when 'heavy' then 600 else 150 end;
  _n_staff := greatest(8, _n_students / 12);

  -- Clear any prior demo rows first (idempotent).
  perform public._demo_wipe(_inst);

  -- Students
  for i in 1.._n_students loop
    _fn := _first[1 + floor(random()*array_length(_first,1))::int];
    _ln := _last[1 + floor(random()*array_length(_last,1))::int];
    _lvl := case when _is_tert then _levels_tert[1+floor(random()*array_length(_levels_tert,1))::int]
                 else _levels_school[1+floor(random()*array_length(_levels_school,1))::int] end;
    insert into public.students (institution_id, admission_number, first_name, last_name, gender, current_level, admission_date, status, meta)
    values (_inst,
      'DEMO/' || to_char(now(),'YY') || '/' || lpad(i::text, 4, '0'),
      _fn, _ln,
      case when random() < 0.5 then 'Male' else 'Female' end,
      _lvl,
      (now() - (random()*900)::int * interval '1 day')::date,
      'enrolled',
      jsonb_build_object('demo', 'true'));
  end loop;

  -- Staff
  for i in 1.._n_staff loop
    _fn := _first[1 + floor(random()*array_length(_first,1))::int];
    _ln := _last[1 + floor(random()*array_length(_last,1))::int];
    insert into public.staff (institution_id, staff_number, first_name, last_name, gender, job_title, employment_type, date_joined, status, meta)
    values (_inst,
      'DEMOSTF/' || lpad(i::text, 3, '0'),
      _fn, _ln,
      case when random() < 0.5 then 'Male' else 'Female' end,
      _titles[1+floor(random()*array_length(_titles,1))::int],
      'full_time',
      (now() - (random()*2000)::int * interval '1 day')::date,
      'active',
      jsonb_build_object('demo', 'true'));
  end loop;

  update public.institutions set demo_mode = true where id = _inst;

  insert into public.audit_logs (institution_id, actor_id, action, entity, metadata)
  values (_inst, auth.uid(), 'demo.loaded', 'demo_data', jsonb_build_object('scenario', _scenario, 'students', _n_students, 'staff', _n_staff));

  return jsonb_build_object('ok', true, 'scenario', _scenario, 'students', _n_students, 'staff', _n_staff);
end $$;

-- ---------- Delete demo data ----------
create or replace function public.demo_delete()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _inst uuid;
begin
  select institution_id into _inst from public.profiles where id = auth.uid();
  if _inst is null then raise exception 'No institution linked to your account'; end if;
  if not public.is_super_admin() then raise exception 'Only a super administrator can manage demo data'; end if;

  perform public._demo_wipe(_inst);
  update public.institutions set demo_mode = false where id = _inst;

  insert into public.audit_logs (institution_id, actor_id, action, entity, metadata)
  values (_inst, auth.uid(), 'demo.deleted', 'demo_data', '{}'::jsonb);

  return jsonb_build_object('ok', true);
end $$;

-- ---------- Reload demo data (fresh set) ----------
create or replace function public.demo_reload(_scenario text default 'medium')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.demo_delete();
  return public.demo_load(_scenario);
end $$;

-- ---------- Demo status (for the banner + settings) ----------
create or replace function public.demo_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'demo_mode', coalesce((select demo_mode from public.institutions
                           where id = (select institution_id from public.profiles where id = auth.uid())), false),
    'demo_students', (select count(*) from public.students s
                      where s.institution_id = (select institution_id from public.profiles where id = auth.uid())
                        and (s.meta->>'demo') = 'true'),
    'demo_staff', (select count(*) from public.staff st
                   where st.institution_id = (select institution_id from public.profiles where id = auth.uid())
                     and (st.meta->>'demo') = 'true')
  );
$$;

grant execute on function public.demo_load(text)   to authenticated;
grant execute on function public.demo_delete()      to authenticated;
grant execute on function public.demo_reload(text)  to authenticated;
grant execute on function public.demo_status()      to authenticated;

-- =====================================================================
-- End of 0026_demo_data.sql
-- =====================================================================
