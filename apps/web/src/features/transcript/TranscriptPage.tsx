import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, GraduationCap } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary } from '../academics/academics-api';
import { useMyStudents } from '../results/student-results-api';
import { useTranscript, buildTranscript, normalizeBands, useStudentSearch } from './transcript-api';
import { DownloadTranscriptButton, type TranscriptBrand } from './transcript-pdf';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

type Picked = { id: string; name: string; admission: string };

export default function TranscriptPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const isStaff = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'registrar', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost', 'lecturer', 'teacher', 'class_teacher');

  const [picked, setPicked] = useState<Picked | null>(null);
  const [query, setQuery] = useState('');
  const search = useStudentSearch(institutionId ?? '', isStaff ? query : '');
  const myStudents = useMyStudents();

  // Auto-select for a single-child family account
  useEffect(() => {
    if (!isStaff && !picked && myStudents.data?.length === 1) {
      const s = myStudents.data[0];
      setPicked({ id: s.id, name: `${s.first_name} ${s.last_name}`, admission: s.admission_number ?? '' });
    }
  }, [isStaff, picked, myStudents.data]);

  const transcriptRows = useTranscript(picked?.id ?? null);
  const bands = useMemo(() => normalizeBands((institution as any)?.grading_system), [institution]);
  const transcript = useMemo(() => buildTranscript(transcriptRows.data ?? [], bands), [transcriptRows.data, bands]);

  const inst = institution as any;
  const brand: TranscriptBrand = {
    name: institution?.name ?? 'Institution', logoUrl: inst?.logo_url ?? null,
    address: inst?.address ?? null, primaryColor: inst?.primary_color ?? inst?.brand_primary ?? null,
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!tertiary) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Transcripts apply to tertiary institutions.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Transcript</h1>
          <p className="text-sm text-muted-foreground">Cumulative academic record — {institution?.name}</p>
        </div>
      </header>

      {/* Student selection */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          {isStaff ? (
            picked ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{picked.name}<span className="ml-2 text-xs text-muted-foreground">{picked.admission}</span></span>
                <button className="text-xs font-medium text-primary" onClick={() => { setPicked(null); setQuery(''); }}>Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search student by name or reg. no." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {query.trim().length >= 2 && (
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {search.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
                    {search.data?.map((s) => (
                      <button key={s.id} onClick={() => { setPicked(s); setQuery(''); }}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                        <span>{s.name}</span><span className="text-xs text-muted-foreground">{s.admission}</span>
                      </button>
                    ))}
                    {!search.isLoading && !search.data?.length && <p className="px-1 text-sm text-muted-foreground">No matches.</p>}
                  </div>
                )}
              </>
            )
          ) : (
            <div className="space-y-1.5">
              <Label>Student</Label>
              <select className={selectClass} value={picked?.id ?? ''} onChange={(e) => {
                const s = myStudents.data?.find((x) => x.id === e.target.value);
                setPicked(s ? { id: s.id, name: `${s.first_name} ${s.last_name}`, admission: s.admission_number ?? '' } : null);
              }}>
                <option value="">Select…</option>
                {myStudents.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {picked && (
        transcriptRows.isLoading ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : transcript.terms.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No published results on record for this student.</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6">
                {transcript.terms.map((t, i) => (
                  <div key={i}>
                    <p className="mb-1 text-sm font-medium">{t.sessionName} — {t.termName}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                          <tr><th className="py-1">Code</th><th className="py-1">Course</th><th className="py-1 text-center">Units</th><th className="py-1 text-center">Score</th><th className="py-1 text-center">Grade</th><th className="py-1 text-center">Pts</th></tr>
                        </thead>
                        <tbody>
                          {t.courses.map((c, j) => (
                            <tr key={j} className="border-t">
                              <td className="py-1">{c.code}</td><td className="py-1">{c.title}</td>
                              <td className="py-1 text-center">{c.units}</td><td className="py-1 text-center">{c.score.toFixed(0)}</td>
                              <td className="py-1 text-center">{c.grade}</td><td className="py-1 text-center">{c.point.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-1 flex justify-end gap-4 text-xs font-medium">
                      <span>Credits {t.units}</span><span>GPA {t.gpa.toFixed(2)}</span><span>CGPA {t.cgpa.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-around rounded-lg border p-4">
                  <div className="text-center"><p className="text-xs text-muted-foreground">Total units</p><p className="text-xl font-semibold">{transcript.totalUnits}</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Cumulative GPA</p><p className="text-xl font-semibold text-primary">{transcript.cgpa.toFixed(2)}</p></div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <DownloadTranscriptButton transcript={transcript} brand={brand} student={{ name: picked.name, admission: picked.admission }} />
            </div>
          </>
        )
      )}
    </div>
  );
}
