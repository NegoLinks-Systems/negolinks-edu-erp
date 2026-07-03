-- =====================================================================
-- NegoLinks — Migration 0025: public institution lookup + extra roles
--
-- 1. Adds two roles the UI already references (proprietor, registrar).
-- 2. Adds a SECURITY DEFINER lookup so the PUBLIC admissions page can
--    identify an institution by its slug WITHOUT a logged-in session.
--    Only non-sensitive branding fields are exposed.
-- Depends on: 0001 (app_role, institutions)
-- =====================================================================

-- ---------- Extra roles (safe no-ops if already present) ----------
alter type public.app_role add value if not exists 'proprietor';
alter type public.app_role add value if not exists 'registrar';

-- ---------- Public, anon-readable institution lookup by slug ----------
-- Returns just enough to brand the public apply/verify pages and to tag a
-- submitted application with the right institution_id.
create or replace function public.get_public_institution(_slug text)
returns table (
  id              uuid,
  slug            text,
  name            text,
  type            institution_type,
  logo_url        text,
  primary_color   text,
  secondary_color text,
  motto           text
) language sql stable security definer set search_path = public as $$
  select i.id, i.slug::text, i.name, i.type, i.logo_url, i.primary_color, i.secondary_color, i.motto
  from public.institutions i
  where i.slug = _slug
  limit 1;
$$;

grant execute on function public.get_public_institution(text) to anon, authenticated;

-- =====================================================================
-- End of 0025_public_and_roles.sql
-- =====================================================================
