import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ExternalLink, FileText, ClipboardList, CheckCircle2, Upload, Paperclip } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { Subjects } from '../academics/academics-api';
import { useMaterials, getMaterialUrl, useAssignments, useMySubmission, useSubmitAssignment, useEnrolledSubjects, useMyStudentId, uploadSubmissionFile, getSubmissionFileUrl } from './elearning-api';
import type { Assignment, LessonMaterial } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

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

function DownloadFile({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); const u = await getSubmissionFileUrl(path); setBusy(false); if (u) window.open(u, '_blank'); else toast.error('Could not open file'); }}
      className="inline-flex items-center gap-1 text-xs text-primary">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} {label}
    </button>
  );
}

function SubmitDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { institutionId } = useTenant();
  const myStudentId = useMyStudentId(institutionId ?? '');
  const mine = useMySubmission(assignment.id);
  const submit = useSubmitAssignment(assignment.id);
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (mine.data) { setContent(mine.data.content ?? ''); setLink(mine.data.file_url ?? ''); } }, [mine.data]);

  const graded = mine.data?.graded_at;
  const overdue = assignment.due_date && new Date(assignment.due_date) < new Date() && !mine.data;

  const send = async () => {
    if (!content.trim() && !link.trim() && !file && !mine.data?.file_path) { toast.error('Add your answer, a link, or a file'); return; }
    let filePath = mine.data?.file_path ?? null;
    try {
      if (file) {
        if (!myStudentId.data) { toast.error('No student profile linked to your account'); return; }
        setUploading(true);
        filePath = await uploadSubmissionFile(institutionId!, myStudentId.data, assignment.id, file);
        setUploading(false);
      }
      submit.mutate({ content, file_url: link || null, file_path: filePath }, {
        onSuccess: () => { toast.success('Submitted'); setFile(null); }, onError: (e: Error) => toast.error(e.message),
      });
    } catch (e) { setUploading(false); toast.error((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment.title}</DialogTitle>
          <DialogDescription>{assignment.due_date ? `Due ${new Date(assignment.due_date).toLocaleString()}` : 'No due date'} · {Number(assignment.max_points)} points</DialogDescription>
        </DialogHeader>

        {assignment.instructions && <p className="whitespace-pre-wrap rounded bg-muted/40 p-3 text-sm">{assignment.instructions}</p>}

        {mine.isLoading ? <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : graded ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Graded: {Number(mine.data!.grade)} / {Number(assignment.max_points)}</span></div>
            {mine.data!.feedback && <p className="text-sm text-emerald-900">{mine.data!.feedback}</p>}
            {mine.data!.content && <p className="whitespace-pre-wrap rounded bg-white/60 p-2 text-sm">{mine.data!.content}</p>}
            {mine.data!.file_path && <DownloadFile path={mine.data!.file_path} label="Your attached file" />}
          </div>
        ) : (
          <div className="space-y-3">
            {overdue && <p className="text-xs text-amber-600">This assignment is past its due date — late submissions may be marked down.</p>}
            <div className="space-y-1.5"><Label>Your answer</Label><Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your work here…" /></div>
            <div className="space-y-1.5"><Label>Link (optional)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to a document, e.g. Google Drive" /></div>
            <div className="space-y-1.5">
              <Label>File (optional)</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> {file ? file.name : mine.data?.file_path ? 'Replace attached file' : 'Choose a file'}
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {mine.data?.file_path && !file && <DownloadFile path={mine.data.file_path} label="Current file" />}
            </div>
            <div className="flex items-center justify-between">
              {mine.data && <span className="text-xs text-muted-foreground">Submitted {new Date(mine.data.submitted_at).toLocaleString()}</span>}
              <Button className="ml-auto" onClick={send} disabled={submit.isPending || uploading}>{(submit.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mine.data ? 'Update submission' : 'Submit'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function LearnPage() {
  const { institution, institutionId } = useTenant();
  const subjects = Subjects.useList(institutionId ?? '');
  const enrolled = useEnrolledSubjects(institutionId ?? '');
  const subjectOptions = (enrolled.data && enrolled.data.length ? enrolled.data : subjects.data) ?? [];
  const showingEnrolled = !!(enrolled.data && enrolled.data.length);
  const [subjectId, setSubjectId] = useState('');
  const [tab, setTab] = useState<'materials' | 'assignments'>('materials');
  const materials = useMaterials(subjectId || null);
  const assignments = useAssignments(subjectId || null, true);
  const [openAsg, setOpenAsg] = useState<Assignment | null>(null);

  if (!institutionId) return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Learn</h1>
        <p className="text-sm text-muted-foreground">Course materials and assignments — {institution?.name}</p>
      </header>

      <div className="space-y-1.5">
        <Label>Course / subject</Label>
        <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select…</option>
          {subjectOptions.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
        </select>
        {showingEnrolled && <p className="text-xs text-muted-foreground">Showing your enrolled courses.</p>}
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
                {materials.isLoading && <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
                {!materials.isLoading && !materials.data?.length && <p className="text-sm text-muted-foreground">No materials yet.</p>}
                {materials.data?.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex min-w-0 gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{m.title}</p>{m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}</div>
                    </div>
                    <OpenMaterial m={m} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-2 pt-6">
                {assignments.isLoading && <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
                {!assignments.isLoading && !assignments.data?.length && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
                {assignments.data?.map((a) => (
                  <button key={a.id} onClick={() => setOpenAsg(a)} className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted">
                    <div className="flex min-w-0 items-center gap-2"><ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : 'No due date'} · {Number(a.max_points)} pts</p></div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {openAsg && <SubmitDialog assignment={openAsg} onClose={() => setOpenAsg(null)} />}
    </div>
  );
}
