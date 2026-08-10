import { Users, Briefcase, Wallet, AlertCircle, CalendarCheck, MonitorCheck, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent } from '@/components/ui/card';
import { KPICard } from '@/components/negolinks/KPICard';
import { BRAND } from '@/lib/brand';
import { useTenant } from '../../providers/app-providers';
import { formatMoney } from '../finance/finance-api';
import { useAdminDashboard } from './admin-dashboard-api';

const n = (v: number | null | undefined) => Number(v ?? 0);

const chartTooltip = {
  contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--accent-border)', borderRadius: 8, color: '#fff', fontSize: 12 },
  itemStyle: { color: '#fff' },
  labelStyle: { color: 'var(--text-secondary)' },
};

export default function AdminDashboardPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const currency = institution?.currency || 'NGN';
  const canView = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'proprietor', 'rector', 'provost',
    'registrar', 'bursar', 'accountant', 'dean', 'head_of_department');

  const { data, isLoading, error } = useAdminDashboard(!!institutionId && canView);

  if (!institutionId) return <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No institution linked to your account.</div>;
  if (!canView) return <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>This dashboard is for administrators.</div>;
  if (isLoading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" style={{ color: 'var(--accent-light)' }} /></div>;
  if (error || !data) return <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Couldn't load dashboard metrics.</div>;

  const invoiced = n(data.fees_invoiced);
  const paid = n(data.fees_paid);
  const outstanding = n(data.fees_outstanding);
  const collectRate = invoiced > 0 ? (paid / invoiced) * 100 : 0;

  const feeData = [
    { name: 'Collected', value: paid, color: BRAND.charts[3] },
    { name: 'Outstanding', value: outstanding, color: BRAND.charts[4] },
  ];
  const levelData = data.by_level.map((b, i) => ({ label: b.label, count: n(b.count), fill: BRAND.charts[i % BRAND.charts.length] }));

  // Smart Insights (generated from live metrics — no empty space)
  const insights: string[] = [];
  if (collectRate < 60 && invoiced > 0) insights.push(`Fee collection is at ${collectRate.toFixed(0)}% — ${formatMoney(outstanding, currency)} remains outstanding. Consider a reminder campaign.`);
  else if (invoiced > 0) insights.push(`Healthy fee collection at ${collectRate.toFixed(0)}% of invoiced amounts.`);
  if (data.attendance_rate != null && n(data.attendance_rate) < 75) insights.push(`Attendance is ${n(data.attendance_rate)}% over 30 days — below the 75% benchmark. Review absentee follow-up.`);
  else if (data.attendance_rate != null) insights.push(`Attendance is strong at ${n(data.attendance_rate)}% this month.`);
  if (data.attempts_total > 0) insights.push(`Exam average sits at ${n(data.exam_avg).toFixed(1)}% across ${n(data.attempts_total).toLocaleString()} attempts.`);
  if (n(data.students_active) > 0) insights.push(`${n(data.students_active).toLocaleString()} active students across ${data.by_level.length} levels.`);
  while (insights.length < 3) insights.push('All key metrics are within expected ranges.');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Executive Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{institution?.name} · live institution metrics</p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Users} title="Active Students" value={n(data.students_active).toLocaleString()} subtitle={`${n(data.students_total).toLocaleString()} on record`} />
        <KPICard icon={Briefcase} title="Staff" value={n(data.staff_total).toLocaleString()} subtitle="Total employees" />
        <KPICard icon={Wallet} title="Fees Collected" value={formatMoney(paid, currency)} trend={`${collectRate.toFixed(0)}%`} trendUp={collectRate >= 60} subtitle="of invoiced" />
        <KPICard icon={AlertCircle} title="Outstanding" value={formatMoney(outstanding, currency)} subtitle={outstanding > 0 ? 'Uncollected fees' : 'All clear'} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={CalendarCheck} title="Attendance (30d)" value={data.attendance_rate != null ? `${n(data.attendance_rate)}%` : '—'} subtitle={data.attendance_total ? `${n(data.attendance_present).toLocaleString()} / ${n(data.attendance_total).toLocaleString()} present` : 'No records'} />
        <KPICard icon={MonitorCheck} title="Exam Average" value={data.attempts_total ? `${n(data.exam_avg).toFixed(1)}%` : '—'} subtitle={`${n(data.attempts_total).toLocaleString()} attempts`} />
        <KPICard icon={TrendingUp} title="Collection Rate" value={`${collectRate.toFixed(0)}%`} subtitle="fees invoiced vs paid" />
        <KPICard icon={Users} title="Levels" value={String(data.by_level.length)} subtitle="active class levels" />
      </div>

      {/* Charts + AI panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Fee donut */}
        <Card>
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Fee Collection</p>
            {invoiced === 0 ? (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={feeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {feeData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                    <Tooltip {...chartTooltip} formatter={(v: number) => formatMoney(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  {feeData.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Enrollment bar */}
        <Card>
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Enrollment by Level</p>
            {levelData.length === 0 ? (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No active students.</p>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={levelData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--bg-border)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...chartTooltip} cursor={{ fill: 'var(--accent-glow)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {levelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AI Smart Insights */}
        <Card style={{ borderColor: 'var(--accent-border)' }}>
          <CardContent className="pt-6">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent-light)' }}>
              <Sparkles size={16} /> Smart Insights
            </p>
            <div className="space-y-3">
              {insights.slice(0, 4).map((t, i) => (
                <div key={i} className="flex gap-2 rounded-lg p-2.5 text-xs leading-relaxed" style={{ background: 'var(--accent-glow)', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-primary)' }}>▹</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>Generated by NegoLinks Intelligence Engine from live data.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
