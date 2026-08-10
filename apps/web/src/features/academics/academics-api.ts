import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import type {
  AcademicSession, AcademicTerm, Class, ClassArm, Department, Faculty, Programme, Subject,
} from '../../lib/database.types';

/* ------------------------------ helpers ---------------------------- */
const optStr = (max = 200) => z.string().max(max).optional().or(z.literal(''));
const optUuid = z.string().uuid().optional().or(z.literal(''));
const optNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().optional());

function clean<T extends Record<string, unknown>>(v: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = val === '' || val === undefined ? null : val;
  return out;
}

/** Generic insert/update/delete + list factory to keep each entity terse. */
function crud<Row extends { id: string }, Form>(table: string) {
  // The table name is dynamic (string), so we access the query builder in an
  // untyped way and re-apply the concrete Row type at the boundaries below.
  const from = () => (supabase as any).from(table);
  return {
    useList(institutionId: string, extra?: { column: string; order?: boolean }) {
      return useQuery({
        queryKey: [table, institutionId],
        queryFn: async () => {
          let q = from().select('*').eq('institution_id', institutionId);
          q = extra ? q.order(extra.column, { ascending: extra.order ?? true }) : q.order('created_at');
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as Row[];
        },
      });
    },
    useUpsert(institutionId: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (input: Form & { id?: string }) => {
          const { id, ...rest } = input as Form & { id?: string };
          const row = { ...clean(rest as Record<string, unknown>), institution_id: institutionId };
          const res = id
            ? await from().update(row).eq('id', id)
            : await from().insert(row);
          if (res.error) throw res.error;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: [table, institutionId] }),
      });
    },
    useDelete(institutionId: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (id: string) => {
          const { error } = await from().delete().eq('id', id);
          if (error) throw error;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: [table, institutionId] }),
      });
    },
  };
}

/* ------------------------------ schemas ---------------------------- */
export const programmeAwards = [
  'certificate', 'diploma', 'national_diploma', 'higher_national_diploma',
  'degree', 'postgraduate', 'professional',
] as const;

export const sessionSchema = z.object({
  name: z.string().min(1, 'Required'), starts_on: optStr(20), ends_on: optStr(20),
});
export const termSchema = z.object({
  name: z.string().min(1, 'Required'),
  sort_order: z.coerce.number().int().min(0).default(1),
  starts_on: optStr(20), ends_on: optStr(20),
});
export const classSchema = z.object({
  name: z.string().min(1, 'Required'),
  level_order: z.coerce.number().int().min(0).default(1),
});
export const armSchema = z.object({
  name: z.string().min(1, 'Required'), capacity: optNum, class_teacher_id: optUuid,
});
export const facultySchema = z.object({ name: z.string().min(1, 'Required'), code: optStr(20) });
export const departmentSchema = z.object({
  name: z.string().min(1, 'Required'), code: optStr(20), faculty_id: optUuid,
});
export const programmeSchema = z.object({
  name: z.string().min(1, 'Required'), code: optStr(20), department_id: optUuid,
  award: z.enum(programmeAwards).optional().or(z.literal('')),
  duration_years: optNum,
});
export const subjectSchema = z.object({
  title: z.string().min(1, 'Required'), code: optStr(20),
  credit_units: optNum, department_id: optUuid, is_elective: z.boolean().default(false),
});

export type SessionForm = z.infer<typeof sessionSchema>;
export type TermForm = z.infer<typeof termSchema>;
export type ClassForm = z.infer<typeof classSchema>;
export type ArmForm = z.infer<typeof armSchema>;
export type FacultyForm = z.infer<typeof facultySchema>;
export type DepartmentForm = z.infer<typeof departmentSchema>;
export type ProgrammeForm = z.infer<typeof programmeSchema>;
export type SubjectForm = z.infer<typeof subjectSchema>;

/* ------------------------------ entities --------------------------- */
export const Sessions = crud<AcademicSession, SessionForm>('academic_sessions');
export const Classes = crud<Class, ClassForm>('classes');
export const Faculties = crud<Faculty, FacultyForm>('faculties');
export const Departments = crud<Department, DepartmentForm>('departments');
export const Programmes = crud<Programme, ProgrammeForm>('programmes');
export const Subjects = crud<Subject, SubjectForm>('subjects');

/* ----- sessions: set-current + nested terms (need custom queries) ---- */
export function useSetCurrentSession(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_sessions')
        .update({ is_current: true }).eq('id', id);  // trigger clears the rest
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_sessions', institutionId] }),
  });
}

export function useTerms(sessionId: string | null) {
  return useQuery({
    queryKey: ['academic_terms', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('academic_terms')
        .select('*').eq('session_id', sessionId!).order('sort_order');
      if (error) throw error;
      return (data ?? []) as AcademicTerm[];
    },
  });
}

export function useUpsertTerm(institutionId: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TermForm & { id?: string }) => {
      const { id, ...rest } = input;
      const row = { ...clean(rest), institution_id: institutionId, session_id: sessionId };
      const res = id
        ? await supabase.from('academic_terms').update(row).eq('id', id)
        : await supabase.from('academic_terms').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_terms', sessionId] }),
  });
}

export function useSetCurrentTerm(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_terms').update({ is_current: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_terms', sessionId] }),
  });
}

export function useDeleteTerm(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academic_terms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic_terms', sessionId] }),
  });
}

/* ----- arms are nested under a class ----- */
export function useArms(classId: string | null) {
  return useQuery({
    queryKey: ['class_arms', classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from('class_arms')
        .select('*').eq('class_id', classId!).order('name');
      if (error) throw error;
      return (data ?? []) as ClassArm[];
    },
  });
}

export function useUpsertArm(institutionId: string, classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ArmForm & { id?: string }) => {
      const { id, ...rest } = input;
      const row = { ...clean(rest), institution_id: institutionId, class_id: classId };
      const res = id
        ? await supabase.from('class_arms').update(row).eq('id', id)
        : await supabase.from('class_arms').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class_arms', classId] }),
  });
}

export function useDeleteArm(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('class_arms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class_arms', classId] }),
  });
}

/* ----- institution-type → which hierarchy the UI shows ----- */
const TERTIARY = new Set(['university', 'polytechnic', 'college', 'professional_academy']);
export const isTertiary = (type?: string) => !!type && TERTIARY.has(type);
