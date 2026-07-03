import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { FeeStructure, Invoice, InvoiceItem, Payment, PaymentMethod, Student } from '../../lib/database.types';
import type { Scope } from '../attendance/attendance-api';

export const paymentMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'online', 'cheque', 'other'];

export function formatMoney(n: number, currency = 'NGN') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n); }
  catch { return `${currency} ${Number(n).toFixed(2)}`; }
}

/* ----------------------------- fee structures --------------------------- */
export function useFeeStructures(institutionId: string, sessionId: string) {
  return useQuery({
    queryKey: ['fee-structures', institutionId, sessionId],
    enabled: !!institutionId && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('fee_structures')
        .select('*').eq('institution_id', institutionId).eq('session_id', sessionId).order('name');
      if (error) throw error;
      return (data ?? []) as FeeStructure[];
    },
  });
}

export function useUpsertFeeStructure(institutionId: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FeeStructure> & { id?: string; name: string; amount: number }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, session_id: sessionId };
      const res = id
        ? await supabase.from('fee_structures').update(row).eq('id', id)
        : await supabase.from('fee_structures').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fee-structures', institutionId, sessionId] }),
  });
}

export function useDeleteFeeStructure(institutionId: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fee-structures', institutionId, sessionId] }),
  });
}

/* -------------------------------- invoices ------------------------------ */
export type InvoiceWithStudent = Invoice & { student: Pick<Student, 'id' | 'first_name' | 'last_name' | 'admission_number'> };

export function useInvoices(institutionId: string, filters: { sessionId: string; termId: string; status: string }) {
  return useQuery({
    queryKey: ['invoices', institutionId, filters],
    enabled: !!institutionId && !!filters.sessionId,
    queryFn: async () => {
      let q = supabase.from('invoices')
        .select('*, student:students(id, first_name, last_name, admission_number)')
        .eq('institution_id', institutionId).eq('session_id', filters.sessionId)
        .order('created_at', { ascending: false }).limit(500);
      if (filters.termId) q = q.eq('term_id', filters.termId);
      if (filters.status) q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceWithStudent[];
    },
  });
}

export type InvoiceDetail = Invoice & {
  student: Pick<Student, 'id' | 'first_name' | 'last_name' | 'admission_number'>;
  items: InvoiceItem[];
  payments: Payment[];
};

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices')
        .select('*, student:students(id, first_name, last_name, admission_number), items:invoice_items(*), payments:payments(*)')
        .eq('id', invoiceId!).single();
      if (error) throw error;
      return data as unknown as InvoiceDetail;
    },
  });
}

export function useGenerateInvoices(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scope: Scope; termId: string | null; title: string; due: string | null }) => {
      const { data, error } = await supabase.rpc('generate_invoices', {
        _institution: institutionId, _session: input.scope.sessionId, _term: input.termId,
        _arm: input.scope.armId ?? null, _programme: input.scope.programmeId ?? null,
        _level: input.scope.level ?? null, _title: input.title, _due: input.due,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Pick<Invoice, 'discount' | 'status' | 'due_date' | 'title'>> }) => {
      const { error } = await supabase.from('invoices').update(input.patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useSetInvoiceDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount: number }) => {
      const { error } = await supabase.rpc('set_invoice_discount', { _invoice: input.id, _amount: input.amount });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/* -------------------------------- payments ------------------------------ */
export function useRecordPayment(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      invoice_id: string; student_id: string; amount: number; method: PaymentMethod; note?: string; paid_at?: string;
    }) => {
      const { error } = await supabase.from('payments').insert({ ...input, institution_id: institutionId });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.invoice_id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from('payments').delete().eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.invoice_id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
