import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AttendanceRecord, AttendanceStatus, Staff, StaffAttendance, StaffAttendanceStatus,
  Student, StudentEnrollment,
} from '../../lib/database.types';

export interface Scope { sessionId: string; armId?: string; programmeId?: string; level?: string; }
const scopeKey = (s: Scope) => [s.sessionId, s.armId ?? '', s.programmeId ?? '', s.level ?? ''];

/* ------------------------------------------------------------------ */
/* Class/arm options (with the parent class name for labelling)        */
/* ------------------------------------------------------------------ */
export function useAllArms(institutionId: string) {
  return useQuery({
    queryKey: ['all-arms', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('class_arms')
        .select('id, name, class_id, class:classes(name, level_order)')
        .eq('institution_id', institutionId);
      if (error) throw error;
      const rows = (data ?? []) as unknown as
        { id: string; name: string; class: { name: string; level_order: number } | null }[];
      return rows
        .map((r) => ({ id: r.id, label: `${r.class?.name ?? '—'} · ${r.name}`, order: r.class?.level_order ?? 0 }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Roster: students placed into a scope for a session                  */
/* ------------------------------------------------------------------ */
export type RosterRow = StudentEnrollment & { student: Student };

export function useRoster(scope: Scope | null) {
  return useQuery({
    queryKey: ['roster', scope ? scopeKey(scope) : 'none'],
    enabled: !!scope?.sessionId && (!!scope?.armId || !!scope?.programmeId),
    queryFn: async () => {
      let q = supabase.from('student_enrollments')
        .select('*, student:students(*)')
        .eq('session_id', scope!.sessionId);
      if (scope!.armId) q = q.eq('class_arm_id', scope!.armId);
      else {
        q = q.eq('programme_id', scope!.programmeId!);
        if (scope!.level) q = q.eq('level', scope!.level);
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as RosterRow[];
      return rows.sort((a, b) =>
        `${a.student.last_name}${a.student.first_name}`.localeCompare(`${b.student.last_name}${b.student.first_name}`));
    },
  });
}

/* Quick student search for the enrolment picker. */
export function useStudentPicker(institutionId: string, search: string) {
  const s = search.replace(/[,()*%]/g, ' ').trim();
  return useQuery({
    queryKey: ['student-picker', institutionId, s],
    enabled: s.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('institution_id', institutionId)
        .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,admission_number.ilike.%${s}%`)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Pick<Student, 'id' | 'first_name' | 'last_name' | 'admission_number'>[];
    },
  });
}

/* Enrol (or move) a student into a scope. Unique per (student, session). */
export function useEnroll(institutionId: string, scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      const row = {
        institution_id: institutionId, student_id: studentId, session_id: scope.sessionId,
        class_arm_id: scope.armId ?? null, programme_id: scope.programmeId ?? null,
        level: scope.level ?? null, status: 'active' as const,
      };
      const { error } = await supabase.from('student_enrollments')
        .upsert(row, { onConflict: 'student_id,session_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  });
}

export function useUnenroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from('student_enrollments').delete().eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  });
}

/* ------------------------------------------------------------------ */
/* Student attendance for a day                                        */
/* ------------------------------------------------------------------ */
export interface AttendanceLine {
  student: Student; status: AttendanceStatus;
}

export function useAttendanceDay(params: {
  scope: Scope | null; date: string; subjectId?: string;
}) {
  const { scope, date, subjectId } = params;
  return useQuery({
    queryKey: ['attendance-day', scope ? scopeKey(scope) : 'none', date, subjectId ?? ''],
    enabled: !!scope?.sessionId && (!!scope?.armId || !!scope?.programmeId) && !!date,
    queryFn: async (): Promise<AttendanceLine[]> => {
      // 1) roster
      let rq = supabase.from('student_enrollments').select('student:students(*)').eq('session_id', scope!.sessionId);
      if (scope!.armId) rq = rq.eq('class_arm_id', scope!.armId);
      else { rq = rq.eq('programme_id', scope!.programmeId!); if (scope!.level) rq = rq.eq('level', scope!.level); }
      const { data: roster, error: rErr } = await rq;
      if (rErr) throw rErr;
      const students = ((roster ?? []) as unknown as { student: Student }[])
        .map((r) => r.student)
        .sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));

      // 2) existing marks for this date + scope
      let aq = supabase.from('attendance_records').select('student_id, status').eq('date', date);
      if (subjectId) aq = aq.eq('subject_id', subjectId);
      else if (scope!.armId) aq = aq.eq('class_arm_id', scope!.armId).is('subject_id', null);
      const { data: marks, error: aErr } = await aq;
      if (aErr) throw aErr;
      const byStudent = new Map((marks ?? []).map((m) => [m.student_id, m.status as AttendanceStatus]));

      return students.map((s) => ({ student: s, status: byStudent.get(s.id) ?? 'present' }));
    },
  });
}

export function useSaveAttendance(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      scope: Scope; date: string; subjectId?: string; termId?: string;
      records: { student_id: string; status: AttendanceStatus }[];
    }) => {
      const { error } = await supabase.rpc('save_attendance', {
        _institution: institutionId,
        _date: input.date,
        _class_arm: input.scope.armId ?? null,
        _subject: input.subjectId ?? null,
        _session: input.scope.sessionId,
        _term: input.termId ?? null,
        _records: input.records,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-day'] }),
  });
}

/* ------------------------------------------------------------------ */
/* Staff attendance for a day                                          */
/* ------------------------------------------------------------------ */
export interface StaffAttendanceLine {
  staff: Pick<Staff, 'id' | 'first_name' | 'last_name' | 'staff_number'>;
  status: StaffAttendanceStatus;
}

export function useStaffAttendanceDay(institutionId: string, date: string) {
  return useQuery({
    queryKey: ['staff-attendance-day', institutionId, date],
    enabled: !!date,
    queryFn: async (): Promise<StaffAttendanceLine[]> => {
      const [{ data: staff, error: sErr }, { data: marks, error: mErr }] = await Promise.all([
        supabase.from('staff').select('id, first_name, last_name, staff_number')
          .eq('institution_id', institutionId).order('first_name').limit(1000),
        supabase.from('staff_attendance').select('staff_id, status')
          .eq('institution_id', institutionId).eq('date', date),
      ]);
      if (sErr) throw sErr;
      if (mErr) throw mErr;
      const byStaff = new Map((marks ?? []).map((m) => [m.staff_id, m.status as StaffAttendanceStatus]));
      return (staff ?? []).map((st) => ({ staff: st, status: byStaff.get(st.id) ?? 'present' }));
    },
  });
}

export function useSaveStaffAttendance(institutionId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: { staff_id: string; status: StaffAttendanceStatus }[]) => {
      const rows = records.map((r) => ({ ...r, institution_id: institutionId, date }));
      const { error } = await supabase.from('staff_attendance')
        .upsert(rows, { onConflict: 'staff_id,date' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-attendance-day', institutionId, date] }),
  });
}
