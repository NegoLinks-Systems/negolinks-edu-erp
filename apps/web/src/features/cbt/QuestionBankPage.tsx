import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, X, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { Subjects } from '../academics/academics-api';
import {
  useCategories, useUpsertCategory, useDeleteCategory,
  useQuestions, useQuestionWithOptions, useSaveQuestion, useDeleteQuestion,
  questionTypes, difficulties,
} from './cbt-api';
import type { QuestionType } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: 'Single choice', multiple_choice: 'Multiple choice', true_false: 'True / False', short_answer: 'Short answer',
};
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

interface OptForm { text: string; is_correct: boolean; }
interface QForm {
  type: QuestionType; text: string; marks: string; difficulty: string;
  category_id: string; subject_id: string; answer_text: string; options: OptForm[];
}
const newQForm = (): QForm => ({
  type: 'single_choice', text: '', marks: '1', difficulty: 'medium',
  category_id: '', subject_id: '', answer_text: '', options: [{ text: '', is_correct: false }, { text: '', is_correct: false }],
});

function QuestionEditor({ open, onOpenChange, institutionId, editId, categories, subjects }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; editId: string | null;
  categories: { id: string; name: string }[]; subjects: { id: string; title: string }[];
}) {
  const existing = useQuestionWithOptions(open && editId ? editId : null);
  const save = useSaveQuestion(institutionId);
  const [form, setForm] = useState<QForm>(newQForm());

  useEffect(() => {
    if (!open) return;
    if (editId && existing.data) {
      const q = existing.data.question; const opts = existing.data.options;
      setForm({
        type: q.type, text: q.text, marks: String(q.marks), difficulty: q.difficulty,
        category_id: q.category_id ?? '', subject_id: q.subject_id ?? '', answer_text: q.answer_text ?? '',
        options: opts.length ? opts.map((o) => ({ text: o.text, is_correct: o.is_correct })) : newQForm().options,
      });
    } else if (!editId) setForm(newQForm());
  }, [open, editId, existing.data]);

  const changeType = (t: QuestionType) => setForm((f) => ({
    ...f, type: t,
    options: t === 'true_false' ? [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }]
      : t === 'short_answer' ? [] : (f.options.length ? f.options : [{ text: '', is_correct: false }, { text: '', is_correct: false }]),
  }));
  const setCorrect = (idx: number) => setForm((f) => ({
    ...f, options: f.options.map((o, i) => f.type === 'multiple_choice' ? (i === idx ? { ...o, is_correct: !o.is_correct } : o) : { ...o, is_correct: i === idx }),
  }));
  const setOptText = (idx: number, text: string) => setForm((f) => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, text } : o) }));

  const submit = () => {
    if (!form.text.trim()) { toast.error('Enter the question'); return; }
    const isChoice = form.type === 'single_choice' || form.type === 'multiple_choice' || form.type === 'true_false';
    if (isChoice) {
      const filled = form.options.filter((o) => o.text.trim());
      if (filled.length < 2) { toast.error('Add at least two options'); return; }
      if (!filled.some((o) => o.is_correct)) { toast.error('Mark the correct answer'); return; }
    } else if (!form.answer_text.trim()) { toast.error('Enter the correct answer'); return; }

    save.mutate({
      id: editId ?? undefined, category_id: form.category_id || null, subject_id: form.subject_id || null,
      type: form.type, text: form.text.trim(), marks: Number(form.marks) || 1, difficulty: form.difficulty,
      answer_text: form.type === 'short_answer' ? form.answer_text.trim() : null, explanation: null,
      options: form.type === 'short_answer' ? [] : form.options.filter((o) => o.text.trim()).map((o, i) => ({ ...o, sort_order: i + 1 })),
    }, { onSuccess: () => { toast.success('Question saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  const choice = form.type === 'single_choice' || form.type === 'multiple_choice' || form.type === 'true_false';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editId ? 'Edit question' : 'New question'}</DialogTitle>
          <DialogDescription>For {form.type === 'multiple_choice' ? 'multiple-choice mark every correct option' : 'single-answer questions mark one correct option'}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Type">
              <select className={selectClass} value={form.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
                {questionTypes.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Marks"><Input type="number" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} /></Field>
            <Field label="Difficulty">
              <select className={selectClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {difficulties.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className={selectClass} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Question"><Textarea rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>

          {choice && (
            <div className="space-y-2">
              <Label>Options {form.type === 'multiple_choice' ? '(tick all correct)' : '(tick the correct one)'}</Label>
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => setCorrect(i)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${o.is_correct ? 'border-emerald-600 bg-emerald-600 text-white' : 'bg-background'}`}>
                    {o.is_correct && <Check className="h-4 w-4" />}
                  </button>
                  <Input value={o.text} disabled={form.type === 'true_false'} placeholder={`Option ${i + 1}`} onChange={(e) => setOptText(i, e.target.value)} />
                  {form.type !== 'true_false' && form.options.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) })}><X className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              {form.type !== 'true_false' && (
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, options: [...form.options, { text: '', is_correct: false }] })}>
                  <Plus className="mr-2 h-4 w-4" /> Add option
                </Button>
              )}
            </div>
          )}

          {form.type === 'short_answer' && (
            <Field label="Correct answer"><Input value={form.answer_text} onChange={(e) => setForm({ ...form, answer_text: e.target.value })} placeholder="Accepted answer (case-insensitive)" /></Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- page ------------------------------- */
export default function QuestionBankPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost', 'teacher', 'class_teacher', 'lecturer');

  const categories = useCategories(institutionId ?? '');
  const upsertCat = useUpsertCategory(institutionId ?? '');
  const delCat = useDeleteCategory(institutionId ?? '');
  const subjects = Subjects.useList(institutionId ?? '');

  const [categoryId, setCategoryId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const { data: questions, isLoading } = useQuestions(institutionId ?? '', { categoryId, subjectId, search });
  const delQ = useDeleteQuestion(institutionId ?? '');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');

  const catList = useMemo(() => (categories.data ?? []).map((c) => ({ id: c.id, name: c.name })), [categories.data]);
  const subjList = useMemo(() => (subjects.data ?? []).map((s: any) => ({ id: s.id, title: s.title })), [subjects.data]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Question bank</h1>
          <p className="text-sm text-muted-foreground">Reusable questions for computer-based tests — {institution?.name}</p>
        </div>
        {canManage && <Button onClick={() => { setEditId(null); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add question</Button>}
      </header>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {categories.data?.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                  {c.name}
                  <button onClick={() => delCat.mutate(c.id, { onSuccess: () => toast.success('Removed') })}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </span>
              ))}
              {!categories.data?.length && <span className="text-sm text-muted-foreground">No categories yet.</span>}
            </div>
            <div className="flex gap-2">
              <Input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="max-w-xs" />
              <Button variant="outline" onClick={() => {
                if (!newCat.trim()) return;
                upsertCat.mutate({ name: newCat.trim() }, { onSuccess: () => { toast.success('Category added'); setNewCat(''); }, onError: (e: Error) => toast.error(e.message) });
              }}>Add</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {catList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All subjects</option>
          {subjList.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!isLoading && !questions?.length && <p className="text-sm text-muted-foreground">No questions found.</p>}
          {questions?.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm">{q.text.length > 120 ? `${q.text.slice(0, 120)}…` : q.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{TYPE_LABEL[q.type]} · {Number(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'} · {titleCase(q.difficulty)}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(q.id); setEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (!confirm('Delete this question?')) return;
                    delQ.mutate(q.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <QuestionEditor open={editorOpen} onOpenChange={setEditorOpen} institutionId={institutionId} editId={editId} categories={catList} subjects={subjList} />
    </div>
  );
}
