import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ListChecks, Search, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Sessions, Programmes, Subjects } from '../academics/academics-api';
import { useAllArms } from '../attendance/attendance-api';
import {
  useExams, useUpsertExam, useDeleteExam, useExamQuestions, useAttachQuestions, useDetachQuestion, useQuestions,
} from './cbt-api';
import type { CbtExam, CbtExamStatus, QuestionType } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const STATUS_STYLE: Record<CbtExamStatus, string> = {
  draft: 'bg-zinc-200 text-zinc-700', published: 'bg-emerald-100 text-emerald-800', closed: 'bg-amber-100 text-amber-800',
};
const TYPE_SHORT: Record<QuestionType, string> = { single_choice: 'SC', multiple_choice: 'MC', true_false: 'TF', short_answer: 'SA' };
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* --------------------------- settings dialog -------------------------- */
function ExamFormDialog({ open, onOpenChange, institutionId, exam }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; exam: CbtExam | null;
}) {
  const { institution } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const upsert = useUpsertExam(institutionId);
  const sessions = Sessions.useList(institutionId, { column: 'starts_on', order: false });
  const arms = useAllArms(institutionId);
  const programmes = Programmes.useList(institutionId);
  const subjects = Subjects.useList(institutionId);

  const blank = {
    title: '', subject_id: '', session_id: '', class_arm_id: '', programme_id: '', level: '',
    duration_minutes: '30', pass_mark: '50', opens_at: '', closes_at: '',
    shuffle_questions: true, shuffle_options: true, max_attempts: '1', instructions: '', status: 'draft' as CbtExamStatus,
  };
  const [f, setF] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (exam) setF({
      title: exam.title, subject_id: exam.subject_id ?? '', session_id: exam.session_id ?? '',
      class_arm_id: exam.class_arm_id ?? '', programme_id: exam.programme_id ?? '', level: exam.level ?? '',
      duration_minutes: String(exam.duration_minutes), pass_mark: String(exam.pass_mark),
      opens_at: toLocalInput(exam.opens_at), closes_at: toLocalInput(exam.closes_at),
      shuffle_questions: exam.shuffle_questions, shuffle_options: exam.shuffle_options,
      max_attempts: String(exam.max_attempts), instructions: exam.instructions ?? '', status: exam.status,
    });
    else setF(blank);
  }, [open, exam]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!f.title.trim()) { toast.error('Enter a title'); return; }
    upsert.mutate({
      id: exam?.id, title: f.title.trim(), subject_id: f.subject_id || null, session_id: f.session_id || null,
      class_arm_id: tertiary ? null : (f.class_arm_id || null), programme_id: tertiary ? (f.programme_id || null) : null,
      level: tertiary ? (f.level || null) : null, duration_minutes: Number(f.duration_minutes) || 30,
      pass_mark: Number(f.pass_mark) || 0, opens_at: fromLocalInput(f.opens_at), closes_at: fromLocalInput(f.closes_at),
      shuffle_questions: f.shuffle_questions, shuffle_options: f.shuffle_options, max_attempts: Number(f.max_attempts) || 1,
      instructions: f.instructions || null, status: f.status,
    }, { onSuccess: () => { toast.success('Exam saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exam ? 'Edit exam' : 'New exam'}</DialogTitle>
          <DialogDescription>Timing, scope and rules. Attach questions after saving.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Subject / course">
            <select className={selectClass} value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}>
              <option value="">—</option>
              {subjects.data?.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
            </select>
          </Field>
          <Field label="Session">
            <select className={selectClass} value={f.session_id} onChange={(e) => setF({ ...f, session_id: e.target.value })}>
              <option value="">—</option>
              {sessions.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          {tertiary ? (
            <>
              <Field label="Programme">
                <select className={selectClass} value={f.programme_id} onChange={(e) => setF({ ...f, programme_id: e.target.value })}>
                  <option value="">All students</option>
                  {programmes.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Level (optional)"><Input value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="100" /></Field>
            </>
          ) : (
            <Field label="Class arm">
              <select className={selectClass} value={f.class_arm_id} onChange={(e) => setF({ ...f, class_arm_id: e.target.value })}>
                <option value="">All students</option>
                {arms.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
          )}
          <Field label="Duration (minutes)"><Input type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></Field>
          <Field label="Pass mark (%)"><Input type="number" value={f.pass_mark} onChange={(e) => setF({ ...f, pass_mark: e.target.value })} /></Field>
          <Field label="Opens at"><Input type="datetime-local" value={f.opens_at} onChange={(e) => setF({ ...f, opens_at: e.target.value })} /></Field>
          <Field label="Closes at"><Input type="datetime-local" value={f.closes_at} onChange={(e) => setF({ ...f, closes_at: e.target.value })} /></Field>
          <Field label="Max attempts"><Input type="number" value={f.max_attempts} onChange={(e) => setF({ ...f, max_attempts: e.target.value })} /></Field>
          <Field label="Status">
            <select className={selectClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CbtExamStatus })}>
              <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
            </select>
          </Field>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">Shuffle questions</span><Switch checked={f.shuffle_questions} onCheckedChange={(v) => setF({ ...f, shuffle_questions: v })} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><span className="text-sm">Shuffle options</span><Switch checked={f.shuffle_options} onCheckedChange={(v) => setF({ ...f, shuffle_options: v })} /></div>
          <div className="sm:col-span-2"><Field label="Instructions"><Textarea rows={2} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field></div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save exam</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- questions dialog -------------------------- */
function ExamQuestionsDialog({ exam, onClose, institutionId }: { exam: CbtExam; onClose: () => void; institutionId: string }) {
  const attached = useExamQuestions(exam.id);
  const attach = useAttachQuestions(exam.id, institutionId);
  const detach = useDetachQuestion(exam.id);
  const [search, setSearch] = useState('');
  const bank = useQuestions(institutionId, { categoryId: '', subjectId: exam.subject_id ?? '', search });
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const attachedIds = useMemo(() => new Set((attached.data ?? []).map((a) => a.question_id)), [attached.data]);
  const totalMarks = (attached.data ?? []).reduce((s, a) => s + Number(a.marks ?? a.question.marks), 0);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addSelected = () => attach.mutate([...picked], {
    onSuccess: () => { toast.success('Questions added'); setPicked(new Set()); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exam.title}</DialogTitle>
          <DialogDescription>{attached.data?.length ?? 0} questions · {totalMarks} marks total</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Attached</p>
          {attached.data?.length === 0 && <p className="text-sm text-muted-foreground">No questions yet — add some below.</p>}
          {attached.data?.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span><span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{TYPE_SHORT[a.question.type]}</span>{a.question.text.length > 90 ? `${a.question.text.slice(0, 90)}…` : a.question.text}</span>
              <Button variant="ghost" size="icon" onClick={() => detach.mutate(a.id, { onSuccess: () => toast.success('Removed') })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Add from bank</p>
            {picked.size > 0 && <Button size="sm" onClick={addSelected} disabled={attach.isPending}>{attach.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add {picked.size}</Button>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search question bank" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {bank.data?.filter((q) => !attachedIds.has(q.id)).map((q) => (
              <label key={q.id} className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <input type="checkbox" checked={picked.has(q.id)} onChange={() => toggle(q.id)} className="mt-0.5" />
                <span><span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{TYPE_SHORT[q.type]}</span>{q.text.length > 90 ? `${q.text.slice(0, 90)}…` : q.text}</span>
              </label>
            ))}
            {!bank.data?.filter((q) => !attachedIds.has(q.id)).length && <p className="px-1 text-sm text-muted-foreground">No more questions match.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- page ------------------------------- */
export default function ExamsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost', 'teacher', 'class_teacher', 'lecturer');

  const { data: exams, isLoading } = useExams(institutionId ?? '');
  const upsert = useUpsertExam(institutionId ?? '');
  const del = useDeleteExam(institutionId ?? '');

  const [formOpen, setFormOpen] = useState(false);
  const [editExam, setEditExam] = useState<CbtExam | null>(null);
  const [questionsExam, setQuestionsExam] = useState<CbtExam | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const togglePublish = (e: CbtExam) =>
    upsert.mutate({ id: e.id, title: e.title, status: e.status === 'published' ? 'draft' : 'published' }, {
      onSuccess: () => toast.success(e.status === 'published' ? 'Unpublished' : 'Published'),
      onError: (err: Error) => toast.error(err.message),
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Exams</h1>
          <p className="text-sm text-muted-foreground">Computer-based tests — {institution?.name}</p>
        </div>
        {canManage && <Button onClick={() => { setEditExam(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New exam</Button>}
      </header>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!isLoading && !exams?.length && <p className="text-sm text-muted-foreground">No exams yet.</p>}
          {exams?.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.duration_minutes} min · pass {Number(e.pass_mark)}% · max {e.max_attempts} attempt{e.max_attempts === 1 ? '' : 's'}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>{titleCase(e.status)}</span>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" title="Questions" onClick={() => setQuestionsExam(e)}><ListChecks className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title={e.status === 'published' ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(e)}>
                      {e.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditExam(e); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => {
                      if (!confirm(`Delete exam "${e.title}"?`)) return;
                      del.mutate(e.id, { onSuccess: () => toast.success('Deleted'), onError: (err: Error) => toast.error(err.message) });
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} institutionId={institutionId} exam={editExam} />
      {questionsExam && <ExamQuestionsDialog exam={questionsExam} onClose={() => setQuestionsExam(null)} institutionId={institutionId} />}
    </div>
  );
}
