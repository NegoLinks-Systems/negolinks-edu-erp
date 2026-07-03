-- =====================================================================
-- NegoLinks Education ERP — Migration 0020: Admissions
-- Public application intake (anon-callable submit function — no table
-- grants to the public), a staff review pipeline, and admit_application
-- which converts an applicant into a students record. Status changes are
-- plain updates under RLS; the two privileged steps are SECURITY DEFINER.
-- Depends on: 0001–0019
-- =====================================================================

do $$ begin
  create type application_status as enum
    ('submitted','under_review','offered','accepted','rejected','enrolled','withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists public.admission_applications (
  id                 uuid primary key default gen_random_uuid(),
  institution_id     uuid not null references public.institutions(id) on delete cascade,
  application_number text not null,
  first_name         text not null,
  last_name          text not null,
  email              text,
  phone              text,
  dob                date,
  gender             text,
  address            text,
  prior_school       text,
  intended_study     text,                       -- free-text programme/class for public intake
  programme_id       uuid references public.programmes(id) on delete set null,
  class_id           uuid references public.classes(id) on delete set null,
  session_id         uuid references public.academic_sessions(id) on delete set null,
  score              numeric(6,2),
  notes              text,
  status             application_status not null default 'submitted',
  student_id         uuid references public.students(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (institution_id, application_number)
);
create index if not exists idx_applications_institution on public.admission_applications(institution_id, status);

drop trigger if exists trg_applications_updated on public.admission_applications;
create trigger trg_applications_updated before update on public.admission_applications
  for each row execute function public.set_updated_at();

-- ---------- Access helper + RLS ----------
create or replace function public.is_admissions_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
                 and role in ('institution_admin','principal','vice_principal','registrar','academic_officer'));
$$;

alter table public.admission_applications enable row level security;

-- Applicants submit through submit_application() (definer); staff manage here.
drop policy if exists applications_read on public.admission_applications;
create policy applications_read on public.admission_applications
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_admissions_staff()));
drop policy if exists applications_manage on public.admission_applications;
create policy applications_manage on public.admission_applications
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_admissions_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_admissions_staff()));

-- =====================================================================
-- submit_application — anon-callable public intake
-- =====================================================================
create or replace function public.submit_application(
  _institution_id uuid, _first text, _last text, _email text, _phone text, _dob date,
  _gender text, _address text, _prior_school text, _intended text
) returns text language plpgsql security definer set search_path = public as $$
declare _num text;
begin
  if not exists (select 1 from public.institutions where id = _institution_id) then raise exception 'Unknown institution'; end if;
  if coalesce(btrim(_first),'') = '' or coalesce(btrim(_last),'') = '' then raise exception 'Your name is required'; end if;

  _num := 'APP' || to_char(now(), 'YYMMDD') || upper(substr(md5(random()::text), 1, 4));

  insert into public.admission_applications (
    institution_id, application_number, first_name, last_name, email, phone, dob, gender, address, prior_school, intended_study, status
  ) values (
    _institution_id, _num, btrim(_first), btrim(_last), nullif(_email,''), nullif(_phone,''), _dob,
    nullif(_gender,''), nullif(_address,''), nullif(_prior_school,''), nullif(_intended,''), 'submitted'
  );
  return _num;
end $$;

-- =====================================================================
-- admit_application — convert an applicant into a students record
-- =====================================================================
create or replace function public.admit_application(_application_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; _inst uuid := public.current_institution_id(); _sid uuid; _num text;
begin
  if not (public.is_super_admin() or (_inst is not null and public.has_any_role(
      'institution_admin','principal','vice_principal','registrar','academic_officer'))) then
    raise exception 'Not authorized';
  end if;

  select * into a from public.admission_applications where id = _application_id;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.institution_id <> _inst then raise exception 'Not allowed'; end if;
  if a.student_id is not null then raise exception 'This applicant has already been admitted'; end if;

  _num := 'ADM' || to_char(now(), 'YY') || lpad(((select count(*) from public.students where institution_id = _inst) + 1)::text, 4, '0');

  insert into public.students (institution_id, first_name, last_name, email, phone, admission_number, status)
  values (_inst, a.first_name, a.last_name, a.email, a.phone, _num, 'active')
  returning id into _sid;

  update public.admission_applications set status = 'enrolled', student_id = _sid where id = _application_id;
  return jsonb_build_object('student_id', _sid, 'admission_number', _num);
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on public.admission_applications to authenticated;
grant execute on function public.submit_application(uuid, text, text, text, text, date, text, text, text, text) to anon, authenticated;
grant execute on function public.admit_application(uuid) to authenticated;
grant execute on function public.is_admissions_staff() to authenticated;

-- =====================================================================
-- End of 0020_admissions.sql
-- =====================================================================
