import { useState } from 'react';
import { toast } from 'sonner';
import { Database, Trash2, RefreshCw, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useTenant } from '../../providers/app-providers';
import { useDemoStatus, useDemoLoad, useDemoDelete, useDemoReload, type DemoScenario } from './demo-api';

const selectClass = 'flex h-10 w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-sm text-white border-[var(--bg-border)] focus-visible:outline-none focus-visible:border-[var(--accent-primary)]';

const SCENARIOS: { value: DemoScenario; label: string; hint: string }[] = [
  { value: 'small',        label: 'Small Organization',    hint: '~40 students' },
  { value: 'medium',       label: 'Medium Organization',   hint: '~150 students' },
  { value: 'large',        label: 'Large Enterprise',      hint: '~400 students' },
  { value: 'multi_branch', label: 'Multi-Branch Enterprise', hint: '~300 students' },
  { value: 'heavy',        label: 'Heavy Daily Transactions', hint: '~600 students' },
];

export default function DemoDataPage() {
  const { isSuperAdmin } = useTenant();
  const status = useDemoStatus();
  const load = useDemoLoad();
  const del = useDemoDelete();
  const reload = useDemoReload();
  const [scenario, setScenario] = useState<DemoScenario>('medium');
  const [confirm, setConfirm] = useState<null | 'load' | 'delete' | 'reload'>(null);

  if (!isSuperAdmin) {
    return <div className="p-6 md:p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Demo Data Management is available to super administrators only.</div>;
  }

  const active = status.data?.demo_mode;
  const busy = load.isPending || del.isPending || reload.isPending;

  const run = () => {
    if (confirm === 'load') load.mutate(scenario, { onSuccess: (r: any) => toast.success(`Demo data loaded — ${r?.students ?? ''} students, ${r?.staff ?? ''} staff`), onError: (e: Error) => toast.error(e.message) });
    if (confirm === 'delete') del.mutate(undefined, { onSuccess: () => toast.success('Demo data removed. Real data untouched.'), onError: (e: Error) => toast.error(e.message) });
    if (confirm === 'reload') reload.mutate(scenario, { onSuccess: (r: any) => toast.success(`Fresh demo data generated — ${r?.students ?? ''} students`), onError: (e: Error) => toast.error(e.message) });
    setConfirm(null);
  };

  const confirmText = {
    load:   'Realistic demonstration data will be inserted across all modules. Continue?',
    delete: 'All demo data will be permanently removed. Real business data will remain untouched. This action cannot be undone.',
    reload: 'A completely new set of realistic demo data will be generated, replacing the current demo data. Continue?',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          <Database size={24} style={{ color: 'var(--accent-primary)' }} /> Demo Data Management
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Populate the platform with realistic sample data for demonstrations, training, and evaluation.
        </p>
      </div>

      {active && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: 'var(--accent-glow)', borderColor: 'var(--accent-border)' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-light)' }} />
          <div className="text-sm" style={{ color: 'var(--accent-light)' }}>
            <span className="font-semibold">Demo mode is active</span> — {status.data?.demo_students} demo students and {status.data?.demo_staff} demo staff currently loaded.
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scenario</CardTitle>
          <CardDescription>Choose the scale of data to generate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-sm">
            <Label>Demo scenario</Label>
            <select className={selectClass} value={scenario} onChange={(e) => setScenario(e.target.value as DemoScenario)}>
              {SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.hint}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => setConfirm('load')} disabled={busy}>
              {load.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />} Load Demo Data
            </Button>
            <Button variant="outline" onClick={() => setConfirm('reload')} disabled={busy || !active}>
              {reload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reload (Fresh Set)
            </Button>
            <Button variant="destructive" onClick={() => setConfirm('delete')} disabled={busy || !active}>
              {del.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete Demo Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Demo records are tagged internally and removed surgically — deleting demo data never affects real students, staff, or transactions. Every action is recorded in the Audit Trail.
      </p>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: confirm === 'delete' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
              {confirm === 'load' ? 'Load demo data' : confirm === 'delete' ? 'Delete demo data' : 'Reload demo data'}
            </DialogTitle>
            <DialogDescription>{confirm ? confirmText[confirm] : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm === 'delete' ? 'destructive' : 'default'} onClick={run}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
