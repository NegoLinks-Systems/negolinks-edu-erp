import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import type { AssessmentComponent } from '../../lib/database.types';
import { useComponents, useUpsertComponent, useDeleteComponent } from './results-api';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export default function AssessmentSetupPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost');

  const { data: components, isLoading } = useComponents(institutionId ?? '');
  const upsert = useUpsertComponent(institutionId ?? '');
  const del = useDeleteComponent(institutionId ?? '');

  const [editing, setEditing] = useState<AssessmentComponent | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', max_score: '100', sort_order: '1' });

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const start = (c: AssessmentComponent | 'new') => {
    setEditing(c);
    setForm(c === 'new'
      ? { name: '', max_score: '100', sort_order: String((components?.length ?? 0) + 1) }
      : { name: c.name, max_score: String(c.max_score), sort_order: String(c.sort_order) });
  };
  const submit = () => {
    if (!form.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({
      id: editing !== 'new' && editing ? editing.id : undefined,
      name: form.name.trim(), max_score: Number(form.max_score) || 0, sort_order: Number(form.sort_order) || 1,
    }, { onSuccess: () => { toast.success('Component saved'); setEditing(null); }, onError: (e: Error) => toast.error(e.message) });
  };

  const totalMax = (components ?? []).reduce((s, c) => s + Number(c.max_score), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assessment components</h1>
          <p className="text-sm text-muted-foreground">The score breakdown used on every score sheet — {institution?.name}</p>
        </div>
        {canManage && editing !== 'new' && (
          <Button onClick={() => start('new')}><Plus className="mr-2 h-4 w-4" /> Add component</Button>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>These add up to a maximum of {totalMax || 0}. Grades are read from your grading scale in Settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !components?.length && editing !== 'new' && (
            <p className="text-sm text-muted-foreground">No components yet. Add CA, Test, Exam, etc.</p>
          )}
          {components?.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span><span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">· max {Number(c.max_score)}</span></span>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => start(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (!confirm(`Delete ${c.name}? Existing scores for this component will be removed.`)) return;
                    del.mutate(c.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}

          {canManage && editing && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name"><Input placeholder="Exam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Max score"><Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></Field>
                <Field label="Order"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
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
    </div>
  );
}
