import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Plus, Star, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useTenant } from '../../providers/app-providers';
import type { Campus, Institution } from '../../lib/database.types';
import {
  identitySchema, contactSchema, localizationSchema, campusSchema, institutionTypes,
  useUpdateInstitution, useUploadAsset, useCampuses, useUpsertCampus, useDeleteCampus,
  signedAssetUrl,
  type IdentityForm, type ContactForm, type LocalizationForm, type CampusForm,
  type AssetKind, type GradeBand,
} from './settings-api';

/* --------------------------------- data ---------------------------------- */
const TYPE_LABELS: Record<string, string> = {
  primary_school: 'Primary school', secondary_school: 'Secondary school',
  combined_school: 'Combined primary & secondary', college: 'College',
  polytechnic: 'Polytechnic', university: 'University',
  professional_academy: 'Professional academy', vocational_center: 'Vocational centre',
  coaching_center: 'Coaching centre', learning_institute: 'Learning institute',
};
const ASSET_LABELS: Record<AssetKind, string> = {
  logo: 'Logo', letterhead: 'Letterhead', stamp: 'Official stamp', signature: 'Signature',
};
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'CAD', 'INR'];
const TIMEZONES = [
  'Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC',
];
const LOCALES = [
  ['en', 'English'], ['fr', 'French'], ['ar', 'Arabic'], ['sw', 'Swahili'],
  ['ha', 'Hausa'], ['yo', 'Yoruba'], ['ig', 'Igbo'],
];
const MODULES: [string, string][] = [
  ['admissions', 'Admissions'], ['academics', 'Academics & results'],
  ['cbt', 'Computer-based testing'], ['elearning', 'E-learning'],
  ['library', 'Library'], ['hostel', 'Hostel'], ['transport', 'Transport'],
  ['inventory', 'Inventory'], ['finance', 'Finance & fees'],
  ['parent_portal', 'Parent portal'], ['student_portal', 'Student portal'],
  ['communications', 'Communications'],
];
const DEFAULT_BANDS: GradeBand[] = [
  { grade: 'A', min: 70, max: 100, remark: 'Excellent', point: 5 },
  { grade: 'B', min: 60, max: 69, remark: 'Very good', point: 4 },
  { grade: 'C', min: 50, max: 59, remark: 'Credit', point: 3 },
  { grade: 'D', min: 45, max: 49, remark: 'Pass', point: 2 },
  { grade: 'E', min: 40, max: 44, remark: 'Weak pass', point: 1 },
  { grade: 'F', min: 0, max: 39, remark: 'Fail', point: 0 },
];

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

/* -------------------------- small presentational ------------------------- */
function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ------------------------------ asset uploader --------------------------- */
function AssetUploader({ kind, value, institutionId, canEdit }: {
  kind: AssetKind; value: string | null; institutionId: string; canEdit: boolean;
}) {
  const upload = useUploadAsset(institutionId);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { signedAssetUrl(value).then(setPreview); }, [value]);

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {preview
          ? <img src={preview} alt={ASSET_LABELS[kind]} className="h-full w-full object-contain" />
          : <span className="text-xs text-muted-foreground">None</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{ASSET_LABELS[kind]}</p>
        <p className="truncate text-xs text-muted-foreground">
          {kind === 'logo' || kind === 'letterhead' ? 'Shown on public documents' : 'Stored privately'}
        </p>
      </div>
      <label className={canEdit ? 'cursor-pointer' : 'pointer-events-none opacity-50'}>
        <input
          type="file" accept="image/*" className="sr-only" disabled={!canEdit}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            upload.mutate({ kind, file }, {
              onSuccess: () => toast.success(`${ASSET_LABELS[kind]} updated`),
              onError: (err: Error) => toast.error(err.message),
            });
            e.currentTarget.value = '';
          }}
        />
        <span className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium">
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </span>
      </label>
    </div>
  );
}

