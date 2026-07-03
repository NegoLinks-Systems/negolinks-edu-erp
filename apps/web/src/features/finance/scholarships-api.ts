import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Scholarship, StudentScholarship, DiscountType, Student } from '../../lib/database.types';

export { formatMoney } from '../finance/finance-api';
export const discountTypes: DiscountType[] = ['percent', 'fixed'];

/* ----------------------------- definitions ----------------------------- */
export function useScholarships(institutionId: string) {
  return useQuery({
    queryKey: ['scholarships', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('scholarships').select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as Scholarship[];
    },
  });
}
export function useUpsertScholarship(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Scholarship> & { id?: string; name: string; discount_type: DiscountType; value: number }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, session_id: rest.session_id || null };
      const res = id ? await supabase.from('scholarships').update(row).eq('id', id) : await supabase.from('scholarships').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scholarships', institutionId] }),
  });
}
export function useDeleteScholarship(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('scholarships').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scholarships', institutionId] }),
  });
}

/* ------------------------------- awards -------------------------------- */
export type AwardRow = StudentScholarship & { scholarship: Pick<Scholarship, 'name' | 'discount_type' | 'value'> | null };

export function useStudentScholarships(studentId: string | null) {
  return useQuery({
    queryKey: ['student-scholarships', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.from('student_scholarships')
        .select('*, scholarship:scholarships(name, discount_type, value)')
        .eq('student_id', studentId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AwardRow[];
    },
  });
}
export function useAwardScholarship(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { student_id: string; scholarship_id: string; session_id: string | null }) => {
      const { error } = await supabase.from('student_scholarships').insert({ ...input, institution_id: institutionId, active: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['student-scholarships', v.student_id] }),
  });
}
export function useRevokeScholarship(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('student_scholarships').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-scholarships', studentId] }),
  });
}

export function useApplyForStudent() {
  return useMutation({
    mutationFn: async (input: { student_id: string; session_id: string }): Promise<number> => {
      const { data, error } = await supabase.rpc('apply_scholarships_for_student', { _student: input.student_id, _session: input.session_id });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
  });
}

/* --------------------------- student search ---------------------------- */
export function useStudentSearch(institutionId: string, q: string) {
  return useQuery({
    queryKey: ['sch-student-search', institutionId, q],
    enabled: !!institutionId && q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const { data, error } = await supabase.from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('institution_id', institutionId)
        .or(`first_name.ilike.${term},last_name.ilike.${term},admission_number.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Pick<Student, 'id' | 'first_name' | 'last_name' | 'admission_number'>[];
    },
  });
}
