import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { CbtAttempt, CbtExam, QuestionType, Student } from '../../lib/database.types';

/* ----------------------------- paper shape ---------------------------- */
export interface PaperOption { id: string; text: string; }
export interface PaperQuestion {
  question_id: string; type: QuestionType; text: string; marks: number;
  selected_option_ids: string[]; answer_text: string | null; options: PaperOption[];
}
export interface Paper {
  attempt_id: string;
  exam: { id: string; title: string; duration_minutes: number; instructions: string | null };
  started_at: string;
  questions: PaperQuestion[];
}
export interface SubmitResult { score: number; total: number; percent: number; pass_mark?: number; }

export interface ReviewQuestion {
  text: string; type: QuestionType; is_correct: boolean | null; marks: number; max: number;
  your_options: string[] | null; correct_options: string[] | null;
  answer_text: string | null; correct_answer: string | null; explanation: string | null;
}
export interface Review { score: number; total: number; percent: number; questions: ReviewQuestion[]; }

/* ---------------------------- RPC wrappers ---------------------------- */
export async function startAttempt(examId: string): Promise<Paper> {
  const { data, error } = await supabase.rpc('start_attempt', { _exam_id: examId });
  if (error) throw error;
  return data as unknown as Paper;
}
export async function saveAnswer(attempt: string, question: string, optionIds: string[], text: string | null) {
  const { error } = await supabase.rpc('save_answer', { _attempt: attempt, _question: question, _option_ids: optionIds, _text: text });
  if (error) throw error;
}
export async function bumpFocus(attempt: string) {
  await supabase.rpc('bump_focus', { _attempt: attempt });
}
export async function submitAttempt(attempt: string): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_attempt', { _attempt: attempt });
  if (error) throw error;
  return data as unknown as SubmitResult;
}
export async function getReview(attempt: string): Promise<Review> {
  const { data, error } = await supabase.rpc('get_attempt_review', { _attempt: attempt });
  if (error) throw error;
  return data as unknown as Review;
}

/* --------------------- available exams (student) ---------------------- */
export interface ExamWithAttempts { exam: CbtExam; attempts: CbtAttempt[]; }

export function useAvailableExams(institutionId: string) {
  return useQuery({
    queryKey: ['available-exams', institutionId],
    enabled: !!institutionId,
    queryFn: async (): Promise<ExamWithAttempts[]> => {
      const [{ data: exams, error: eErr }, { data: attempts, error: aErr }] = await Promise.all([
        supabase.from('cbt_exams').select('*').eq('institution_id', institutionId).eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('cbt_attempts').select('*'),  // RLS → only the caller's own
      ]);
      if (eErr) throw eErr; if (aErr) throw aErr;
      const byExam = new Map<string, CbtAttempt[]>();
      for (const a of (attempts ?? []) as CbtAttempt[]) {
        const arr = byExam.get(a.exam_id) ?? []; arr.push(a); byExam.set(a.exam_id, arr);
      }
      return ((exams ?? []) as CbtExam[]).map((exam) => ({ exam, attempts: byExam.get(exam.id) ?? [] }));
    },
  });
}

/* ----------------------- attempts list (staff) ------------------------ */
export type AttemptWithStudent = CbtAttempt & { student: Pick<Student, 'first_name' | 'last_name' | 'admission_number'> };

export function useExamAttempts(examId: string | null) {
  return useQuery({
    queryKey: ['exam-attempts', examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.from('cbt_attempts')
        .select('*, student:students(first_name, last_name, admission_number)')
        .eq('exam_id', examId!).order('started_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttemptWithStudent[];
    },
  });
}
