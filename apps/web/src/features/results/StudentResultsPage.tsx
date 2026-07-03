import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary } from '../academics/academics-api';
import { gradeFor, type GradeBand } from './results-api';
import { ReportCardButton, type ReportCardCore } from './report-card';
import {
  useMyStudents, useAllTerms, useStudentTermResult, useStudentPosition,
} from './student-results-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

export default function StudentResultsPage() {
  const { institution, institutionId } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const bands = ((institution?.grading_system as { scale?: GradeBand[] } | undefined)?.scale) ?? [];

  const students = useMyStudents();
  const terms = useAllTerms(institutionId ?? '');

  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');

  // Auto-select when there's exactly one student, and default to the current term.
  useEffect(() => { if (!studentId && students.data?.length === 1) setStudentId(students.data[0].id); }, [students.data, studentId]);
  useEffect(() => { if (!termId && terms.data?.length) setTermId((terms.data.find((t) => t.isCurrent) ?? terms.data[terms.data.length - 1]).id); }, [terms.data, termId]);

  const result = useStudentTermResult(studentId, termId);
  const position = useStudentPosition(studentId, termId);

  const student = students.data?.find((s) => s.id === studentId);
  const term = terms.data?.find((t) => t.id === termId);

  const computed = useMemo(() => {
    if (!result.data) return null;
    const { subjectMax, rows } = result.data;
    const subjects = rows.map((r) => {
      const percent = subjectMax ? (r.total / subjectMax) * 100 : 0;
      const band = gradeFor(percent, bands);
      return { ...r, percent, grade: band?.grade ?? '—', remark: band?.remark ?? '', point: band?.point ?? null };
    });
    const totalScore = subjects.reduce((s, r) => s + r.total, 0);
    const obtainable = subjects.length * subjectMax;
    const average = obtainable ? (totalScore / obtainable) * 100 : 0;
    let gpa: number | null = null;
    if (tertiary) {
      let pts = 0, units = 0;
      for (const r of subjects) if (r.creditUnits && r.point != null) { pts += r.point * r.creditUnits; units += r.creditUnits; }
      gpa = units ? pts / units : null;
    }
    return { subjectMax, subjects, totalScore, obtainable, average, gpa };
  }, [result.data, bands, tertiary]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const assemble = (): ReportCardCore => ({
    institution: {
      name: institution!.name, address: institution!.address,
      contact: institution!.phone || institution!.email, motto: institution!.motto, logoUrl: institution!.logo_url,
    },
    student: { name: `${student!.last_name} ${student!.first_name}`, admissionNumber: student!.admission_number, level: student!.current_level },
    termLabel: term?.label ?? '',
    subjects: (computed?.subjects ?? []).map((r) => ({ title: r.title, total: r.total, max: computed!.subjectMax, grade: r.grade, remark: r.remark })),
    summary: { total: computed?.totalScore ?? 0, obtainable: computed?.obtainable ?? 0, average: computed?.average ?? 0, position: position.data ?? null, gpa: computed?.gpa ?? null },
    gradeKey: bands.map((b) => ({ grade: b.grade, range: `${b.min}-${b.max}`, remark: b.remark })),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Results</h1>
        <p className="text-sm text-muted-foreground">Published term results — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <select className={selectClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.admission_number}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Term</Label>
            <select className={selectClass} value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">Select term</option>
              {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (current)' : ''}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {studentId && termId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{student?.first_name} {student?.last_name} · {term?.name}</CardTitle>
            {computed && computed.subjects.length > 0 && (
              <ReportCardButton studentId={studentId} termId={termId} assemble={assemble} />
            )}
          </CardHeader>
          <CardContent>
            {result.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
            {!result.isLoading && (!computed || computed.subjects.length === 0) && (
              <p className="text-sm text-muted-foreground">No results to show. They may not be published yet for this term.</p>
            )}
            {computed && computed.subjects.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Subject</th>
                        <th className="px-2 py-2 text-center font-medium">Score</th>
                        <th className="px-2 py-2 text-center font-medium">%</th>
                        <th className="px-2 py-2 text-center font-medium">Grade</th>
                        <th className="px-2 py-2 font-medium">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.subjects.map((r) => (
                        <tr key={r.subjectId} className="border-t">
                          <td className="px-2 py-1.5">{r.title}</td>
                          <td className="px-2 py-1.5 text-center">{r.total}/{computed.subjectMax}</td>
                          <td className="px-2 py-1.5 text-center">{r.percent.toFixed(1)}</td>
                          <td className="px-2 py-1.5 text-center font-medium">{r.grade}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{r.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap gap-6 border-t pt-4 text-sm">
                  <div><span className="text-muted-foreground">Total</span><div className="text-lg font-semibold">{computed.totalScore}/{computed.obtainable}</div></div>
                  <div><span className="text-muted-foreground">Average</span><div className="text-lg font-semibold">{computed.average.toFixed(1)}%</div></div>
                  {position.data != null && <div><span className="text-muted-foreground">Position</span><div className="text-lg font-semibold">{position.data}</div></div>}
                  {tertiary && computed.gpa != null && <div><span className="text-muted-foreground">GPA</span><div className="text-lg font-semibold">{computed.gpa.toFixed(2)}</div></div>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
