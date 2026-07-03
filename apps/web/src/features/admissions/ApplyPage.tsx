import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, GraduationCap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { BRAND } from '../../lib/brand';
import { isTertiary } from '../academics/academics-api';
import { useSubmitApplication, usePublicInstitution, resolveSchoolSlug } from './admissions-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

export default function ApplyPage() {
  // Logged-in admins can preview via their tenant; the public resolves by subdomain / ?school=.
  const { institution: tenantInst, institutionId: tenantId } = useTenant();
  const pub = usePublicInstitution();
  const submit = useSubmitApplication();

  const inst = (tenantInst ?? pub.data) as any;
  const institutionId: string | null = tenantId ?? pub.data?.id ?? null;
  const tertiary = isTertiary(inst?.type);
  const brand = inst?.primary_color || '#1d4ed8';

  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', dob: '', gender: '', address: '', prior_school: '', intended: '' });
  const [ref, setRef] = useState<string | null>(null);

  const onSubmit = () => {
    if (!institutionId) { toast.error('Could not identify the institution'); return; }
    if (!f.first.trim() || !f.last.trim()) { toast.error('Enter your name'); return; }
    submit.mutate({ institutionId, ...f }, {
      onSuccess: (num) => setRef(num),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  // Still resolving the institution from the URL.
  if (!tenantId && !!resolveSchoolSlug() && pub.isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;
  }

  // No institution could be resolved from the link.
  if (!institutionId) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">We couldn’t identify your institution</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Please open this page from your institution’s official admissions link — for example
          <br /><span className="font-mono">https://yourschool.negolinks.com/apply</span>.
        </p>
      </div>
    );
  }

  if (ref) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="text-lg font-semibold">Application received</h1>
            <p className="text-sm text-muted-foreground">Keep your application number for reference:</p>
            <p className="font-mono text-xl font-bold">{ref}</p>
            <p className="text-xs text-muted-foreground">{inst?.name} will be in touch about the next steps.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
      <div className="h-1.5 w-full rounded-full" style={{ background: brand }} />
      <header className="flex items-center gap-3">
        {inst?.logo_url ? <img src={inst.logo_url} alt="" className="h-12 w-12 rounded object-contain" /> : <GraduationCap className="h-8 w-8" style={{ color: brand }} />}
        <div>
          <h1 className="text-xl font-semibold">Apply to {inst?.name}</h1>
          <p className="text-sm text-muted-foreground">{tertiary ? 'Admission application' : 'Enrolment application'}</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name"><Input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
            <Field label="Last name"><Input value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Date of birth"><Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
            <Field label="Gender">
              <select className={selectClass} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </Field>
          </div>
          <Field label={tertiary ? 'Programme applying for' : 'Class applying for'}>
            <Input value={f.intended} onChange={(e) => setF({ ...f, intended: e.target.value })} placeholder={tertiary ? 'e.g. BSc Computer Science' : 'e.g. JSS1 or SS1'} />
          </Field>
          <Field label={tertiary ? 'Previous institution (optional)' : 'Previous school (optional)'}>
            <Input value={f.prior_school} onChange={(e) => setF({ ...f, prior_school: e.target.value })} />
          </Field>
          <Field label="Home address (optional)"><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>

          <Button className="w-full" onClick={onSubmit} disabled={submit.isPending} style={{ background: brand }}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit application
          </Button>
        </CardContent>
      </Card>
      <p className="text-center text-[11px] text-muted-foreground">Powered by {BRAND.productShort}</p>
    </div>
  );
}
