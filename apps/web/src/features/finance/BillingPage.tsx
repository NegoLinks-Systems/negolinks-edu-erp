import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, FilePlus2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { isTertiary, useTerms } from '../academics/academics-api';
import { ScopeSelector, selectClass, emptyScope, toScope, type ScopeState } from '../attendance/scope-selector';
import {
  useInvoices, useInvoice, useGenerateInvoices, useRecordPayment, useUpdateInvoice, useDeletePayment, useSetInvoiceDiscount,
  formatMoney, paymentMethods, type InvoiceWithStudent,
} from './finance-api';
import type { InvoiceStatus, PaymentMethod } from '../../lib/database.types';

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  unpaid: 'bg-red-100 text-red-800', partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-zinc-200 text-zinc-700',
};
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);

/* ----------------------------- detail dialog ---------------------------- */
function InvoiceDialog({ invoiceId, onClose, currency, canManage }: {
  invoiceId: string; onClose: () => void; currency: string; canManage: boolean;
}) {
  const { data: inv, isLoading } = useInvoice(invoiceId);
  const record = useRecordPayment(inv?.institution_id ?? '');
  const update = useUpdateInvoice();
  const delPay = useDeletePayment();
  const setDiscount = useSetInvoiceDiscount();
  const [pay, setPay] = useState({ amount: '', method: 'cash' as PaymentMethod, note: '', paid_at: today() });
  const [disc, setDisc] = useState('');
  useEffect(() => { if (inv) setDisc(String(Number(inv.discount) || 0)); }, [inv?.id, inv?.discount]); // eslint-disable-line

  const submitPayment = () => {
    const amount = Number(pay.amount);
    if (!inv || !amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    record.mutate({ invoice_id: inv.id, student_id: inv.student_id, amount, method: pay.method, note: pay.note || undefined, paid_at: new Date(pay.paid_at).toISOString() }, {
      onSuccess: () => { toast.success('Payment recorded'); setPay({ amount: '', method: 'cash', note: '', paid_at: today() }); },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{inv ? `${inv.student.first_name} ${inv.student.last_name}` : 'Invoice'}</DialogTitle>
          <DialogDescription>{inv ? `${inv.reference} · ${inv.title}` : ''}</DialogDescription>
        </DialogHeader>

        {isLoading || !inv ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border">
              {inv.items.map((it) => (
                <div key={it.id} className="flex justify-between border-b px-3 py-1.5 text-sm last:border-b-0">
                  <span>{it.description}</span><span>{formatMoney(Number(it.amount), currency)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between rounded-md bg-muted px-3 py-2"><span className="text-muted-foreground">Total</span><span className="font-medium">{formatMoney(Number(inv.total), currency)}</span></div>
              <div className="flex justify-between rounded-md bg-muted px-3 py-2"><span className="text-muted-foreground">Discount</span><span className="font-medium">{formatMoney(Number(inv.discount), currency)}</span></div>
              <div className="flex justify-between rounded-md bg-muted px-3 py-2"><span className="text-muted-foreground">Paid</span><span className="font-medium">{formatMoney(Number(inv.amount_paid), currency)}</span></div>
              <div className="flex justify-between rounded-md bg-muted px-3 py-2"><span className="text-muted-foreground">Balance</span><span className="font-semibold">{formatMoney(Number(inv.balance), currency)}</span></div>
            </div>

            {canManage && inv.status !== 'cancelled' && (
              <div className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Discount ({currency})</Label>
                  <Input type="number" value={disc} onChange={(e) => setDisc(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" disabled={setDiscount.isPending} onClick={() => {
                  const amt = Number(disc);
                  if (isNaN(amt) || amt < 0) { toast.error('Enter a valid amount'); return; }
                  setDiscount.mutate({ id: inv.id, amount: amt }, { onSuccess: () => toast.success('Discount updated'), onError: (e: Error) => toast.error(e.message) });
                }}>{setDiscount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Set discount</Button>
              </div>
            )}

            {inv.payments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Payments</p>
                <div className="space-y-1">
                  {inv.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span>{formatMoney(Number(p.amount), currency)} · {titleCase(p.method)} <span className="text-xs text-muted-foreground">· {new Date(p.paid_at).toLocaleDateString()}</span></span>
                      {canManage && (
                        <Button variant="ghost" size="icon" onClick={() => delPay.mutate({ id: p.id, invoice_id: inv.id }, { onSuccess: () => toast.success('Payment removed'), onError: (e: Error) => toast.error(e.message) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canManage && inv.status !== 'cancelled' && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Record payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Method</Label>
                    <select className={selectClass} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
                      {paymentMethods.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={pay.paid_at} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Note</Label><Input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={submitPayment} disabled={record.isPending}>
                    {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record payment
                  </Button>
                </div>
              </div>
            )}

            {canManage && (
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Status: <span className="font-medium capitalize">{inv.status}</span></span>
                {inv.status !== 'cancelled'
                  ? <Button variant="outline" size="sm" onClick={() => update.mutate({ id: inv.id, patch: { status: 'cancelled' } }, { onSuccess: () => toast.success('Invoice cancelled') })}>Cancel invoice</Button>
                  : <Button variant="outline" size="sm" onClick={() => update.mutate({ id: inv.id, patch: { status: 'unpaid' } }, { onSuccess: () => toast.success('Invoice restored') })}>Restore</Button>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- page ---------------------------------- */
export default function BillingPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const tertiary = isTertiary(institution?.type);
  const currency = institution?.currency || 'NGN';
  const canManage = isSuperAdmin || hasRole('bursar', 'accountant', 'institution_admin', 'principal');

  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const scope = toScope(scopeState, tertiary);
  const patch = (p: Partial<ScopeState>) => setScopeState((s) => ({ ...s, ...p }));
  const terms = useTerms(scopeState.sessionId || null);
  const [termId, setTermId] = useState('');
  const [title, setTitle] = useState('School fees');
  const [due, setDue] = useState('');

  const generate = useGenerateInvoices(institutionId ?? '');

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data: invoices, isLoading } = useInvoices(institutionId ?? '', { sessionId: scopeState.sessionId, termId, status });
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return invoices ?? [];
    return (invoices ?? []).filter((i: InvoiceWithStudent) =>
      `${i.student.first_name} ${i.student.last_name} ${i.student.admission_number} ${i.reference}`.toLowerCase().includes(s));
  }, [invoices, search]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const onGenerate = () => {
    if (!scope) { toast.error(`Select a session and ${tertiary ? 'programme' : 'class arm'} first`); return; }
    generate.mutate({ scope, termId: termId || null, title: title.trim() || 'School fees', due: due || null }, {
      onSuccess: (n) => toast.success(n > 0 ? `Generated ${n} invoice${n === 1 ? '' : 's'}` : 'No new invoices (already billed or no matching fees)'),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Generate invoices and record payments — {institution?.name}</p>
      </header>

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Generate invoices</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ScopeSelector institutionId={institutionId} tertiary={tertiary} value={scopeState} onChange={patch} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Term</Label>
                <select className={selectClass} value={termId} onChange={(e) => setTermId(e.target.value)} disabled={!scopeState.sessionId}>
                  <option value="">Whole session</option>
                  {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onGenerate} disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />} Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search student or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${selectClass} sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(['unpaid', 'partial', 'paid', 'cancelled'] as InvoiceStatus[]).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!scopeState.sessionId && <p className="text-sm text-muted-foreground">Select a session to view invoices.</p>}
          {scopeState.sessionId && isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {scopeState.sessionId && !isLoading && !filtered.length && <p className="text-sm text-muted-foreground">No invoices found.</p>}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Student</th>
                    <th className="px-2 py-2 font-medium">Reference</th>
                    <th className="px-2 py-2 text-right font-medium">Total</th>
                    <th className="px-2 py-2 text-right font-medium">Balance</th>
                    <th className="px-2 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpenId(i.id)}>
                      <td className="px-2 py-2">{i.student.first_name} {i.student.last_name}<div className="text-xs text-muted-foreground">{i.student.admission_number}</div></td>
                      <td className="px-2 py-2 text-muted-foreground">{i.reference}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(Number(i.total), currency)}</td>
                      <td className="px-2 py-2 text-right font-medium">{formatMoney(Number(i.balance), currency)}</td>
                      <td className="px-2 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{titleCase(i.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {openId && <InvoiceDialog invoiceId={openId} onClose={() => setOpenId(null)} currency={currency} canManage={canManage} />}
    </div>
  );
}
