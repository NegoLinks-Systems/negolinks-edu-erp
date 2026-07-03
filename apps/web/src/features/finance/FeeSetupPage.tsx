import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Sessions, Classes, Programmes, useTerms } from '../academics/academics-api';
import { useFeeStructures, useUpsertFeeStructure, useDeleteFeeStructure, formatMoney } from './finance-api';
import type { FeeStructure } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

const emptyForm = { name: '', amount: '', term_id: '', class_id: '', programme_id: '', level: '' };

export default function FeeSetupPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const currency = institution?.currency || 'NGN';
  const canManage = isSuperAdmin || hasRole('bursar', 'accountant', 'institution_admin', 'principal');

  const sessions = Sessions.useList(institutionId ?? '', { column: 'starts_on', order: false });
  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    if (!sessionId && sessions.data?.length) setSessionId((sessions.data.find((s: any) => s.is_current) ?? sessions.data[0]).id);
  }, [sessions.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const terms = useTerms(sessionId || null);
  const classes = Classes.useList(institutionId ?? '', { column: 'level_order' });
  const programmes = Programmes.useList(institutionId ?? '');
  const { data: fees, isLoading } = useFeeStructures(institutionId ?? '', sessionId);
  const upsert = useUpsertFeeStructure(institutionId ?? '', sessionId);
  const del = useDeleteFeeStructure(institutionId ?? '', sessionId);

  const classMap = useMemo(() => new Map((classes.data ?? []).map((c: any) => [c.id, c.name])), [classes.data]);
  const progMap = useMemo(() => new Map((programmes.data ?? []).map((p: any) => [p.id, p.name])), [programmes.data]);
  const termMap = useMemo(() => new Map((terms.data ?? []).map((t) => [t.id, t.name])), [terms.data]);

  const [editing, setEditing] = useState<FeeStructure | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const start = (fs: FeeStructure | 'new') => {
    setEditing(fs);
    setForm(fs === 'new' ? emptyForm : {
      name: fs.name, amount: String(fs.amount), term_id: fs.term_id ?? '',
      class_id: fs.class_id ?? '', programme_id: fs.programme_id ?? '', level: fs.level ?? '',
    });
  };
  const submit = () => {
    if (!form.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({
      id: editing !== 'new' && editing ? editing.id : undefined,
      name: form.name.trim(), amount: Number(form.amount) || 0,
      term_id: form.term_id || null, class_id: tertiary ? null : (form.class_id || null),
      programme_id: tertiary ? (form.programme_id || null) : null, level: tertiary ? (form.level || null) : null,
    }, { onSuccess: () => { toast.success('Fee saved'); setEditing(null); }, onError: (e: Error) => toast.error(e.message) });
  };

  const scopeLabel = (fs: FeeStructure) =>
    fs.class_id ? (classMap.get(fs.class_id) ?? 'Class')
      : fs.programme_id ? `${progMap.get(fs.programme_id) ?? 'Programme'}${fs.level ? ` · L${fs.level}` : ''}`
        : 'All students';

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Fee structure</h1>
          <p className="text-sm text-muted-foreground">Charges used to bill students — {institution?.name}</p>
        </div>
        {canManage && editing !== 'new' && sessionId && (
          <Button onClick={() => start('new')}><Plus className="mr-2 h-4 w-4" /> Add fee</Button>
        )}
      </header>

      <Card>
        <CardContent className="pt-6">
          <Field label="Session">
            <select className={selectClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Select session</option>
              {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.is_current ? ' (current)' : ''}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      {sessionId && (
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>Set per class/programme. Leave scope as “All students” to charge everyone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && !fees?.length && editing !== 'new' && (
              <p className="text-sm text-muted-foreground">No fees set for this session yet.</p>
            )}
            {fees?.map((fs) => (
              <div key={fs.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{fs.name}</span> · {formatMoney(Number(fs.amount), currency)}
                  <div className="text-xs text-muted-foreground">{scopeLabel(fs)} · {fs.term_id ? termMap.get(fs.term_id) ?? 'Term' : 'Whole session'}</div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => start(fs)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (!confirm(`Delete ${fs.name}?`)) return;
                      del.mutate(fs.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) });
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            ))}

            {canManage && editing && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><Input placeholder="Tuition" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label={`Amount (${currency})`}><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
                  <Field label="Term">
                    <select className={selectClass} value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
                      <option value="">Whole session</option>
                      {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Field>
                  {tertiary ? (
                    <>
                      <Field label="Programme">
                        <select className={selectClass} value={form.programme_id} onChange={(e) => setForm({ ...form, programme_id: e.target.value })}>
                          <option value="">All students</option>
                          {programmes.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Level (optional)"><Input placeholder="100" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} /></Field>
                    </>
                  ) : (
                    <Field label="Class">
                      <select className={selectClass} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                        <option value="">All students</option>
                        {classes.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={submit} disabled={upsert.isPending}>
                    {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
