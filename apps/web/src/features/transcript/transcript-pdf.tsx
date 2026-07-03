import { Document as PdfDoc, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import type { Transcript } from './transcript-api';

export interface TranscriptBrand { name: string; logoUrl?: string | null; address?: string | null; primaryColor?: string | null }
export interface TranscriptStudent { name: string; admission: string }

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 52, paddingHorizontal: 44, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  logo: { width: 42, height: 42, marginRight: 10, objectFit: 'contain' },
  inst: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 8, color: '#6b7280', marginTop: 1 },
  rule: { height: 2.5, marginTop: 8, marginBottom: 10, borderRadius: 2 },
  docTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textAlign: 'center', marginBottom: 8 },
  studentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, fontSize: 10 },
  termHead: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', backgroundColor: '#f3f4f6', paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 3, paddingHorizontal: 6 },
  th: { flexDirection: 'row', backgroundColor: '#fafafa', paddingVertical: 3, paddingHorizontal: 6, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  cCode: { width: '14%' }, cTitle: { width: '42%' }, cUnits: { width: '10%', textAlign: 'center' },
  cScore: { width: '12%', textAlign: 'center' }, cGrade: { width: '10%', textAlign: 'center' }, cGp: { width: '12%', textAlign: 'center' },
  termFoot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, paddingVertical: 3, paddingHorizontal: 6, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  summary: { marginTop: 14, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, flexDirection: 'row', justifyContent: 'space-around' },
  sumLabel: { fontSize: 8, color: '#6b7280' }, sumVal: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 5 },
});

function TranscriptPDF({ transcript, brand, student }: { transcript: Transcript; brand: TranscriptBrand; student: TranscriptStudent }) {
  const color = brand.primaryColor || '#1d4ed8';
  const meta = [brand.address].filter(Boolean).join('  •  ');
  return (
    <PdfDoc>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {brand.logoUrl ? <Image style={styles.logo} src={brand.logoUrl} /> : null}
          <View><Text style={styles.inst}>{brand.name}</Text>{meta ? <Text style={styles.meta}>{meta}</Text> : null}</View>
        </View>
        <View style={[styles.rule, { backgroundColor: color }]} />
        <Text style={styles.docTitle}>OFFICIAL ACADEMIC TRANSCRIPT</Text>

        <View style={styles.studentRow}>
          <Text>Student: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{student.name}</Text></Text>
          <Text>Reg. No: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{student.admission || '—'}</Text></Text>
        </View>

        {transcript.terms.length === 0 && <Text style={{ color: '#6b7280' }}>No published results on record.</Text>}

        {transcript.terms.map((t, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.termHead}>{t.sessionName} — {t.termName}</Text>
            <View style={styles.th}>
              <Text style={styles.cCode}>Code</Text><Text style={styles.cTitle}>Course</Text><Text style={styles.cUnits}>Units</Text>
              <Text style={styles.cScore}>Score</Text><Text style={styles.cGrade}>Grade</Text><Text style={styles.cGp}>Pts</Text>
            </View>
            {t.courses.map((c, j) => (
              <View key={j} style={styles.tr}>
                <Text style={styles.cCode}>{c.code}</Text><Text style={styles.cTitle}>{c.title}</Text>
                <Text style={styles.cUnits}>{c.units}</Text><Text style={styles.cScore}>{c.score.toFixed(0)}</Text>
                <Text style={styles.cGrade}>{c.grade}</Text><Text style={styles.cGp}>{c.point.toFixed(1)}</Text>
              </View>
            ))}
            <View style={styles.termFoot}>
              <Text>Credits: {t.units}</Text><Text>GPA: {t.gpa.toFixed(2)}</Text><Text>CGPA: {t.cgpa.toFixed(2)}</Text>
            </View>
          </View>
        ))}

        {transcript.terms.length > 0 && (
          <View style={styles.summary}>
            <View><Text style={styles.sumLabel}>Total credit units</Text><Text style={styles.sumVal}>{transcript.totalUnits}</Text></View>
            <View><Text style={styles.sumLabel}>Cumulative GPA</Text><Text style={[styles.sumVal, { color }]}>{transcript.cgpa.toFixed(2)}</Text></View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Computer-generated transcript — confirm authenticity with the registrar. NegoLinks Education ERP.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </PdfDoc>
  );
}

export async function generateTranscriptBlob(transcript: Transcript, brand: TranscriptBrand, student: TranscriptStudent): Promise<Blob> {
  return pdf(<TranscriptPDF transcript={transcript} brand={brand} student={student} />).toBlob();
}

export function DownloadTranscriptButton({ transcript, brand, student, disabled }: {
  transcript: Transcript; brand: TranscriptBrand; student: TranscriptStudent; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const blob = await generateTranscriptBlob(transcript, brand, student);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `transcript_${(student.admission || student.name).replace(/[^\w\d-]+/g, '_')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };
  return (
    <Button onClick={onClick} disabled={disabled || busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download transcript
    </Button>
  );
}
