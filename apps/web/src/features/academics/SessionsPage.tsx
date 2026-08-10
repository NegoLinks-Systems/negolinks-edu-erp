import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, CheckCircle2, Calendar, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import type { AcademicSession, AcademicTerm } from '../../lib/database.types';
import {
  sessionSchema, termSchema, Sessions, useSetCurrentSession,
  useTerms, useUpsertTerm, useSetCurrentTerm, useDeleteTerm,
  type SessionForm, type TermForm,
} from './academics-api';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const sessionDefaults = (s?: AcademicSession): SessionForm =>
  ({ name: s?.name ?? '', starts_on: s?.starts_on ?? '', ends_on: s?.ends_on ?? '' });

/* -------------------------------- terms ---------------------------------- */
function TermsPanel({ institutionId, session, canManage }: {
  institutionId: string; session: AcademicSession; canManage: boolean;
}) {
  const { data: terms, isLoading } = useTerms(session.id);
  const upsert = useUpsertTerm(institutionId, session.id);
  const setCurrent = useSetCurrentTerm(session.id);
  const del = useDeleteTerm(session.id);
  const [editing, setEditing] = useState<TermForm & { id?: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<TermForm>({ resolver: zodResolver(termSchema), defaultValues: { name: '', sort_order: 1, starts_on: '', ends_on: '' } });

  const start = (t?: AcademicTerm) => {
    setEditing(t ? { id: t.id, name: t.name, sort_order: t.sort_order, starts_on: t.starts_on ?? '', ends_on: t.ends_on ?? '' } : { name: '', sort_order: (terms?.length ?? 0) + 1, starts_on: '', ends_on: '' });
    reset(t ? { name: t.name, sort_order: t.sort_order, starts_on: t.starts_on ?? '', ends_on: t.ends_on ?? '' } : { name: '', sort_order: (terms?.length ?? 0) + 1, starts_on: '', ends_on: '' });
  };
  const submit = (v: TermForm) =>
    upsert.mutate({ ...v, id: editing?.id }, {
      onSuccess: () => { toast.success('Term saved'); setEditing(null); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">Terms / semesters in {session.name}</p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {terms?.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
          <span className="text-sm">
            {t.name}
            {t.is_current && <Badge variant="secondary" className="ml-2 text-[10px]">Current</Badge>}
          </span>
          {canManage && (
            <div className="flex gap-1">
              {!t.is_current && (
                <Button variant="ghost" size="sm" onClick={() => setCurrent.mutate(t.id, {
                  onSuccess: () => toast.success(`${t.name} is now current`),
                  onError: (e: Error) => toast.error(e.message),
                })}>Set current</Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => start(t)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(t.id, {
                onSuccess: () => toast.success('Term removed'),
                onError: (e: Error) => toast.error(e.message),
              })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      ))}

      {canManage && (editing ? (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}><Input placeholder="First Term" {...register('name')} /></Field>
            <Field label="Order"><Input type="number" {...register('sort_order')} /></Field>
            <Field label="Starts on"><Input type="date" {...register('starts_on')} /></Field>
            <Field label="Ends on"><Input type="date" {...register('ends_on')} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit(submit)} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save term
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => start()}><Plus className="mr-2 h-4 w-4" /> Add term</Button>
      ))}
    </div>
  );
}

/* ------------------------------- sessions -------------------------------- */
export default function SessionsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin ||
    hasRole('institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost');

  const { data: sessions, isLoading } = Sessions.useList(institutionId ?? '', { column: 'starts_on', order: false });
  const upsert = Sessions.useUpsert(institutionId ?? '');
  const setCurrent = useSetCurrentSession(institutionId ?? '');
  const del = Sessions.useDelete(institutionId ?? '');

  const [editing, setEditing] = useState<AcademicSession | 'new' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<SessionForm>({ resolver: zodResolver(sessionSchema), defaultValues: sessionDefaults() });

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const startEdit = (s: AcademicSession | 'new') => {
    setEditing(s); reset(s === 'new' ? sessionDefaults() : sessionDefaults(s));
  };
  const submit = (v: SessionForm) =>
    upsert.mutate({ ...v, id: editing !== 'new' && editing ? editing.id : undefined }, {
      onSuccess: () => { toast.success('Session saved'); setEditing(null); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Academic sessions</h1>
          <p className="text-sm text-muted-foreground">Sessions and their terms for {institution?.name}</p>
        </div>
        {canManage && editing !== 'new' && (
          <Button onClick={() => startEdit('new')}><Plus className="mr-2 h-4 w-4" /> Add session</Button>
        )}
      </header>

      {editing === 'new' && (
        <Card>
          <CardHeader><CardTitle>New session</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" error={errors.name?.message}><Input placeholder="2024/2025" {...register('name')} /></Field>
            <Field label="Starts on"><Input type="date" {...register('starts_on')} /></Field>
            <Field label="Ends on"><Input type="date" {...register('ends_on')} /></Field>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSubmit(submit)} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!isLoading && !sessions?.length && editing !== 'new' && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No sessions yet. Add one to start scheduling terms, results, and attendance.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {sessions?.map((s) => (
          <Card key={s.id}>
            {editing !== 'new' && editing?.id === s.id ? (
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
                <Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
                <Field label="Starts on"><Input type="date" {...register('starts_on')} /></Field>
                <Field label="Ends on"><Input type="date" {...register('ends_on')} /></Field>
                <div className="sm:col-span-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={handleSubmit(submit)} disabled={upsert.isPending}>
                    {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
                  </Button>
                </div>
              </CardContent>
            ) : (
              <>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {s.is_current && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Current</Badge>}
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      {!s.is_current && (
                        <Button variant="ghost" size="sm" onClick={() => setCurrent.mutate(s.id, {
                          onSuccess: () => toast.success(`${s.name} is now current`),
                          onError: (e: Error) => toast.error(e.message),
                        })}>Set current</Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (!confirm(`Delete session ${s.name}? Its terms will be removed too.`)) return;
                        del.mutate(s.id, { onSuccess: () => toast.success('Session deleted'), onError: (e: Error) => toast.error(e.message) });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expanded === s.id ? 'rotate-90' : ''}`} />
                    Manage terms
                  </button>
                  {expanded === s.id && <TermsPanel institutionId={institutionId} session={s} canManage={canManage} />}
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
