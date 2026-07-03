import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { TeachingAssignment } from '../../lib/database.types';

export type AssignmentRow = TeachingAssignment & {
  staff: { first_name: string; last_name: string } | null;
  subject: { title: string; code: string | null } | null;
  arm: { name: string; class: { name: string } | null } | null;
  programme: { name: string } | null;
  session: { name: string } | null;
};

export function useTeachingAssignments(institutionId: string, staffId?: string) {
  return useQuery({
    queryKey: ['teaching-assignments', institutionId, staffId ?? ''],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('teaching_assignments')
        .select('*, staff:staff(first_name, last_name), subject:subjects(title, code), arm:class_arms(name, class:classes(name)), programme:programmes(name), session:academic_sessions(name)')
        .eq('institution_id', institutionId).order('created_at', { ascending: false });
      if (staffId) q = q.eq('staff_id', staffId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentRow[];
    },
  });
}

export function useUpsertTeachingAssignment(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; staff_id: string; subject_id: string;
      session_id: string | null; class_arm_id: string | null; programme_id: string | null; level: string | null;
    }) => {
      const { id, ...rest } = input;
      const row = {
        ...rest, institution_id: institutionId,
        session_id: rest.session_id || null, class_arm_id: rest.class_arm_id || null,
        programme_id: rest.programme_id || null, level: rest.level || null,
      };
      const res = id
        ? await supabase.from('teaching_assignments').update(row).eq('id', id)
        : await supabase.from('teaching_assignments').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teaching-assignments', institutionId] }),
  });
}

export function useDeleteTeachingAssignment(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('teaching_assignments').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teaching-assignments', institutionId] }),
  });
}

export function useStaffList(institutionId: string) {
  return useQuery({
    queryKey: ['ta-staff', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('staff')
        .select('id, first_name, last_name').eq('institution_id', institutionId).order('first_name').limit(1000);
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string; last_name: string }[];
    },
  });
}

export function useAllArms(institutionId: string) {
  return useQuery({
    queryKey: ['ta-arms', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('class_arms')
        .select('id, name, class:classes(name)').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; class: { name: string } | null }[];
    },
  });
}
