-- =====================================================================
-- NegoLinks Education ERP — Migration 0023: Scholarships & fee discounts
-- Reusable scholarship/discount definitions (percent or fixed) that are
-- awarded to students and automatically reduce their invoices. The
-- invoices table already carries a `discount` column and a generated
-- `balance = total - discount - amount_paid`, so applying a discount is
-- just setting that column — the existing recompute trigger does the rest.
-- Depends on: 0001–0022 (esp. 0009 finance)
-- =====================================================================

do $$ begin
  create type discount_type as enum ('percent','fixed');
exception when duplicate_object then null; end $$;

-- ---------- Scholarship / discount definitions ----------
create table if not exists public.scholarships (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,                       -- 'Staff child', 'Merit award', 'Sibling discount'
  discount_type  discount_type not null default 'percent',
  value          numeric(12,2) not null default 0,    -- percent (0–100) or a fixed amount
  session_id     uuid references public.academic_sessions(id) on delete cascade,  -- null = any session
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_scholarships_institution on public.scholarships(institution_id);

-- ---------- Awards (which student holds which scholarship) ----------
create table if not exists public.student_scholarships (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  session_id     uuid references public.academic_sessions(id) on delete cascade,  -- null = all sessions
  active         boolean not null default true,
  awarded_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (student_id, scholarship_id, session_id)
);
create index if not exists idx_award_student on public.student_scholarships(student_id);
create index if not exists idx_award_scholarship on public.student_scholarships(scholarship_id);

drop trigger if exists trg_scholarships_updated on public.scholarships;
create trigger trg_scholarships_updated before update on public.scholarships
  for each row execute function public.set_updated_at();

-- =====================================================================
-- compute_student_discount — total discount for a student on a gross amount
-- SECURITY DEFINER so invoice generation can read awards regardless of caller.
-- Percent scholarships apply to the gross; fixed ones are flat; they stack,
-- capped at the gross amount.
-- =====================================================================
create or replace function public.compute_student_discount(_student uuid, _session uuid, _gross numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare _disc numeric := 0; r record;
begin
  for r in
    select s.discount_type, s.value
    from public.student_scholarships ss
    join public.scholarships s on s.id = ss.scholarship_id
    where ss.student_id = _student
      and ss.active and s.active
      and (ss.session_id is null or ss.session_id = _session)
      and (s.session_id is null or s.session_id = _session)
  loop
    if r.discount_type = 'percent' then _disc := _disc + _gross * (r.value / 100.0);
    else _disc := _disc + r.value; end if;
  end loop;
  if _disc < 0 then _disc := 0; end if;
  if _disc > _gross then _disc := _gross; end if;
  return round(_disc, 2);
end $$;

-- =====================================================================
-- Replace generate_invoices so new invoices get each student's discount
-- at creation. Signature is unchanged — existing callers keep working.
-- =====================================================================
create or replace function public.generate_invoices(
  _institution uuid, _session uuid, _term uuid, _arm uuid,
  _programme uuid, _level text, _title text, _due date
) returns int
language plpgsql security invoker set search_path = public as $$
declare _count int := 0; _class uuid; _total numeric; _sid uuid; _inv uuid;
begin
  if _arm is not null then select class_id into _class from public.class_arms where id = _arm; end if;

  create temp table _fs on commit drop as
    select fs.name, fs.amount from public.fee_structures fs
     where fs.session_id = _session
       and (fs.term_id is null or fs.term_id = _term)
       and (
         (fs.class_id is null and fs.programme_id is null)
         or (_class is not null and fs.class_id = _class)
         or (_programme is not null and fs.programme_id = _programme
             and coalesce(fs.level,'') = coalesce(_level,''))
       );

  select coalesce(sum(amount), 0) into _total from _fs;
  if _total = 0 then return 0; end if;

  for _sid in
    select e.student_id from public.student_enrollments e
     where e.session_id = _session
       and ((_arm is not null and e.class_arm_id = _arm)
         or (_programme is not null and e.programme_id = _programme
             and coalesce(e.level,'') = coalesce(_level,'')))
  loop
    if exists (select 1 from public.invoices
               where student_id = _sid and session_id = _session
                 and coalesce(term_id::text,'') = coalesce(_term::text,'')) then
      continue;
    end if;

    insert into public.invoices (institution_id, student_id, session_id, term_id, title, total, discount, due_date, created_by)
    values (_institution, _sid, _session, _term, _title, _total,
            public.compute_student_discount(_sid, _session, _total), _due, auth.uid())
    returning id into _inv;

    insert into public.invoice_items (invoice_id, institution_id, description, amount)
    select _inv, _institution, name, amount from _fs;

    _count := _count + 1;
  end loop;
  return _count;
end $$;

-- =====================================================================
-- apply_scholarships_for_student — refresh discount on a student's existing
-- invoices for a session (use after awarding a scholarship post-billing).
-- =====================================================================
create or replace function public.apply_scholarships_for_student(_student uuid, _session uuid)
returns int language plpgsql security definer set search_path = public as $$
declare _inst uuid := public.current_institution_id(); _n int := 0; r record; _d numeric;
begin
  if not (public.is_super_admin() or public.is_finance_staff()) then raise exception 'Not authorized'; end if;
  for r in
    select id, total from public.invoices
     where student_id = _student and session_id = _session and status <> 'cancelled'
       and (public.is_super_admin() or institution_id = _inst)
  loop
    _d := public.compute_student_discount(_student, _session, r.total);
    update public.invoices set discount = _d where id = r.id;
    _n := _n + 1;
  end loop;
  return _n;
end $$;

-- =====================================================================
-- set_invoice_discount — manual ad-hoc discount on a single invoice
-- =====================================================================
create or replace function public.set_invoice_discount(_invoice uuid, _amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare _inst uuid := public.current_institution_id(); inv record;
begin
  if not (public.is_super_admin() or public.is_finance_staff()) then raise exception 'Not authorized'; end if;
  select institution_id, total into inv from public.invoices where id = _invoice;
  if inv.institution_id is null then raise exception 'Invoice not found'; end if;
  if inv.institution_id <> _inst and not public.is_super_admin() then raise exception 'Not allowed'; end if;
  if _amount < 0 then _amount := 0; end if;
  if _amount > inv.total then _amount := inv.total; end if;
  update public.invoices set discount = _amount where id = _invoice;
end $$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.scholarships         enable row level security;
alter table public.student_scholarships enable row level security;

-- scholarship catalog: any institution member may read; finance manages.
drop policy if exists scholarships_read on public.scholarships;
create policy scholarships_read on public.scholarships
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists scholarships_manage on public.scholarships;
create policy scholarships_manage on public.scholarships
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- awards: finance sees all; a student/parent sees their own; finance manages.
drop policy if exists awards_read on public.student_scholarships;
create policy awards_read on public.student_scholarships
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_finance_staff() or public.is_student_self(student_id) or public.is_my_ward(student_id)))
  );
drop policy if exists awards_manage on public.student_scholarships;
create policy awards_manage on public.student_scholarships
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- ---------- Grants ----------
grant select, insert, update, delete on public.scholarships, public.student_scholarships to authenticated;
grant execute on function
  public.compute_student_discount(uuid, uuid, numeric),
  public.apply_scholarships_for_student(uuid, uuid),
  public.set_invoice_discount(uuid, numeric),
  public.generate_invoices(uuid, uuid, uuid, uuid, uuid, text, text, date)
  to authenticated;

-- =====================================================================
-- End of 0023_scholarships.sql
-- =====================================================================
