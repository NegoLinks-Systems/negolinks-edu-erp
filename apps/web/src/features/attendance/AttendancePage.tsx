import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Subjects } from '../academics/academics-api';
import { ScopeSelector, selectClass, emptyScope, toScope, type ScopeState } from './scope-selector';
import { useAttendanceDay, useSaveAttendance } from './attendance-api';
import type { AttendanceStatus } from '../../lib/database.types';

const today = () => new Date().toISOString().slice(0, 10);
const OPTIONS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: 'present', label: 'Present', on: 'bg-emerald-600 text-white' },
  { value: 'absent', label: 'Absent', on: 'bg-red-600 text-white' },
  { value: 'late', label: 'Late', on: 'bg-amber-500 text-white' },
  { value: 'excused', label: 'Excused', on: 'bg-sky-600 text-white' },
];

function Segmented({ value, onChange, disabled }: {
  value: AttendanceStatus; onChange: (v: AttendanceStatus) => void; disabled?: boolean;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${value === o.value ? o.on : 'bg-background hover:bg-muted'} ${disabled ? 'opacity-60' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AttendancePage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const canMark = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer',
    'dean', 'head_of_department', 'rector', 'provost', 'teacher', 'class_teacher', 'lecturer');

  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const scope = toScope(scopeState, tertiary);
  const patch = (p: Partial<ScopeState>) => setScopeState((s) => ({ ...s, ...p }));

  const [date, setDate] = useState(today());
  const [subjectId, setSubjectId] = useState('');
  const subjects = Subjects.useList(institutionId ?? '');

  const { data: lines, isLoading } = useAttendanceDay({ scope, date, subjectId: subjectId || undefined });
  const save = useSaveAttendance(institutionId ?? '');

  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  useEffect(() => {
    if (lines) setMarks(Object.fromEntries(lines.map((l) => [l.student.id, l.status])));
  }, [lines]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const counts = Object.values(marks).reduce((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>);

  const onSave = () => {
    if (!scope) return;
    const records = Object.entries(marks).map(([student_id, status]) => ({ student_id, status }));
    save.mutate({ scope, date, subjectId: subjectId || undefined, records }, {
      onSuccess: () => toast.success('Attendance saved'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Record attendance against a class roster — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <ScopeSelector institutionId={institutionId} tertiary={tertiary} value={scopeState} onChange={patch} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tertiary ? 'Course' : 'Subject (optional)'}</Label>
              <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">{tertiary ? 'Select course' : 'Whole-day attendance'}</option>
                {subjects.data?.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!scope && (
        <p className="text-center text-sm text-muted-foreground">
          Choose a session and {tertiary ? 'programme' : 'class arm'} to load the roster.
        </p>
      )}

      {scope && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {lines?.length ?? 0} students
              {Object.keys(counts).length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {counts.present ?? 0} present · {counts.absent ?? 0} absent · {counts.late ?? 0} late · {counts.excused ?? 0} excused
                </span>
              )}
            </CardTitle>
            {canMark && lines && lines.length > 0 && (
              <Button variant="outline" size="sm"
                onClick={() => setMarks(Object.fromEntries((lines ?? []).map((l) => [l.student.id, 'present' as AttendanceStatus])))}>
                <Check className="mr-2 h-4 w-4" /> All present
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
            {!isLoading && !lines?.length && (
              <p className="text-sm text-muted-foreground">No students on this roster. Enrol students first.</p>
            )}
            {lines?.map((l) => (
              <div key={l.student.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="text-sm">{l.student.first_name} {l.student.last_name}
                  <span className="text-xs text-muted-foreground"> · {l.student.admission_number}</span>
                </span>
                <Segmented value={marks[l.student.id] ?? 'present'} disabled={!canMark}
                  onChange={(v) => setMarks((m) => ({ ...m, [l.student.id]: v }))} />
              </div>
            ))}
            {canMark && lines && lines.length > 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={onSave} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save attendance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
