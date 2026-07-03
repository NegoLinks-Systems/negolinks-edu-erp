-- =====================================================================
-- NegoLinks Education ERP — Migration 0024: Assignment file uploads
-- A dedicated private `submissions` bucket with per-student write access
-- and teacher read access, so students can attach files to their work
-- without exposing each other's uploads. Path layout:
--   {institution_id}/{student_id}/{assignment_id}/{uuid}-{filename}
-- The submit RPC gains a file_path parameter (the stored object path).
-- Depends on: 0001–0023 (esp. 0022 e-learning)
-- =====================================================================

-- ---------- Private bucket for submissions ----------
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- A caller's own student id (used by the storage policies below).
create or replace function public.my_student_id()
returns text language sql stable security definer set search_path = public as $$
  select s.id::text from public.students s where s.user_id = auth.uid() limit 1;
$$;
grant execute on function public.my_student_id() to authenticated;

-- Students write only inside their own folder; the 2nd path segment is their student id.
drop policy if exists submissions_insert on storage.objects;
create policy submissions_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[2] = public.my_student_id()
);

-- Read: the owning student, any staff of that institution, or a super admin.
drop policy if exists submissions_select on storage.objects;
create policy submissions_select on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and (
    (storage.foldername(name))[2] = public.my_student_id()
    or exists (
      select 1 from public.staff st
      where st.user_id = auth.uid() and st.institution_id::text = (storage.foldername(name))[1]
    )
    or public.is_super_admin()
  )
);

-- Students may replace/remove files in their own folder (until graded is enforced app-side).
drop policy if exists submissions_modify on storage.objects;
create policy submissions_modify on storage.objects for update to authenticated
using (bucket_id = 'submissions' and (storage.foldername(name))[2] = public.my_student_id())
with check (bucket_id = 'submissions' and (storage.foldername(name))[2] = public.my_student_id());
drop policy if exists submissions_delete on storage.objects;
create policy submissions_delete on storage.objects for delete to authenticated
using (bucket_id = 'submissions' and (storage.foldername(name))[2] = public.my_student_id());

-- ---------- Store the uploaded object path on the submission ----------
alter table public.assignment_submissions add column if not exists file_path text;

-- ---------- submit_assignment gains _file_path (recreate with new arity) ----------
drop function if exists public.submit_assignment(uuid, text, text);
create or replace function public.submit_assignment(_assignment uuid, _content text, _file_url text, _file_path text)
returns void language plpgsql security definer set search_path = public as $$
declare a record; _student uuid;
begin
  select * into a from public.assignments where id = _assignment;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if not a.published then raise exception 'This assignment is not open'; end if;
  select id into _student from public.students where user_id = auth.uid() and institution_id = a.institution_id limit 1;
  if _student is null then raise exception 'No student profile is linked to your account'; end if;
  if exists (select 1 from public.assignment_submissions where assignment_id = _assignment and student_id = _student and graded_at is not null) then
    raise exception 'Your submission has been graded and can no longer be changed';
  end if;

  insert into public.assignment_submissions (institution_id, assignment_id, student_id, content, file_url, file_path, submitted_at)
  values (a.institution_id, _assignment, _student, nullif(_content,''), nullif(_file_url,''), nullif(_file_path,''), now())
  on conflict (assignment_id, student_id)
    do update set content = excluded.content, file_url = excluded.file_url, file_path = excluded.file_path, submitted_at = now();
end $$;

grant execute on function public.submit_assignment(uuid, text, text, text) to authenticated;

-- =====================================================================
-- End of 0024_submission_uploads.sql
-- =====================================================================
