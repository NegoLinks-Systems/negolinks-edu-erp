import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, GraduationCap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Subjects, Sessions, Programmes } from '../academics/academics-api';
import {
  useTeachingAssignments, useUpsertTeachingAssignment, useDeleteTeachingAssignment,
  useStaffList, useAllArms, type AssignmentRow,
} from './teaching-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

const scopeLabel = (a: AssignmentRow) =>
  a.arm ? `${a.arm.class?.name ?? ''} ${a.arm.name}`.trim()
    : a.programme ? `${a.programme.name}${a.level ? ` · L${a.level}` : ''}`
    : '—';

export default function TeachingAssignmentsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const canManage = isSuperAdmin ||
    hasRole('institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost');

  const staff = useStaffList(institutionId ?? '');
  const subjects = Subjects.useList(institutionId ?? '');
  const sessions = Sessions.useList(institutionId ?? '');
  const arms = useAllArms(institutionId ?? '');
  const programmes = Programmes.useList(institutionId ?? '');

  const [staffId, setStaffId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [armId, setArmId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [level, setLevel] = useState('');

  const [filterStaff, setFilterStaff] = useState('');
  const list = useTeachingAssignments(institutionId ?? '', filterStaff || undefined);
  const upsert = useUpsertTeachingAssignment(institutionId ?? '');
  const del = useDeleteTeachingAssignment(institutionId ?? '');

  if (!institutionId) return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  if (!canManage) return <div className="py-16 text-center text-sm text-muted-foreground">Teaching assignments are managed by academic staff.</div>;

  const add = () => {
    if (!staffId || !subjectId) { toast.error('Select a teacher and a course'); return; }
    if (tertiary && !programmeId) { toast.error('Select a programme'); return; }
    if (!tertiary && !armId) { toast.error('Select a class arm'); return; }
    upsert.mutate({
      staff_id: staffId, subject_id: subjectId, session_id: sessionId || null,
      class_arm_id: tertiary ? null : armId, programme_id: tertiary ? programmeId : null,
      level: tertiary ? (level || null) : null,
    }, {
      onSuccess: () => { toast.success('Assignment added'); setSubjectId(''); },
      onError: (e: Error) => toast.error(/duplicate|unique/i.test(e.message) ? 'That assignment already exists' : e.message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Teaching assignments</h1>
        <p className="text-sm text-muted-foreground">
          Assign teachers to {tertiary ? 'courses and programmes' : 'subjects and class arms'} — {institution?.name}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">New assignment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <select className={selectClass} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Select…</option>
                {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{tertiary ? 'Course' : 'Subject'}</Label>
              <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select…</option>
                {subjects.data?.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
              </select>
            </div>

            {tertiary ? (
              <>
                <div className="space-y-1.5">
                  <Label>Programme</Label>
                  <select className={selectClass} value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
                    <option value="">Select…</option>
                    {programmes.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level (optional)</Label>
                  <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="100" />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Class arm</Label>
                <select className={selectClass} value={armId} onChange={(e) => setArmId(e.target.value)}>
                  <option value="">Select…</option>
                  {arms.data?.map((a) => <option key={a.id} value={a.id}>{a.class?.name ?? ''} {a.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Session (optional)</Label>
              <select className={selectClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">Any session</option>
                {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add assignment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Assignments</CardTitle>
          <select className={`${selectClass} w-auto`} value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
            <option value="">All teachers</option>
            {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!list.isLoading && !list.data?.length && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          {list.data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <div className="flex min-w-0 items-start gap-2">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{a.staff ? `${a.staff.first_name} ${a.staff.last_name}` : '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.subject ? `${a.subject.code ? `${a.subject.code} — ` : ''}${a.subject.title}` : '—'} · {scopeLabel(a)}{a.session ? ` · ${a.session.name}` : ''}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm('Remove this assignment?')) del.mutate(a.id, { onSuccess: () => toast.success('Removed'), onError: (e: Error) => toast.error(e.message) });
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
