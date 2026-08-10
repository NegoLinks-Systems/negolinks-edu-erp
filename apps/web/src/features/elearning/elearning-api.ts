import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { LessonMaterial, Assignment, AssignmentSubmission, MaterialKind, Student } from '../../lib/database.types';

export const materialKinds: MaterialKind[] = ['link', 'video', 'file', 'note'];

/* ----------------------------- materials ------------------------------ */
export function useMaterials(subjectId: string | null) {
  return useQuery({
    queryKey: ['materials', subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase.from('lesson_materials').select('*').eq('subject_id', subjectId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LessonMaterial[];
    },
  });
}
export function useUpsertMaterial(institutionId: string, subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LessonMaterial> & { id?: string; title: string; kind: MaterialKind }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, subject_id: subjectId };
      const res = id ? await supabase.from('lesson_materials').update(row).eq('id', id) : await supabase.from('lesson_materials').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials', subjectId] }),
  });
}
export function useDeleteMaterial(subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('lesson_materials').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials', subjectId] }),
  });
}

export async function uploadMaterialFile(institutionId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${institutionId}/elearning/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
export async function getMaterialUrl(m: Pick<LessonMaterial, 'kind' | 'url'>): Promise<string | null> {
  if (!m.url) return null;
  if (m.kind === 'file') {
    const { data } = await supabase.storage.from('documents').createSignedUrl(m.url, 3600);
    return data?.signedUrl ?? null;
  }
  return m.url;
}

/* ---------------------------- assignments ----------------------------- */
export function useAssignments(subjectId: string | null, publishedOnly = false) {
  return useQuery({
    queryKey: ['assignments', subjectId, publishedOnly],
    enabled: !!subjectId,
    queryFn: async () => {
      let q = supabase.from('assignments').select('*').eq('subject_id', subjectId!).order('created_at', { ascending: false });
      if (publishedOnly) q = q.eq('published', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });
}
export function useUpsertAssignment(institutionId: string, subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Assignment> & { id?: string; title: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, subject_id: subjectId };
      const res = id ? await supabase.from('assignments').update(row).eq('id', id) : await supabase.from('assignments').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', subjectId] }),
  });
}
export function useDeleteAssignment(subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('assignments').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', subjectId] }),
  });
}

/* ---------------------------- submissions ----------------------------- */
export type SubmissionRow = AssignmentSubmission & { student: Pick<Student, 'first_name' | 'last_name' | 'admission_number'> | null };

export function useSubmissions(assignmentId: string | null) {
  return useQuery({
    queryKey: ['submissions', assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase.from('assignment_submissions')
        .select('*, student:students(first_name,last_name,admission_number)')
        .eq('assignment_id', assignmentId!).order('submitted_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SubmissionRow[];
    },
  });
}

export function useMySubmission(assignmentId: string | null) {
  return useQuery({
    queryKey: ['my-submission', assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase.from('assignment_submissions').select('*').eq('assignment_id', assignmentId!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as AssignmentSubmission | null;  // RLS → caller's own
    },
  });
}

export function useMyStudentId(institutionId: string) {
  return useQuery({
    queryKey: ['my-student-id', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<string | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase.from('students').select('id').eq('user_id', auth.user.id).eq('institution_id', institutionId).maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    },
  });
}

export async function uploadSubmissionFile(institutionId: string, studentId: string, assignmentId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${institutionId}/${studentId}/${assignmentId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from('submissions').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
export async function getSubmissionFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('submissions').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useSubmitAssignment(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: string; file_url?: string | null; file_path?: string | null }) => {
      const { error } = await supabase.rpc('submit_assignment', {
        _assignment: assignmentId, _content: input.content, _file_url: input.file_url ?? null, _file_path: input.file_path ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-submission', assignmentId] }),
  });
}

export function useGradeSubmission(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { submission_id: string; grade: number; feedback?: string | null }) => {
      const { error } = await supabase.rpc('grade_submission', { _submission: input.submission_id, _grade: input.grade, _feedback: input.feedback ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submissions', assignmentId] }),
  });
}

/* --------------------- course scoping (derive from teaching_assignments) --------------------- */
export type CourseOption = { id: string; title: string; code: string | null };

const dedupeSubjects = (rows: { subject: CourseOption | null }[]) => {
  const map = new Map<string, CourseOption>();
  for (const r of rows) if (r.subject) map.set(r.subject.id, r.subject);
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
};

/** Subjects the current user teaches (via their staff record + teaching_assignments).
 *  Returns [] for non-teaching users; callers fall back to the full subject list. */
export function useTaughtSubjects(institutionId: string) {
  return useQuery({
    queryKey: ['taught-subjects', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<CourseOption[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data: staff } = await supabase.from('staff').select('id').eq('user_id', uid).eq('institution_id', institutionId).maybeSingle();
      if (!staff) return [];
      const { data, error } = await supabase.from('teaching_assignments')
        .select('subject:subjects(id, title, code)').eq('staff_id', (staff as { id: string }).id);
      if (error) throw error;
      return dedupeSubjects((data ?? []) as unknown as { subject: CourseOption | null }[]);
    },
  });
}

/** Subjects offered to the current student's enrolment (current session if set, else latest),
 *  resolved through teaching_assignments for their arm/programme. [] when not a student. */
export function useEnrolledSubjects(institutionId: string) {
  return useQuery({
    queryKey: ['enrolled-subjects', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<CourseOption[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data: student } = await supabase.from('students').select('id').eq('user_id', uid).eq('institution_id', institutionId).maybeSingle();
      if (!student) return [];
      const sid = (student as { id: string }).id;

      const { data: current } = await supabase.from('academic_sessions').select('id').eq('institution_id', institutionId).eq('is_current', true).maybeSingle();
      let enr: { class_arm_id: string | null; programme_id: string | null } | null = null;
      if (current) {
        const { data } = await supabase.from('student_enrollments')
          .select('class_arm_id, programme_id').eq('student_id', sid).eq('session_id', (current as { id: string }).id).maybeSingle();
        enr = (data as typeof enr) ?? null;
      }
      if (!enr) {
        const { data } = await supabase.from('student_enrollments')
          .select('class_arm_id, programme_id').eq('student_id', sid).order('created_at', { ascending: false }).limit(1).maybeSingle();
        enr = (data as typeof enr) ?? null;
      }
      if (!enr) return [];

      let q = supabase.from('teaching_assignments').select('subject:subjects(id, title, code)');
      const e = enr as { class_arm_id: string | null; programme_id: string | null };
      if (e.class_arm_id) q = q.eq('class_arm_id', e.class_arm_id);
      else if (e.programme_id) q = q.eq('programme_id', e.programme_id);
      else return [];
      const { data, error } = await q;
      if (error) throw error;
      return dedupeSubjects((data ?? []) as unknown as { subject: CourseOption | null }[]);
    },
  });
}

