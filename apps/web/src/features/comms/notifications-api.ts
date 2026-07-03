import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Notification } from '../../lib/database.types';

export const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'all_students', label: 'All students' },
  { value: 'all_staff', label: 'All staff' },
  { value: 'class', label: 'A class' },
  { value: 'programme', label: 'A programme' },
] as const;

export const CATEGORIES = ['general', 'fee', 'result', 'attendance', 'exam', 'library', 'event'] as const;

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unread-count'],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('unread_count');
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { const { error } = await supabase.rpc('mark_read', { _ids: ids }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread-count'] }); },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('mark_all_read'); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread-count'] }); },
  });
}

export interface AnnouncementInput {
  audience: string; scope_id?: string | null; level?: string | null;
  title: string; body: string; category: string; link?: string | null;
  channels: string[]; include_guardians: boolean;
}
export function useSendAnnouncement() {
  return useMutation({
    mutationFn: async (i: AnnouncementInput) => {
      const { data, error } = await supabase.rpc('send_announcement', {
        _audience: i.audience, _scope_id: i.scope_id ?? null, _level: i.level ?? null,
        _title: i.title, _body: i.body, _category: i.category, _link: i.link ?? null,
        _channels: i.channels, _include_guardians: i.include_guardians,
      });
      if (error) throw error;
      return data as { notifications: number; queued_messages: number };
    },
  });
}
