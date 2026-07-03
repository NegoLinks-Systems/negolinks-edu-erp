import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Invoice, InvoiceItem, Payment } from '../../lib/database.types';

export type StudentInvoice = Invoice & { items: InvoiceItem[]; payments: Payment[] };

/** Invoices for a single student. RLS only returns rows the caller (the
 *  student themselves or their parent/guardian) is allowed to see. */
export function useStudentInvoices(studentId: string) {
  return useQuery({
    queryKey: ['student-invoices', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices')
        .select('*, items:invoice_items(*), payments:payments(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StudentInvoice[];
    },
  });
}
