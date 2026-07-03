import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle2, Upload, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, useTerms } from '../academics/academics-api';
import { ScopeSelector, selectClass, emptyScope, toScope, type ScopeState } from '../attendance/scope-selector';
import { gradeFor, type GradeBand } from './results-api';
import {
  usePublication, useSetResultStatus, useCompiledRaw, buildCompiled, type CompiledStudent,
} from './results-publish-api';
import { ReportCardButton, type ReportCardCore } from './report-card';
import type { ResultStatus } from '../../lib/database.types';

const STATUS_BADGE: Record<ResultStatus, string> = {
  draft: 'bg-zinc-200 text-zinc-700', submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-800', published: 'bg-emerald-100 text-emerald-800',
};

export default function ResultApprovalPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const managers = ['institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost'] as const;
  const canApprove = isSuperAdmin || hasRole(...managers);
  const canSubmit = canApprove || hasRole('teacher', 'class_teacher', 'lecturer');
  const bands = ((institution?.grading_system as { scale?: GradeBand[] } | undefined)?.scale) ?? [];

  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const scope = toScope(scopeState, tertiary);
  const patch = (p: Partial<ScopeState>) => setScopeState((s) => ({ ...s, ...p }));
  const [termId, setTermId] = useState('');
  useEffect(() => { setTermId(''); }, [scopeState.sessionId]);

  const terms = useTerms(scopeState.sessionId || null);
  const publication = usePublication(scope, termId);
  const raw = useCompiledRaw(scope, termId);
  const setStatus = useSetResultStatus(institutionId ?? '', scope ?? { sessionId: '' }, termId);

  const compiled = useMemo(() => (raw.data ? buildCompiled(raw.data, bands, tertiary) : null), [raw.data, bands, tertiary]);
  const ranked = useMemo(() => compiled ? [...compiled.students].sort((a, b) => a.position - b.position) : [], [compiled]);
  const termName = terms.data?.find((t) => t.id === termId)?.name ?? '';

  const buildCore = (row: CompiledStudent): (() => ReportCardCore) => () => {
    const taken = compiled!.subjects.filter((s) => row.cells[s.id]?.taken);
    return {
      institution: {
        name: institution!.name, address: institution!.address,
        contact: institution!.phone || institution!.email, motto: institution!.motto, logoUrl: institution!.logo_url,
      },
      student: { name: `${row.student.last_name} ${row.student.first_name}`, admissionNumber: row.student.admission_number, level: row.student.current_level },
      termLabel: termName,
      subjects: taken.map((s) => {
        const c = row.cells[s.id]; const band = gradeFor(c.percent, bands);
        return { title: s.title, total: c.total, max: compiled!.subjectMax, grade: c.grade ?? '', remark: band?.remark ?? '' };
      }),
      summary: { total: row.totalScore, obtainable: taken.length * compiled!.subjectMax, average: row.average, position: row.position, gpa: row.gpa, classSize: ranked.length },
      gradeKey: bands.map((b) => ({ grade: b.grade, range: `${b.min}-${b.max}`, remark: b.remark })),
    };
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const status: ResultStatus = publication.data?.status ?? 'draft';
  const ready = scope && termId;

  const act = (next: ResultStatus, msg: string) =>
    setStatus.mutate(next, { onSuccess: () => toast.success(msg), onError: (e: Error) => toast.error(e.message) });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Results &amp; approval</h1>
        <p className="text-sm text-muted-foreground">Compile, approve and publish term results — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <ScopeSelector institutionId={institutionId} tertiary={tertiary} value={scopeState} onChange={patch} />
          <div className="max-w-xs space-y-1.5">
            <Label>Term</Label>
            <select className={selectClass} value={termId} onChange={(e) => setTermId(e.target.value)} disabled={!scopeState.sessionId}>
              <option value="">Select term</option>
              {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {!ready && (
        <p className="text-center text-sm text-muted-foreground">
          Choose a session, {tertiary ? 'programme' : 'class arm'} and term to compile results.
        </p>
      )}

      {ready && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Status</CardTitle>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status]}`}>{status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === 'draft' && canSubmit && (
                  <Button size="sm" onClick={() => act('submitted', 'Submitted for approval')} disabled={setStatus.isPending}>
                    <Send className="mr-2 h-4 w-4" /> Submit for approval
                  </Button>
                )}
                {status === 'submitted' && (
                  <>
                    {canApprove && (
                      <Button size="sm" onClick={() => act('approved', 'Results approved')} disabled={setStatus.isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                      </Button>
                    )}
                    {canSubmit && (
                      <Button size="sm" variant="outline" onClick={() => act('draft', 'Returned to draft')} disabled={setStatus.isPending}>
                        <Undo2 className="mr-2 h-4 w-4" /> Return to draft
                      </Button>
                    )}
                  </>
                )}
                {status === 'approved' && canApprove && (
                  <>
                    <Button size="sm" onClick={() => act('published', 'Results published')} disabled={setStatus.isPending}>
                      <Upload className="mr-2 h-4 w-4" /> Publish
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act('submitted', 'Approval reverted')} disabled={setStatus.isPending}>
                      <Undo2 className="mr-2 h-4 w-4" /> Unapprove
                    </Button>
                  </>
                )}
                {status === 'published' && canApprove && (
                  <Button size="sm" variant="outline" onClick={() => act('approved', 'Results unpublished')} disabled={setStatus.isPending}>
                    <Undo2 className="mr-2 h-4 w-4" /> Unpublish
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {status === 'published'
                ? 'Students and parents can now see these results on their portals.'
                : 'Results stay hidden from students and parents until published.'}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Broadsheet · {ranked.length} students</CardTitle></CardHeader>
            <CardContent>
              {raw.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
              {!raw.isLoading && compiled && compiled.subjects.length === 0 && (
                <p className="text-sm text-muted-foreground">No scores recorded for this class and term yet.</p>
              )}
              {!raw.isLoading && compiled && compiled.subjects.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Pos</th>
                        <th className="px-2 py-2 font-medium">Student</th>
                        {compiled.subjects.map((s) => (
                          <th key={s.id} className="px-2 py-2 text-center font-medium" title={s.title}>
                            {s.code || s.title.slice(0, 8)}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium">Total</th>
                        <th className="px-2 py-2 text-center font-medium">Avg %</th>
                        {tertiary && <th className="px-2 py-2 text-center font-medium">GPA</th>}
                        <th className="px-2 py-2 text-center font-medium">Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((row) => (
                        <tr key={row.student.id} className="border-t">
                          <td className="px-2 py-1.5 text-center font-medium">{row.position}</td>
                          <td className="whitespace-nowrap px-2 py-1.5">{row.student.last_name} {row.student.first_name}</td>
                          {compiled.subjects.map((s) => {
                            const c = row.cells[s.id];
                            return (
                              <td key={s.id} className="px-2 py-1.5 text-center">
                                {c?.taken ? <>{c.total}{c.grade && <span className="ml-1 text-[10px] text-muted-foreground">{c.grade}</span>}</> : <span className="text-muted-foreground">–</span>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center font-medium">{row.totalScore}</td>
                          <td className="px-2 py-1.5 text-center">{row.average.toFixed(1)}</td>
                          {tertiary && <td className="px-2 py-1.5 text-center">{row.gpa != null ? row.gpa.toFixed(2) : '—'}</td>}
                          <td className="px-2 py-1.5 text-center"><ReportCardButton studentId={row.student.id} termId={termId} assemble={buildCore(row)} label="PDF" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
