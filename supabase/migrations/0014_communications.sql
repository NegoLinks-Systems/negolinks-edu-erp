-- =====================================================================
-- NegoLinks Education ERP — Migration 0014: Communications
-- In-app notifications (any module can write to them), an outbound queue
-- for email/SMS/WhatsApp drained by an Edge Function, and reusable
-- templates. send_announcement resolves an audience and fans out in one
-- server-side call; provider credentials never touch the DB or client.
-- Depends on: 0001–0013
-- =====================================================================

do $$ begin
  create type message_channel as enum ('email','sms','whatsapp');
exception when duplicate_object then null; end $$;
do $$ begin
  create type message_status as enum ('queued','sent','failed','delivered');
exception when duplicate_object then null; end $$;

-- ---------- In-app notifications ----------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  body           text,
  category       text not null default 'general',
  link           text,
  read_at        timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id, read_at);

-- ---------- Outbound message queue / log ----------
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references public.institutions(id) on delete cascade,
  channel             message_channel not null,
  recipient           text not null,                 -- email address or phone number
  recipient_user_id   uuid references auth.users(id) on delete set null,
  recipient_student_id uuid references public.students(id) on delete set null,
  subject             text,
  body                text not null,
  status              message_status not null default 'queued',
  provider            text,
  provider_message_id text,
  error               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);
create index if not exists idx_messages_status on public.messages(status, created_at);
create index if not exists idx_messages_institution on public.messages(institution_id);

-- ---------- Templates ----------
create table if not exists public.message_templates (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name           text not null,
  channel        message_channel,
  subject        text,
  body           text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (institution_id, name)
);
drop trigger if exists trg_templates_updated on public.message_templates;
create trigger trg_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.notifications     enable row level security;
alter table public.messages          enable row level security;
alter table public.message_templates enable row level security;

-- notifications: recipients read their own; writes happen via definer fns.
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications
  for select using (user_id = auth.uid() or public.is_super_admin());

-- messages: communications staff read/manage; the Edge Function uses the
-- service role (bypasses RLS) to drain the queue.
drop policy if exists messages_rw on public.messages;
create policy messages_rw on public.messages
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id()
      and public.has_any_role('institution_admin','principal','vice_principal','registrar','proprietor','rector','provost')))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
      and public.has_any_role('institution_admin','principal','vice_principal','registrar','proprietor','rector','provost')));

drop policy if exists templates_read on public.message_templates;
create policy templates_read on public.message_templates
  for select using (public.is_super_admin() or (institution_id = public.current_institution_id() and public.is_staff()));
drop policy if exists templates_manage on public.message_templates;
create policy templates_manage on public.message_templates
  for all using (public.is_super_admin() or (institution_id = public.current_institution_id()
      and public.has_any_role('institution_admin','principal','vice_principal','registrar','proprietor','rector','provost')))
  with check (public.is_super_admin() or (institution_id = public.current_institution_id()
      and public.has_any_role('institution_admin','principal','vice_principal','registrar','proprietor','rector','provost')));

