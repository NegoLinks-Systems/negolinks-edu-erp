import { useMemo, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { useExams } from './cbt-api';
import { useExamAttempts } from './cbt-take-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function ExamResultsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canView = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost', 'teacher', 'class_teacher', 'lecturer');

  const exams = useExams(institutionId ?? '');
  const [examId, setExamId] = useState('');
  const exam = exams.data?.find((e) => e.id === examId);
  const attempts = useExamAttempts(examId || null);

  const stats = useMemo(() => {
    const done = (attempts.data ?? []).filter((a) => a.status === 'graded' || a.status === 'submitted');
    if (!done.length) return null;
    const pcts = done.map((a) => (a.total > 0 ? (a.score / a.total) * 100 : 0));
    const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
    const passMark = Number(exam?.pass_mark ?? 50);
    const passed = pcts.filter((p) => p >= passMark).length;
    return { count: done.length, avg, high: Math.max(...pcts), low: Math.min(...pcts), passRate: (passed / done.length) * 100 };
  }, [attempts.data, exam]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canView) {
    return <div className="py-16 text-center text-sm text-muted-foreground">You don’t have access to exam results.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Exam results</h1>
        <p className="text-sm text-muted-foreground">Attempts and analysis — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md space-y-1.5">
            <Label>Exam</Label>
            <select className={selectClass} value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Select exam</option>
              {exams.data?.map((e) => <option key={e.id} value={e.id}>{e.title} ({titleCase(e.status)})</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {examId && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Attempts</p><p className="text-lg font-semibold">{stats.count}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Average</p><p className="text-lg font-semibold">{stats.avg.toFixed(1)}%</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Pass rate</p><p className="text-lg font-semibold">{stats.passRate.toFixed(0)}%</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Highest</p><p className="text-lg font-semibold">{stats.high.toFixed(0)}%</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Lowest</p><p className="text-lg font-semibold">{stats.low.toFixed(0)}%</p></CardContent></Card>
        </div>
      )}

      {examId && (
        <Card>
          <CardContent className="pt-6">
            {attempts.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
            {!attempts.isLoading && !attempts.data?.length && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
            {attempts.data && attempts.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Student</th>
                      <th className="px-2 py-2 text-center font-medium">Score</th>
                      <th className="px-2 py-2 text-center font-medium">%</th>
                      <th className="px-2 py-2 text-center font-medium">Status</th>
                      <th className="px-2 py-2 text-center font-medium">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.data.map((a) => {
                      const pct = a.total > 0 ? (a.score / a.total) * 100 : 0;
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="px-2 py-2">{a.student.last_name} {a.student.first_name}<div className="text-xs text-muted-foreground">{a.student.admission_number}</div></td>
                          <td className="px-2 py-2 text-center">{a.status === 'in_progress' ? '—' : `${a.score}/${a.total}`}</td>
                          <td className="px-2 py-2 text-center">{a.status === 'in_progress' ? '—' : `${pct.toFixed(0)}%`}</td>
                          <td className="px-2 py-2 text-center capitalize">{a.status.replace('_', ' ')}</td>
                          <td className="px-2 py-2 text-center">
                            {a.focus_losses > 0
                              ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />{a.focus_losses}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
