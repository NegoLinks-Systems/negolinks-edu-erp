import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface FinanceReport {
  collected: number; outstanding: number; invoiced: number;
  monthly: { month: string; amount: number }[];
  by_method: { method: string; amount: number }[];
  by_level: { label: string; outstanding: number }[];
  top_debtors: { name: string; admission: string; balance: number }[];
}

export function useFinanceReport(enabled: boolean) {
  return useQuery({
    queryKey: ['finance-report'],
    enabled,
    queryFn: async (): Promise<FinanceReport> => {
      const { data, error } = await supabase.rpc('finance_report');
      if (error) throw error;
      return data as unknown as FinanceReport;
    },
  });
}
