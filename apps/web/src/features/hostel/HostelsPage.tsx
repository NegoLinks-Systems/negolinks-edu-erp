import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Search, UserPlus, LogOut, BedDouble } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import {
  useHostels, useUpsertHostel, useDeleteHostel, useRooms, useUpsertRoom, useDeleteRoom,
  useHostelAllocations, useAllocateStudent, useVacate, useStudentSearch, hostelGenders,
} from './hostel-api';
import type { Hostel, HostelRoom, HostelGender } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const GENDER_STYLE: Record<HostelGender, string> = { male: 'bg-sky-100 text-sky-700', female: 'bg-pink-100 text-pink-700', mixed: 'bg-zinc-200 text-zinc-700' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* ------------------------------ hostel dialog ------------------------------ */
function HostelDialog({ open, onOpenChange, institutionId, hostel }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; hostel: Hostel | null;
}) {
  const upsert = useUpsertHostel(institutionId);
  const blank = { name: '', gender: 'mixed' as HostelGender, description: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(hostel ? { name: hostel.name, gender: hostel.gender, description: hostel.description ?? '' } : blank); }, [open, hostel]); // eslint-disable-line

  const submit = () => {
    if (!f.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({ id: hostel?.id, name: f.name.trim(), gender: f.gender, description: f.description || null },
      { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{hostel ? 'Edit block' : 'New block'}</DialogTitle><DialogDescription>A hostel block or building.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Unity Hall" /></Field>
          <Field label="Gender">
            <select className={selectClass} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value as HostelGender })}>
              {hostelGenders.map((g) => <option key={g} value={g}>{cap(g)}</option>)}
            </select>
          </Field>
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

/* ------------------------------- room dialog ------------------------------- */
function RoomDialog({ open, onOpenChange, institutionId, hostelId, room }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; hostelId: string; room: HostelRoom | null;
}) {
  const upsert = useUpsertRoom(institutionId, hostelId);
  const blank = { room_number: '', capacity: '4', floor: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(room ? { room_number: room.room_number, capacity: String(room.capacity), floor: room.floor ?? '' } : blank); }, [open, room]); // eslint-disable-line

  const submit = () => {
    if (!f.room_number.trim()) { toast.error('Enter a room number'); return; }
    upsert.mutate({ id: room?.id, room_number: f.room_number.trim(), capacity: Number(f.capacity) || 1, floor: f.floor || null },
      { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{room ? 'Edit room' : 'New room'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room number"><Input value={f.room_number} onChange={(e) => setF({ ...f, room_number: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Floor (optional)"><Input value={f.floor} onChange={(e) => setF({ ...f, floor: e.target.value })} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- allocate dialog ----------------------------- */
function AllocateDialog({ room, hostelId, institutionId, onClose }: {
  room: HostelRoom; hostelId: string; institutionId: string; onClose: () => void;
}) {
  const allocate = useAllocateStudent(institutionId, hostelId);
  const [query, setQuery] = useState('');
  const results = useStudentSearch(institutionId, query);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Allocate to room {room.room_number}</DialogTitle><DialogDescription>Search for a student to assign a bed.</DialogDescription></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or admission no." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim().length >= 2 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {results.isLoading && <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
            {results.data?.map((s) => (
              <button key={s.id} disabled={allocate.isPending}
                onClick={() => allocate.mutate({ room_id: room.id, student_id: s.id }, { onSuccess: () => { toast.success('Allocated'); onClose(); }, onError: (e: Error) => toast.error(e.message) })}
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

/* ------------------------------ rooms manager ------------------------------ */
function RoomsManager({ hostel, institutionId, canManage }: { hostel: Hostel; institutionId: string; canManage: boolean }) {
  const rooms = useRooms(hostel.id);
  const allocations = useHostelAllocations(hostel.id);
  const vacate = useVacate(hostel.id);
  const del = useDeleteRoom(hostel.id);
  const [roomDialog, setRoomDialog] = useState(false);
  const [editRoom, setEditRoom] = useState<HostelRoom | null>(null);
  const [allocRoom, setAllocRoom] = useState<HostelRoom | null>(null);

  const byRoom = useMemo(() => {
    const m = new Map<string, typeof allocations.data>();
    for (const a of allocations.data ?? []) { const arr = m.get(a.room_id) ?? []; arr.push(a); m.set(a.room_id, arr as any); }
    return m;
  }, [allocations.data]);

  return (
    <div className="space-y-2 border-t bg-muted/20 p-3">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => { setEditRoom(null); setRoomDialog(true); }}><Plus className="mr-1 h-4 w-4" /> Add room</Button>
        </div>
      )}
      {(rooms.isLoading || allocations.isLoading) && <div className="py-3 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
      {!rooms.isLoading && !rooms.data?.length && <p className="px-1 text-sm text-muted-foreground">No rooms yet.</p>}

      {rooms.data?.map((r) => {
        const occ = byRoom.get(r.id) ?? [];
        const full = occ.length >= r.capacity;
        return (
          <div key={r.id} className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BedDouble className="h-4 w-4 text-muted-foreground" /> Room {r.room_number}
                {r.floor && <span className="text-xs text-muted-foreground">· floor {r.floor}</span>}
                <span className={`text-xs ${full ? 'text-red-600' : 'text-emerald-600'}`}>{occ.length}/{r.capacity}</span>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Allocate" disabled={full} onClick={() => setAllocRoom(r)}><UserPlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditRoom(r); setRoomDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (confirm(`Delete room ${r.room_number}?`)) del.mutate(r.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
            {occ.length > 0 && (
              <div className="mt-2 space-y-1">
                {occ.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs">
                    <span>{a.student ? `${a.student.last_name} ${a.student.first_name}` : '—'}<span className="ml-2 text-muted-foreground">{a.student?.admission_number}</span></span>
                    {canManage && <Button variant="ghost" size="icon" className="h-6 w-6" title="Vacate" onClick={() => vacate.mutate(a.id, { onSuccess: () => toast.success('Vacated') })}><LogOut className="h-3.5 w-3.5" /></Button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <RoomDialog open={roomDialog} onOpenChange={setRoomDialog} institutionId={institutionId} hostelId={hostel.id} room={editRoom} />
      {allocRoom && <AllocateDialog room={allocRoom} hostelId={hostel.id} institutionId={institutionId} onClose={() => setAllocRoom(null)} />}
    </div>
  );
}

/* --------------------------------- page ----------------------------------- */
export default function HostelsPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal');

  const hostels = useHostels(institutionId ?? '');
  const del = useDeleteHostel(institutionId ?? '');
  const [dialog, setDialog] = useState(false);
  const [editHostel, setEditHostel] = useState<Hostel | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hostels</h1>
          <p className="text-sm text-muted-foreground">Blocks, rooms and allocations — {institution?.name}</p>
        </div>
        {canManage && <Button onClick={() => { setEditHostel(null); setDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add block</Button>}
      </header>

      {hostels.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!hostels.isLoading && !hostels.data?.length && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hostel blocks yet.</CardContent></Card>}

      <div className="space-y-2">
        {hostels.data?.map((h) => (
          <Card key={h.id} className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button className="flex items-center gap-2 text-left" onClick={() => setOpenId(openId === h.id ? null : h.id)}>
                {openId === h.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">{h.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GENDER_STYLE[h.gender]}`}>{cap(h.gender)}</span>
              </button>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditHostel(h); setDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${h.name}" and its rooms?`)) del.mutate(h.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
            {openId === h.id && <RoomsManager hostel={h} institutionId={institutionId} canManage={canManage} />}
          </Card>
        ))}
      </div>

      <HostelDialog open={dialog} onOpenChange={setDialog} institutionId={institutionId} hostel={editHostel} />
    </div>
  );
}
