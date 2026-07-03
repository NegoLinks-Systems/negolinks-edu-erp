import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import type { Staff } from '../../lib/database.types';
import {
  staffSchema, staffStatuses, employmentTypes,
  useStaffList, useUpsertStaff, useDeleteStaff, type StaffForm,
} from './people-api';

const PAGE_SIZE = 20;
const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800', on_leave: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800', terminated: 'bg-zinc-200 text-zinc-700',
  retired: 'bg-violet-100 text-violet-800',
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

function staffDefaults(s?: Staff | null): StaffForm {
  return {
    staff_number: s?.staff_number ?? '', first_name: s?.first_name ?? '', last_name: s?.last_name ?? '',
    middle_name: s?.middle_name ?? '', gender: s?.gender ?? '', email: s?.email ?? '', phone: s?.phone ?? '',
    address: s?.address ?? '', job_title: s?.job_title ?? '', department: s?.department ?? '',
    employment_type: s?.employment_type ?? 'full_time', qualification: s?.qualification ?? '',
    date_joined: s?.date_joined ?? '', status: s?.status ?? 'active',
  };
}

function StaffFormDialog({ open, onOpenChange, institutionId, member }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; member: Staff | null;
}) {
  const upsert = useUpsertStaff(institutionId);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<StaffForm>({ resolver: zodResolver(staffSchema), defaultValues: staffDefaults(member) });

  useEffect(() => { if (open) reset(staffDefaults(member)); }, [open, member, reset]);

  const onSubmit = (v: StaffForm) =>
    upsert.mutate({ ...v, id: member?.id }, {
      onSuccess: () => { toast.success(member ? 'Staff updated' : 'Staff added'); onOpenChange(false); },
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit staff' : 'New staff'}</DialogTitle>
          <DialogDescription>Employment records that feed attendance, payroll, and academic assignments.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Staff number" error={errors.staff_number?.message}><Input {...register('staff_number')} /></Field>
          <Field label="Status">
            <select className={selectClass} {...register('status')}>
              {staffStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
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
          <Field label="Job title"><Input placeholder="e.g. Mathematics Teacher" {...register('job_title')} /></Field>
          <Field label="Department"><Input {...register('department')} /></Field>
          <Field label="Employment type">
            <select className={selectClass} {...register('employment_type')}>
              {employmentTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </Field>
          <Field label="Date joined"><Input type="date" {...register('date_joined')} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label="Phone"><Input {...register('phone')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Qualification"><Input placeholder="e.g. B.Sc Mathematics, PGDE" {...register('qualification')} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address"><Textarea rows={2} {...register('address')} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {member ? 'Save changes' : 'Add staff'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const { data, isLoading, isError, error } = useStaffList(institutionId ?? '', {
    search: debounced, status, page, pageSize: PAGE_SIZE,
  });
  const del = useDeleteStaff(institutionId ?? '');

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
          <h1 className="text-xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground">{total} record{total === 1 ? '' : 's'} at {institution?.name}</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add staff
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or staff number"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${selectClass} sm:w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {staffStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
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
              <tr><td colSpan={4} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</td></tr>
            )}
            {!isLoading && !data?.rows.length && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                No staff match your search. {canManage && 'Add your first staff member to begin.'}
              </td></tr>
            )}
            {data?.rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">
                  <p className="font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-muted-foreground">{s.staff_number}</p>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {s.job_title || '—'}{s.department ? ` · ${s.department}` : ''}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                    {titleCase(s.status)}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit"
                        onClick={() => { setEditing(s); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete"
                        onClick={() => {
                          if (!confirm(`Delete ${s.first_name} ${s.last_name}? This cannot be undone.`)) return;
                          del.mutate(s.id, {
                            onSuccess: () => toast.success('Staff deleted'),
                            onError: (e: Error) => toast.error(e.message),
                          });
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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

      <StaffFormDialog open={formOpen} onOpenChange={setFormOpen} institutionId={institutionId} member={editing} />
    </div>
  );
}
