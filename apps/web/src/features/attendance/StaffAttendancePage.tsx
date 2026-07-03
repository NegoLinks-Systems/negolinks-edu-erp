import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { useStaffAttendanceDay, useSaveStaffAttendance } from './attendance-api';
import type { StaffAttendanceStatus } from '../../lib/database.types';

const today = () => new Date().toISOString().slice(0, 10);
const OPTIONS: { value: StaffAttendanceStatus; label: string; on: string }[] = [
  { value: 'present', label: 'Present', on: 'bg-emerald-600 text-white' },
  { value: 'absent', label: 'Absent', on: 'bg-red-600 text-white' },
  { value: 'late', label: 'Late', on: 'bg-amber-500 text-white' },
  { value: 'on_leave', label: 'On leave', on: 'bg-sky-600 text-white' },
];

function Segmented({ value, onChange, disabled }: {
  value: StaffAttendanceStatus; onChange: (v: StaffAttendanceStatus) => void; disabled?: boolean;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${value === o.value ? o.on : 'bg-background hover:bg-muted'} ${disabled ? 'opacity-60' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function StaffAttendancePage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canMark = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal');

  const [date, setDate] = useState(today());
  const { data: lines, isLoading } = useStaffAttendanceDay(institutionId ?? '', date);
  const save = useSaveStaffAttendance(institutionId ?? '', date);

  const [marks, setMarks] = useState<Record<string, StaffAttendanceStatus>>({});
  useEffect(() => {
    if (lines) setMarks(Object.fromEntries(lines.map((l) => [l.staff.id, l.status])));
  }, [lines]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const counts = Object.values(marks).reduce((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>);

  const onSave = () => {
    const records = Object.entries(marks).map(([staff_id, status]) => ({ staff_id, status }));
    save.mutate(records, {
      onSuccess: () => toast.success('Staff attendance saved'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Staff attendance</h1>
        <p className="text-sm text-muted-foreground">Daily staff attendance — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xs space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {lines?.length ?? 0} staff
            {Object.keys(counts).length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {counts.present ?? 0} present · {counts.absent ?? 0} absent · {counts.late ?? 0} late · {counts.on_leave ?? 0} on leave
              </span>
            )}
          </CardTitle>
          {canMark && lines && lines.length > 0 && (
            <Button variant="outline" size="sm"
              onClick={() => setMarks(Object.fromEntries((lines ?? []).map((l) => [l.staff.id, 'present' as StaffAttendanceStatus])))}>
              <Check className="mr-2 h-4 w-4" /> All present
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!isLoading && !lines?.length && (
            <p className="text-sm text-muted-foreground">No staff records yet. Add staff in People first.</p>
          )}
          {lines?.map((l) => (
            <div key={l.staff.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="text-sm">{l.staff.first_name} {l.staff.last_name}
                <span className="text-xs text-muted-foreground"> · {l.staff.staff_number}</span>
              </span>
              <Segmented value={marks[l.staff.id] ?? 'present'} disabled={!canMark}
                onChange={(v) => setMarks((m) => ({ ...m, [l.staff.id]: v }))} />
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
    </div>
  );
}
