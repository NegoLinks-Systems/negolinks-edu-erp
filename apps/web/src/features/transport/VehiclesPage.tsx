import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Bus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { useVehicles, useUpsertVehicle, useDeleteVehicle, vehicleStatuses } from './transport-api';
import type { Vehicle, VehicleStatus } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const STATUS_STYLE: Record<VehicleStatus, string> = { active: 'bg-emerald-100 text-emerald-800', maintenance: 'bg-amber-100 text-amber-800', inactive: 'bg-zinc-200 text-zinc-700' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function VehicleDialog({ open, onOpenChange, institutionId, vehicle }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; vehicle: Vehicle | null;
}) {
  const upsert = useUpsertVehicle(institutionId);
  const blank = { name: '', plate_number: '', model: '', capacity: '14', driver_name: '', driver_phone: '', status: 'active' as VehicleStatus };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (open) setF(vehicle ? {
      name: vehicle.name, plate_number: vehicle.plate_number ?? '', model: vehicle.model ?? '', capacity: String(vehicle.capacity),
      driver_name: vehicle.driver_name ?? '', driver_phone: vehicle.driver_phone ?? '', status: vehicle.status,
    } : blank);
  }, [open, vehicle]); // eslint-disable-line

  const submit = () => {
    if (!f.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({
      id: vehicle?.id, name: f.name.trim(), plate_number: f.plate_number || null, model: f.model || null,
      capacity: Number(f.capacity) || 1, driver_name: f.driver_name || null, driver_phone: f.driver_phone || null, status: f.status,
    }, { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{vehicle ? 'Edit vehicle' : 'New vehicle'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name / label"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Bus 1" /></Field></div>
          <Field label="Plate number"><Input value={f.plate_number} onChange={(e) => setF({ ...f, plate_number: e.target.value })} /></Field>
          <Field label="Model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
          <Field label="Status">
            <select className={selectClass} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as VehicleStatus })}>
              {vehicleStatuses.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </Field>
          <Field label="Driver name"><Input value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} /></Field>
          <Field label="Driver phone"><Input value={f.driver_phone} onChange={(e) => setF({ ...f, driver_phone: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VehiclesPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal');
  const vehicles = useVehicles(institutionId ?? '');
  const del = useDeleteVehicle(institutionId ?? '');
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Transport fleet — {institution?.name}</p>
        </div>
        {canManage && <Button onClick={() => { setEdit(null); setDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add vehicle</Button>}
      </header>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {vehicles.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!vehicles.isLoading && !vehicles.data?.length && <p className="text-sm text-muted-foreground">No vehicles yet.</p>}
          {vehicles.data?.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-3">
                <Bus className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{v.name}{v.plate_number ? ` · ${v.plate_number}` : ''}</p>
                  <p className="text-xs text-muted-foreground">Seats {v.capacity}{v.driver_name ? ` · ${v.driver_name}` : ''}{v.driver_phone ? ` · ${v.driver_phone}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status]}`}>{cap(v.status)}</span>
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => { setEdit(v); setDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${v.name}?`)) del.mutate(v.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <VehicleDialog open={dialog} onOpenChange={setDialog} institutionId={institutionId} vehicle={edit} />
    </div>
  );
}
