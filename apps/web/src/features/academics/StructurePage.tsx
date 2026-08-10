import { useState } from 'react';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ChevronRight } from 'lucide-react';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '../../lib/supabase';
import { useTenant } from '../../providers/app-providers';
import type { ClassArm } from '../../lib/database.types';
import {
  isTertiary, programmeAwards,
  Classes, Faculties, Departments, Programmes, Subjects,
  classSchema, facultySchema, departmentSchema, programmeSchema, subjectSchema, armSchema,
  useArms, useUpsertArm, useDeleteArm,
  type ArmForm,
} from './academics-api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Field({ label, error, children }: { label: string; error?: unknown; children: React.ReactNode }) {
  const msg = typeof error === 'string' ? error : (error as { message?: string } | undefined)?.message;
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{msg && <p className="text-xs text-destructive">{msg}</p>}</div>;
}

function useStaffOptions(institutionId: string) {
  return useQuery({
    queryKey: ['staff-options', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff')
        .select('id, first_name, last_name').eq('institution_id', institutionId)
        .order('first_name').limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string; last_name: string }[];
    },
  });
}

/* ----------------------- generic CRUD section ---------------------- */
interface Entity {
  useList: (id: string, extra?: { column: string; order?: boolean }) => { data?: { id: string }[]; isLoading: boolean };
  useUpsert: (id: string) => { mutate: (v: any, o?: any) => void; isPending: boolean };
  useDelete: (id: string) => { mutate: (v: string, o?: any) => void };
}

