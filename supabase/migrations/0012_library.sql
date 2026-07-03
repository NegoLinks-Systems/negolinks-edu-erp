-- =====================================================================
-- NegoLinks Education ERP — Migration 0012: Library
-- Catalog (title-level with copy counts), loans to students or staff,
-- and fines that accrue per overdue day. Triggers keep available_copies
-- correct on issue/return/edit and block lending the last free copy.
-- Depends on: 0001–0011
-- =====================================================================

create table if not exists public.library_settings (
  institution_id    uuid primary key references public.institutions(id) on delete cascade,
  loan_period_days  int not null default 14,
  fine_per_day      numeric(10,2) not null default 0,
  max_books         int not null default 3,
  updated_at        timestamptz not null default now()
);

create table if not exists public.library_books (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references public.institutions(id) on delete cascade,
  title            text not null,
  author           text,
  isbn             text,
  category         text,
  publisher        text,
  year             int,
  description      text,
  cover_url        text,
  total_copies     int not null default 1,
  available_copies int not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_books_institution on public.library_books(institution_id);

create table if not exists public.library_loans (
  id                 uuid primary key default gen_random_uuid(),
  institution_id     uuid not null references public.institutions(id) on delete cascade,
  book_id            uuid not null references public.library_books(id) on delete cascade,
  borrower_student_id uuid references public.students(id) on delete cascade,
  borrower_staff_id   uuid references public.staff(id) on delete cascade,
  borrowed_at        date not null default current_date,
  due_date           date not null,
  returned_at        date,
  fine_amount        numeric(10,2) not null default 0,
  fine_paid          boolean not null default false,
  note               text,
  issued_by          uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint one_borrower check (num_nonnulls(borrower_student_id, borrower_staff_id) = 1)
);
create index if not exists idx_loans_institution on public.library_loans(institution_id);
create index if not exists idx_loans_book on public.library_loans(book_id);
create index if not exists idx_loans_student on public.library_loans(borrower_student_id);
create index if not exists idx_loans_staff on public.library_loans(borrower_staff_id);
create index if not exists idx_loans_active on public.library_loans(institution_id) where returned_at is null;

-- ---------- Copy-count maintenance ----------
create or replace function public.lib_book_before()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.available_copies := new.total_copies;
  elsif new.total_copies <> old.total_copies then
    new.available_copies := greatest(0, old.available_copies + (new.total_copies - old.total_copies));
  end if;
  return new;
end $$;
drop trigger if exists trg_book_before on public.library_books;
create trigger trg_book_before before insert or update on public.library_books
  for each row execute function public.lib_book_before();

create or replace function public.lib_loan_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.returned_at is null then
      update public.library_books set available_copies = available_copies - 1
        where id = new.book_id and available_copies > 0;
      if not found then raise exception 'No copies available to lend'; end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.returned_at is null and new.returned_at is not null then
      update public.library_books set available_copies = available_copies + 1 where id = new.book_id;
    elsif old.returned_at is not null and new.returned_at is null then
      update public.library_books set available_copies = available_copies - 1
        where id = new.book_id and available_copies > 0;
      if not found then raise exception 'No copies available to lend'; end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.returned_at is null then
      update public.library_books set available_copies = available_copies + 1 where id = old.book_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_loan_after on public.library_loans;
create trigger trg_loan_after after insert or update or delete on public.library_loans
  for each row execute function public.lib_loan_after();

-- ---------- Access helper + RLS ----------
create or replace function public.is_library_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
                 and role in ('librarian','institution_admin','principal'));
$$;

alter table public.library_settings enable row level security;
alter table public.library_books    enable row level security;
alter table public.library_loans    enable row level security;

drop policy if exists libset_read on public.library_settings;
create policy libset_read on public.library_settings
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists libset_manage on public.library_settings;
create policy libset_manage on public.library_settings
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()));

-- catalog: any institution member may browse; library staff manage.
drop policy if exists books_read on public.library_books;
create policy books_read on public.library_books
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());
drop policy if exists books_manage on public.library_books;
create policy books_manage on public.library_books
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()));

-- loans: library staff see all; a borrower sees their own.
drop policy if exists loans_read on public.library_loans;
create policy loans_read on public.library_loans
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id()
        and (public.is_library_staff()
             or public.is_student_self(borrower_student_id)
             or public.is_staff_record_self(borrower_staff_id)))
  );
drop policy if exists loans_manage on public.library_loans;
create policy loans_manage on public.library_loans
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_library_staff()));

-- ---------- Grants ----------
grant select, insert, update, delete on
  public.library_settings, public.library_books, public.library_loans to authenticated;
grant execute on function public.is_library_staff() to authenticated;

-- =====================================================================
-- End of 0012_library.sql
-- =====================================================================
