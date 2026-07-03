import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ExternalLink, FileText, ClipboardList, Eye, EyeOff, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { Subjects } from '../academics/academics-api';
import {
  useMaterials, useUpsertMaterial, useDeleteMaterial, uploadMaterialFile, getMaterialUrl,
  useAssignments, useUpsertAssignment, useDeleteAssignment, useSubmissions, useGradeSubmission, materialKinds, useTaughtSubjects, getSubmissionFileUrl,
} from './elearning-api';
import type { LessonMaterial, Assignment, MaterialKind } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const toLocal = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function OpenMaterial({ m }: { m: LessonMaterial }) {
  const [busy, setBusy] = useState(false);
  if (m.kind === 'note') return null;
  return (
    <Button variant="ghost" size="icon" title="Open" disabled={busy} onClick={async () => {
      setBusy(true); const u = await getMaterialUrl(m); setBusy(false);
      if (u) window.open(u, '_blank'); else toast.error('No link available');
    }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}</Button>
  );
}

/* ----------------------------- material dialog ----------------------------- */
function MaterialDialog({ open, onOpenChange, institutionId, subjectId, material }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; subjectId: string; material: LessonMaterial | null;
}) {
  const upsert = useUpsertMaterial(institutionId, subjectId);
  const blank = { title: '', kind: 'link' as MaterialKind, url: '', description: '' };
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (open) { setF(material ? { title: material.title, kind: material.kind, url: material.url ?? '', description: material.description ?? '' } : blank); setFile(null); } }, [open, material]); // eslint-disable-line

  const submit = async () => {
    if (!f.title.trim()) { toast.error('Enter a title'); return; }
    let url = f.url;
    try {
      if (f.kind === 'file' && file) { setUploading(true); url = await uploadMaterialFile(institutionId, file); setUploading(false); }
      if (f.kind === 'file' && !url) { toast.error('Choose a file'); return; }
      if ((f.kind === 'link' || f.kind === 'video') && !f.url.trim()) { toast.error('Enter the URL'); return; }
      upsert.mutate({ id: material?.id, title: f.title.trim(), kind: f.kind, url: f.kind === 'note' ? null : url, description: f.description || null },
        { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
    } catch (e) { setUploading(false); toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{material ? 'Edit material' : 'Add material'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Type">
            <select className={selectClass} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as MaterialKind })}>
              {materialKinds.map((k) => <option key={k} value={k}>{cap(k)}</option>)}
            </select>
          </Field>
          {(f.kind === 'link' || f.kind === 'video') && <Field label="URL"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></Field>}
          {f.kind === 'file' && (
            <Field label="File">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> {file ? file.name : material?.url ? 'Replace file' : 'Choose file'}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}
          <Field label={f.kind === 'note' ? 'Note' : 'Description (optional)'}><Textarea rows={f.kind === 'note' ? 4 : 2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending || uploading}>{(upsert.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- assignment dialog ---------------------------- */
function AssignmentDialog({ open, onOpenChange, institutionId, subjectId, assignment }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; subjectId: string; assignment: Assignment | null;
}) {
  const upsert = useUpsertAssignment(institutionId, subjectId);
  const blank = { title: '', instructions: '', due_date: '', max_points: '100', published: false };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(assignment ? { title: assignment.title, instructions: assignment.instructions ?? '', due_date: toLocal(assignment.due_date), max_points: String(assignment.max_points), published: assignment.published } : blank); }, [open, assignment]); // eslint-disable-line

  const submit = () => {
    if (!f.title.trim()) { toast.error('Enter a title'); return; }
    upsert.mutate({ id: assignment?.id, title: f.title.trim(), instructions: f.instructions || null, due_date: fromLocal(f.due_date), max_points: Number(f.max_points) || 100, published: f.published },
      { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{assignment ? 'Edit assignment' : 'New assignment'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Instructions"><Textarea rows={3} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date"><Input type="datetime-local" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
            <Field label="Max points"><Input type="number" value={f.max_points} onChange={(e) => setF({ ...f, max_points: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">Published</span><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- submissions dialog --------------------------- */
function FileLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); const u = await getSubmissionFileUrl(path); setBusy(false); if (u) window.open(u, '_blank'); else toast.error('Could not open file'); }}
      className="inline-flex items-center gap-1 text-xs text-primary">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />} Download file
    </button>
  );
}

function GradeRow({ s, assignmentId, maxPoints }: { s: any; assignmentId: string; maxPoints: number }) {
  const grade = useGradeSubmission(assignmentId);
  const [g, setG] = useState(s.grade != null ? String(s.grade) : '');
  const [fb, setFb] = useState(s.feedback ?? '');
  return (
    <div className="space-y-2 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{s.student ? `${s.student.last_name} ${s.student.first_name}` : '—'}<span className="ml-2 text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleString()}</span></p>
        {s.graded_at && <span className="text-xs text-emerald-600">graded</span>}
      </div>
      {s.content && <p className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-sm">{s.content}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {s.file_url && <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">Attached link <ExternalLink className="h-3 w-3" /></a>}
        {s.file_path && <FileLink path={s.file_path} />}
      </div>
      <div className="flex items-end gap-2">
        <div className="w-24"><Label className="text-xs">Score /{maxPoints}</Label><Input type="number" value={g} onChange={(e) => setG(e.target.value)} /></div>
        <div className="flex-1"><Label className="text-xs">Feedback</Label><Input value={fb} onChange={(e) => setFb(e.target.value)} /></div>
        <Button size="sm" disabled={grade.isPending} onClick={() => {
          if (g === '') { toast.error('Enter a score'); return; }
          grade.mutate({ submission_id: s.id, grade: Number(g), feedback: fb || null }, { onSuccess: () => toast.success('Graded'), onError: (e: Error) => toast.error(e.message) });
        }}>{grade.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
      </div>
    </div>
  );
}

function SubmissionsDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const subs = useSubmissions(assignment.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{assignment.title}</DialogTitle><DialogDescription>{subs.data?.length ?? 0} submission(s)</DialogDescription></DialogHeader>
        {subs.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
        {!subs.isLoading && !subs.data?.length && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
        <div className="space-y-2">
          {subs.data?.map((s) => <GradeRow key={s.id} s={s} assignmentId={assignment.id} maxPoints={Number(assignment.max_points)} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- page ----------------------------------- */
export default function CourseworkPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canTeach = isSuperAdmin || hasRole('teacher', 'class_teacher', 'lecturer', 'academic_officer', 'head_of_department', 'dean', 'vice_principal', 'principal', 'institution_admin', 'rector', 'provost');

  const subjects = Subjects.useList(institutionId ?? '');
  const taught = useTaughtSubjects(institutionId ?? '');
  const subjectOptions = (taught.data && taught.data.length ? taught.data : subjects.data) ?? [];
  const showingTaught = !!(taught.data && taught.data.length);
  const [subjectId, setSubjectId] = useState('');
  const [tab, setTab] = useState<'materials' | 'assignments'>('materials');

  const materials = useMaterials(subjectId || null);
  const delMat = useDeleteMaterial(subjectId);
  const assignments = useAssignments(subjectId || null);
  const delAsg = useDeleteAssignment(subjectId);

  const [matDialog, setMatDialog] = useState(false);
  const [editMat, setEditMat] = useState<LessonMaterial | null>(null);
  const [asgDialog, setAsgDialog] = useState(false);
  const [editAsg, setEditAsg] = useState<Assignment | null>(null);
  const [subsAsg, setSubsAsg] = useState<Assignment | null>(null);

  if (!institutionId) return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  if (!canTeach) return <div className="py-16 text-center text-sm text-muted-foreground">Coursework is for teaching staff.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Coursework</h1>
        <p className="text-sm text-muted-foreground">Materials and assignments — {institution?.name}</p>
      </header>

      <div className="max-w-md space-y-1.5">
        <Label>Course / subject</Label>
        <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select…</option>
          {subjectOptions.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
        </select>
        {showingTaught && <p className="text-xs text-muted-foreground">Showing courses you’re assigned to teach.</p>}
      </div>

      {subjectId && (
        <>
          <div className="flex gap-2">
            {(['materials', 'assignments'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'border'}`}>{cap(t)}</button>
            ))}
          </div>

          {tab === 'materials' ? (
            <Card>
              <CardContent className="space-y-2 pt-6">
                <div className="flex justify-end"><Button size="sm" onClick={() => { setEditMat(null); setMatDialog(true); }}><Plus className="mr-1 h-4 w-4" /> Add material</Button></div>
                {materials.isLoading && <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
                {!materials.isLoading && !materials.data?.length && <p className="text-sm text-muted-foreground">No materials yet.</p>}
                {materials.data?.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex min-w-0 gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{m.title}</p><p className="text-xs text-muted-foreground">{cap(m.kind)}{m.description ? ` · ${m.description.slice(0, 60)}` : ''}</p></div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <OpenMaterial m={m} />
                      <Button variant="ghost" size="icon" onClick={() => { setEditMat(m); setMatDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete material?')) delMat.mutate(m.id, { onSuccess: () => toast.success('Deleted') }); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-2 pt-6">
                <div className="flex justify-end"><Button size="sm" onClick={() => { setEditAsg(null); setAsgDialog(true); }}><Plus className="mr-1 h-4 w-4" /> New assignment</Button></div>
                {assignments.isLoading && <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
                {!assignments.isLoading && !assignments.data?.length && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
                {assignments.data?.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2"><ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.due_date ? `Due ${new Date(a.due_date).toLocaleString()}` : 'No due date'} · {Number(a.max_points)} pts</p></div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.published ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <Button variant="outline" size="sm" onClick={() => setSubsAsg(a)}>Submissions</Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditAsg(a); setAsgDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete assignment?')) delAsg.mutate(a.id, { onSuccess: () => toast.success('Deleted') }); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <MaterialDialog open={matDialog} onOpenChange={setMatDialog} institutionId={institutionId} subjectId={subjectId} material={editMat} />
      <AssignmentDialog open={asgDialog} onOpenChange={setAsgDialog} institutionId={institutionId} subjectId={subjectId} assignment={editAsg} />
      {subsAsg && <SubmissionsDialog assignment={subsAsg} onClose={() => setSubsAsg(null)} />}
    </div>
  );
}
