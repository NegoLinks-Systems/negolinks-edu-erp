-- =====================================================================
-- NegoLinks Education ERP — Migration 0015: Intelligence Engine documents
-- Stores documents drafted by the NegoLinks Intelligence Engine (letters,
-- memos, circulars, reports). The generation itself runs in an Edge
-- Function; this table is the saved-output log. Staff-only.
-- Depends on: 0001–0014
-- =====================================================================

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  doc_type       text not null default 'letter',
  title          text not null,
  body           text not null,
  instructions   text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_documents_institution on public.documents(institution_id, created_at desc);

drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

-- Staff of the institution may draft, read, edit and remove documents.
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists documents_manage on public.documents;
create policy documents_manage on public.documents
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));

grant select, insert, update, delete on public.documents to authenticated;

-- =====================================================================
-- End of 0015_documents.sql
-- =====================================================================
