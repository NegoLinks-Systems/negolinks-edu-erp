-- =====================================================================
-- NegoLinks Education ERP — Migration 0007: Result publishing
-- A draft→submitted→approved→published workflow per class/term, and a
-- gated read path so students/parents see scores only once published.
-- Approve/publish are restricted to academic managers by a trigger.
-- Depends on: 0001–0006
-- =====================================================================

do $$ begin
  create type result_status as enum ('draft','submitted','approved','published');
exception when duplicate_object then null; end $$;

create table if not exists public.result_publications (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id     uuid not null references public.academic_sessions(id) on delete cascade,
  term_id        uuid not null references public.academic_terms(id) on delete cascade,
  class_arm_id   uuid references public.class_arms(id) on delete cascade,   -- school scope
  programme_id   uuid references public.programmes(id) on delete cascade,   -- tertiary scope
  level          text,
  status         result_status not null default 'draft',
  submitted_by   uuid references auth.users(id) on delete set null,
  submitted_at   timestamptz,
  approved_by    uuid references auth.users(id) on delete set null,
  approved_at    timestamptz,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uniq_pub_arm
  on public.result_publications(term_id, class_arm_id) where class_arm_id is not null;
create unique index if not exists uniq_pub_prog
  on public.result_publications(term_id, programme_id, coalesce(level, '')) where programme_id is not null;
create index if not exists idx_pub_institution on public.result_publications(institution_id);

drop trigger if exists trg_pub_updated on public.result_publications;
create trigger trg_pub_updated before update on public.result_publications
  for each row execute function public.set_updated_at();

-- Are this student's results published for this term? (matches their enrolment scope)
create or replace function public.results_published_for(_student uuid, _term uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.student_enrollments e
    join public.result_publications p
      on p.term_id = _term and p.status = 'published'
     and (
       (p.class_arm_id is not null and p.class_arm_id = e.class_arm_id)
       or (p.programme_id is not null and p.programme_id = e.programme_id
           and coalesce(p.level,'') = coalesce(e.level,''))
     )
    where e.student_id = _student
      and e.session_id = (select session_id from public.academic_terms where id = _term)
  );
$$;

-- Only academic managers may move a publication to approved/published.
create or replace function public.enforce_result_status_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved','published')
     and not (public.is_super_admin() or public.is_academic_manager()) then
    raise exception 'Only academic managers can approve or publish results';
  end if;
  return new;
end $$;
drop trigger if exists trg_pub_status_roles on public.result_publications;
create trigger trg_pub_status_roles before insert or update on public.result_publications
  for each row execute function public.enforce_result_status_roles();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.result_publications enable row level security;

drop policy if exists pub_read on public.result_publications;
create policy pub_read on public.result_publications
  for select using (public.is_super_admin() or institution_id = public.current_institution_id());

drop policy if exists pub_manage on public.result_publications;
create policy pub_manage on public.result_publications
  for all
  using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id() and public.can_enter_results()));

-- Re-open student_scores read with the published path for students/parents.
drop policy if exists scores_read on public.student_scores;
create policy scores_read on public.student_scores
  for select using (
    public.is_super_admin()
    or (institution_id = public.current_institution_id() and public.is_staff())
    or ((public.is_student_self(student_id) or public.is_my_ward(student_id))
        and public.results_published_for(student_id, term_id))
  );

-- =====================================================================
-- Transition helper (SECURITY INVOKER: RLS + status trigger apply)
-- =====================================================================
create or replace function public.set_result_status(
  _institution uuid, _session uuid, _term uuid, _arm uuid,
  _programme uuid, _level text, _status result_status
) returns void
language plpgsql security invoker set search_path = public as $$
declare _id uuid;
begin
  select id into _id from public.result_publications
   where term_id = _term
     and class_arm_id is not distinct from _arm
     and programme_id is not distinct from _programme
     and coalesce(level,'') = coalesce(_level,'');

  if _id is null then
    insert into public.result_publications
      (institution_id, session_id, term_id, class_arm_id, programme_id, level, status)
    values (_institution, _session, _term, _arm, _programme, _level, _status)
    returning id into _id;
  else
    update public.result_publications set status = _status where id = _id;
  end if;

  if _status = 'submitted' then update public.result_publications set submitted_by = auth.uid(), submitted_at = now() where id = _id; end if;
  if _status = 'approved'  then update public.result_publications set approved_by  = auth.uid(), approved_at  = now() where id = _id; end if;
  if _status = 'published' then update public.result_publications set published_at  = now() where id = _id; end if;
end $$;

-- ---------- Grants ----------
grant select, insert, update, delete on public.result_publications to authenticated;
grant execute on function
  public.results_published_for(uuid, uuid),
  public.set_result_status(uuid, uuid, uuid, uuid, uuid, text, result_status)
  to authenticated;

-- =====================================================================
-- End of 0007_result_publishing.sql
-- =====================================================================
