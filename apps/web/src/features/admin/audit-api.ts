import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_name: string;
  actor_email: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}

export function useAuditActions() {
  return useQuery({
    queryKey: ['audit-actions'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('audit_actions');
      if (error) throw error;
      return ((data as { action: string }[]) ?? []).map((r) => r.action);
    },
  });
}

export function useAuditList(search: string, action: string) {
  return useQuery({
    queryKey: ['audit-list', search, action],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase.rpc('audit_list', {
        _search: search || undefined,
        _action: action || undefined,
        _limit: 200,
        _offset: 0,
      });
      if (error) throw error;
      return (data as AuditRow[]) ?? [];
    },
  });
}
