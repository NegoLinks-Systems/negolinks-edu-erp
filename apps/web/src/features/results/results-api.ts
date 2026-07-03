import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { AssessmentComponent, Student } from '../../lib/database.types';
import type { Scope } from '../attendance/attendance-api';

/* ----------------------------- grading ---------------------------- */
export interface GradeBand { grade: string; min: number; max: number; remark: string; point: number; }

/** Look up a grade band by percentage (0–100). */
export function gradeFor(percent: number, bands: GradeBand[]): GradeBand | null {
  return bands.find((b) => percent >= b.min && percent <= b.max) ?? null;
}

/** Dense ranking by total (desc); ties share a position. */
export function rankByTotal(entries: { id: string; total: number }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.total - a.total);
  const pos = new Map<string, number>();
  let lastTotal: number | null = null;
  let lastRank = 0;
  sorted.forEach((e, i) => {
    const rank = lastTotal !== null && e.total === lastTotal ? lastRank : i + 1;
    pos.set(e.id, rank);
    lastTotal = e.total; lastRank = rank;
  });
  return pos;
}

/* --------------------------- components ---------------------------- */
export function useComponents(institutionId: string) {
  return useQuery({
    queryKey: ['components', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('assessment_components')
        .select('*').eq('institution_id', institutionId).order('sort_order');
      if (error) throw error;
      return (data ?? []) as AssessmentComponent[];
    },
  });
}

export function useUpsertComponent(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; max_score: number; sort_order: number }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id
        ? await supabase.from('assessment_components').update(row).eq('id', id)
        : await supabase.from('assessment_components').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components', institutionId] }),
  });
}

export function useDeleteComponent(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessment_components').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components', institutionId] }),
  });
}

/* --------------------------- score sheet --------------------------- */
export interface SheetRow { student: Student; scores: Record<string, number>; }
export interface SheetData { components: AssessmentComponent[]; rows: SheetRow[]; }

export function useScoreSheet(params: { scope: Scope | null; subjectId: string; termId: string }) {
  const { scope, subjectId, termId } = params;
  return useQuery({
    queryKey: ['score-sheet', scope?.sessionId, scope?.armId ?? '', scope?.programmeId ?? '', scope?.level ?? '', subjectId, termId],
    enabled: !!scope?.sessionId && (!!scope?.armId || !!scope?.programmeId) && !!subjectId && !!termId,
    queryFn: async (): Promise<SheetData> => {
      const { data: components, error: cErr } = await supabase.from('assessment_components')
        .select('*').order('sort_order'); // RLS scopes to the caller's institution
      if (cErr) throw cErr;

      let rq = supabase.from('student_enrollments').select('student:students(*)').eq('session_id', scope!.sessionId);
      if (scope!.armId) rq = rq.eq('class_arm_id', scope!.armId);
      else { rq = rq.eq('programme_id', scope!.programmeId!); if (scope!.level) rq = rq.eq('level', scope!.level); }
      const { data: roster, error: rErr } = await rq;
      if (rErr) throw rErr;
      const students = ((roster ?? []) as unknown as { student: Student }[]).map((r) => r.student)
        .sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));

      const ids = students.map((s) => s.id);
      let marks: { student_id: string; component_id: string; score: number }[] = [];
      if (ids.length) {
        const { data, error } = await supabase.from('student_scores')
          .select('student_id, component_id, score')
          .eq('subject_id', subjectId).eq('term_id', termId).in('student_id', ids);
        if (error) throw error;
        marks = (data ?? []) as typeof marks;
      }
      const map = new Map<string, Record<string, number>>();
      for (const m of marks) {
        const cur = map.get(m.student_id) ?? {};
        cur[m.component_id] = Number(m.score);
        map.set(m.student_id, cur);
      }
      return {
        components: (components ?? []) as AssessmentComponent[],
        rows: students.map((s) => ({ student: s, scores: map.get(s.id) ?? {} })),
      };
    },
  });
}

export function useSaveScores(params: { institutionId: string; scope: Scope; subjectId: string; termId: string }) {
  const { institutionId, scope, subjectId, termId } = params;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { student_id: string; component_id: string; score: number }[]) => {
      const rows = entries.map((e) => ({
        ...e, institution_id: institutionId, subject_id: subjectId, term_id: termId,
        session_id: scope.sessionId, class_arm_id: scope.armId ?? null,
        programme_id: scope.programmeId ?? null, level: scope.level ?? null,
      }));
      const { error } = await supabase.from('student_scores')
        .upsert(rows, { onConflict: 'student_id,subject_id,term_id,component_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['score-sheet'] }),
  });
}
