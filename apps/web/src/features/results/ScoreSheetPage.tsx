import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Subjects, useTerms } from '../academics/academics-api';
import { ScopeSelector, selectClass, emptyScope, toScope, type ScopeState } from '../attendance/scope-selector';
import {
  useScoreSheet, useSaveScores, gradeFor, rankByTotal, type GradeBand,
} from './results-api';

export default function ScoreSheetPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const canEnter = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'academic_officer',
    'dean', 'head_of_department', 'rector', 'provost', 'teacher', 'class_teacher', 'lecturer');
  const bands = ((institution?.grading_system as { scale?: GradeBand[] } | undefined)?.scale) ?? [];

  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const scope = toScope(scopeState, tertiary);
  const patch = (p: Partial<ScopeState>) => setScopeState((s) => ({ ...s, ...p }));

  const [termId, setTermId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  useEffect(() => { setTermId(''); }, [scopeState.sessionId]);

  const terms = useTerms(scopeState.sessionId || null);
  const subjects = Subjects.useList(institutionId ?? '');
  const { data: sheet, isLoading } = useScoreSheet({ scope, subjectId, termId });
  const save = useSaveScores({ institutionId: institutionId ?? '', scope: scope ?? { sessionId: '' }, subjectId, termId });

  // Local editable scores: studentId -> componentId -> string
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    if (!sheet) return;
    const next: Record<string, Record<string, string>> = {};
    for (const row of sheet.rows) {
      next[row.student.id] = {};
      for (const c of sheet.components) {
        const v = row.scores[c.id];
        next[row.student.id][c.id] = v === undefined ? '' : String(v);
      }
    }
    setScores(next);
  }, [sheet]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const components = sheet?.components ?? [];
  const totalMax = components.reduce((s, c) => s + Number(c.max_score), 0);

  const totalFor = (sid: string) =>
    components.reduce((s, c) => s + (parseFloat(scores[sid]?.[c.id] || '0') || 0), 0);
  const positions = sheet
    ? rankByTotal(sheet.rows.map((r) => ({ id: r.student.id, total: totalFor(r.student.id) })))
    : new Map<string, number>();

  const setCell = (sid: string, cid: string, val: string) =>
    setScores((m) => ({ ...m, [sid]: { ...(m[sid] ?? {}), [cid]: val } }));

  const onSave = () => {
    if (!scope || !sheet) return;
    const entries = sheet.rows.flatMap((r) =>
      components.map((c) => ({
        student_id: r.student.id, component_id: c.id,
        score: parseFloat(scores[r.student.id]?.[c.id] || '0') || 0,
      })));
    save.mutate(entries, {
      onSuccess: () => toast.success('Scores saved'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const ready = scope && subjectId && termId;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Score sheet</h1>
        <p className="text-sm text-muted-foreground">Enter {tertiary ? 'course' : 'subject'} scores; grades follow your grading scale — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <ScopeSelector institutionId={institutionId} tertiary={tertiary} value={scopeState} onChange={patch} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Term</Label>
              <select className={selectClass} value={termId} onChange={(e) => setTermId(e.target.value)} disabled={!scopeState.sessionId}>
                <option value="">Select term</option>
                {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{tertiary ? 'Course' : 'Subject'}</Label>
              <select className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select {tertiary ? 'course' : 'subject'}</option>
                {subjects.data?.map((s: any) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.title}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!ready && (
        <p className="text-center text-sm text-muted-foreground">
          Choose a session, {tertiary ? 'programme' : 'class arm'}, term, and {tertiary ? 'course' : 'subject'} to load the sheet.
        </p>
      )}

      {ready && bands.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No grading scale set. Add one under Settings → Grading so grades and remarks appear.
        </div>
      )}

      {ready && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{sheet?.rows.length ?? 0} students · total out of {totalMax || 0}</CardTitle>
            {canEnter && sheet && sheet.rows.length > 0 && components.length > 0 && (
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save scores
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
            {!isLoading && components.length === 0 && (
              <p className="text-sm text-muted-foreground">No assessment components configured. Set them up first.</p>
            )}
            {!isLoading && components.length > 0 && !sheet?.rows.length && (
              <p className="text-sm text-muted-foreground">No students on this roster. Enrol students first.</p>
            )}
            {!isLoading && components.length > 0 && sheet && sheet.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Student</th>
                      {components.map((c) => (
                        <th key={c.id} className="px-2 py-2 text-center font-medium">{c.name}<br /><span className="text-[10px] font-normal">/{Number(c.max_score)}</span></th>
                      ))}
                      <th className="px-2 py-2 text-center font-medium">Total</th>
                      <th className="px-2 py-2 text-center font-medium">%</th>
                      <th className="px-2 py-2 text-center font-medium">Grade</th>
                      {tertiary && <th className="px-2 py-2 text-center font-medium">Pt</th>}
                      <th className="px-2 py-2 text-center font-medium">Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((r) => {
                      const total = totalFor(r.student.id);
                      const pct = totalMax ? (total / totalMax) * 100 : 0;
                      const band = gradeFor(pct, bands);
                      return (
                        <tr key={r.student.id} className="border-t">
                          <td className="whitespace-nowrap px-2 py-1.5">{r.student.last_name} {r.student.first_name}</td>
                          {components.map((c) => {
                            const val = scores[r.student.id]?.[c.id] ?? '';
                            const over = (parseFloat(val || '0') || 0) > Number(c.max_score);
                            return (
                              <td key={c.id} className="px-1 py-1 text-center">
                                <input type="number" value={val} disabled={!canEnter}
                                  onChange={(e) => setCell(r.student.id, c.id, e.target.value)}
                                  className={`h-8 w-16 rounded-md border px-2 text-center text-sm ${over ? 'border-destructive text-destructive' : 'border-input'} disabled:opacity-60`} />
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center font-medium">{total}</td>
                          <td className="px-2 py-1.5 text-center">{pct.toFixed(1)}</td>
                          <td className="px-2 py-1.5 text-center font-medium">{band?.grade ?? '—'}</td>
                          {tertiary && <td className="px-2 py-1.5 text-center">{band ? band.point : '—'}</td>}
                          <td className="px-2 py-1.5 text-center">{positions.get(r.student.id) ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
