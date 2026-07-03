import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, Award, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { Sessions } from '../academics/academics-api';
import {
  useScholarships, useUpsertScholarship, useDeleteScholarship,
  useStudentScholarships, useAwardScholarship, useRevokeScholarship, useApplyForStudent, useStudentSearch,
  formatMoney, discountTypes,
} from './scholarships-api';
import type { Scholarship, DiscountType } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function ScholarshipsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const currency = institution?.currency || 'NGN';
  const canManage = isSuperAdmin || hasRole('bursar', 'accountant', 'institution_admin', 'principal');

  const sessions = Sessions.useList(institutionId ?? '');
  const list = useScholarships(institutionId ?? '');
  const upsert = useUpsertScholarship(institutionId ?? '');
  const del = useDeleteScholarship(institutionId ?? '');

  const blank = { name: '', discount_type: 'percent' as DiscountType, value: '', session_id: '', active: true };
  const [editing, setEditing] = useState<Scholarship | 'new' | null>(null);
  const [f, setF] = useState(blank);
  const openForm = (s: Scholarship | 'new') => {
    setEditing(s);
    setF(s === 'new' ? blank : { name: s.name, discount_type: s.discount_type, value: String(s.value), session_id: s.session_id ?? '', active: s.active });
  };
  const save = () => {
    if (!f.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({ id: editing !== 'new' && editing ? editing.id : undefined, name: f.name.trim(), discount_type: f.discount_type, value: Number(f.value) || 0, session_id: f.session_id || null, active: f.active },
      { onSuccess: () => { toast.success('Saved'); setEditing(null); }, onError: (e: Error) => toast.error(e.message) });
  };
  const showValue = (s: Pick<Scholarship, 'discount_type' | 'value'>) => s.discount_type === 'percent' ? `${Number(s.value)}%` : formatMoney(Number(s.value), currency);

  // Award area
  const [q, setQ] = useState('');
  const results = useStudentSearch(institutionId ?? '', q);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [awardSession, setAwardSession] = useState('');
  const [awardScholarship, setAwardScholarship] = useState('');
  const awards = useStudentScholarships(student?.id ?? null);
  const award = useAwardScholarship(institutionId ?? '');
  const revoke = useRevokeScholarship(student?.id ?? '');
  const apply = useApplyForStudent();
  const sessionLabel = (id: string | null) => id ? (sessions.data?.find((s: any) => s.id === id)?.name ?? 'Session') : 'All sessions';

  if (!institutionId) return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  if (!canManage) return <div className="py-16 text-center text-sm text-muted-foreground">Scholarships are managed by finance staff.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Scholarships &amp; discounts</h1>
        <p className="text-sm text-muted-foreground">Define concessions and award them to students — {institution?.name}</p>
      </header>

      {/* Definitions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Concessions</CardTitle>
          {editing !== 'new' && <Button size="sm" onClick={() => openForm('new')}><Plus className="mr-2 h-4 w-4" /> Add</Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!list.isLoading && !list.data?.length && editing !== 'new' && <p className="text-sm text-muted-foreground">No concessions yet.</p>}
          {list.data?.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{showValue(s)} · {sessionLabel(s.session_id)}{s.active ? '' : ' · inactive'}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openForm(s)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this concession? Awards using it are removed too.')) del.mutate(s.id, { onSuccess: () => toast.success('Deleted') }); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}

          {editing && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">{editing === 'new' ? 'New concession' : 'Edit'}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Staff child" /></div>
                <div className="space-y-1.5"><Label>Type</Label>
                  <select className={selectClass} value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value as DiscountType })}>
                    {discountTypes.map((d) => <option key={d} value={d}>{d === 'percent' ? 'Percentage' : 'Fixed amount'}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>{f.discount_type === 'percent' ? 'Percent (0–100)' : `Amount (${currency})`}</Label><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Applies to session</Label>
                  <select className={selectClass} value={f.session_id} onChange={(e) => setF({ ...f, session_id: e.target.value })}>
                    <option value="">All sessions</option>
                    {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Active</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Awards */}
      <Card>
        <CardHeader><CardTitle className="text-base">Award to a student</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search student by name or admission no." value={q} onChange={(e) => { setQ(e.target.value); setStudent(null); }} />
          </div>
          {!student && q.trim().length >= 2 && (
            <div className="space-y-1">
              {results.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
              {!results.isLoading && !results.data?.length && <p className="text-sm text-muted-foreground">No matches.</p>}
              {results.data?.map((s) => (
                <button key={s.id} onClick={() => { setStudent({ id: s.id, name: `${s.first_name} ${s.last_name}` }); setQ(`${s.first_name} ${s.last_name}`); }}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                  <span>{s.first_name} {s.last_name}</span><span className="text-xs text-muted-foreground">{s.admission_number}</span>
                </button>
              ))}
            </div>
          )}

          {student && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{student.name}</p>
                <Button variant="ghost" size="icon" onClick={() => { setStudent(null); setQ(''); }}><X className="h-4 w-4" /></Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">Concession</Label>
                  <select className={selectClass} value={awardScholarship} onChange={(e) => setAwardScholarship(e.target.value)}>
                    <option value="">Select…</option>
                    {list.data?.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({showValue(s)})</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Session</Label>
                  <select className={selectClass} value={awardSession} onChange={(e) => setAwardSession(e.target.value)}>
                    <option value="">All sessions</option>
                    {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={award.isPending} onClick={() => {
                  if (!awardScholarship) { toast.error('Pick a concession'); return; }
                  award.mutate({ student_id: student.id, scholarship_id: awardScholarship, session_id: awardSession || null }, {
                    onSuccess: () => { toast.success('Awarded'); setAwardScholarship(''); },
                    onError: (e: Error) => toast.error(e.message.includes('duplicate') ? 'Already awarded for that session' : e.message),
                  });
                }}><Award className="mr-2 h-4 w-4" /> Award</Button>
              </div>

              {/* existing awards */}
              <div className="space-y-1">
                {awards.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!awards.isLoading && !awards.data?.length && <p className="text-sm text-muted-foreground">No awards yet.</p>}
                {awards.data?.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                    <span>{a.scholarship?.name ?? '—'}<span className="ml-2 text-xs text-muted-foreground">{a.scholarship ? showValue(a.scholarship) : ''} · {sessionLabel(a.session_id)}</span></span>
                    <Button variant="ghost" size="icon" onClick={() => revoke.mutate(a.id, { onSuccess: () => toast.success('Revoked'), onError: (e: Error) => toast.error(e.message) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">Refresh discounts on this student's existing invoices for the selected session.</p>
                <Button variant="outline" size="sm" disabled={apply.isPending} onClick={() => {
                  if (!awardSession) { toast.error('Pick a session to apply'); return; }
                  apply.mutate({ student_id: student.id, session_id: awardSession }, {
                    onSuccess: (n) => toast.success(n > 0 ? `Updated ${n} invoice${n === 1 ? '' : 's'}` : 'No invoices to update'),
                    onError: (e: Error) => toast.error(e.message),
                  });
                }}>{apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply to invoices</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
