import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, Megaphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, Programmes } from '../academics/academics-api';
import { useAllArms } from '../attendance/attendance-api';
import { useSendAnnouncement, AUDIENCES, CATEGORIES } from './notifications-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

export default function AnnouncementsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const canSend = isSuperAdmin || hasRole(
    'institution_admin', 'principal', 'vice_principal', 'registrar', 'academic_officer', 'proprietor', 'rector', 'provost', 'dean', 'head_of_department');

  const arms = useAllArms(institutionId ?? '');
  const programmes = Programmes.useList(institutionId ?? '');
  const send = useSendAnnouncement();

  const [audience, setAudience] = useState('all');
  const [scopeId, setScopeId] = useState('');
  const [level, setLevel] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [includeGuardians, setIncludeGuardians] = useState(true);
  const [channels, setChannels] = useState({ email: false, sms: false, whatsapp: false });

  const studentAudience = ['all', 'all_students', 'class', 'programme'].includes(audience);

  const submit = () => {
    if (!title.trim()) { toast.error('Add a title'); return; }
    if (audience === 'class' && !scopeId) { toast.error('Choose a class'); return; }
    if (audience === 'programme' && !scopeId) { toast.error('Choose a programme'); return; }
    const chans = Object.entries(channels).filter(([, v]) => v).map(([k]) => k);

    send.mutate({
      audience, scope_id: scopeId || null, level: level || null,
      title: title.trim(), body: body.trim(), category, link: null,
      channels: chans, include_guardians: studentAudience && includeGuardians,
    }, {
      onSuccess: (r) => {
        toast.success(`Posted to ${r.notifications} inbox${r.notifications === 1 ? '' : 'es'}${r.queued_messages > 0 ? ` · ${r.queued_messages} message${r.queued_messages === 1 ? '' : 's'} queued` : ''}`);
        setTitle(''); setBody('');
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canSend) {
    return <div className="py-16 text-center text-sm text-muted-foreground">You don’t have permission to send announcements.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Send announcement</h1>
          <p className="text-sm text-muted-foreground">{institution?.name}</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience">
              <select className={selectClass} value={audience} onChange={(e) => { setAudience(e.target.value); setScopeId(''); }}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>

            {audience === 'class' && (
              <Field label="Class">
                <select className={selectClass} value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">Select class</option>
                  {arms.data?.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </Field>
            )}
            {audience === 'programme' && (
              <>
                <Field label="Programme">
                  <select className={selectClass} value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                    <option value="">Select programme</option>
                    {programmes.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Level (optional)"><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="100" /></Field>
              </>
            )}

            <Field label="Category">
              <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mid-term break" /></Field>
          <Field label="Message"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement…" /></Field>

          {studentAudience && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Also notify parents / guardians</span>
              <Switch checked={includeGuardians} onCheckedChange={setIncludeGuardians} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Delivery</Label>
            <p className="text-xs text-muted-foreground">Always posted to the in-app inbox. Add external channels below (sent once provider credentials are configured).</p>
            <div className="grid grid-cols-3 gap-2">
              {(['email', 'sms', 'whatsapp'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setChannels((s) => ({ ...s, [c]: !s[c] }))}
                  className={`rounded-md border px-3 py-2 text-sm capitalize ${channels[c] ? 'border-primary bg-primary/5 font-medium' : ''}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
