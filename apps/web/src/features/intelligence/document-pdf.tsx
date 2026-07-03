import { Document as PdfDoc, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

export interface InstitutionBrand {
  name: string; logoUrl?: string | null; address?: string | null;
  phone?: string | null; email?: string | null; primaryColor?: string | null;
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 56, fontSize: 11, fontFamily: 'Helvetica', color: '#1f2937', lineHeight: 1.5 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logo: { width: 48, height: 48, marginRight: 12, objectFit: 'contain' },
  instName: { fontSize: 17, fontFamily: 'Helvetica-Bold' },
  instMeta: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  rule: { height: 3, marginTop: 10, marginBottom: 18, borderRadius: 2 },
  date: { fontSize: 10, color: '#6b7280', marginBottom: 14, textAlign: 'right' },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  para: { marginBottom: 10, textAlign: 'justify' },
  footer: { position: 'absolute', bottom: 28, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
});

export interface DocPayload { title: string; body: string; docType?: string; date?: string }

function DocumentPDF({ doc, brand }: { doc: DocPayload; brand: InstitutionBrand }) {
  const color = brand.primaryColor || '#1d4ed8';
  const meta = [brand.address, brand.phone, brand.email].filter(Boolean).join('  •  ');
  const paragraphs = doc.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const dateStr = doc.date || new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <PdfDoc>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {brand.logoUrl ? <Image style={styles.logo} src={brand.logoUrl} /> : null}
          <View>
            <Text style={styles.instName}>{brand.name}</Text>
            {meta ? <Text style={styles.instMeta}>{meta}</Text> : null}
          </View>
        </View>
        <View style={[styles.rule, { backgroundColor: color }]} />

        <Text style={styles.date}>{dateStr}</Text>
        {doc.title ? <Text style={styles.title}>{doc.title}</Text> : null}

        {paragraphs.map((p, i) => <Text key={i} style={styles.para}>{p}</Text>)}

        <View style={styles.footer} fixed>
          <Text>{brand.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </PdfDoc>
  );
}

export async function generateDocumentBlob(doc: DocPayload, brand: InstitutionBrand): Promise<Blob> {
  return pdf(<DocumentPDF doc={doc} brand={brand} />).toBlob();
}

export function DownloadDocButton({ doc, brand, disabled }: { doc: DocPayload; brand: InstitutionBrand; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const blob = await generateDocumentBlob(doc, brand);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(doc.title || 'document').replace(/[^\w\d-]+/g, '_').slice(0, 60)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled || busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
    </Button>
  );
}
