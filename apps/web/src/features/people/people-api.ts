import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import type { Guardian, Staff, Student, StudentGuardian } from '../../lib/database.types';

/* ------------------------------ enums ------------------------------ */
export const studentStatuses = [
  'prospective', 'enrolled', 'graduated', 'transferred', 'withdrawn', 'suspended', 'deferred',
] as const;
export const staffStatuses = ['active', 'on_leave', 'suspended', 'terminated', 'retired'] as const;
export const employmentTypes = ['full_time', 'part_time', 'contract', 'visiting', 'volunteer'] as const;
export const relationships = ['father', 'mother', 'guardian', 'sibling', 'other'] as const;

/* ------------------------------ helpers ---------------------------- */
const optEmail = z.string().email('Enter a valid email').optional().or(z.literal(''));
const optStr = (max = 200) => z.string().max(max).optional().or(z.literal(''));
const optDate = z.string().optional().or(z.literal(''));

// Convert '' → null so empty optional fields don't fail typed columns (e.g. date).
function clean<T extends Record<string, unknown>>(v: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = val === '' ? null : val;
  return out;
}

// Strip characters that would break PostgREST .or() filter syntax.
const safe = (s: string) => s.replace(/[,()*%]/g, ' ').trim();

/* ------------------------------ schemas ---------------------------- */
export const studentSchema = z.object({
  admission_number: z.string().min(1, 'Required'),
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  middle_name: optStr(80),
  gender: optStr(20),
  date_of_birth: optDate,
  email: optEmail,
  phone: optStr(40),
  address: optStr(400),
  nationality: optStr(60),
  state_of_origin: optStr(60),
  blood_group: optStr(10),
  genotype: optStr(10),
  medical_notes: optStr(600),
  admission_date: optDate,
  current_level: optStr(40),
  status: z.enum(studentStatuses),
});
export type StudentForm = z.infer<typeof studentSchema>;

export const staffSchema = z.object({
  staff_number: z.string().min(1, 'Required'),
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  middle_name: optStr(80),
  gender: optStr(20),
  email: optEmail,
  phone: optStr(40),
  address: optStr(400),
  job_title: optStr(120),
  department: optStr(120),
  employment_type: z.enum(employmentTypes),
  qualification: optStr(200),
  date_joined: optDate,
  status: z.enum(staffStatuses),
});
export type StaffForm = z.infer<typeof staffSchema>;

export const guardianSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: optEmail,
  phone: optStr(40),
  whatsapp: optStr(40),
  address: optStr(400),
  occupation: optStr(120),
  relationship: z.enum(relationships),
  is_primary: z.boolean().default(false),
  is_emergency_contact: z.boolean().default(false),
});
export type GuardianForm = z.infer<typeof guardianSchema>;

interface ListParams { search: string; status: string; page: number; pageSize: number; }

/* ------------------------------ students --------------------------- */
export function useStudents(institutionId: string, p: ListParams) {
  return useQuery({
    queryKey: ['students', institutionId, p],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('students')
        .select('*', { count: 'exact' })
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .range(p.page * p.pageSize, p.page * p.pageSize + p.pageSize - 1);
      if (p.status) q = q.eq('status', p.status);
      const s = safe(p.search);
      if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,admission_number.ilike.%${s}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Student[], count: count ?? 0 };
    },
  });
}

export function useUpsertStudent(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudentForm & { id?: string }) => {
      const { id, ...rest } = input;
      const row = { ...clean(rest), institution_id: institutionId };
      const res = id
        ? await supabase.from('students').update(row).eq('id', id)
        : await supabase.from('students').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', institutionId] }),
  });
}

export function useDeleteStudent(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', institutionId] }),
  });
}

/* ------------------------------- staff ----------------------------- */
export function useStaffList(institutionId: string, p: ListParams) {
  return useQuery({
    queryKey: ['staff', institutionId, p],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('staff')
        .select('*', { count: 'exact' })
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .range(p.page * p.pageSize, p.page * p.pageSize + p.pageSize - 1);
      if (p.status) q = q.eq('status', p.status);
      const s = safe(p.search);
      if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,staff_number.ilike.%${s}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Staff[], count: count ?? 0 };
    },
  });
}

export function useUpsertStaff(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StaffForm & { id?: string }) => {
      const { id, ...rest } = input;
      const row = { ...clean(rest), institution_id: institutionId };
      const res = id
        ? await supabase.from('staff').update(row).eq('id', id)
        : await supabase.from('staff').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', institutionId] }),
  });
}

export function useDeleteStaff(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', institutionId] }),
  });
}

/* --------------------------- guardian links ------------------------ */
export type GuardianLink = StudentGuardian & { guardian: Guardian };

export function useStudentGuardians(studentId: string | null) {
  return useQuery({
    queryKey: ['student-guardians', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_guardians')
        .select('*, guardian:guardians(*)')
        .eq('student_id', studentId!)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GuardianLink[];
    },
  });
}

export function useAddGuardian(institutionId: string, studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardianForm) => {
      const { relationship, is_primary, is_emergency_contact, ...g } = input;
      const { data: guardian, error: gErr } = await supabase
        .from('guardians').insert({ ...clean(g), institution_id: institutionId }).select().single();
      if (gErr) throw gErr;
      const { error: lErr } = await supabase.from('student_guardians').insert({
        institution_id: institutionId, student_id: studentId,
        guardian_id: guardian!.id, relationship, is_primary, is_emergency_contact,
      });
      if (lErr) throw lErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-guardians', studentId] }),
  });
}

export function useUnlinkGuardian(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('student_guardians').delete().eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-guardians', studentId] }),
  });
}
