import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Document } from '../../lib/database.types';

export const DOC_TYPES = [
  'Formal letter', 'Memo', 'Circular', 'Notice', 'Acceptance letter',
  'Recommendation letter', 'Warning letter', 'Report', 'Invitation', 'Announcement',
] as const;

export interface GenerateInput {
  institutionName: string; docType: string; instructions: string;
  fields?: { recipient?: string; subject?: string; sender?: string; date?: string };
}

export function useGenerateDocument() {
  return useMutation({
    mutationFn: async (input: GenerateInput): Promise<{ title: string; body: string }> => {
      const { data, error } = await supabase.functions.invoke('intelligence-engine', { body: input });
      if (error) {
        let msg = 'The Intelligence Engine is unavailable.';
        try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { title: string; body: string };
    },
  });
}

export function useDocuments(institutionId: string) {
  return useQuery({
    queryKey: ['documents', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('documents')
        .select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });
}

export function useSaveDocument(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; doc_type: string; title: string; body: string; instructions?: string | null }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('documents').update(row).eq('id', id).select().single()
        : await supabase.from('documents').insert(row).select().single();
      if (res.error) throw res.error;
      return res.data as Document;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', institutionId] }),
  });
}

export function useDeleteDocument(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('documents').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', institutionId] }),
  });
}
