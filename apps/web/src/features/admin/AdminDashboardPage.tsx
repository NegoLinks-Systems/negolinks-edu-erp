import { Users, Briefcase, Wallet, AlertCircle, CalendarCheck, MonitorCheck, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../../providers/app-providers';
import { formatMoney } from '../finance/finance-api';
import { useAdminDashboard } from './admin-dashboard-api';

const n = (v: number | null | undefined) => Number(v ?? 0);

function Stat({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${accent}`}>{icon}</span>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const currency = institution?.currency || 'NGN';
  const canView = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'proprietor', 'rector', 'provost',
    'registrar', 'bursar', 'accountant', 'dean', 'head_of_department');

  const { data, isLoading, error } = useAdminDashboard(!!institutionId && canView);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canView) {
    return <div className="py-16 text-center text-sm text-muted-foreground">This dashboard is for administrators.</div>;
  }
  if (isLoading) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Couldn’t load dashboard metrics.</div>;
  }

  const invoiced = n(data.fees_invoiced);
  const paid = n(data.fees_paid);
  const outstanding = n(data.fees_outstanding);
  const collectRate = invoiced > 0 ? (paid / invoiced) * 100 : 0;
  const maxLevel = Math.max(1, ...data.by_level.map((b) => n(b.count)));

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Institution metrics — {institution?.name}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={<Users className="h-4 w-4 text-sky-600" />} accent="bg-sky-50" label="Students"
          value={n(data.students_active).toLocaleString()} sub={`${n(data.students_total).toLocaleString()} on record`} />
        <Stat icon={<Briefcase className="h-4 w-4 text-violet-600" />} accent="bg-violet-50" label="Staff"
          value={n(data.staff_total).toLocaleString()} />
        <Stat icon={<CalendarCheck className="h-4 w-4 text-emerald-600" />} accent="bg-emerald-50" label="Attendance (30d)"
          value={data.attendance_rate != null ? `${n(data.attendance_rate)}%` : '—'}
          sub={data.attendance_total ? `${n(data.attendance_present).toLocaleString()} / ${n(data.attendance_total).toLocaleString()} present` : 'No records'} />
        <Stat icon={<Wallet className="h-4 w-4 text-emerald-600" />} accent="bg-emerald-50" label="Fees collected"
          value={formatMoney(paid, currency)} sub={`${collectRate.toFixed(0)}% of invoiced`} />
        <Stat icon={<AlertCircle className="h-4 w-4 text-red-600" />} accent="bg-red-50" label="Outstanding"
          value={formatMoney(outstanding, currency)} sub={outstanding > 0 ? 'Uncollected' : 'All clear'} />
        <Stat icon={<MonitorCheck className="h-4 w-4 text-amber-600" />} accent="bg-amber-50" label="Exam average"
          value={data.attempts_total ? `${n(data.exam_avg).toFixed(1)}%` : '—'}
          sub={`${n(data.attempts_total).toLocaleString()} attempts · ${n(data.exams_total)} exams`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">Fee collection</p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, collectRate)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Collected {formatMoney(paid, currency)}</span>
              <span>Invoiced {formatMoney(invoiced, currency)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">Enrollment by level</p>
            {data.by_level.length === 0 && <p className="text-sm text-muted-foreground">No active students.</p>}
            <div className="space-y-2">
              {data.by_level.map((b) => (
                <div key={b.label}>
                  <div className="mb-0.5 flex justify-between text-xs"><span>{b.label}</span><span className="text-muted-foreground">{n(b.count)}</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${(n(b.count) / maxLevel) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