function Manager<F extends FieldValues>({
  entity, institutionId, canManage, title, blurb, addLabel,
  schema, emptyDefaults, toDefaults, fields, label, rowExtra, listOrder,
}: {
  entity: Entity; institutionId: string; canManage: boolean;
  title: string; blurb: string; addLabel: string;
  schema: z.ZodType<F>; emptyDefaults: F;
  toDefaults: (item: any) => F;
  fields: (form: UseFormReturn<F>) => React.ReactNode;
  label: (item: any) => React.ReactNode;
  rowExtra?: (item: any) => React.ReactNode;
  listOrder?: { column: string; order?: boolean };
}) {
  const { data: items, isLoading } = entity.useList(institutionId, listOrder);
  const upsert = entity.useUpsert(institutionId);
  const del = entity.useDelete(institutionId);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const form = useForm<F>({ resolver: zodResolver(schema as any), defaultValues: emptyDefaults as any });

  const open = (item: any | 'new') => { setEditing(item); form.reset((item === 'new' ? emptyDefaults : toDefaults(item)) as any); };
  const submit = (v: F) => upsert.mutate({ ...v, id: editing !== 'new' ? editing.id : undefined }, {
    onSuccess: () => { toast.success('Saved'); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>{title}</CardTitle><CardDescription>{blurb}</CardDescription></div>
        {canManage && editing !== 'new' && (
          <Button size="sm" onClick={() => open('new')}><Plus className="mr-2 h-4 w-4" /> {addLabel}</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !items?.length && editing !== 'new' && (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        )}

        {items?.map((item) => (
          <div key={item.id}>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="text-sm">{label(item)}</div>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => open(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (!confirm('Delete this item? This cannot be undone.')) return;
                    del.mutate(item.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
            {rowExtra?.(item)}
          </div>
        ))}

        {canManage && editing && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{editing === 'new' ? `New — ${title}` : 'Edit'}</p>
            <div className="grid gap-3 sm:grid-cols-2">{fields(form)}</div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" onClick={form.handleSubmit(submit)} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------- arms expander (per class) ------------------ */
function ArmsExpander({ classId, institutionId, canManage }: {
  classId: string; institutionId: string; canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: arms } = useArms(open ? classId : null);
  const upsert = useUpsertArm(institutionId, classId);
  const del = useDeleteArm(classId);
  const staff = useStaffOptions(institutionId);
  const [editing, setEditing] = useState<ClassArm | 'new' | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<ArmForm>({ resolver: zodResolver(armSchema), defaultValues: { name: '', capacity: undefined, class_teacher_id: '' } });

  const start = (a: ClassArm | 'new') => {
    setEditing(a);
    reset(a === 'new' ? { name: '', capacity: undefined, class_teacher_id: '' }
      : { name: a.name, capacity: a.capacity ?? undefined, class_teacher_id: a.class_teacher_id ?? '' });
  };
  const submit = (v: ArmForm) => upsert.mutate({ ...v, id: editing !== 'new' && editing ? editing.id : undefined }, {
    onSuccess: () => { toast.success('Arm saved'); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="ml-3 mt-1">
      <button className="flex items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} /> Arms
      </button>
      {open && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {arms?.length === 0 && !editing && <p className="text-xs text-muted-foreground">No arms yet.</p>}
          {arms?.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
              <span>{a.name}{a.capacity ? ` · cap ${a.capacity}` : ''}</span>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => start(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(a.id, {
                    onSuccess: () => toast.success('Arm removed'), onError: (e: Error) => toast.error(e.message),
                  })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
          {canManage && (editing ? (
            <div className="space-y-3 rounded-md border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" error={errors.name?.message}><Input placeholder="A" {...register('name')} /></Field>
                <Field label="Capacity"><Input type="number" {...register('capacity')} /></Field>
                <Field label="Class teacher">
                  <select className={selectClass} {...register('class_teacher_id')}>
                    <option value="">—</option>
                    {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit(submit)} disabled={upsert.isPending}>
                  {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save arm
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => start('new')}><Plus className="mr-2 h-4 w-4" /> Add arm</Button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- page ------------------------------ */
export default function StructurePage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin ||
    hasRole('institution_admin', 'principal', 'vice_principal', 'academic_officer', 'dean', 'head_of_department', 'rector', 'provost');
  const tertiary = isTertiary(institution?.type);

  // Shared option lists (deduped by React Query across this page).
  const faculties = Faculties.useList(institutionId ?? '');
  const departments = Departments.useList(institutionId ?? '');

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const facultyOptions = faculties.data ?? [];
  const departmentOptions = departments.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Academic structure</h1>
        <p className="text-sm text-muted-foreground">
          {tertiary ? 'Faculties, departments, programmes and courses' : 'Classes, arms and subjects'} for {institution?.name}
        </p>
      </header>

      {tertiary ? (
        <Tabs defaultValue="faculties">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="faculties">Faculties</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="programmes">Programmes</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="faculties">
            <Manager
              entity={Faculties} institutionId={institutionId} canManage={canManage}
              title="Faculties" blurb="Top-level academic divisions." addLabel="Add faculty"
              schema={facultySchema} emptyDefaults={{ name: '', code: '' }}
              toDefaults={(f) => ({ name: f.name, code: f.code ?? '' })}
              label={(f) => <><span className="font-medium">{f.name}</span>{f.code ? <span className="ml-2 text-xs text-muted-foreground">{f.code}</span> : null}</>}
              fields={(form) => (<>
                <Field label="Name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
                <Field label="Code"><Input {...form.register('code')} /></Field>
              </>)}
            />
          </TabsContent>

          <TabsContent value="departments">
            <Manager
              entity={Departments} institutionId={institutionId} canManage={canManage}
              title="Departments" blurb="Departments grouped under faculties." addLabel="Add department"
              schema={departmentSchema} emptyDefaults={{ name: '', code: '', faculty_id: '' }}
              toDefaults={(d) => ({ name: d.name, code: d.code ?? '', faculty_id: d.faculty_id ?? '' })}
              label={(d) => <><span className="font-medium">{d.name}</span>{d.code ? <span className="ml-2 text-xs text-muted-foreground">{d.code}</span> : null}</>}
              fields={(form) => (<>
                <Field label="Name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
                <Field label="Code"><Input {...form.register('code')} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Faculty">
                    <select className={selectClass} {...form.register('faculty_id')}>
                      <option value="">—</option>
                      {facultyOptions.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                </div>
              </>)}
            />
          </TabsContent>

          <TabsContent value="programmes">
            <Manager
              entity={Programmes} institutionId={institutionId} canManage={canManage}
              title="Programmes" blurb="Courses of study leading to an award." addLabel="Add programme"
              schema={programmeSchema}
              emptyDefaults={{ name: '', code: '', department_id: '', award: '', duration_years: undefined } as any}
              toDefaults={(p) => ({ name: p.name, code: p.code ?? '', department_id: p.department_id ?? '', award: p.award ?? '', duration_years: p.duration_years ?? undefined } as any)}
              label={(p) => <><span className="font-medium">{p.name}</span>{p.award ? <span className="ml-2 text-xs text-muted-foreground">{titleCase(p.award)}</span> : null}</>}
              fields={(form) => (<>
                <Field label="Name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
                <Field label="Code"><Input {...form.register('code')} /></Field>
                <Field label="Department">
                  <select className={selectClass} {...form.register('department_id')}>
                    <option value="">—</option>
                    {departmentOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Award">
                  <select className={selectClass} {...form.register('award')}>
                    <option value="">—</option>
                    {programmeAwards.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
                  </select>
                </Field>
                <Field label="Duration (years)"><Input type="number" step="0.5" {...form.register('duration_years')} /></Field>
              </>)}
            />
          </TabsContent>

          <TabsContent value="courses">
            <Manager
              entity={Subjects} institutionId={institutionId} canManage={canManage}
              title="Courses" blurb="Courses with credit units, owned by departments." addLabel="Add course"
              schema={subjectSchema}
              emptyDefaults={{ title: '', code: '', credit_units: undefined, department_id: '', is_elective: false } as any}
              toDefaults={(s) => ({ title: s.title, code: s.code ?? '', credit_units: s.credit_units ?? undefined, department_id: s.department_id ?? '', is_elective: s.is_elective } as any)}
              label={(s) => <><span className="font-medium">{s.code ? `${s.code} — ` : ''}{s.title}</span>{s.credit_units ? <span className="ml-2 text-xs text-muted-foreground">{s.credit_units} units</span> : null}</>}
              fields={(form) => (<>
                <Field label="Code"><Input placeholder="MTH101" {...form.register('code')} /></Field>
                <Field label="Credit units"><Input type="number" {...form.register('credit_units')} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Title" error={form.formState.errors.title?.message}><Input {...form.register('title')} /></Field>
                </div>
                <Field label="Department">
                  <select className={selectClass} {...form.register('department_id')}>
                    <option value="">—</option>
                    {departmentOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('is_elective')} /> Elective</label>
              </>)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="classes">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="classes">Classes &amp; arms</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
          </TabsList>

          <TabsContent value="classes">
            <Manager
              entity={Classes} institutionId={institutionId} canManage={canManage}
              title="Classes" blurb="Each class can hold one or more arms." addLabel="Add class"
              schema={classSchema} emptyDefaults={{ name: '', level_order: 1 }}
              listOrder={{ column: 'level_order' }}
              toDefaults={(c) => ({ name: c.name, level_order: c.level_order })}
              label={(c) => <><span className="font-medium">{c.name}</span><span className="ml-2 text-xs text-muted-foreground">level {c.level_order}</span></>}
              rowExtra={(c) => <ArmsExpander classId={c.id} institutionId={institutionId} canManage={canManage} />}
              fields={(form) => (<>
                <Field label="Name" error={form.formState.errors.name?.message}><Input placeholder="JSS 1" {...form.register('name')} /></Field>
                <Field label="Level order"><Input type="number" {...form.register('level_order')} /></Field>
              </>)}
            />
          </TabsContent>

          <TabsContent value="subjects">
            <Manager
              entity={Subjects} institutionId={institutionId} canManage={canManage}
              title="Subjects" blurb="Subjects taught across the school." addLabel="Add subject"
              schema={subjectSchema}
              emptyDefaults={{ title: '', code: '', credit_units: undefined, department_id: '', is_elective: false } as any}
              toDefaults={(s) => ({ title: s.title, code: s.code ?? '', credit_units: s.credit_units ?? undefined, department_id: '', is_elective: s.is_elective } as any)}
              label={(s) => <><span className="font-medium">{s.title}{s.code ? ` (${s.code})` : ''}</span>{s.credit_units ? <span className="ml-2 text-xs text-muted-foreground">{s.credit_units} units</span> : null}</>}
              fields={(form) => (<>
                <Field label="Title" error={form.formState.errors.title?.message}><Input placeholder="Mathematics" {...form.register('title')} /></Field>
                <Field label="Code (optional)"><Input {...form.register('code')} /></Field>
                <Field label="Credit units (optional)"><Input type="number" {...form.register('credit_units')} /></Field>
              </>)}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
