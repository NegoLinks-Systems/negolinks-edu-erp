import { useState } from 'react';
import { ShieldCheck, Search, Loader2, FileClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '../../providers/app-providers';
import { useAuditActions, useAuditList } from './audit-api';

const selectClass = 'flex h-10 rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-sm text-white border-[var(--bg-border)] focus-visible:outline-none focus-visible:border-[var(--accent-primary)]';

function actionTone(a: string): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (a.includes('delete') || a.includes('reject')) return 'destructive';
  if (a.includes('approve') || a.includes('paid') || a.includes('publish')) return 'success';
  if (a.includes('demo')) return 'warning';
  if (a.includes('login') || a.includes('create')) return 'default';
  return 'secondary';
}

export default function AuditTrailPage() {
  const { isSuperAdmin, hasRole } = useTenant();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const actions = useAuditActions();
  const rows = useAuditList(search, action);

  const allowed = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal', 'rector', 'provost', 'proprietor', 'registrar');
  if (!allowed) {
    return <div className="p-6 md:p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>The Audit Trail is available to administrators only.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          <ShieldCheck size={24} style={{ color: 'var(--accent-primary)' }} /> Audit Trail
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A tamper-evident, read-only record of every significant action. Audit entries can never be edited or deleted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, entity, or person…" className="pl-9" />
        </div>
        <select className={selectClass} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {(actions.data ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-light)' }} /></div>
          ) : (rows.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileClock size={28} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audit entries match your filters yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--accent-border)' }}>
                    {['When', 'Action', 'Entity', 'Performed by'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge variant={actionTone(r.action)}>{r.action}</Badge></td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{r.entity ?? '—'}{r.entity_id ? <span style={{ color: 'var(--text-muted)' }}> · {String(r.entity_id).slice(0, 8)}</span> : null}</td>
                      <td className="px-4 py-3">
                        <div style={{ color: 'var(--text-primary)' }}>{r.actor_name}</div>
                        {r.actor_email && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.actor_email}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
