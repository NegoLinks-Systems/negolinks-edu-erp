import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Pencil, Trash2, Users, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import type { Student } from '../../lib/database.types';
import {
  studentSchema, studentStatuses, relationships, guardianSchema,
  useStudents, useUpsertStudent, useDeleteStudent,
  useStudentGuardians, useAddGuardian, useUnlinkGuardian,
  type StudentForm, type GuardianForm,
} from './people-api';

const PAGE_SIZE = 20;
const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

const STATUS_STYLE: Record<string, string> = {
  enrolled: 'bg-emerald-100 text-emerald-800', prospective: 'bg-sky-100 text-sky-800',
  graduated: 'bg-violet-100 text-violet-800', transferred: 'bg-amber-100 text-amber-800',
  withdrawn: 'bg-zinc-200 text-zinc-700', suspended: 'bg-red-100 text-red-800',
  deferred: 'bg-orange-100 text-orange-800',
};
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Avatar({ first, last }: { first: string; last: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {(first[0] ?? '').toUpperCase()}{(last[0] ?? '').toUpperCase()}
    </div>
  );
}

/* --------------------------- create / edit ------------------------- */
function studentDefaults(s?: Student | null): StudentForm {
  return {
    admission_number: s?.admission_number ?? '', first_name: s?.first_name ?? '',
    last_name: s?.last_name ?? '', middle_name: s?.middle_name ?? '', gender: s?.gender ?? '',
    date_of_birth: s?.date_of_birth ?? '', email: s?.email ?? '', phone: s?.phone ?? '',
    address: s?.address ?? '', nationality: s?.nationality ?? '', state_of_origin: s?.state_of_origin ?? '',
    blood_group: s?.blood_group ?? '', genotype: s?.genotype ?? '', medical_notes: s?.medical_notes ?? '',
    admission_date: s?.admission_date ?? '', current_level: s?.current_level ?? '',
    status: s?.status ?? 'enrolled',
  };
}

