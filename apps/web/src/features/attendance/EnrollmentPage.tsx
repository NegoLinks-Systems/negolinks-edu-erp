import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, Trash2, Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary } from '../academics/academics-api';
import { ScopeSelector, emptyScope, toScope, type ScopeState } from './scope-selector';
import { useRoster, useStudentPicker, useEnroll, useUnenroll } from './attendance-api';

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function EnrollmentPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const canManage = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer',
    'dean', 'head_of_department', 'rector', 'provost', 'admissions_officer');

  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const scope = toScope(scopeState, tertiary);
  const patch = (p: Partial<ScopeState>) => setScopeState((s) => ({ ...s, ...p }));

  const { data: roster, isLoading } = useRoster(scope);
  const enroll = useEnroll(institutionId ?? '', scope ?? { sessionId: '' });
  const unenroll = useUnenroll();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const picker = useStudentPicker(institutionId ?? '', debounced);
  const enrolledIds = new Set((roster ?? []).map((r) => r.student_id));

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Enrolment</h1>
        <p className="text-sm text-muted-foreground">
          Place students into {tertiary ? 'a programme and level' : 'a class arm'} for a session — {institution?.name}
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <ScopeSelector institutionId={institutionId} tertiary={tertiary} value={scopeState} onChange={patch} />
        </CardContent>
      </Card>

      {!scope && (
        <p className="text-center text-sm text-muted-foreground">
          Choose a session and {tertiary ? 'programme' : 'class arm'} to view its roster.
        </p>
      )}

      {scope && (
        <>
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">Add students</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search name or admission number"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {picker.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
                {picker.data?.map((s) => {
                  const already = enrolledIds.has(s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{s.first_name} {s.last_name} <span className="text-xs text-muted-foreground">· {s.admission_number}</span></span>
                      <Button size="sm" variant={already ? 'ghost' : 'outline'} disabled={already || enroll.isPending}
                        onClick={() => enroll.mutate(s.id, {
                          onSuccess: () => toast.success(`${s.first_name} enrolled`),
                          onError: (e: Error) => toast.error(e.message),
                        })}>
                        {already ? 'In roster' : <><UserPlus className="mr-2 h-4 w-4" /> Add</>}
                      </Button>
                    </div>
                  );
                })}
                {debounced.length >= 2 && !picker.isLoading && !picker.data?.length && (
                  <p className="text-sm text-muted-foreground">No students match.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Roster · {roster?.length ?? 0} students</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
              {!isLoading && !roster?.length && (
                <p className="text-sm text-muted-foreground">No students placed here yet.</p>
              )}
              {roster?.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{r.student.first_name} {r.student.last_name}
                    <span className="text-xs text-muted-foreground"> · {r.student.admission_number}{r.level ? ` · L${r.level}` : ''}</span>
                  </span>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => unenroll.mutate(r.id, {
                      onSuccess: () => toast.success('Removed from roster'),
                      onError: (e: Error) => toast.error(e.message),
                    })}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
