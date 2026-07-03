import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type ProvisionType = 'student' | 'guardian' | 'staff';
export interface Provisionable { id: string; name: string; email: string; ident: string }

export const STAFF_ROLES = [
  'teacher', 'class_teacher', 'lecturer', 'academic_officer', 'head_of_department', 'dean',
  'registrar', 'bursar', 'accountant', 'librarian', 'vice_principal', 'principal', 'institution_admin',
] as const;

export function useUnprovisioned(institutionId: string, type: ProvisionType) {
  return useQuery({
    queryKey: ['unprovisioned', institutionId, type],
    enabled: !!institutionId,
    queryFn: async (): Promise<Provisionable[]> => {
      if (type === 'student') {
        const { data, error } = await supabase.from('students')
          .select('id, first_name, last_name, email, admission_number')
          .eq('institution_id', institutionId).is('user_id', null).not('email', 'is', null).order('last_name').limit(500);
        if (error) throw error;
        return (data ?? []).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, email: r.email, ident: r.admission_number ?? '' }));
      }
      if (type === 'staff') {
        const { data, error } = await supabase.from('staff')
          .select('id, first_name, last_name, email, staff_number')
          .eq('institution_id', institutionId).is('user_id', null).not('email', 'is', null).order('last_name').limit(500);
        if (error) throw error;
        return (data ?? []).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, email: r.email, ident: r.staff_number ?? '' }));
      }
      const { data, error } = await supabase.from('guardians')
        .select('id, first_name, last_name, email, phone')
        .eq('institution_id', institutionId).is('user_id', null).not('email', 'is', null).order('last_name').limit(500);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, email: r.email, ident: r.phone ?? '' }));
    },
  });
}

export interface ProvisionPerson { type: ProvisionType; record_id: string; email: string; full_name: string; role: string }
export interface ProvisionResult { record_id: string; email?: string; status: 'created' | 'failed'; password?: string; error?: string }

export function useProvision() {
  return useMutation({
    mutationFn: async (input: { institution_id: string; people: ProvisionPerson[] }): Promise<{ created: number; failed: number; results: ProvisionResult[] }> => {
      const { data, error } = await supabase.functions.invoke('provision-accounts', { body: input });
      if (error) {
        let msg = 'Provisioning service is unavailable.';
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { created: number; failed: number; results: ProvisionResult[] };
    },
  });
}