/* ------------------------------- identity -------------------------------- */
function IdentitySection({ inst, canEdit }: { inst: Institution; canEdit: boolean }) {
  const update = useUpdateInstitution(inst.id);
  const form = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      name: inst.name, type: inst.type, motto: inst.motto ?? '',
      primary_color: inst.primary_color, secondary_color: inst.secondary_color,
    },
  });
  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const primary = watch('primary_color');
  const secondary = watch('secondary_color');

  const onSubmit = (v: IdentityForm) =>
    update.mutate(v, {
      onSuccess: () => toast.success('Identity saved'),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity</CardTitle>
        <CardDescription>Name, type, and the colours used across the app and documents.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Institution name" error={errors.name?.message}>
          <Input {...register('name')} disabled={!canEdit} />
        </Field>
        <Field label="Institution type">
          <select className={selectClass} disabled={!canEdit} {...register('type')}>
            {institutionTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Motto" hint="Optional — appears under the name on letterheads." error={errors.motto?.message}>
            <Input {...register('motto')} disabled={!canEdit} />
          </Field>
        </div>
        {(['primary_color', 'secondary_color'] as const).map((key) => (
          <Field
            key={key}
            label={key === 'primary_color' ? 'Primary colour' : 'Secondary colour'}
            error={errors[key]?.message}
          >
            <div className="flex items-center gap-2">
              <input
                type="color" disabled={!canEdit}
                value={key === 'primary_color' ? primary : secondary}
                onChange={(e) => setValue(key, e.target.value, { shouldDirty: true })}
                className="h-10 w-12 rounded-md border"
              />
              <Input className="font-mono" disabled={!canEdit} {...register(key)} />
            </div>
          </Field>
        ))}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button onClick={handleSubmit(onSubmit)} disabled={!canEdit || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>

      <Separator />
      <CardHeader>
        <CardTitle>Branding assets</CardTitle>
        <CardDescription>Used automatically on report cards, certificates, invoices, and IDs.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(ASSET_LABELS) as AssetKind[]).map((kind) => (
          <AssetUploader
            key={kind} kind={kind} institutionId={inst.id} canEdit={canEdit}
            value={inst[kind === 'logo' ? 'logo_url'
              : kind === 'letterhead' ? 'letterhead_url'
              : kind === 'stamp' ? 'stamp_url' : 'signature_url']}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- contact -------------------------------- */
function ContactSection({ inst, canEdit }: { inst: Institution; canEdit: boolean }) {
  const update = useUpdateInstitution(inst.id);
  const { register, handleSubmit, formState: { errors } } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      email: inst.email ?? '', phone: inst.phone ?? '', whatsapp: inst.whatsapp ?? '',
      website: inst.website ?? '', address: inst.address ?? '',
      registration_number: inst.registration_number ?? '', tax_id: inst.tax_id ?? '',
    },
  });
  const onSubmit = (v: ContactForm) =>
    update.mutate(v, {
      onSuccess: () => toast.success('Contact details saved'),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact & registration</CardTitle>
        <CardDescription>How the institution is reached and identified on official documents.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} disabled={!canEdit} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} disabled={!canEdit} />
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp?.message}>
          <Input {...register('whatsapp')} disabled={!canEdit} />
        </Field>
        <Field label="Website" hint="Include https://" error={errors.website?.message}>
          <Input {...register('website')} disabled={!canEdit} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" error={errors.address?.message}>
            <Textarea rows={2} {...register('address')} disabled={!canEdit} />
          </Field>
        </div>
        <Field label="Registration number" error={errors.registration_number?.message}>
          <Input {...register('registration_number')} disabled={!canEdit} />
        </Field>
        <Field label="Tax ID" error={errors.tax_id?.message}>
          <Input {...register('tax_id')} disabled={!canEdit} />
        </Field>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSubmit(onSubmit)} disabled={!canEdit || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------ localization ----------------------------- */
function LocalizationSection({ inst, canEdit }: { inst: Institution; canEdit: boolean }) {
  const update = useUpdateInstitution(inst.id);
  const { register, handleSubmit } = useForm<LocalizationForm>({
    resolver: zodResolver(localizationSchema),
    defaultValues: { currency: inst.currency, timezone: inst.timezone, locale: inst.locale },
  });
  const onSubmit = (v: LocalizationForm) =>
    update.mutate(v, {
      onSuccess: () => toast.success('Localization saved'),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Localization</CardTitle>
        <CardDescription>Currency, time zone, and language for this institution.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-3">
        <Field label="Currency">
          <select className={selectClass} disabled={!canEdit} {...register('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Time zone">
          <select className={selectClass} disabled={!canEdit} {...register('timezone')}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Language">
          <select className={selectClass} disabled={!canEdit} {...register('locale')}>
            {LOCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSubmit(onSubmit)} disabled={!canEdit || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------- grading -------------------------------- */
function GradingSection({ inst, canEdit }: { inst: Institution; canEdit: boolean }) {
  const update = useUpdateInstitution(inst.id);
  const existing = (inst.grading_system as { scale?: GradeBand[] })?.scale;
  const [bands, setBands] = useState<GradeBand[]>(existing?.length ? existing : DEFAULT_BANDS);

  const set = (i: number, patch: Partial<GradeBand>) =>
    setBands((b) => b.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const save = () =>
    update.mutate({ grading_system: { scale: bands } }, {
      onSuccess: () => toast.success('Grading scale saved'),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grading scale</CardTitle>
        <CardDescription>Bands drive automatic grades, remarks, and GPA points on results.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
          <span>Grade</span><span>Min %</span><span>Max %</span><span>Remark</span><span>Point</span><span />
        </div>
        {bands.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_auto] gap-2">
            <Input value={b.grade} disabled={!canEdit} onChange={(e) => set(i, { grade: e.target.value })} />
            <Input type="number" value={b.min} disabled={!canEdit} onChange={(e) => set(i, { min: +e.target.value })} />
            <Input type="number" value={b.max} disabled={!canEdit} onChange={(e) => set(i, { max: +e.target.value })} />
            <Input value={b.remark} disabled={!canEdit} onChange={(e) => set(i, { remark: e.target.value })} />
            <Input type="number" value={b.point} disabled={!canEdit} onChange={(e) => set(i, { point: +e.target.value })} />
            <Button variant="ghost" size="icon" disabled={!canEdit}
              onClick={() => setBands((x) => x.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" disabled={!canEdit}
          onClick={() => setBands((b) => [...b, { grade: '', min: 0, max: 0, remark: '', point: 0 }])}>
          <Plus className="mr-2 h-4 w-4" /> Add band
        </Button>
        <Button onClick={save} disabled={!canEdit || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------- modules -------------------------------- */
function ModulesSection({ inst, canEdit }: { inst: Institution; canEdit: boolean }) {
  const update = useUpdateInstitution(inst.id);
  const enabled = (inst.enabled_modules ?? {}) as Record<string, boolean>;
  const [state, setState] = useState<Record<string, boolean>>(enabled);

  const save = () =>
    update.mutate({ enabled_modules: state }, {
      onSuccess: () => toast.success('Modules updated'),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modules</CardTitle>
        <CardDescription>Turn features on or off for this institution. Defaults follow its type.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {MODULES.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-sm font-medium">{label}</span>
            <Switch checked={!!state[key]} disabled={!canEdit}
              onCheckedChange={(v) => setState((s) => ({ ...s, [key]: v }))} />
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={!canEdit || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}

/* -------------------------------- campuses ------------------------------- */
function CampusesSection({ institutionId, canEdit }: { institutionId: string; canEdit: boolean }) {
  const { data: campuses, isLoading } = useCampuses(institutionId);
  const upsert = useUpsertCampus(institutionId);
  const remove = useDeleteCampus(institutionId);
  const [editing, setEditing] = useState<Partial<Campus> | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CampusForm>({
    resolver: zodResolver(campusSchema),
    defaultValues: { name: '', code: '', address: '', phone: '', email: '', is_main: false },
  });

  const startAdd = () => { setEditing({}); reset({ name: '', code: '', address: '', phone: '', email: '', is_main: false }); };
  const startEdit = (c: Campus) => {
    setEditing(c);
    reset({ name: c.name, code: c.code ?? '', address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '', is_main: c.is_main });
  };
  const onSubmit = (v: CampusForm) =>
    upsert.mutate({ ...v, id: editing?.id }, {
      onSuccess: () => { toast.success(editing?.id ? 'Campus updated' : 'Campus added'); setEditing(null); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Campuses</CardTitle>
          <CardDescription>Branches operating under this institution.</CardDescription>
        </div>
        {canEdit && !editing && (
          <Button size="sm" onClick={startAdd}><Plus className="mr-2 h-4 w-4" /> Add campus</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading campuses…</p>}
        {!isLoading && !campuses?.length && !editing && (
          <p className="text-sm text-muted-foreground">No campuses yet. Add your main campus to begin.</p>
        )}

        {campuses?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {c.name}
                {c.is_main && <Star className="h-3.5 w-3.5 fill-current text-amber-500" />}
              </p>
              <p className="truncate text-xs text-muted-foreground">{c.address || c.code || '—'}</p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>Edit</Button>
                <Button variant="ghost" size="icon"
                  onClick={() => remove.mutate(c.id, {
                    onSuccess: () => toast.success('Campus removed'),
                    onError: (e: Error) => toast.error(e.message),
                  })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {editing && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message}>
                <Input {...register('name')} />
              </Field>
              <Field label="Code" error={errors.code?.message}>
                <Input {...register('code')} />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <Input {...register('phone')} />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <Input {...register('email')} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" error={errors.address?.message}>
                  <Textarea rows={2} {...register('address')} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('is_main')} className="h-4 w-4" />
                Main campus
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing.id ? 'Update campus' : 'Add campus'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- page ---------------------------------- */
/* ------------------------------ public links ----------------------------- */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="icon" title="Copy"
          onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function PublicLinksSection({ inst }: { inst: Institution }) {
  const slug = String((inst as any).slug ?? '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://school.negolinks.com';
  const onSubdomain = typeof window !== 'undefined' && window.location.hostname.split('.')[0] === slug;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Public links</CardTitle>
        <CardDescription>Share these with prospective students and for document checks. They need no login.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          Your institution’s public identifier is <span className="font-mono font-semibold">{slug || '(no slug set)'}</span>.
          For the clean link to work, point the subdomain <span className="font-mono">{slug || 'yourschool'}.negolinks.com</span> at
          this deployment. The <span className="font-mono">?school=</span> link works on any domain.
        </div>
        <CopyRow label="Student registration — clean link (needs matching subdomain)" value={`${origin}/apply`} />
        {!onSubdomain && <CopyRow label="Student registration — works anywhere" value={`${origin}/apply?school=${slug}`} />}
        <Separator />
        <div className="space-y-1">
          <Label>Document verification</Label>
          <p className="text-xs text-muted-foreground">Each certificate/result QR code links to a URL of this shape:</p>
          <Input readOnly value={`${origin}/verify/<document-token>`} className="font-mono text-xs" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { institution, institutionId, isLoading, isSuperAdmin, hasRole } = useTenant();
  const canEdit = isSuperAdmin || hasRole('institution_admin', 'principal');

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading settings…
    </div>;
  }
  if (!institution || !institutionId) {
    return <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="text-lg font-semibold">No institution linked</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account isn’t attached to an institution yet. Ask a super admin to assign you.
      </p>
    </div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        {institution.logo_url
          ? <img src={institution.logo_url} alt="" className="h-12 w-12 rounded-md object-contain" />
          : <div className="h-12 w-12 rounded-md" style={{ background: 'var(--brand-primary)' }} />}
        <div>
          <h1 className="text-xl font-semibold">{institution.name}</h1>
          <p className="text-sm text-muted-foreground">{TYPE_LABELS[institution.type]} · Settings</p>
        </div>
      </header>

      {!canEdit && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view these settings but not change them. Editing needs an administrator or principal role.
        </div>
      )}

      <Tabs defaultValue="identity">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="identity">Identity & branding</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="localization">Localization</TabsTrigger>
          <TabsTrigger value="grading">Grading</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="campuses">Campuses</TabsTrigger>
          <TabsTrigger value="public">Public links</TabsTrigger>
        </TabsList>
        <TabsContent value="identity"><IdentitySection inst={institution} canEdit={canEdit} /></TabsContent>
        <TabsContent value="contact"><ContactSection inst={institution} canEdit={canEdit} /></TabsContent>
        <TabsContent value="localization"><LocalizationSection inst={institution} canEdit={canEdit} /></TabsContent>
        <TabsContent value="grading"><GradingSection inst={institution} canEdit={canEdit} /></TabsContent>
        <TabsContent value="modules"><ModulesSection inst={institution} canEdit={canEdit} /></TabsContent>
        <TabsContent value="campuses"><CampusesSection institutionId={institutionId} canEdit={canEdit} /></TabsContent>
        <TabsContent value="public"><PublicLinksSection inst={institution} /></TabsContent>
      </Tabs>
    </div>
  );
}
