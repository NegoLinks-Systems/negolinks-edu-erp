import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Search, UserPlus, LogOut, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { formatMoney } from '../finance/finance-api';
import {
  useRoutes, useUpsertRoute, useDeleteRoute, useVehicles, useStops, useUpsertStop, useDeleteStop,
  useRouteAssignments, useAssignStudent, useEndAssignment, useStudentSearch,
} from './transport-api';
import type { TransportRoute, RouteStop, Vehicle } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* ------------------------------ route dialog ------------------------------ */
function RouteDialog({ open, onOpenChange, institutionId, route, vehicles }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; route: TransportRoute | null; vehicles: Vehicle[];
}) {
  const upsert = useUpsertRoute(institutionId);
  const blank = { name: '', description: '', fare: '0', vehicle_id: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(route ? { name: route.name, description: route.description ?? '', fare: String(route.fare), vehicle_id: route.vehicle_id ?? '' } : blank); }, [open, route]); // eslint-disable-line

  const submit = () => {
    if (!f.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({ id: route?.id, name: f.name.trim(), description: f.description || null, fare: Number(f.fare) || 0, vehicle_id: f.vehicle_id || null },
      { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{route ? 'Edit route' : 'New route'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Town Campus — Ikeja" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Term fare"><Input type="number" value={f.fare} onChange={(e) => setF({ ...f, fare: e.target.value })} /></Field>
            <Field label="Vehicle">
              <select className={selectClass} value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
                <option value="">Unassigned</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.capacity})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- stop dialog ------------------------------- */
function StopDialog({ open, onOpenChange, institutionId, routeId, stop }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; routeId: string; stop: RouteStop | null;
}) {
  const upsert = useUpsertStop(institutionId, routeId);
  const blank = { name: '', sequence: '1', pickup_time: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(stop ? { name: stop.name, sequence: String(stop.sequence), pickup_time: stop.pickup_time ?? '' } : blank); }, [open, stop]); // eslint-disable-line

  const submit = () => {
    if (!f.name.trim()) { toast.error('Enter a stop name'); return; }
    upsert.mutate({ id: stop?.id, name: f.name.trim(), sequence: Number(f.sequence) || 1, pickup_time: f.pickup_time || null },
      { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{stop ? 'Edit stop' : 'New stop'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Stop name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Order"><Input type="number" value={f.sequence} onChange={(e) => setF({ ...f, sequence: e.target.value })} /></Field>
          <Field label="Pickup time"><Input value={f.pickup_time} onChange={(e) => setF({ ...f, pickup_time: e.target.value })} placeholder="6:45 AM" /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- assign dialog ----------------------------- */
function AssignDialog({ route, institutionId, stops, onClose }: {
  route: TransportRoute; institutionId: string; stops: RouteStop[]; onClose: () => void;
}) {
  const assign = useAssignStudent(institutionId, route.id);
  const [query, setQuery] = useState('');
  const [stopId, setStopId] = useState('');
  const results = useStudentSearch(institutionId, query);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Assign to {route.name}</DialogTitle><DialogDescription>Search for a student to add to this route.</DialogDescription></DialogHeader>
        {stops.length > 0 && (
          <Field label="Pickup stop (optional)">
            <select className={selectClass} value={stopId} onChange={(e) => setStopId(e.target.value)}>
              <option value="">—</option>
              {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or admission no." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim().length >= 2 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {results.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
            {results.data?.map((s) => (
              <button key={s.id} disabled={assign.isPending}
                onClick={() => assign.mutate({ student_id: s.id, stop_id: stopId || null }, { onSuccess: () => { toast.success('Assigned'); onClose(); }, onError: (e: Error) => toast.error(e.message) })}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
                <span>{s.name}</span><span className="text-xs text-muted-foreground">{s.admission}</span>
              </button>
            ))}
            {!results.isLoading && !results.data?.length && <p className="px-1 text-sm text-muted-foreground">No matches.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ route manager ------------------------------ */
function RouteManager({ route, institutionId, canManage, vehicles }: { route: TransportRoute; institutionId: string; canManage: boolean; vehicles: Vehicle[] }) {
  const stops = useStops(route.id);
  const assignments = useRouteAssignments(route.id);
  const end = useEndAssignment(route.id);
  const delStop = useDeleteStop(route.id);
  const [stopDialog, setStopDialog] = useState(false);
  const [editStop, setEditStop] = useState<RouteStop | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const vehicle = vehicles.find((v) => v.id === route.vehicle_id);
  const occupied = assignments.data?.length ?? 0;
  const full = vehicle ? occupied >= vehicle.capacity : false;

  return (
    <div className="space-y-3 border-t bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        {vehicle ? `${vehicle.name} · ${occupied}/${vehicle.capacity} seats` : 'No vehicle assigned'}
      </p>

      {/* Stops */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Stops</p>
          {canManage && <Button variant="outline" size="sm" onClick={() => { setEditStop(null); setStopDialog(true); }}><Plus className="mr-1 h-4 w-4" /> Add stop</Button>}
        </div>
        {stops.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
        {!stops.isLoading && !stops.data?.length && <p className="text-xs text-muted-foreground">No stops yet.</p>}
        {stops.data?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
            <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {s.name}{s.pickup_time ? <span className="text-xs text-muted-foreground">· {s.pickup_time}</span> : null}</span>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditStop(s); setStopDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete stop ${s.name}?`)) delStop.mutate(s.id, { onSuccess: () => toast.success('Deleted') }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assignments */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Students ({occupied})</p>
          {canManage && <Button variant="outline" size="sm" disabled={full} onClick={() => setAssignOpen(true)}><UserPlus className="mr-1 h-4 w-4" /> Assign</Button>}
        </div>
        {assignments.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
        {!assignments.isLoading && !assignments.data?.length && <p className="text-xs text-muted-foreground">No students assigned.</p>}
        {assignments.data?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
            <span>{a.student ? `${a.student.last_name} ${a.student.first_name}` : '—'}<span className="ml-2 text-xs text-muted-foreground">{a.student?.admission_number}{a.stop ? ` · ${a.stop.name}` : ''}</span></span>
            {canManage && <Button variant="ghost" size="icon" className="h-7 w-7" title="Remove" onClick={() => end.mutate(a.id, { onSuccess: () => toast.success('Removed') })}><LogOut className="h-3.5 w-3.5" /></Button>}
          </div>
        ))}
      </div>

      <StopDialog open={stopDialog} onOpenChange={setStopDialog} institutionId={institutionId} routeId={route.id} stop={editStop} />
      {assignOpen && <AssignDialog route={route} institutionId={institutionId} stops={stops.data ?? []} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}

/* --------------------------------- page ----------------------------------- */
export default function RoutesPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal');
  const currency = institution?.currency || 'NGN';

  const routes = useRoutes(institutionId ?? '');
  const vehicles = useVehicles(institutionId ?? '');
  const del = useDeleteRoute(institutionId ?? '');
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<TransportRoute | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Routes</h1>
          <p className="text-sm text-muted-foreground">Transport routes and assignments — {institution?.name}</p>
        </div>
        {canManage && <Button onClick={() => { setEdit(null); setDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add route</Button>}
      </header>

      {routes.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!routes.isLoading && !routes.data?.length && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No routes yet.</CardContent></Card>}

      <div className="space-y-2">
        {routes.data?.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button className="flex items-center gap-2 text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                {openId === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{formatMoney(Number(r.fare), currency)}/term</span>
              </button>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${r.name}"?`)) del.mutate(r.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
            {openId === r.id && <RouteManager route={r} institutionId={institutionId} canManage={canManage} vehicles={vehicles.data ?? []} />}
          </Card>
        ))}
      </div>

      <RouteDialog open={dialog} onOpenChange={setDialog} institutionId={institutionId} route={edit} vehicles={vehicles.data ?? []} />
    </div>
  );
}
