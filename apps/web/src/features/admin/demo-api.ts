import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type DemoScenario = 'small' | 'medium' | 'large' | 'multi_branch' | 'heavy';

export interface DemoStatus { demo_mode: boolean; demo_students: number; demo_staff: number }

export function useDemoStatus() {
  return useQuery({
    queryKey: ['demo-status'],
    queryFn: async (): Promise<DemoStatus> => {
      const { data, error } = await supabase.rpc('demo_status');
      if (error) throw error;
      return (data as DemoStatus) ?? { demo_mode: false, demo_students: 0, demo_staff: 0 };
    },
  });
}

export function useDemoLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scenario: DemoScenario) => {
      const { data, error } = await supabase.rpc('demo_load', { _scenario: scenario });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDemoDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('demo_delete');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDemoReload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scenario: DemoScenario) => {
      const { data, error } = await supabase.rpc('demo_reload', { _scenario: scenario });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
