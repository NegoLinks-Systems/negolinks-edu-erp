import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminMetrics {
  students_active: number; students_total: number; staff_total: number;
  fees_invoiced: number; fees_paid: number; fees_outstanding: number;
  attendance_total: number; attendance_present: number; attendance_rate: number | null;
  exams_total: number; attempts_total: number; exam_avg: number;
  by_level: { label: string; count: number }[];
}

export function useAdminDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-dashboard'],
    enabled,
    queryFn: async (): Promise<AdminMetrics> => {
      const { data, error } = await supabase.rpc('admin_dashboard');
      if (error) throw error;
      return data as unknown as AdminMetrics;
    },
  });
}
