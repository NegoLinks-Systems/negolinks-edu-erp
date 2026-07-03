import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, Save, FileText, Trash2, FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { useGenerateDocument, useDocuments, useSaveDocument, useDeleteDocument, DOC_TYPES } from './intelligence-api';
import { DownloadDocButton, type InstitutionBrand } from './document-pdf';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export default function IntelligencePage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canUse = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'registrar', 'academic_officer', 'proprietor', 'rector', 'provost', 'dean', 'head_of_department');

  const generate = useGenerateDocument();
  const docs = useDocuments(institutionId ?? '');
  const saveDoc = useSaveDocument(institutionId ?? '');
  const delDoc = useDeleteDocument(institutionId ?? '');

  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [sender, setSender] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [instructions, setInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);

  const inst = institution as any;
  const brand: InstitutionBrand = {
    name: institution?.name ?? 'Institution', logoUrl: inst?.logo_url ?? null,
    address: inst?.address ?? null, phone: inst?.phone ?? null, email: inst?.email ?? null,
    primaryColor: inst?.primary_color ?? inst?.brand_primary ?? null,
  };
  const dateDisplay = date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : undefined;

  const onGenerate = () => {
    if (!instructions.trim()) { toast.error('Describe what the document should say'); return; }
    generate.mutate(
      { institutionName: brand.name, docType, instructions: instructions.trim(), fields: { recipient, subject, sender, date: dateDisplay } },
      { onSuccess: (r) => { setTitle(r.title); setBody(r.body); setCurrentId(null); toast.success('Draft ready — review and edit below'); },
        onError: (e: Error) => toast.error(e.message) },
    );
  };

  const onSave = () => {
    if (!title.trim() || !body.trim()) { toast.error('Nothing to save yet'); return; }
    saveDoc.mutate(
      { id: currentId ?? undefined, doc_type: docType, title: title.trim(), body, instructions: instructions || null },
      { onSuccess: (d) => { setCurrentId(d.id); toast.success('Saved'); }, onError: (e: Error) => toast.error(e.message) },
    );
  };

  const openDoc = (d: { id: string; doc_type: string; title: string; body: string; instructions: string | null }) => {
    setDocType(d.doc_type); setTitle(d.title); setBody(d.body); setInstructions(d.instructions ?? ''); setCurrentId(d.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canUse) {
    return <div className="py-16 text-center text-sm text-muted-foreground">The Intelligence Engine is available to administrators.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <div>
          <h1 className="text-xl font-semibold">Intelligence Engine</h1>
          <p className="text-sm text-muted-foreground">Draft official documents — {institution?.name}</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document type">
              <select className={selectClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Addressed to (optional)"><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Parents of JSS 2 students" /></Field>
            <Field label="From / signatory (optional)"><Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="The Principal" /></Field>
            <div className="sm:col-span-2"><Field label="Subject (optional)"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumption date for second term" /></Field></div>
          </div>
          <Field label="What should it say?">
            <Textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="Key points the document should cover. The engine writes the full draft; leave blanks in [brackets] for anything it shouldn't invent." />
          </Field>
          <div className="flex justify-end">
            <Button onClick={onGenerate} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate draft
            </Button>
          </div>
        </CardContent>
      </Card>

      {(title || body) && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Body"><Textarea rows={16} value={body} onChange={(e) => setBody(e.target.value)} className="font-serif" /></Field>
            <p className="text-xs text-muted-foreground">Review carefully and fill any [bracketed] placeholders before sending.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onSave} disabled={saveDoc.isPending}>
                {saveDoc.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {currentId ? 'Update' : 'Save'}
              </Button>
              <DownloadDocButton doc={{ title, body, docType, date: dateDisplay }} brand={brand} disabled={!body.trim()} />
            </div>
          </CardContent>
        </Card>
      )}

      {!!docs.data?.length && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm font-medium">Saved documents</p>
            {docs.data.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.doc_type} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" title="Open" onClick={() => openDoc(d)}><FolderOpen className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => {
                    if (!confirm(`Delete "${d.title}"?`)) return;
                    delDoc.mutate(d.id, { onSuccess: () => { toast.success('Deleted'); if (currentId === d.id) setCurrentId(null); }, onError: (e: Error) => toast.error(e.message) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
