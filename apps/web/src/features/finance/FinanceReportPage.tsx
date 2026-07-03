import { Wallet, AlertCircle, Receipt, TrendingUp, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../../providers/app-providers';
import { formatMoney } from '../finance/finance-api';
import { useFinanceReport } from './finance-report-api';

const n = (v: number | null | undefined) => Number(v ?? 0);
const monthLabel = (m: string) => { const d = new Date(`${m}-01T00:00:00`); return isNaN(d.getTime()) ? m : d.toLocaleString(undefined, { month: 'short' }); };

function Stat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
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

export default function FinanceReportPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const currency = institution?.currency || 'NGN';
  const canView = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal', 'bursar', 'accountant', 'proprietor');
  const { data, isLoading, error } = useFinanceReport(!!institutionId && canView);

  if (!institutionId) return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  if (!canView) return <div className="py-16 text-center text-sm text-muted-foreground">Financial reports are for finance staff.</div>;
  if (isLoading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (error || !data) return <div className="py-16 text-center text-sm text-muted-foreground">Couldn’t load the report.</div>;

  const collected = n(data.collected), outstanding = n(data.outstanding), invoiced = n(data.invoiced);
  const rate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
  const maxMonth = Math.max(1, ...data.monthly.map((m) => n(m.amount)));
  const maxLevel = Math.max(1, ...data.by_level.map((l) => n(l.outstanding)));
  const methodTotal = data.by_method.reduce((s, m) => s + n(m.amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Financial report</h1>
        <p className="text-sm text-muted-foreground">Revenue and collections — {institution?.name}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Wallet className="h-4 w-4 text-emerald-600" />} accent="bg-emerald-50" label="Collected" value={formatMoney(collected, currency)} />
        <Stat icon={<AlertCircle className="h-4 w-4 text-red-600" />} accent="bg-red-50" label="Outstanding" value={formatMoney(outstanding, currency)} />
        <Stat icon={<Receipt className="h-4 w-4 text-sky-600" />} accent="bg-sky-50" label="Invoiced" value={formatMoney(invoiced, currency)} />
        <Stat icon={<TrendingUp className="h-4 w-4 text-violet-600" />} accent="bg-violet-50" label="Collection rate" value={`${rate.toFixed(0)}%`} />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-medium">Collections (last 12 months)</p>
          {data.monthly.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : (
            <div className="flex h-40 items-end gap-1">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t bg-emerald-500" style={{ height: `${(n(m.amount) / maxMonth) * 100}%` }} title={formatMoney(n(m.amount), currency)} />
                  <span className="text-[9px] text-muted-foreground">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">Outstanding by level</p>
            {data.by_level.length === 0 ? <p className="text-sm text-muted-foreground">Nothing outstanding.</p> : data.by_level.map((l) => (
              <div key={l.label}>
                <div className="mb-0.5 flex justify-between text-xs"><span>{l.label}</span><span className="text-muted-foreground">{formatMoney(n(l.outstanding), currency)}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-red-500" style={{ width: `${(n(l.outstanding) / maxLevel) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm font-medium">Payments by method</p>
            {data.by_method.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : data.by_method.map((m) => (
              <div key={m.method} className="flex items-center justify-between text-sm">
                <span className="capitalize">{m.method.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">{formatMoney(n(m.amount), currency)}{methodTotal > 0 ? ` · ${((n(m.amount) / methodTotal) * 100).toFixed(0)}%` : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm font-medium">Top outstanding balances</p>
          {data.top_debtors.length === 0 ? <p className="text-sm text-muted-foreground">No outstanding balances.</p> : data.top_debtors.map((d, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{d.name}<span className="ml-2 text-xs text-muted-foreground">{d.admission}</span></span>
              <span className="font-medium text-red-600">{formatMoney(n(d.balance), currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