-- =====================================================================
-- Notification helpers (self-service, run as caller)
-- =====================================================================
create or replace function public.unread_count()
returns int language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_read(_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and id = any(_ids);
$$;

create or replace function public.mark_all_read()
returns void language sql security invoker set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- =====================================================================
-- send_announcement — resolve audience, post in-app, queue external
--   _audience: 'all' | 'all_students' | 'all_staff' | 'class' | 'programme'
-- =====================================================================
create or replace function public.send_announcement(
  _audience text, _scope_id uuid, _level text,
  _title text, _body text, _category text, _link text,
  _channels text[], _include_guardians boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare _inst uuid := public.current_institution_id(); _notif int := 0; _msg int := 0; _r int := 0;
begin
  if not (public.is_super_admin() or (_inst is not null and public.has_any_role(
      'institution_admin','principal','vice_principal','registrar','academic_officer','proprietor','rector','provost','dean','head_of_department'))) then
    raise exception 'Not authorized';
  end if;
  if coalesce(btrim(_title),'') = '' then raise exception 'A title is required'; end if;

  create temp table _rcpt (user_id uuid, email text, phone text, student_id uuid) on commit drop;

  if _audience in ('all','all_students','class','programme') then
    insert into _rcpt (user_id, email, phone, student_id)
    select s.user_id, s.email, s.phone, s.id
    from public.students s
    where s.institution_id = _inst and s.status = 'active' and (
      _audience in ('all','all_students')
      or (_audience = 'class' and exists (select 1 from public.student_enrollments en where en.student_id = s.id and en.class_arm_id = _scope_id))
      or (_audience = 'programme' and exists (select 1 from public.student_enrollments en where en.student_id = s.id and en.programme_id = _scope_id and (_level is null or coalesce(en.level,'') = _level)))
    );

    if _include_guardians then
      insert into _rcpt (user_id, email, phone, student_id)
      select g.user_id, g.email, g.phone, s.id
      from public.student_guardians sg
      join public.guardians g on g.id = sg.guardian_id
      join public.students s on s.id = sg.student_id
      where s.institution_id = _inst and s.status = 'active' and (
        _audience in ('all','all_students')
        or (_audience = 'class' and exists (select 1 from public.student_enrollments en where en.student_id = s.id and en.class_arm_id = _scope_id))
        or (_audience = 'programme' and exists (select 1 from public.student_enrollments en where en.student_id = s.id and en.programme_id = _scope_id and (_level is null or coalesce(en.level,'') = _level)))
      );
    end if;
  end if;

  if _audience in ('all','all_staff') then
    insert into _rcpt (user_id, email, phone, student_id)
    select st.user_id, st.email, st.phone, null from public.staff st where st.institution_id = _inst;
  end if;

  -- in-app notifications for recipients that have a login
  insert into public.notifications (institution_id, user_id, title, body, category, link, created_by)
  select distinct _inst, user_id, _title, _body, coalesce(nullif(_category,''),'general'), _link, auth.uid()
  from _rcpt where user_id is not null;
  get diagnostics _notif = row_count;

  -- queue external channels
  if _channels is not null then
    if 'email' = any(_channels) then
      insert into public.messages (institution_id, channel, recipient, recipient_user_id, recipient_student_id, subject, body, status, created_by)
      select distinct _inst, 'email', email, user_id, student_id, _title, _body, 'queued', auth.uid()
      from _rcpt where email is not null and btrim(email) <> '';
      get diagnostics _r = row_count; _msg := _msg + _r;
    end if;
    if 'sms' = any(_channels) then
      insert into public.messages (institution_id, channel, recipient, recipient_user_id, recipient_student_id, subject, body, status, created_by)
      select distinct _inst, 'sms', phone, user_id, student_id, null, _body, 'queued', auth.uid()
      from _rcpt where phone is not null and btrim(phone) <> '';
      get diagnostics _r = row_count; _msg := _msg + _r;
    end if;
    if 'whatsapp' = any(_channels) then
      insert into public.messages (institution_id, channel, recipient, recipient_user_id, recipient_student_id, subject, body, status, created_by)
      select distinct _inst, 'whatsapp', phone, user_id, student_id, null, _body, 'queued', auth.uid()
      from _rcpt where phone is not null and btrim(phone) <> '';
      get diagnostics _r = row_count; _msg := _msg + _r;
    end if;
  end if;

  return jsonb_build_object('notifications', _notif, 'queued_messages', _msg);
end $$;

-- ---------- Grants ----------
grant select on public.notifications, public.messages, public.message_templates to authenticated;
grant insert, update, delete on public.message_templates to authenticated;
grant execute on function
  public.unread_count(), public.mark_read(uuid[]), public.mark_all_read(),
  public.send_announcement(text, uuid, text, text, text, text, text, text[], boolean)
  to authenticated;

-- =====================================================================
-- End of 0014_communications.sql
-- =====================================================================
