import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Hostel, HostelRoom, Student } from '../../lib/database.types';

const today = () => new Date().toISOString().slice(0, 10);
export const hostelGenders = ['male', 'female', 'mixed'] as const;

/* ------------------------------ hostels ------------------------------- */
export function useHostels(institutionId: string) {
  return useQuery({
    queryKey: ['hostels', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('hostels').select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as Hostel[];
    },
  });
}
export function useUpsertHostel(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Hostel> & { id?: string; name: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('hostels').update(row).eq('id', id) : await supabase.from('hostels').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostels', institutionId] }),
  });
}
export function useDeleteHostel(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('hostels').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostels', institutionId] }),
  });
}

/* ------------------------------- rooms -------------------------------- */
export function useRooms(hostelId: string | null) {
  return useQuery({
    queryKey: ['hostel-rooms', hostelId],
    enabled: !!hostelId,
    queryFn: async () => {
      const { data, error } = await supabase.from('hostel_rooms').select('*').eq('hostel_id', hostelId!).order('room_number');
      if (error) throw error;
      return (data ?? []) as HostelRoom[];
    },
  });
}
export function useUpsertRoom(institutionId: string, hostelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; room_number: string; capacity: number; floor?: string | null }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, hostel_id: hostelId };
      const res = id ? await supabase.from('hostel_rooms').update(row).eq('id', id) : await supabase.from('hostel_rooms').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel-rooms', hostelId] }),
  });
}
export function useDeleteRoom(hostelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('hostel_rooms').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel-rooms', hostelId] }),
  });
}

/* ---------------------------- allocations ----------------------------- */
export type AllocationRow = {
  id: string; room_id: string; student_id: string; allocated_at: string;
  student: Pick<Student, 'first_name' | 'last_name' | 'admission_number'> | null;
};

/** Active allocations for every room in a hostel. */
export function useHostelAllocations(hostelId: string | null) {
  return useQuery({
    queryKey: ['hostel-allocations', hostelId],
    enabled: !!hostelId,
    queryFn: async (): Promise<AllocationRow[]> => {
      const { data: rooms, error: rErr } = await supabase.from('hostel_rooms').select('id').eq('hostel_id', hostelId!);
      if (rErr) throw rErr;
      const ids = (rooms ?? []).map((r) => r.id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from('hostel_allocations')
        .select('id, room_id, student_id, allocated_at, student:students(first_name,last_name,admission_number)')
        .in('room_id', ids).is('vacated_at', null);
      if (error) throw error;
      return (data ?? []) as unknown as AllocationRow[];
    },
  });
}

export function useAllocateStudent(institutionId: string, hostelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { room_id: string; student_id: string; session_id?: string | null }) => {
      const { error } = await supabase.from('hostel_allocations').insert({
        institution_id: institutionId, room_id: input.room_id, student_id: input.student_id, session_id: input.session_id ?? null, allocated_at: today(),
      });
      if (error) {
        if ((error as any).code === '23505') throw new Error('That student already has a bed allocated');
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel-allocations', hostelId] }),
  });
}

export function useVacate(hostelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('hostel_allocations').update({ vacated_at: today() }).eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel-allocations', hostelId] }),
  });
}

/* --------------------------- student search --------------------------- */
export function useStudentSearch(institutionId: string, query: string) {
  return useQuery({
    queryKey: ['hostel-student-search', institutionId, query],
    enabled: !!institutionId && query.trim().length >= 2,
    queryFn: async () => {
      const s = query.replace(/[,()*%]/g, ' ').trim();
      const { data, error } = await supabase.from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('institution_id', institutionId).eq('status', 'active')
        .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,admission_number.ilike.%${s}%`).limit(10);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`, admission: r.admission_number ?? '' }));
    },
  });
}

/* ---------------------------- student view ---------------------------- */
export function useMyAllocations() {
  return useQuery({
    queryKey: ['my-hostel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hostel_allocations')
        .select('id, allocated_at, room:hostel_rooms(room_number, floor, hostel:hostels(name, gender))')
        .is('vacated_at', null);
      if (error) throw error;
      return (data ?? []) as any[]; // RLS → only the caller's own / wards
    },
  });
}
