import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, KeyRound, Copy, Check, UserPlus, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import {
  useUnprovisioned, useProvision, STAFF_ROLES,
  type ProvisionType, type ProvisionPerson, type ProvisionResult,
} from './provisioning-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

const TABS: { key: ProvisionType; label: string }[] = [
  { key: 'student', label: 'Students' }, { key: 'guardian', label: 'Guardians' }, { key: 'staff', label: 'Staff' },
];

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" size="icon" title="Copy" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function ProvisioningPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal', 'registrar', 'proprietor', 'rector', 'provost');

  const [tab, setTab] = useState<ProvisionType>('student');
  const list = useUnprovisioned(institutionId ?? '', tab);
  const provision = useProvision();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staffRole, setStaffRole] = useState<string>('teacher');
  const [results, setResults] = useState<ProvisionResult[] | null>(null);

  const people = useMemo(() => list.data ?? [], [list.data]);
  const allSelected = people.length > 0 && people.every((p) => selected.has(p.id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(people.map((p) => p.id)));
  const switchTab = (t: ProvisionType) => { setTab(t); setSelected(new Set()); setResults(null); };

  const run = () => {
    const chosen = people.filter((p) => selected.has(p.id));
    if (!chosen.length) { toast.error('Select at least one person'); return; }
    const role = tab === 'student' ? 'student' : tab === 'guardian' ? 'guardian' : staffRole;
    const payload: ProvisionPerson[] = chosen.map((p) => ({ type: tab, record_id: p.id, email: p.email, full_name: p.name, role }));

    provision.mutate({ institution_id: institutionId!, people: payload }, {
      onSuccess: (r) => {
        setResults(r.results);
        setSelected(new Set());
        list.refetch();
        toast.success(`${r.created} login${r.created === 1 ? '' : 's'} created${r.failed ? ` · ${r.failed} failed` : ''}`);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canManage) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Account provisioning is for administrators.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Create logins</h1>
          <p className="text-sm text-muted-foreground">Provision portal accounts — {institution?.name}</p>
        </div>
      </header>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary text-primary-foreground' : 'border'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {results && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Temporary passwords are shown once. Share them securely; users should change them after first sign-in.
            </div>
            {results.map((r) => (
              <div key={r.record_id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{r.email}</p>
                  {r.status === 'created'
                    ? <p className="font-mono text-xs text-muted-foreground">{r.password}</p>
                    : <p className="text-xs text-red-600">{r.error}</p>}
                </div>
                {r.status === 'created'
                  ? <CopyBtn text={`${r.email}  ${r.password}`} />
                  : <span className="text-xs text-red-600">failed</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'staff' && (
        <div className="max-w-xs space-y-1.5">
          <Label>Role for selected staff</Label>
          <select className={selectClass} value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}

      <Card>
        <CardContent className="space-y-2 pt-6">
          {list.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!list.isLoading && !people.length && (
            <p className="text-sm text-muted-foreground">Everyone with an email already has a login. Add an email address on a record (in People) to provision it here.</p>
          )}
          {people.length > 0 && (
            <>
              <label className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all ({people.length})
              </label>
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-md px-1 py-1.5 text-sm">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="flex-1 truncate">{p.name}<span className="ml-2 text-xs text-muted-foreground">{p.email}{p.ident ? ` · ${p.ident}` : ''}</span></span>
                </label>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {people.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={run} disabled={provision.isPending || selected.size === 0}>
            {provision.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Create {selected.size > 0 ? selected.size : ''} login{selected.size === 1 ? '' : 's'}
          </Button>
        </div>
      )}
    </div>
  );
}
