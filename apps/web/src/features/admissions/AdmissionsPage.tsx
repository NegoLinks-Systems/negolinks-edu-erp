import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserCheck, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import {
  useApplications, useUpdateApplication, useAdmitApplication,
  APPLICATION_STATUSES, STATUS_LABEL,
} from './admissions-api';
import type { AdmissionApplication, ApplicationStatus } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const STATUS_STYLE: Record<ApplicationStatus, string> = {
  submitted: 'bg-sky-100 text-sky-700', under_review: 'bg-amber-100 text-amber-800', offered: 'bg-violet-100 text-violet-700',
  accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700', enrolled: 'bg-emerald-600 text-white', withdrawn: 'bg-zinc-200 text-zinc-600',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function ApplicationDialog({ app, institutionId, onClose }: { app: AdmissionApplication; institutionId: string; onClose: () => void }) {
  const update = useUpdateApplication(institutionId);
  const admit = useAdmitApplication(institutionId);
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [score, setScore] = useState(app.score != null ? String(app.score) : '');
  const [notes, setNotes] = useState(app.notes ?? '');
  useEffect(() => { setStatus(app.status); setScore(app.score != null ? String(app.score) : ''); setNotes(app.notes ?? ''); }, [app]);

  const save = () => update.mutate(
    { id: app.id, status, score: score === '' ? null : Number(score), notes: notes || null },
    { onSuccess: () => { toast.success('Saved'); onClose(); }, onError: (e: Error) => toast.error(e.message) },
  );
  const doAdmit = () => {
    if (!confirm(`Admit ${app.first_name} ${app.last_name} and create a student record?`)) return;
    admit.mutate(app.id, {
      onSuccess: (r) => { toast.success(`Admitted · ${r.admission_number}`); onClose(); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const detail = (k: string, v?: string | null) => v ? <p><span className="text-muted-foreground">{k}: </span>{v}</p> : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{app.first_name} {app.last_name}</DialogTitle>
          <DialogDescription>{app.application_number}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          {detail('Email', app.email)}
          {detail('Phone', app.phone)}
          {detail('Date of birth', app.dob)}
          {detail('Gender', app.gender)}
          {detail('Applying for', app.intended_study)}
          {detail('Previous school', app.prior_school)}
          {detail('Address', app.address)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)} disabled={app.status === 'enrolled'}>
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Entrance score (optional)"><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {app.status !== 'enrolled' && (
            <Button variant="outline" onClick={doAdmit} disabled={admit.isPending} className="sm:mr-auto">
              {admit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />} Admit applicant
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {app.status !== 'enrolled' && <Button onClick={save} disabled={update.isPending}>{update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdmissionsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal', 'registrar', 'academic_officer');

  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('submitted');
  const apps = useApplications(institutionId ?? '', filter);
  const [open, setOpen] = useState<AdmissionApplication | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canManage) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Admissions is for admissions staff.</div>;
  }

  const tabs: (ApplicationStatus | 'all')[] = ['all', ...APPLICATION_STATUSES];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Admissions</h1>
        <p className="text-sm text-muted-foreground">Applications — {institution?.name}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === t ? 'bg-primary text-primary-foreground' : 'border'}`}>
            {t === 'all' ? 'All' : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {apps.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!apps.isLoading && !apps.data?.length && <p className="text-sm text-muted-foreground">No applications here.</p>}
          {apps.data?.map((a) => (
            <button key={a.id} onClick={() => setOpen(a)} className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left hover:bg-muted">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.first_name} {a.last_name}</p>
                  <p className="text-xs text-muted-foreground">{a.application_number}{a.intended_study ? ` · ${a.intended_study}` : ''}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      {open && <ApplicationDialog app={open} institutionId={institutionId} onClose={() => setOpen(null)} />}
    </div>
  );
}
