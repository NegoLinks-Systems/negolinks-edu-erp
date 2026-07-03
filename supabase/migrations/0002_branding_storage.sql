-- =====================================================================
-- NegoLinks Education ERP — Migration 0002: Branding storage & verification
-- Adds: storage buckets + tenant-scoped policies, document_verifications,
-- and a public verify_document() function for QR codes on generated docs.
-- Depends on: 0001_foundation.sql
-- =====================================================================

-- ---------- Storage buckets ----------
-- 'branding' is PUBLIC: logos & letterheads need to embed in portals/emails.
-- 'documents' is PRIVATE: stamps, signatures, and generated files (served via
-- short-lived signed URLs only). Path convention: {institution_id}/...
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ---------- Storage policies: branding (public read, tenant-admin write) ----
drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists branding_tenant_insert on storage.objects;
create policy branding_tenant_insert on storage.objects
  for insert with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(array['institution_admin','principal']::app_role[])
  );

drop policy if exists branding_tenant_update on storage.objects;
create policy branding_tenant_update on storage.objects
  for update using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(array['institution_admin','principal']::app_role[])
  );

drop policy if exists branding_tenant_delete on storage.objects;
create policy branding_tenant_delete on storage.objects
  for delete using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(array['institution_admin','principal']::app_role[])
  );

-- ---------- Storage policies: documents (tenant-scoped, private) -----------
drop policy if exists documents_tenant_read on storage.objects;
create policy documents_tenant_read on storage.objects
  for select using (
    bucket_id = 'documents'
    and (public.is_super_admin()
         or (storage.foldername(name))[1] = public.current_institution_id()::text)
  );

drop policy if exists documents_tenant_insert on storage.objects;
create policy documents_tenant_insert on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(
      array['institution_admin','principal','bursar','accountant',
            'academic_officer','admissions_officer']::app_role[])
  );

drop policy if exists documents_tenant_modify on storage.objects;
create policy documents_tenant_modify on storage.objects
  for update using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(
      array['institution_admin','principal','bursar','accountant',
            'academic_officer','admissions_officer']::app_role[])
  );

drop policy if exists documents_tenant_delete on storage.objects;
create policy documents_tenant_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.has_any_role(array['institution_admin','principal']::app_role[])
  );

-- =====================================================================
-- Document verification (QR codes on report cards, certificates, etc.)
-- =====================================================================
create table if not exists public.document_verifications (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  token           text not null unique default encode(gen_random_bytes(12), 'hex'),
  document_type   text not null,           -- 'report_card' | 'certificate' | ...
  reference       text,                    -- app-defined id (student/result/...)
  title           text,
  payload         jsonb not null default '{}'::jsonb,  -- safe public snapshot
  issued_by       uuid references auth.users(id),
  issued_at       timestamptz not null default now(),
  revoked         boolean not null default false,
  revoked_at      timestamptz
);
create index if not exists idx_docver_institution on public.document_verifications(institution_id);

alter table public.document_verifications enable row level security;

drop policy if exists docver_tenant_read on public.document_verifications;
create policy docver_tenant_read on public.document_verifications
  for select using (
    public.is_super_admin() or institution_id = public.current_institution_id()
  );

drop policy if exists docver_tenant_manage on public.document_verifications;
create policy docver_tenant_manage on public.document_verifications
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','academic_officer',
                 'bursar','admissions_officer']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(
           array['institution_admin','principal','academic_officer',
                 'bursar','admissions_officer']::app_role[])));

-- Public verifier: callable by anyone (the QR landing page) but returns only
-- safe, non-sensitive fields. Never exposes the whole table.
create or replace function public.verify_document(_token text)
returns table (
  valid             boolean,
  institution_name  text,
  institution_logo  text,
  document_type     text,
  title             text,
  payload           jsonb,
  issued_at         timestamptz,
  revoked           boolean
)
language sql stable security definer set search_path = public as $$
  select
    (dv.id is not null and not dv.revoked),
    i.name, i.logo_url, dv.document_type, dv.title, dv.payload, dv.issued_at, dv.revoked
  from public.document_verifications dv
  join public.institutions i on i.id = dv.institution_id
  where dv.token = _token;
$$;

-- ---------- Grants ----------
grant select, insert, update, delete on public.document_verifications to authenticated;
grant execute on function public.verify_document(text) to anon, authenticated;

-- =====================================================================
-- End of 0002_branding_storage.sql
-- =====================================================================
