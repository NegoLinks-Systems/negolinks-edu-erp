import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Vehicle, TransportRoute, RouteStop, Student } from '../../lib/database.types';

const today = () => new Date().toISOString().slice(0, 10);
export const vehicleStatuses = ['active', 'maintenance', 'inactive'] as const;

/* ------------------------------ vehicles ------------------------------ */
export function useVehicles(institutionId: string) {
  return useQuery({
    queryKey: ['vehicles', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });
}
export function useUpsertVehicle(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Vehicle> & { id?: string; name: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('vehicles').update(row).eq('id', id) : await supabase.from('vehicles').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles', institutionId] }),
  });
}
export function useDeleteVehicle(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('vehicles').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles', institutionId] }),
  });
}

/* ------------------------------- routes ------------------------------- */
export function useRoutes(institutionId: string) {
  return useQuery({
    queryKey: ['routes', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('transport_routes').select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as TransportRoute[];
    },
  });
}
export function useUpsertRoute(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TransportRoute> & { id?: string; name: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('transport_routes').update(row).eq('id', id) : await supabase.from('transport_routes').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes', institutionId] }),
  });
}
export function useDeleteRoute(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('transport_routes').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes', institutionId] }),
  });
}

/* -------------------------------- stops ------------------------------- */
export function useStops(routeId: string | null) {
  return useQuery({
    queryKey: ['route-stops', routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('route_stops').select('*').eq('route_id', routeId!).order('sequence');
      if (error) throw error;
      return (data ?? []) as RouteStop[];
    },
  });
}
export function useUpsertStop(institutionId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; sequence: number; pickup_time?: string | null }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId, route_id: routeId };
      const res = id ? await supabase.from('route_stops').update(row).eq('id', id) : await supabase.from('route_stops').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-stops', routeId] }),
  });
}
export function useDeleteStop(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('route_stops').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-stops', routeId] }),
  });
}

/* ---------------------------- assignments ----------------------------- */
export type TAssignmentRow = {
  id: string; route_id: string; student_id: string; stop_id: string | null; assigned_at: string;
  student: Pick<Student, 'first_name' | 'last_name' | 'admission_number'> | null;
  stop: { name: string } | null;
};
export function useRouteAssignments(routeId: string | null) {
  return useQuery({
    queryKey: ['route-assignments', routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('transport_assignments')
        .select('id, route_id, student_id, stop_id, assigned_at, student:students(first_name,last_name,admission_number), stop:route_stops(name)')
        .eq('route_id', routeId!).is('ended_at', null);
      if (error) throw error;
      return (data ?? []) as unknown as TAssignmentRow[];
    },
  });
}
export function useAssignStudent(institutionId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { student_id: string; stop_id?: string | null }) => {
      const { error } = await supabase.from('transport_assignments').insert({
        institution_id: institutionId, route_id: routeId, student_id: input.student_id, stop_id: input.stop_id ?? null, assigned_at: today(),
      });
      if (error) {
        if ((error as any).code === '23505') throw new Error('That student is already assigned to a route');
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-assignments', routeId] }),
  });
}
export function useEndAssignment(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('transport_assignments').update({ ended_at: today() }).eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['route-assignments', routeId] }),
  });
}

/* --------------------------- student search --------------------------- */
export function useStudentSearch(institutionId: string, query: string) {
  return useQuery({
    queryKey: ['transport-student-search', institutionId, query],
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
export function useMyTransport() {
  return useQuery({
    queryKey: ['my-transport'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transport_assignments')
        .select('id, assigned_at, stop:route_stops(name, pickup_time), route:transport_routes(name, fare, vehicle:vehicles(name, plate_number, driver_name, driver_phone))')
        .is('ended_at', null);
      if (error) throw error;
      return (data ?? []) as any[]; // RLS → caller's own / wards
    },
  });
}
