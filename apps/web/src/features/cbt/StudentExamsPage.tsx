import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Clock, AlertTriangle, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import {
  useAvailableExams, startAttempt, saveAnswer, bumpFocus, submitAttempt, getReview,
  type Paper, type SubmitResult, type Review,
} from './cbt-take-api';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/* -------------------------------- runner -------------------------------- */
type Answers = Record<string, { optionIds: string[]; text: string }>;

function ExamRunner({ paper, onSubmitted }: { paper: Paper; onSubmitted: (r: SubmitResult) => void }) {
  const endsAt = useMemo(() => new Date(paper.started_at).getTime() + paper.exam.duration_minutes * 60000, [paper]);
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
  const [idx, setIdx] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const submittingRef = useRef(false);

  const [answers, setAnswers] = useState<Answers>(() => {
    const a: Answers = {};
    for (const q of paper.questions) a[q.question_id] = { optionIds: q.selected_option_ids ?? [], text: q.answer_text ?? '' };
    return a;
  });

  const doSubmit = useCallback(async (auto = false) => {
    if (submittingRef.current) return;
    if (!auto && !window.confirm('Submit your exam now? You will not be able to change answers.')) return;
    submittingRef.current = true;
    try { onSubmitted(await submitAttempt(paper.attempt_id)); }
    catch (e) { toast.error((e as Error).message); submittingRef.current = false; }
  }, [paper.attempt_id, onSubmitted]);

  useEffect(() => {
    const id = setInterval(() => {
      const rem = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) { clearInterval(id); doSubmit(true); }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, doSubmit]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && !submittingRef.current) {
        bumpFocus(paper.attempt_id).catch(() => {});
        setWarnings((w) => w + 1);
        toast('Leaving the exam screen is recorded');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [paper.attempt_id]);

  const q = paper.questions[idx];
  const ans = answers[q.question_id];

  const persist = (qid: string, optionIds: string[], text: string) => {
    setAnswers((a) => ({ ...a, [qid]: { optionIds, text } }));
    saveAnswer(paper.attempt_id, qid, optionIds, text || null).catch(() => {});
  };
  const pickSingle = (oid: string) => persist(q.question_id, [oid], '');
  const toggleMulti = (oid: string) => {
    const set = new Set(ans.optionIds); set.has(oid) ? set.delete(oid) : set.add(oid);
    persist(q.question_id, [...set], '');
  };
  const setText = (t: string) => persist(q.question_id, [], t);

  const answered = (qid: string) => { const a = answers[qid]; return a.optionIds.length > 0 || a.text.trim().length > 0; };
  const answeredCount = paper.questions.filter((x) => answered(x.question_id)).length;
  const low = remaining <= 60;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <h1 className="font-semibold">{paper.exam.title}</h1>
          <p className="text-xs text-muted-foreground">{answeredCount} / {paper.questions.length} answered{warnings > 0 ? ` · ${warnings} focus warning${warnings === 1 ? '' : 's'}` : ''}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${low ? 'bg-red-100 text-red-700' : 'bg-muted'}`}>
          <Clock className="h-4 w-4" /> {fmt(remaining)}
        </div>
      </div>

      {warnings > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4" /> Switching tabs or apps during the exam is logged for the examiner.
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Question {idx + 1}</CardTitle>
          <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm">{q.text}</p>

          {(q.type === 'single_choice' || q.type === 'true_false') && q.options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${ans.optionIds[0] === o.id ? 'border-primary bg-primary/5' : ''}`}>
              <input type="radio" checked={ans.optionIds[0] === o.id} onChange={() => pickSingle(o.id)} />
              {o.text}
            </label>
          ))}
          {q.type === 'multiple_choice' && q.options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${ans.optionIds.includes(o.id) ? 'border-primary bg-primary/5' : ''}`}>
              <input type="checkbox" checked={ans.optionIds.includes(o.id)} onChange={() => toggleMulti(o.id)} />
              {o.text}
            </label>
          ))}
          {q.type === 'short_answer' && (
            <Input value={ans.text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer" />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Prev</Button>
        <div className="flex flex-wrap justify-center gap-1">
          {paper.questions.map((x, i) => (
            <button key={x.question_id} onClick={() => setIdx(i)}
              className={`h-7 w-7 rounded text-xs font-medium ${i === idx ? 'bg-primary text-primary-foreground' : answered(x.question_id) ? 'bg-emerald-100 text-emerald-800' : 'bg-muted'}`}>
              {i + 1}
            </button>
          ))}
        </div>
        {idx < paper.questions.length - 1
          ? <Button variant="outline" onClick={() => setIdx((i) => i + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
          : <Button onClick={() => doSubmit(false)}>Submit</Button>}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => doSubmit(false)}>Submit exam</Button>
      </div>
    </div>
  );
}

/* ------------------------------- review --------------------------------- */
function ReviewView({ review, onBack }: { review: Review; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Review</h1>
        <Button variant="outline" onClick={onBack}>Back</Button>
      </div>
      {review.questions.map((q, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{i + 1}. {q.text}</p>
              {q.is_correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Your answer: {q.type === 'short_answer' ? (q.answer_text || '—') : (q.your_options?.join(', ') || '—')}
            </p>
            {!q.is_correct && (
              <p className="text-xs text-emerald-700">
                Correct: {q.type === 'short_answer' ? (q.correct_answer || '—') : (q.correct_options?.join(', ') || '—')}
              </p>
            )}
            {q.explanation && <p className="text-xs text-muted-foreground">Note: {q.explanation}</p>}
            <p className="text-xs font-medium">{q.marks} / {q.max} marks</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------- page ---------------------------------- */
export default function StudentExamsPage() {
  const { institution, institutionId } = useTenant();
  const { data: exams, isLoading, refetch } = useAvailableExams(institutionId ?? '');
  const [paper, setPaper] = useState<Paper | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const begin = async (examId: string) => {
    setBusyId(examId);
    try { setPaper(await startAttempt(examId)); setResult(null); setReview(null); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  };

  const openReview = async (attemptId: string) => {
    try { setReview(await getReview(attemptId)); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (review) return <ReviewView review={review} onBack={() => setReview(null)} />;

  if (result) {
    const passed = result.pass_mark == null || result.percent >= result.pass_mark;
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            {passed ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /> : <XCircle className="mx-auto h-14 w-14 text-red-500" />}
            <h1 className="text-lg font-semibold">{passed ? 'Submitted' : 'Submitted'}</h1>
            <p className="text-3xl font-bold">{result.percent.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">{result.score} / {result.total} marks{result.pass_mark != null ? ` · pass mark ${result.pass_mark}%` : ''}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={() => { setResult(null); setPaper(null); refetch(); }}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paper) return <ExamRunner paper={paper} onSubmitted={(r) => { setResult(r); setPaper(null); }} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Exams</h1>
        <p className="text-sm text-muted-foreground">Available computer-based tests — {institution?.name}</p>
      </header>

      {isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!isLoading && !exams?.length && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No exams available right now.</CardContent></Card>}

      {exams?.map(({ exam, attempts }) => {
        const inProgress = attempts.find((a) => a.status === 'in_progress');
        const graded = attempts.filter((a) => a.status === 'graded' || a.status === 'submitted');
        const used = attempts.filter((a) => a.status !== 'in_progress').length;
        const remaining = exam.max_attempts - used;
        const best = graded.length ? graded.reduce((m, a) => Math.max(m, a.total > 0 ? (a.score / a.total) * 100 : 0), 0) : null;
        return (
          <Card key={exam.id}>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{exam.title}</p>
                <p className="text-xs text-muted-foreground">
                  {exam.duration_minutes} min · pass {Number(exam.pass_mark)}%
                  {best != null && ` · best ${best.toFixed(0)}%`}
                  {` · ${Math.max(0, remaining)} attempt${remaining === 1 ? '' : 's'} left`}
                </p>
              </div>
              <div className="flex gap-2">
                {graded.length > 0 && <Button variant="outline" size="sm" onClick={() => openReview(graded[0].id)}>Review</Button>}
                {inProgress
                  ? <Button size="sm" onClick={() => begin(exam.id)} disabled={busyId === exam.id}>{busyId === exam.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Resume</Button>
                  : remaining > 0
                    ? <Button size="sm" onClick={() => begin(exam.id)} disabled={busyId === exam.id}>{busyId === exam.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start</Button>
                    : <span className="text-xs text-muted-foreground">No attempts left</span>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
