import { useEffect, useMemo, useState } from 'react';
import { Wallet, CalendarCheck, GraduationCap, MonitorCheck, ArrowRight } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { useMyStudents, useAllTerms, useStudentTermResult, useStudentPosition } from '../results/student-results-api';
import { useStudentInvoices } from '../finance/student-finance-api';
import { formatMoney } from '../finance/finance-api';
import { useAvailableExams } from '../cbt/cbt-take-api';
import { useStudentAttendanceSummary } from './dashboard-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function StatCard({ icon, label, value, sub, href, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; href?: string; accent?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${accent ?? 'bg-muted'}`}>{icon}</span>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <div className="flex items-center justify-between">
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : <span />}
          {href && <a href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary">View <ArrowRight className="h-3 w-3" /></a>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentDashboardPage() {
  const { institution, institutionId } = useTenant();
  const currency = institution?.currency || 'NGN';

  const students = useMyStudents();
  const [studentId, setStudentId] = useState('');
  useEffect(() => { if (!studentId && students.data?.length) setStudentId(students.data[0].id); }, [students.data, studentId]);
  const student = students.data?.find((s) => s.id === studentId);

  const terms = useAllTerms(institutionId ?? '');
  const currentTerm = useMemo(() => terms.data?.find((t) => t.isCurrent) ?? terms.data?.[terms.data.length - 1], [terms.data]);

  const invoices = useStudentInvoices(studentId);
  const attendance = useStudentAttendanceSummary(studentId);
  const exams = useAvailableExams(institutionId ?? '');
  const result = useStudentTermResult(studentId, currentTerm?.id ?? '');
  const position = useStudentPosition(studentId, currentTerm?.id ?? '');

  const outstanding = useMemo(() =>
    (invoices.data ?? []).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + Number(i.balance), 0), [invoices.data]);

  const average = useMemo(() => {
    if (!result.data || !result.data.rows.length) return null;
    const obtainable = result.data.rows.length * result.data.subjectMax;
    const total = result.data.rows.reduce((s, r) => s + r.total, 0);
    return obtainable ? (total / obtainable) * 100 : 0;
  }, [result.data]);

  const openExamCount = useMemo(() => {
    return (exams.data ?? []).filter(({ exam, attempts }) => {
      const used = attempts.filter((a) => a.status !== 'in_progress').length;
      const inProgress = attempts.some((a) => a.status === 'in_progress');
      return inProgress || used < exam.max_attempts;
    }).length;
  }, [exams.data]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{student ? `${student.first_name} ${student.last_name}` : 'Dashboard'}</h1>
          <p className="text-sm text-muted-foreground">
            {student ? `${student.admission_number}${student.current_level ? ` · ${student.current_level}` : ''}` : institution?.name}
          </p>
        </div>
        {(students.data?.length ?? 0) > 1 && (
          <div className="space-y-1.5 sm:w-64">
            <Label className="text-xs">Viewing</Label>
            <select className={selectClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>
        )}
      </header>

      {studentId && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Wallet className="h-4 w-4 text-red-600" />} accent="bg-red-50"
            label="Outstanding fees"
            value={invoices.isLoading ? '…' : formatMoney(outstanding, currency)}
            sub={outstanding > 0 ? 'Payment due' : 'All clear'} href="/my-fees"
          />
          <StatCard
            icon={<CalendarCheck className="h-4 w-4 text-emerald-600" />} accent="bg-emerald-50"
            label="Attendance"
            value={attendance.isLoading ? '…' : attendance.data?.rate != null ? `${attendance.data.rate.toFixed(0)}%` : '—'}
            sub={attendance.data?.total ? `${attendance.data.counts.present}/${attendance.data.total} days present` : 'No records'}
          />
          <StatCard
            icon={<GraduationCap className="h-4 w-4 text-violet-600" />} accent="bg-violet-50"
            label={`Result · ${currentTerm?.name ?? 'current'}`}
            value={result.isLoading ? '…' : average != null ? `${average.toFixed(1)}%` : '—'}
            sub={average != null ? (position.data != null ? `Position ${position.data}` : 'Published') : 'Not published yet'}
            href="/results"
          />
          <StatCard
            icon={<MonitorCheck className="h-4 w-4 text-sky-600" />} accent="bg-sky-50"
            label="Exams open"
            value={exams.isLoading ? '…' : String(openExamCount)}
            sub={openExamCount > 0 ? 'Ready to take' : 'None right now'} href="/take-exams"
          />
        </div>
      )}

      {studentId && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-sm font-medium">Quick links</p>
            <div className="flex flex-wrap gap-2">
              {[['Results', '/results'], ['Fees & payments', '/my-fees'], ['Exams', '/take-exams']].map(([label, href]) => (
                <a key={href} href={href} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  {label} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