function StudentFormDialog({ open, onOpenChange, institutionId, student }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; student: Student | null;
}) {
  const upsert = useUpsertStudent(institutionId);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<StudentForm>({ resolver: zodResolver(studentSchema), defaultValues: studentDefaults(student) });

  useEffect(() => { if (open) reset(studentDefaults(student)); }, [open, student, reset]);

  const onSubmit = (v: StudentForm) =>
    upsert.mutate({ ...v, id: student?.id }, {
      onSuccess: () => { toast.success(student ? 'Student updated' : 'Student added'); onOpenChange(false); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{student ? 'Edit student' : 'New student'}</DialogTitle>
          <DialogDescription>Records used across results, attendance, finance, and portals.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admission number" error={errors.admission_number?.message}>
            <Input {...register('admission_number')} />
          </Field>
          <Field label="Status">
            <select className={selectClass} {...register('status')}>
              {studentStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </Field>
          <Field label="First name" error={errors.first_name?.message}><Input {...register('first_name')} /></Field>
          <Field label="Last name" error={errors.last_name?.message}><Input {...register('last_name')} /></Field>
          <Field label="Middle name"><Input {...register('middle_name')} /></Field>
          <Field label="Gender">
            <select className={selectClass} {...register('gender')}>
              <option value="">—</option><option value="male">Male</option>
              <option value="female">Female</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of birth"><Input type="date" {...register('date_of_birth')} /></Field>
          <Field label="Current level"><Input placeholder="e.g. JSS1 or 100L" {...register('current_level')} /></Field>
          <Field label="Admission date"><Input type="date" {...register('admission_date')} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label="Phone"><Input {...register('phone')} /></Field>
          <Field label="Nationality"><Input {...register('nationality')} /></Field>
          <Field label="State / region of origin"><Input {...register('state_of_origin')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Blood group"><Input {...register('blood_group')} /></Field>
            <Field label="Genotype"><Input {...register('genotype')} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address"><Textarea rows={2} {...register('address')} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Medical notes" error={errors.medical_notes?.message}>
              <Textarea rows={2} placeholder="Allergies, conditions — kept private" {...register('medical_notes')} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {student ? 'Save changes' : 'Add student'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- guardians ---------------------------- */
function guardianDefaults(): GuardianForm {
  return {
    first_name: '', last_name: '', email: '', phone: '', whatsapp: '', address: '',
    occupation: '', relationship: 'guardian', is_primary: false, is_emergency_contact: false,
  };
}

function GuardiansDialog({ open, onOpenChange, institutionId, student }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; student: Student;
}) {
  const { data: links, isLoading } = useStudentGuardians(open ? student.id : null);
  const add = useAddGuardian(institutionId, student.id);
  const unlink = useUnlinkGuardian(student.id);
  const [adding, setAdding] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<GuardianForm>({ resolver: zodResolver(guardianSchema), defaultValues: guardianDefaults() });

  const onSubmit = (v: GuardianForm) =>
    add.mutate(v, {
      onSuccess: () => { toast.success('Guardian added'); setAdding(false); reset(guardianDefaults()); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Guardians — {student.first_name} {student.last_name}</DialogTitle>
          <DialogDescription>Parents and guardians who can be contacted and given portal access.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !links?.length && !adding && (
            <p className="text-sm text-muted-foreground">No guardians linked yet.</p>
          )}
          {links?.map((l) => (
            <div key={l.id} className="flex items-start justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {l.guardian.first_name} {l.guardian.last_name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{titleCase(l.relationship)}</span>
                </p>
                <p className="text-xs text-muted-foreground">{l.guardian.phone || l.guardian.email || '—'}</p>
                <div className="mt-1 flex gap-1">
                  {l.is_primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                  {l.is_emergency_contact && <Badge variant="secondary" className="text-[10px]">Emergency</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon"
                onClick={() => unlink.mutate(l.id, {
                  onSuccess: () => toast.success('Guardian unlinked'),
                  onError: (e: Error) => toast.error(e.message),
                })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" error={errors.first_name?.message}><Input {...register('first_name')} /></Field>
              <Field label="Last name" error={errors.last_name?.message}><Input {...register('last_name')} /></Field>
              <Field label="Relationship">
                <select className={selectClass} {...register('relationship')}>
                  {relationships.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                </select>
              </Field>
              <Field label="Occupation"><Input {...register('occupation')} /></Field>
              <Field label="Phone"><Input {...register('phone')} /></Field>
              <Field label="WhatsApp"><Input {...register('whatsapp')} /></Field>
              <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
              <Field label="Address"><Input {...register('address')} /></Field>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" {...register('is_primary')} /> Primary</label>
              <label className="flex items-center gap-2"><input type="checkbox" {...register('is_emergency_contact')} /> Emergency contact</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={add.isPending}>
                {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add guardian
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add guardian
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- page ------------------------------ */
export default function StudentsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin
    || hasRole('institution_admin', 'principal', 'vice_principal', 'admissions_officer', 'academic_officer');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [guardiansFor, setGuardiansFor] = useState<Student | null>(null);

  const { data, isLoading, isError, error } = useStudents(institutionId ?? '', {
    search: debounced, status, page, pageSize: PAGE_SIZE,
  });
  const del = useDeleteStudent(institutionId ?? '');

  useEffect(() => { setPage(0); }, [debounced, status]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const total = data?.count ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">{total} record{total === 1 ? '' : 's'} at {institution?.name}</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add student
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or admission number"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${selectClass} sm:w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {studentStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td></tr>
            )}
            {isError && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-destructive">
                {(error as Error).message}
              </td></tr>
            )}
            {!isLoading && !data?.rows.length && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                No students match your search. {canManage && 'Add your first student to begin.'}
              </td></tr>
            )}
            {data?.rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar first={s.first_name} last={s.last_name} />
                    <div>
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{s.current_level || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                    {titleCase(s.status)}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Guardians" onClick={() => setGuardiansFor(s)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" title="Edit"
                          onClick={() => { setEditing(s); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete"
                          onClick={() => {
                            if (!confirm(`Delete ${s.first_name} ${s.last_name}? This cannot be undone.`)) return;
                            del.mutate(s.id, {
                              onSuccess: () => toast.success('Student deleted'),
                              onError: (e: Error) => toast.error(e.message),
                            });
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {lastPage + 1}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} institutionId={institutionId} student={editing} />
      {guardiansFor && (
        <GuardiansDialog
          open={!!guardiansFor} onOpenChange={(v) => !v && setGuardiansFor(null)}
          institutionId={institutionId} student={guardiansFor}
        />
      )}
    </div>
  );
}
