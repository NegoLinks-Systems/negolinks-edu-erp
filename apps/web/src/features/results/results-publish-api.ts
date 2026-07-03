import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ResultPublication, Student } from '../../lib/database.types';
import type { Scope } from '../attendance/attendance-api';
import { gradeFor, rankByTotal, type GradeBand } from './results-api';

const scopeTermKey = (scope: Scope | null, termId: string) =>
  [scope?.sessionId ?? '', scope?.armId ?? '', scope?.programmeId ?? '', scope?.level ?? '', termId];

/* ----------------------- publication status ------------------------ */
export function usePublication(scope: Scope | null, termId: string) {
  return useQuery({
    queryKey: ['publication', scopeTermKey(scope, termId)],
    enabled: !!scope?.sessionId && (!!scope?.armId || !!scope?.programmeId) && !!termId,
    queryFn: async () => {
      let q = supabase.from('result_publications').select('*').eq('term_id', termId);
      if (scope!.armId) q = q.eq('class_arm_id', scope!.armId);
      else {
        q = q.eq('programme_id', scope!.programmeId!);
        q = scope!.level ? q.eq('level', scope!.level) : q.is('level', null);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data as ResultPublication | null) ?? null;
    },
  });
}

export function useSetResultStatus(institutionId: string, scope: Scope, termId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: ResultPublication['status']) => {
      const { error } = await supabase.rpc('set_result_status', {
        _institution: institutionId, _session: scope.sessionId, _term: termId,
        _arm: scope.armId ?? null, _programme: scope.programmeId ?? null,
        _level: scope.level ?? null, _status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['publication'] });
      qc.invalidateQueries({ queryKey: ['compiled-raw'] });
    },
  });
}

/* --------------------------- compilation --------------------------- */
export interface SubjectMeta { id: string; title: string; code: string | null; credit_units: number | null; }
export interface CompiledRaw {
  subjectMax: number;
  subjects: SubjectMeta[];
  students: { student: Student; totals: Record<string, number> }[];
}

export function useCompiledRaw(scope: Scope | null, termId: string) {
  return useQuery({
    queryKey: ['compiled-raw', scopeTermKey(scope, termId)],
    enabled: !!scope?.sessionId && (!!scope?.armId || !!scope?.programmeId) && !!termId,
    queryFn: async (): Promise<CompiledRaw> => {
      const { data: comps, error: cErr } = await supabase.from('assessment_components').select('max_score');
      if (cErr) throw cErr;
      const subjectMax = (comps ?? []).reduce((s, c) => s + Number(c.max_score), 0);

      let rq = supabase.from('student_enrollments').select('student:students(*)').eq('session_id', scope!.sessionId);
      if (scope!.armId) rq = rq.eq('class_arm_id', scope!.armId);
      else { rq = rq.eq('programme_id', scope!.programmeId!); if (scope!.level) rq = rq.eq('level', scope!.level); }
      const { data: roster, error: rErr } = await rq;
      if (rErr) throw rErr;
      const students = ((roster ?? []) as unknown as { student: Student }[]).map((r) => r.student)
        .sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));
      const ids = students.map((s) => s.id);

      const totalsByStudent = new Map<string, Record<string, number>>();
      const subjectIds = new Set<string>();
      if (ids.length) {
        const { data: scores, error: sErr } = await supabase.from('student_scores')
          .select('student_id, subject_id, score').eq('term_id', termId).in('student_id', ids);
        if (sErr) throw sErr;
        for (const r of scores ?? []) {
          subjectIds.add(r.subject_id);
          const cur = totalsByStudent.get(r.student_id) ?? {};
          cur[r.subject_id] = (cur[r.subject_id] ?? 0) + Number(r.score);
          totalsByStudent.set(r.student_id, cur);
        }
      }

      let subjects: SubjectMeta[] = [];
      if (subjectIds.size) {
        const { data: subs, error: subErr } = await supabase.from('subjects')
          .select('id, title, code, credit_units').in('id', [...subjectIds]);
        if (subErr) throw subErr;
        subjects = ((subs ?? []) as SubjectMeta[]).sort((a, b) => a.title.localeCompare(b.title));
      }

      return {
        subjectMax,
        subjects,
        students: students.map((s) => ({ student: s, totals: totalsByStudent.get(s.id) ?? {} })),
      };
    },
  });
}

/* Pure: turn raw totals into grades, averages, GPA and positions. */
export interface SubjectCell { total: number; percent: number; grade: string | null; point: number | null; taken: boolean; }
export interface CompiledStudent {
  student: Student;
  cells: Record<string, SubjectCell>;
  totalScore: number;
  average: number;          // percent across taken subjects
  gpa: number | null;       // tertiary only
  position: number;
}
export interface Compiled { subjects: SubjectMeta[]; subjectMax: number; students: CompiledStudent[]; }

export function buildCompiled(raw: CompiledRaw, bands: GradeBand[], tertiary: boolean): Compiled {
  const max = raw.subjectMax;
  const prelim = raw.students.map((row) => {
    const cells: Record<string, SubjectCell> = {};
    let totalScore = 0, takenCount = 0, gpaPoints = 0, gpaUnits = 0;
    for (const subj of raw.subjects) {
      const has = subj.id in row.totals;
      const total = row.totals[subj.id] ?? 0;
      const percent = max ? (total / max) * 100 : 0;
      const band = has ? gradeFor(percent, bands) : null;
      cells[subj.id] = { total, percent, grade: band?.grade ?? null, point: band ? band.point : null, taken: has };
      if (has) {
        totalScore += total; takenCount += 1;
        if (tertiary && subj.credit_units && band) { gpaPoints += band.point * subj.credit_units; gpaUnits += subj.credit_units; }
      }
    }
    const average = takenCount && max ? (totalScore / (takenCount * max)) * 100 : 0;
    const gpa = tertiary && gpaUnits ? gpaPoints / gpaUnits : null;
    return { student: row.student, cells, totalScore, average, gpa };
  });

  const pos = rankByTotal(prelim.map((p) => ({ id: p.student.id, total: p.average })));
  return {
    subjects: raw.subjects,
    subjectMax: max,
    students: prelim.map((p) => ({ ...p, position: pos.get(p.student.id) ?? 0 })),
  };
}
