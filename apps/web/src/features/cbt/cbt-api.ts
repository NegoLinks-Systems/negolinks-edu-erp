import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  CbtExam, CbtExamQuestion, Question, QuestionCategory, QuestionOption, QuestionType,
} from '../../lib/database.types';

export const questionTypes: QuestionType[] = ['single_choice', 'multiple_choice', 'true_false', 'short_answer'];
export const difficulties = ['easy', 'medium', 'hard'] as const;

/* ----------------------------- categories ----------------------------- */
export function useCategories(institutionId: string) {
  return useQuery({
    queryKey: ['q-categories', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('question_categories')
        .select('*').eq('institution_id', institutionId).order('name');
      if (error) throw error;
      return (data ?? []) as QuestionCategory[];
    },
  });
}
export function useUpsertCategory(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; subject_id?: string | null }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('question_categories').update(row).eq('id', id)
        : await supabase.from('question_categories').insert(row);
      if (res.error) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['q-categories', institutionId] }),
  });
}
export function useDeleteCategory(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('question_categories').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['q-categories', institutionId] }),
  });
}

/* ------------------------------ questions ----------------------------- */
export function useQuestions(institutionId: string, filters: { categoryId: string; subjectId: string; search: string }) {
  return useQuery({
    queryKey: ['questions', institutionId, filters],
    enabled: !!institutionId,
    queryFn: async () => {
      let q = supabase.from('questions')
        .select('id, text, type, marks, difficulty, category_id, subject_id')
        .eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(300);
      if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
      if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
      const s = filters.search.replace(/[,()*%]/g, ' ').trim();
      if (s) q = q.ilike('text', `%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Pick<Question, 'id' | 'text' | 'type' | 'marks' | 'difficulty' | 'category_id' | 'subject_id'>[];
    },
  });
}

export function useQuestionWithOptions(questionId: string | null) {
  return useQuery({
    queryKey: ['question', questionId],
    enabled: !!questionId,
    queryFn: async () => {
      const [{ data: q, error: qErr }, { data: opts, error: oErr }] = await Promise.all([
        supabase.from('questions').select('*').eq('id', questionId!).single(),
        supabase.from('question_options').select('*').eq('question_id', questionId!).order('sort_order'),
      ]);
      if (qErr) throw qErr; if (oErr) throw oErr;
      return { question: q as Question, options: (opts ?? []) as QuestionOption[] };
    },
  });
}

export function useSaveQuestion(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; category_id: string | null; subject_id: string | null; type: QuestionType;
      text: string; marks: number; difficulty: string; answer_text: string | null; explanation: string | null;
      options: { text: string; is_correct: boolean; sort_order: number }[];
    }) => {
      const { options, ...q } = input;
      const { data, error } = await supabase.rpc('save_question', {
        _q: { ...q, institution_id: institutionId } as unknown as Record<string, unknown>,
        _options: options as unknown as Record<string, unknown>,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions', institutionId] }),
  });
}

export function useDeleteQuestion(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('questions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions', institutionId] }),
  });
}

/* -------------------------------- exams ------------------------------- */
export function useExams(institutionId: string) {
  return useQuery({
    queryKey: ['cbt-exams', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('cbt_exams')
        .select('*').eq('institution_id', institutionId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CbtExam[];
    },
  });
}

export function useUpsertExam(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CbtExam> & { id?: string; title: string }) => {
      const { id, ...rest } = input;
      const row = { ...rest, institution_id: institutionId };
      const res = id ? await supabase.from('cbt_exams').update(row).eq('id', id).select().single()
        : await supabase.from('cbt_exams').insert(row).select().single();
      if (res.error) throw res.error;
      return res.data as CbtExam;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cbt-exams', institutionId] }),
  });
}

export function useDeleteExam(institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('cbt_exams').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cbt-exams', institutionId] }),
  });
}

/* --------------------------- exam questions --------------------------- */
export type ExamQuestionRow = CbtExamQuestion & { question: Pick<Question, 'id' | 'text' | 'type' | 'marks'> };

export function useExamQuestions(examId: string | null) {
  return useQuery({
    queryKey: ['exam-questions', examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.from('cbt_exam_questions')
        .select('*, question:questions(id, text, type, marks)')
        .eq('exam_id', examId!).order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as ExamQuestionRow[];
    },
  });
}

export function useAttachQuestions(examId: string, institutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionIds: string[]) => {
      if (!questionIds.length) return;
      const rows = questionIds.map((qid, i) => ({ exam_id: examId, question_id: qid, institution_id: institutionId, sort_order: i + 1 }));
      const { error } = await supabase.from('cbt_exam_questions').upsert(rows, { onConflict: 'exam_id,question_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-questions', examId] }),
  });
}

export function useDetachQuestion(examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => { const { error } = await supabase.from('cbt_exam_questions').delete().eq('id', linkId); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-questions', examId] }),
  });
}
