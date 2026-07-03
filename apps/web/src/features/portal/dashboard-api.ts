import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/** Attendance summary for a student over the last ~120 days. RLS only
 *  returns rows the caller (the student or their parent) may read. */
export function useStudentAttendanceSummary(studentId: string) {
  return useQuery({
    queryKey: ['attendance-summary', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.from('attendance_records')
        .select('status').eq('student_id', studentId).gte('date', since).limit(2000);
      if (error) throw error;
      const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      const total = (data ?? []).length;
      return { counts, total, rate: total ? (counts.present / total) * 100 : null };
    },
  });
}
