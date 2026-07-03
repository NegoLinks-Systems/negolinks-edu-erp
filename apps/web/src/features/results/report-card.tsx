import { useState } from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../../lib/supabase';

export interface ReportSubjectRow { title: string; total: number; max: number; grade: string; remark: string; }
export interface ReportCardCore {
  institution: { name: string; address?: string | null; contact?: string | null; motto?: string | null; logoUrl?: string | null };
  student: { name: string; admissionNumber: string; level?: string | null };
  termLabel: string;
  subjects: ReportSubjectRow[];
  summary: { total: number; obtainable: number; average: number; position?: number | null; gpa?: number | null; classSize?: number | null };
  gradeKey: { grade: string; range: string; remark: string }[];
}
export interface ReportCardData extends ReportCardCore { verifyUrl: string; qrDataUrl: string; }

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#0f172a', fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 8, marginBottom: 8 },
  logo: { width: 46, height: 46, objectFit: 'contain', marginRight: 10 },
  instName: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  instMeta: { fontSize: 8, color: '#475569', marginTop: 2 },
  motto: { fontSize: 8, fontStyle: 'italic', color: '#475569', marginTop: 1 },
  title: { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 6 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  infoCell: { width: '50%', marginBottom: 2 },
  label: { color: '#64748b' },
  table: { borderWidth: 1, borderColor: '#cbd5e1', marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th: { backgroundColor: '#f1f5f9', fontFamily: 'Helvetica-Bold', padding: 4 },
  td: { padding: 4 },
  cSubject: { width: '46%' }, cNum: { width: '13%', textAlign: 'center' }, cGrade: { width: '13%', textAlign: 'center' }, cRemark: { width: '28%' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 6 },
  sumCell: { width: '25%', marginBottom: 4 },
  sumVal: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  qr: { width: 64, height: 64 },
  verifyText: { fontSize: 7, color: '#64748b', maxWidth: 360 },
  keyTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 3 },
  keyRow: { flexDirection: 'row', flexWrap: 'wrap' },
  keyItem: { fontSize: 7, color: '#475569', marginRight: 10, marginBottom: 2 },
});

function ReportCard({ data }: { data: ReportCardData }) {
  const i = data.institution;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          {i.logoUrl ? <Image src={i.logoUrl} style={s.logo} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.instName}>{i.name}</Text>
            {i.address ? <Text style={s.instMeta}>{i.address}</Text> : null}
            {i.contact ? <Text style={s.instMeta}>{i.contact}</Text> : null}
            {i.motto ? <Text style={s.motto}>{i.motto}</Text> : null}
          </View>
        </View>

        <Text style={s.title}>STUDENT REPORT CARD</Text>

        <View style={s.infoRow}>
          <Text style={s.infoCell}><Text style={s.label}>Name: </Text>{data.student.name}</Text>
          <Text style={s.infoCell}><Text style={s.label}>Admission No: </Text>{data.student.admissionNumber}</Text>
          {data.student.level ? <Text style={s.infoCell}><Text style={s.label}>Class/Level: </Text>{data.student.level}</Text> : null}
          <Text style={s.infoCell}><Text style={s.label}>Term/Session: </Text>{data.termLabel}</Text>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.cSubject]}>Subject</Text>
            <Text style={[s.th, s.cNum]}>Score</Text>
            <Text style={[s.th, s.cNum]}>Max</Text>
            <Text style={[s.th, s.cGrade]}>Grade</Text>
            <Text style={[s.th, s.cRemark]}>Remark</Text>
          </View>
          {data.subjects.map((r, idx) => (
            <View style={s.tr} key={idx}>
              <Text style={[s.td, s.cSubject]}>{r.title}</Text>
              <Text style={[s.td, s.cNum]}>{r.total}</Text>
              <Text style={[s.td, s.cNum]}>{r.max}</Text>
              <Text style={[s.td, s.cGrade]}>{r.grade}</Text>
              <Text style={[s.td, s.cRemark]}>{r.remark}</Text>
            </View>
          ))}
        </View>

        <View style={s.summaryRow}>
          <View style={s.sumCell}><Text style={s.label}>Total</Text><Text style={s.sumVal}>{data.summary.total}/{data.summary.obtainable}</Text></View>
          <View style={s.sumCell}><Text style={s.label}>Average</Text><Text style={s.sumVal}>{data.summary.average.toFixed(1)}%</Text></View>
          {data.summary.position != null && (
            <View style={s.sumCell}><Text style={s.label}>Position</Text><Text style={s.sumVal}>{ordinal(data.summary.position)}{data.summary.classSize ? ` / ${data.summary.classSize}` : ''}</Text></View>
          )}
          {data.summary.gpa != null && (
            <View style={s.sumCell}><Text style={s.label}>GPA</Text><Text style={s.sumVal}>{data.summary.gpa.toFixed(2)}</Text></View>
          )}
        </View>

        {data.gradeKey.length > 0 && (
          <>
            <Text style={s.keyTitle}>Grading key</Text>
            <View style={s.keyRow}>
              {data.gradeKey.map((k, idx) => (
                <Text style={s.keyItem} key={idx}>{k.grade}: {k.range} ({k.remark})</Text>
              ))}
            </View>
          </>
        )}

        <View style={s.footer}>
          <Text style={s.verifyText}>
            Verify this document at {data.verifyUrl}. This report is system-generated and valid with the QR code. Generated by NegoLinks Education ERP.
          </Text>
          <Image src={data.qrDataUrl} style={s.qr} />
        </View>
      </Page>
    </Document>
  );
}

function ordinal(n: number) {
  const sfx = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]);
}

export async function generateReportCardBlob(data: ReportCardData): Promise<Blob> {
  return pdf(<ReportCard data={data} />).toBlob();
}

/* Mints the verification token, builds the QR, and downloads the PDF. */
export function ReportCardButton({ studentId, termId, assemble, label = 'Report card' }: {
  studentId: string; termId: string; assemble: () => ReportCardCore; label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    try {
      setBusy(true);
      const { data: token, error } = await supabase.rpc('get_report_card_token', { _student: studentId, _term: termId });
      if (error) throw error;
      const verifyUrl = `${window.location.origin}/verify/${token}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
      const core = assemble();
      const blob = await generateReportCardBlob({ ...core, verifyUrl, qrDataUrl });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${core.student.admissionNumber || studentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{label}
    </Button>
  );
}
