import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../lib/database.types';

/* Students the current user may see: themselves (student) or their wards (parent).
   RLS already restricts the rows, so a plain select returns the right set. */
export function useMyStudents() {
  return useQuery({
    queryKey: ['my-students'],
    queryFn: async () => {
      const { data, error } = await supabase.from('students')
        .select('id, first_name, last_name, admission_number, current_level')
        .order('first_name');
      if (error) throw error;
      return (data ?? []) as Pick<Student, 'id' | 'first_name' | 'last_name' | 'admission_number' | 'current_level'>[];
    },
  });
}

export interface TermOption { id: string; name: string; sessionId: string; label: string; isCurrent: boolean; }

export function useAllTerms(institutionId: string) {
  return useQuery({
    queryKey: ['all-terms', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<TermOption[]> => {
      const { data, error } = await supabase.from('academic_terms')
        .select('id, name, session_id, is_current, sort_order, session:academic_sessions(name)')
        .order('sort_order');
      if (error) throw error;
      const rows = (data ?? []) as unknown as
        { id: string; name: string; session_id: string; is_current: boolean; session: { name: string } | null }[];
      return rows.map((t) => ({
        id: t.id, name: t.name, sessionId: t.session_id, isCurrent: t.is_current,
        label: `${t.session?.name ?? ''} · ${t.name}`,
      }));
    },
  });
}

export interface StudentResultRow { subjectId: string; title: string; code: string | null; creditUnits: number | null; total: number; }
export interface StudentTermResult { subjectMax: number; rows: StudentResultRow[]; }

export function useStudentTermResult(studentId: string, termId: string) {
  return useQuery({
    queryKey: ['student-term-result', studentId, termId],
    enabled: !!studentId && !!termId,
    queryFn: async (): Promise<StudentTermResult> => {
      const { data: comps, error: cErr } = await supabase.from('assessment_components').select('max_score');
      if (cErr) throw cErr;
      const subjectMax = (comps ?? []).reduce((sum, c) => sum + Number(c.max_score), 0);

      // RLS returns these rows to the student/parent only when published.
      const { data: scores, error: sErr } = await supabase.from('student_scores')
        .select('subject_id, score').eq('student_id', studentId).eq('term_id', termId);
      if (sErr) throw sErr;

      const totals = new Map<string, number>();
      for (const r of scores ?? []) totals.set(r.subject_id, (totals.get(r.subject_id) ?? 0) + Number(r.score));

      let rows: StudentResultRow[] = [];
      if (totals.size) {
        const { data: subs, error: subErr } = await supabase.from('subjects')
          .select('id, title, code, credit_units').in('id', [...totals.keys()]);
        if (subErr) throw subErr;
        rows = ((subs ?? []) as { id: string; title: string; code: string | null; credit_units: number | null }[])
          .map((s) => ({ subjectId: s.id, title: s.title, code: s.code, creditUnits: s.credit_units, total: totals.get(s.id) ?? 0 }))
          .sort((a, b) => a.title.localeCompare(b.title));
      }
      return { subjectMax, rows };
    },
  });
}

export function useStudentPosition(studentId: string, termId: string) {
  return useQuery({
    queryKey: ['student-position', studentId, termId],
    enabled: !!studentId && !!termId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('student_position', { _student: studentId, _term: termId });
      if (error) throw error;
      return (data as number | null) ?? null;
    },
  });
}
