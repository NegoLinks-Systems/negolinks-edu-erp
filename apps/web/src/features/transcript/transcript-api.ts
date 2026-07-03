import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { gradeFor, type GradeBand } from '../results/results-api';

export interface CourseTotalRow {
  session_id: string; session_name: string; session_start: string | null;
  term_id: string; term_name: string; term_start: string | null;
  subject_id: string; code: string | null; title: string; credit_units: number;
  total: number; obtainable: number;
}

export interface CourseLine { code: string; title: string; units: number; score: number; grade: string; point: number }
export interface TermBlock { sessionName: string; termName: string; courses: CourseLine[]; gpa: number; units: number; qp: number; cgpa: number }
export interface Transcript { terms: TermBlock[]; cgpa: number; totalUnits: number; totalQP: number }

/** Accepts grading_system as either a bare bands array or { bands: [...] }. */
export function normalizeBands(gs: unknown): GradeBand[] {
  if (Array.isArray(gs)) return gs as GradeBand[];
  if (gs && typeof gs === 'object' && Array.isArray((gs as any).bands)) return (gs as any).bands as GradeBand[];
  return [];
}

export function buildTranscript(rows: CourseTotalRow[], bands: GradeBand[]): Transcript {
  const groups: { key: string; sessionName: string; termName: string; rows: CourseTotalRow[] }[] = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.key !== r.term_id) { g = { key: r.term_id, sessionName: r.session_name, termName: r.term_name, rows: [] }; groups.push(g); }
    g.rows.push(r);
  }

  let runQP = 0, runUnits = 0;
  const terms: TermBlock[] = groups.map((g) => {
    let qp = 0, units = 0;
    const courses: CourseLine[] = g.rows.map((r) => {
      const obtainable = Number(r.obtainable) || 0;
      const pct = obtainable > 0 ? (Number(r.total) / obtainable) * 100 : 0;
      const band = gradeFor(pct, bands);
      const point = band ? Number((band as any).point) || 0 : 0;
      const u = Number(r.credit_units) || 1;
      qp += point * u; units += u;
      return { code: r.code || '', title: r.title, units: u, score: Math.round(pct * 10) / 10, grade: (band as any)?.grade ?? '-', point };
    });
    runQP += qp; runUnits += units;
    return { sessionName: g.sessionName, termName: g.termName, courses, gpa: units ? qp / units : 0, units, qp, cgpa: runUnits ? runQP / runUnits : 0 };
  });

  return { terms, cgpa: runUnits ? runQP / runUnits : 0, totalUnits: runUnits, totalQP: runQP };
}

export function useTranscript(studentId: string | null) {
  return useQuery({
    queryKey: ['transcript', studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<CourseTotalRow[]> => {
      const { data, error } = await supabase.rpc('get_student_course_totals', { _student: studentId! });
      if (error) throw error;
      return (data ?? []) as unknown as CourseTotalRow[];
    },
  });
}

export function useStudentSearch(institutionId: string, query: string) {
  return useQuery({
    queryKey: ['transcript-student-search', institutionId, query],
    enabled: !!institutionId && query.trim().length >= 2,
    queryFn: async () => {
      const s = query.replace(/[,()*%]/g, ' ').trim();
      const { data, error } = await supabase.from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('institution_id', institutionId)
        .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,admission_number.ilike.%${s}%`).limit(10);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, admission: r.admission_number ?? '' }));
    },
  });
}
