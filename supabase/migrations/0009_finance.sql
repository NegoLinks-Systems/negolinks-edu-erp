-- =====================================================================
-- NegoLinks Education ERP — Migration 0009: Finance core
-- Fee structures, invoices (with auto-maintained balance/status),
-- invoice items, and payments. generate_invoices() bills a whole class
-- from matching fee structures in one idempotent pass. Students/parents
-- can read their own invoices and payments; only finance staff write.
-- Depends on: 0001–0008
-- =====================================================================

do $$ begin
  create type payment_method as enum ('cash','bank_transfer','card','online','cheque','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('unpaid','partial','paid','cancelled');
exception when duplicate_object then null; end $$;

-- ---------- Fee structures (chargeable lines per scope/term) ----------
create table if not exists public.fee_structures (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,                 -- 'Tuition', 'Development levy'
  amount         numeric(12,2) not null default 0,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  term_id        uuid references public.academic_terms(id) on delete cascade,   -- null = whole session
  class_id       uuid references public.classes(id) on delete cascade,          -- school scope
  programme_id   uuid references public.programmes(id) on delete cascade,       -- tertiary scope
  level          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_fee_institution on public.fee_structures(institution_id);
create index if not exists idx_fee_session on public.fee_structures(session_id);

-- ---------- Invoices ----------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  term_id        uuid references public.academic_terms(id) on delete cascade,
  reference      text not null default ('INV-' || upper(encode(gen_random_bytes(4), 'hex'))),
  title          text not null default 'School fees',
  total          numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  balance        numeric(12,2) generated always as (total - discount - amount_paid) stored,
  status         invoice_status not null default 'unpaid',
  due_date       date,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_invoices_student on public.invoices(student_id);
create index if not exists idx_invoices_scope on public.invoices(institution_id, session_id, term_id);
create index if not exists idx_invoices_status on public.invoices(institution_id, status);

create table if not exists public.invoice_items (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  description    text not null,
  amount         numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_items_invoice on public.invoice_items(invoice_id);

-- ---------- Payments ----------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  amount         numeric(12,2) not null,
  method         payment_method not null default 'cash',
  reference      text not null default ('RCT-' || upper(encode(gen_random_bytes(4), 'hex'))),
  note           text,
  recorded_by    uuid references auth.users(id) on delete set null,
  paid_at        timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_student on public.payments(student_id);

-- ---------- updated_at ----------
drop trigger if exists trg_fee_updated on public.fee_structures;
create trigger trg_fee_updated before update on public.fee_structures
  for each row execute function public.set_updated_at();
drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------- Balance/status maintenance ----------
create or replace function public.fin_recompute_invoice(_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _paid numeric; _total numeric; _disc numeric; _status invoice_status;
begin
  select coalesce(sum(amount), 0) into _paid from public.payments where invoice_id = _invoice;
  select total, discount, status into _total, _disc, _status from public.invoices where id = _invoice;
  if _status = 'cancelled' then
    update public.invoices set amount_paid = _paid where id = _invoice;
  else
    update public.invoices set amount_paid = _paid,
      status = case when _paid <= 0 then 'unpaid'
                    when _paid >= (_total - _disc) then 'paid'
                    else 'partial' end
     where id = _invoice;
  end if;
end $$;

create or replace function public.fin_payments_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fin_recompute_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
drop trigger if exists trg_payments_after on public.payments;
create trigger trg_payments_after after insert or update or delete on public.payments
  for each row execute function public.fin_payments_after();

-- Recompute when an invoice's total/discount/status changes.
create or replace function public.fin_invoice_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total <> old.total or new.discount <> old.discount or new.status <> old.status then
    perform public.fin_recompute_invoice(new.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_invoice_after on public.invoices;
create trigger trg_invoice_after after update on public.invoices
  for each row execute function public.fin_invoice_after();

-- =====================================================================
-- Access helpers + RLS
-- =====================================================================
create or replace function public.is_finance_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('bursar','accountant','institution_admin','principal')
  );
$$;

create or replace function public.can_view_invoice(_invoice uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invoices i
    where i.id = _invoice and (
      public.is_super_admin()
      or (i.institution_id = public.current_institution_id()
          and (public.is_finance_staff() or public.is_student_self(i.student_id) or public.is_my_ward(i.student_id)))
    )
  );
$$;

alter table public.fee_structures enable row level security;
alter table public.invoices       enable row level security;
alter table public.invoice_items  enable row level security;
alter table public.payments       enable row level security;

-- fee structures: institution members read; finance staff manage.
drop policy if exists fee_read on public.fee_structures;
create policy fee_read on public.fee_structures
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists fee_manage on public.fee_structures;
create policy fee_manage on public.fee_structures
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- invoices: finance staff see all; students/parents see their own.
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_finance_staff() or public.is_student_self(student_id) or public.is_my_ward(student_id)))
  );
drop policy if exists invoices_manage on public.invoices;
create policy invoices_manage on public.invoices
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- invoice items: visible to whoever can view the invoice; finance staff manage.
drop policy if exists items_read on public.invoice_items;
create policy items_read on public.invoice_items
  for select using (public.can_view_invoice(invoice_id));
drop policy if exists items_manage on public.invoice_items;
create policy items_manage on public.invoice_items
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- payments: finance staff all; students/parents their own.
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_finance_staff() or public.is_student_self(student_id) or public.is_my_ward(student_id)))
  );
drop policy if exists payments_manage on public.payments;
create policy payments_manage on public.payments
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_finance_staff()));

-- =====================================================================
-- Bulk invoice generation (SECURITY INVOKER: finance manage policy applies)
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

    insert into public.invoices (institution_id, student_id, session_id, term_id, title, total, due_date, created_by)
    values (_institution, _sid, _session, _term, _title, _total, _due, auth.uid())
    returning id into _inv;

    insert into public.invoice_items (invoice_id, institution_id, description, amount)
    select _inv, _institution, name, amount from _fs;

    _count := _count + 1;
  end loop;
  return _count;
end $$;

-- =====================================================================
-- Receipt verification token (used by the receipt PDF, next turn)
-- =====================================================================
create or replace function public.get_receipt_token(_payment uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _tok text; _inst uuid; _student uuid; _ref text;
begin
  select institution_id, student_id into _inst, _student from public.payments where id = _payment;
  if _inst is null then raise exception 'Payment not found'; end if;
  if not (
    public.is_super_admin()
    or (public.is_staff() and _inst = public.current_institution_id())
    or public.is_student_self(_student) or public.is_my_ward(_student)
  ) then raise exception 'Not authorized'; end if;

  _ref := 'receipt:' || _payment::text;
  select token into _tok from public.document_verifications
   where document_type = 'receipt' and reference = _ref;
  if _tok is null then
    insert into public.document_verifications (institution_id, document_type, reference, title, issued_by)
    values (_inst, 'receipt', _ref, 'Payment Receipt', auth.uid())
    on conflict (document_type, reference) do update set title = excluded.title
    returning token into _tok;
  end if;
  return _tok;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.fee_structures, public.invoices, public.invoice_items, public.payments to authenticated;
grant execute on function
  public.is_finance_staff(), public.can_view_invoice(uuid),
  public.generate_invoices(uuid, uuid, uuid, uuid, uuid, text, text, date),
  public.get_receipt_token(uuid)
  to authenticated;

-- =====================================================================
-- End of 0009_finance.sql
-- =====================================================================
