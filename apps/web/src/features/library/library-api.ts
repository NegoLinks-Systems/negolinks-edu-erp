import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { LibraryBook, LibraryLoan, LibrarySettings, Student, Staff } from '../../lib/database.types';

const today = () => new Date().toISOString().slice(0, 10);
const DAY = 86400000;

/** Days a loan is overdue as of `asOf` (or its return date), and the fine. */
export function computeFine(dueDate: string, finePerDay: number, returnedAt?: string | null) {
  const end = returnedAt ? new Date(returnedAt) : new Date();
  const due = new Date(dueDate);
  const days = Math.max(0, Math.floor((end.getTime() - due.getTime()) / DAY));
  return { daysOverdue: days, fine: days * Number(finePerDay || 0) };
}

export const addDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

/* ------------------------------ settings ------------------------------ */
const DEFAULTS: Omit<LibrarySettings, 'institution_id' | 'updated_at'> = { loan_period_days: 14, fine_per_day: 0, max_books: 3 };

export function useLibrarySettings(institutionId: string) {
  return useQuery({
    queryKey: ['library-settings', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<Omit<LibrarySettings, 'updated_at'>> => {
      const { data, error } = await supabase.from('library_settings').select('*').eq('institution_id', institutionId).maybeSingle();
      if (error) throw error;
      return data ?? { institution_id: institutionId, ...DEFAULTS };
    },
  });
}
export function useUpsertLibrarySettings(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { loan_period_days: number; fine_per_day: number; max_books: number }) => {
      const { error } = await supabase.from('library_settings')
        .upsert({ institution_id: institutionId, ...input, updated_at: new Date().toISOString() }, { onConflict: 'institution_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-settings', institutionId] }),
  });
}

/* -------------------------------- books ------------------------------- */
export function useBooks(institutionId: string, search: string) {
  return useQuery({
    queryKey: ['library-books', institutionId, search],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('library_books').select('*').eq('institution_id', institutionId).order('title').limit(300);
      const s = search.replace(/[,()*%]/g, ' ').trim();
      if (s) q = q.or(`title.ilike.%${s}%,author.ilike.%${s}%,isbn.ilike.%${s}%,category.ilike.%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LibraryBook[];
    },
  });
}
export function useUpsertBook(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LibraryBook> & { id?: string; title: string }) => {
      const { id, available_copies, created_at, updated_at, ...rest } = input as any;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('library_books').update(row).eq('id', id) : await supabase.from('library_books').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-books', institutionId] }),
  });
}
export function useDeleteBook(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('library_books').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-books', institutionId] }),
  });
}

/* -------------------------------- loans ------------------------------- */
export type LoanRow = LibraryLoan & {
  book: Pick<LibraryBook, 'id' | 'title' | 'author'> | null;
  student: Pick<Student, 'first_name' | 'last_name' | 'admission_number'> | null;
  staff: Pick<Staff, 'first_name' | 'last_name'> | null;
};
const LOAN_SELECT = '*, book:library_books(id,title,author), student:students(first_name,last_name,admission_number), staff:staff(first_name,last_name)';

export function useLoans(institutionId: string, filter: 'active' | 'overdue' | 'all') {
  return useQuery({
    queryKey: ['library-loans', institutionId, filter],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('library_loans').select(LOAN_SELECT).eq('institution_id', institutionId);
      if (filter === 'active') q = q.is('returned_at', null).order('due_date');
      else if (filter === 'overdue') q = q.is('returned_at', null).lt('due_date', today()).order('due_date');
      else q = q.order('borrowed_at', { ascending: false }).limit(300);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LoanRow[];
    },
  });
}

export function useMyLoans() {
  return useQuery({
    queryKey: ['my-library-loans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('library_loans').select(LOAN_SELECT).order('borrowed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LoanRow[];   // RLS → only the caller's own loans
    },
  });
}

export function useIssueBook(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { book_id: string; student_id?: string; staff_id?: string; due_date: string; note?: string }) => {
      const { error } = await supabase.from('library_loans').insert({
        institution_id: institutionId, book_id: input.book_id,
        borrower_student_id: input.student_id ?? null, borrower_staff_id: input.staff_id ?? null,
        borrowed_at: today(), due_date: input.due_date, note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-loans', institutionId] }); qc.invalidateQueries({ queryKey: ['library-books', institutionId] }); },
  });
}

export function useReturnBook(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; fine_amount: number; fine_paid: boolean }) => {
      const { error } = await supabase.from('library_loans')
        .update({ returned_at: today(), fine_amount: input.fine_amount, fine_paid: input.fine_paid }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-loans', institutionId] }); qc.invalidateQueries({ queryKey: ['library-books', institutionId] }); },
  });
}

/* ----------------------------- borrowers ------------------------------ */
export type Borrower = { type: 'student' | 'staff'; id: string; label: string; sub: string };

export function useBorrowerSearch(institutionId: string, query: string) {
  return useQuery({
    queryKey: ['borrower-search', institutionId, query],
    enabled: !!institutionId && query.trim().length >= 2,
    queryFn: async (): Promise<Borrower[]> => {
      const s = query.replace(/[,()*%]/g, ' ').trim();
      const [stu, stf] = await Promise.all([
        supabase.from('students').select('id, first_name, last_name, admission_number').eq('institution_id', institutionId)
          .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,admission_number.ilike.%${s}%`).limit(8),
        supabase.from('staff').select('id, first_name, last_name, staff_number').eq('institution_id', institutionId)
          .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,staff_number.ilike.%${s}%`).limit(8),
      ]);
      if (stu.error) throw stu.error; if (stf.error) throw stf.error;
      return [
        ...(stu.data ?? []).map((r: any) => ({ type: 'student' as const, id: r.id, label: `${r.first_name} ${r.last_name}`, sub: `Student · ${r.admission_number}` })),
        ...(stf.data ?? []).map((r: any) => ({ type: 'staff' as const, id: r.id, label: `${r.first_name} ${r.last_name}`, sub: `Staff · ${r.staff_number ?? ''}` })),
      ];
    },
  });
}
