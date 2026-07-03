import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Search, X, History, ArrowDownUp, Package, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import {
  useInvCategories, useUpsertInvCategory, useDeleteInvCategory,
  useItems, useUpsertItem, useDeleteItem, useItemHistory, useRecordMovement,
} from './inventory-api';
import type { InventoryItem, MovementType } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

/* ------------------------------ item dialog ------------------------------ */
function ItemDialog({ open, onOpenChange, institutionId, item, categories }: {
  open: boolean; onOpenChange: (v: boolean) => void; institutionId: string; item: InventoryItem | null; categories: { id: string; name: string }[];
}) {
  const upsert = useUpsertItem(institutionId);
  const blank = { name: '', category_id: '', sku: '', unit: 'unit', reorder_level: '0', unit_cost: '', location: '', quantity: '0' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (open) setF(item ? {
      name: item.name, category_id: item.category_id ?? '', sku: item.sku ?? '', unit: item.unit,
      reorder_level: String(item.reorder_level), unit_cost: item.unit_cost != null ? String(item.unit_cost) : '', location: item.location ?? '', quantity: String(item.quantity),
    } : blank);
  }, [open, item]); // eslint-disable-line

  const submit = () => {
    if (!f.name.trim()) { toast.error('Enter a name'); return; }
    upsert.mutate({
      id: item?.id, name: f.name.trim(), category_id: f.category_id || null, sku: f.sku || null, unit: f.unit || 'unit',
      reorder_level: Number(f.reorder_level) || 0, unit_cost: f.unit_cost ? Number(f.unit_cost) : null, location: f.location || null,
      ...(item ? {} : { quantity: Number(f.quantity) || 0 }),
    } as any, { onSuccess: () => { toast.success('Saved'); onOpenChange(false); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? 'Edit item' : 'New item'}</DialogTitle>
          {!item && <DialogDescription>Set the opening stock now; later changes go through receive / issue.</DialogDescription>}</DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Category">
            <select className={selectClass} value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="SKU"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="piece, box, ream" /></Field>
          <Field label="Reorder level"><Input type="number" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} /></Field>
          <Field label="Unit cost (optional)"><Input type="number" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></Field>
          <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Store room A" /></Field>
          {!item && <div className="sm:col-span-2"><Field label="Opening stock"><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field></div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- movement dialog ---------------------------- */
const TYPES: { key: MovementType; label: string }[] = [{ key: 'receive', label: 'Receive' }, { key: 'issue', label: 'Issue' }, { key: 'adjust', label: 'Adjust' }];

function MovementDialog({ item, institutionId, onClose }: { item: InventoryItem; institutionId: string; onClose: () => void }) {
  const record = useRecordMovement(institutionId);
  const [type, setType] = useState<MovementType>('receive');
  const [amount, setAmount] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || (type !== 'adjust' && n <= 0)) { toast.error('Enter a valid quantity'); return; }
    const change = type === 'receive' ? n : type === 'issue' ? -n : (n - item.quantity);
    if (type === 'issue' && n > item.quantity) { toast.error(`Only ${item.quantity} ${item.unit} in stock`); return; }
    if (change === 0) { toast.error('No change to record'); return; }
    record.mutate({ item_id: item.id, type, change, issued_to: type === 'issue' ? (issuedTo || null) : null, note: note || null },
      { onSuccess: () => { toast.success('Stock updated'); onClose(); }, onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{item.name}</DialogTitle><DialogDescription>In stock: {item.quantity} {item.unit}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button key={t.key} onClick={() => setType(t.key)}
                className={`rounded-md border px-3 py-2 text-sm ${type === t.key ? 'border-primary bg-primary/5 font-medium' : ''}`}>{t.label}</button>
            ))}
          </div>
          <Field label={type === 'adjust' ? 'New counted quantity' : 'Quantity'}>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          {type === 'issue' && <Field label="Issued to (optional)"><Input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Science dept" /></Field>}
          <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending}>{record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- history dialog ---------------------------- */
function HistoryDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const history = useItemHistory(item.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{item.name} — history</DialogTitle></DialogHeader>
        {history.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
        {!history.isLoading && !history.data?.length && <p className="text-sm text-muted-foreground">No movements yet.</p>}
        <div className="space-y-1">
          {history.data?.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="capitalize">{m.type}</span>
                {m.issued_to ? <span className="text-xs text-muted-foreground"> · {m.issued_to}</span> : null}
                <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}{m.note ? ` · ${m.note}` : ''}</div>
              </div>
              <div className="text-right">
                <span className={m.change >= 0 ? 'text-emerald-600' : 'text-red-600'}>{m.change >= 0 ? '+' : ''}{m.change}</span>
                <div className="text-xs text-muted-foreground">bal {m.balance_after}</div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- page ---------------------------------- */
export default function InventoryPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('institution_admin', 'principal', 'vice_principal', 'bursar');

  const categories = useInvCategories(institutionId ?? '');
  const upsertCat = useUpsertInvCategory(institutionId ?? '');
  const delCat = useDeleteInvCategory(institutionId ?? '');

  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const items = useItems(institutionId ?? '', { categoryId, search });
  const del = useDeleteItem(institutionId ?? '');

  const [itemDialog, setItemDialog] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);
  const [histItem, setHistItem] = useState<InventoryItem | null>(null);
  const [newCat, setNewCat] = useState('');

  const catList = useMemo(() => (categories.data ?? []).map((c) => ({ id: c.id, name: c.name })), [categories.data]);
  const shown = useMemo(() => (items.data ?? []).filter((i) => !lowOnly || i.quantity <= i.reorder_level), [items.data, lowOnly]);
  const lowCount = useMemo(() => (items.data ?? []).filter((i) => i.quantity <= i.reorder_level).length, [items.data]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canManage) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Inventory is for store and admin staff.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Store items and stock — {institution?.name}</p>
        </div>
        <Button onClick={() => { setEditItem(null); setItemDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add item</Button>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.data?.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                {c.name}<button onClick={() => delCat.mutate(c.id, { onSuccess: () => toast.success('Removed') })}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </span>
            ))}
            {!categories.data?.length && <span className="text-sm text-muted-foreground">No categories yet.</span>}
          </div>
          <div className="flex gap-2">
            <Input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="max-w-xs" />
            <Button variant="outline" onClick={() => { if (!newCat.trim()) return; upsertCat.mutate({ name: newCat.trim() }, { onSuccess: () => { toast.success('Added'); setNewCat(''); }, onError: (e: Error) => toast.error(e.message) }); }}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${selectClass} max-w-[200px]`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {catList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setLowOnly((v) => !v)}
          className={`flex items-center gap-1 rounded-md border px-3 py-2 text-sm ${lowOnly ? 'border-amber-400 bg-amber-50 text-amber-800' : ''}`}>
          <AlertTriangle className="h-4 w-4" /> Low {lowCount > 0 ? `(${lowCount})` : ''}
        </button>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {items.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!items.isLoading && !shown.length && <p className="text-sm text-muted-foreground">No items.</p>}
          {shown.map((i) => {
            const low = i.quantity <= i.reorder_level;
            return (
              <div key={i.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.name}{i.sku ? <span className="ml-1 text-xs text-muted-foreground">{i.sku}</span> : null}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className={low ? 'font-medium text-amber-600' : ''}>{i.quantity} {i.unit}</span>
                      {low && ' · low'}{i.location ? ` · ${i.location}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={() => setMoveItem(i)}><ArrowDownUp className="mr-1 h-4 w-4" /> Stock</Button>
                  <Button variant="ghost" size="icon" title="History" onClick={() => setHistItem(i)}><History className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditItem(i); setItemDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (confirm(`Delete "${i.name}"?`)) del.mutate(i.id, { onSuccess: () => toast.success('Deleted'), onError: (e: Error) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ItemDialog open={itemDialog} onOpenChange={setItemDialog} institutionId={institutionId} item={editItem} categories={catList} />
      {moveItem && <MovementDialog item={moveItem} institutionId={institutionId} onClose={() => setMoveItem(null)} />}
      {histItem && <HistoryDialog item={histItem} onClose={() => setHistItem(null)} />}
    </div>
  );
}
