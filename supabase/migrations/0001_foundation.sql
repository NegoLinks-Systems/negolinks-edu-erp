-- =====================================================================
-- NegoLinks Education ERP — Migration 0001: Foundation
-- Multi-tenant core: institutions, campuses, profiles, RBAC, RLS.
-- Target: Supabase (PostgreSQL 15+). Idempotent where practical.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive text

-- ---------- Enums ----------
do $$ begin
  create type institution_type as enum (
    'primary_school','secondary_school','combined_school','college',
    'polytechnic','university','professional_academy','vocational_center',
    'coaching_center','learning_institute'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum (
    'super_admin','institution_admin','principal','vice_principal','rector',
    'provost','dean','head_of_department','academic_officer','lecturer',
    'teacher','class_teacher','bursar','accountant','librarian',
    'hostel_manager','admissions_officer','parent','student','guardian'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('trial','active','past_due','suspended','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type record_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

-- ---------- Tenant root: institutions ----------
create table if not exists public.institutions (
  id                  uuid primary key default gen_random_uuid(),
  slug                citext unique not null,
  name                text not null,
  type                institution_type not null,
  -- branding (consumed by the global branding engine)
  logo_url            text,
  letterhead_url      text,
  stamp_url           text,
  signature_url       text,
  motto               text,
  primary_color       text default '#1d4ed8',
  secondary_color     text default '#0f172a',
  -- contact
  email               citext,
  phone               text,
  whatsapp            text,
  website             text,
  address             text,
  social_links        jsonb not null default '{}'::jsonb,
  -- registration / tax
  registration_number text,
  tax_id              text,
  -- localization
  currency            char(3) not null default 'NGN',
  timezone            text   not null default 'Africa/Lagos',
  locale              text   not null default 'en',
  -- academic configuration (drives which modules/fields apply)
  grading_system      jsonb not null default '{}'::jsonb,
  session_structure   jsonb not null default '{}'::jsonb,
  enabled_modules     jsonb not null default '{}'::jsonb,
  settings            jsonb not null default '{}'::jsonb,
  -- saas lifecycle
  subscription_status subscription_status not null default 'trial',
  trial_ends_at       timestamptz default (now() + interval '30 days'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Campuses (an institution may have many) ----------
create table if not exists public.campuses (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  name            text not null,
  code            text,
  address         text,
  phone           text,
  email           citext,
  is_main         boolean not null default false,
  status          record_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_campuses_institution on public.campuses(institution_id);

-- ---------- Profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  institution_id  uuid references public.institutions(id) on delete set null,
  full_name       text,
  email           citext,
  phone           text,
  avatar_url      text,
  is_super_admin  boolean not null default false,
  status          record_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_profiles_institution on public.profiles(institution_id);

-- ---------- Role assignments (a user may hold several roles) ----------
create table if not exists public.user_roles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  institution_id  uuid references public.institutions(id) on delete cascade,
  campus_id       uuid references public.campuses(id) on delete cascade,
  role            app_role not null,
  created_at      timestamptz not null default now(),
  unique (user_id, institution_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_user_roles_institution on public.user_roles(institution_id);

-- ---------- Audit log ----------
create table if not exists public.audit_logs (
  id              bigint generated always as identity primary key,
  institution_id  uuid,
  actor_id        uuid,
  action          text not null,
  entity          text,
  entity_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_audit_inst_time on public.audit_logs(institution_id, created_at desc);

-- =====================================================================
-- Security helper functions (SECURITY DEFINER so they bypass RLS and
-- never cause recursive policy evaluation on profiles/user_roles).
-- =====================================================================
create or replace function public.current_institution_id()
returns uuid language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.has_role(_role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = _role
  );
$$;

create or replace function public.has_any_role(_roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = any(_roles)
  );
$$;

-- ---------- updated_at maintenance ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_institutions_updated on public.institutions;
create trigger trg_institutions_updated before update on public.institutions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_campuses_updated on public.campuses;
create trigger trg_campuses_updated before update on public.campuses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.institutions enable row level security;
alter table public.campuses     enable row level security;
alter table public.profiles     enable row level security;
alter table public.user_roles   enable row level security;
alter table public.audit_logs   enable row level security;

-- institutions ------------------------------------------------------
drop policy if exists inst_superadmin_all on public.institutions;
create policy inst_superadmin_all on public.institutions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists inst_member_select on public.institutions;
create policy inst_member_select on public.institutions
  for select using (id = public.current_institution_id());

drop policy if exists inst_admin_update on public.institutions;
create policy inst_admin_update on public.institutions
  for update
  using (id = public.current_institution_id() and public.has_role('institution_admin'))
  with check (id = public.current_institution_id() and public.has_role('institution_admin'));

-- campuses ----------------------------------------------------------
drop policy if exists campus_select on public.campuses;
create policy campus_select on public.campuses
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());

drop policy if exists campus_manage on public.campuses;
create policy campus_manage on public.campuses
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal']::app_role[])))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_any_role(array['institution_admin','principal']::app_role[])));

-- profiles ----------------------------------------------------------
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles
  for select using (
    id = auth.uid() or public.is_super_admin() or institution_id = public.current_institution_id()
  );

drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profile_superadmin_all on public.profiles;
create policy profile_superadmin_all on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- user_roles --------------------------------------------------------
drop policy if exists roles_select on public.user_roles;
create policy roles_select on public.user_roles
  for select using (
    public.is_super_admin() or user_id = auth.uid() or institution_id = public.current_institution_id()
  );

drop policy if exists roles_manage on public.user_roles;
create policy roles_manage on public.user_roles
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_role('institution_admin')))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
         and public.has_role('institution_admin')));

-- audit_logs (read within tenant; writes via service role / definer fns)
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());

-- =====================================================================
-- Grants (RLS still gates every row; these grant table-level access)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.institutions, public.campuses, public.profiles, public.user_roles
  to authenticated;
grant select on public.audit_logs to authenticated;
grant execute on function
  public.current_institution_id(), public.is_super_admin(),
  public.has_role(app_role), public.has_any_role(app_role[])
  to authenticated;

-- =====================================================================
-- End of 0001_foundation.sql
-- =====================================================================
