import { useMemo, useState, useEffect } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { useTenant } from '../../providers/app-providers';
import { useMyStudents } from '../results/student-results-api';
import { formatMoney } from './finance-api';
import { useStudentInvoices, type StudentInvoice } from './student-finance-api';
import { ReceiptButton, type ReceiptCore } from './receipt';
import type { InvoiceStatus, Payment } from '../../lib/database.types';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';
const STATUS_STYLE: Record<InvoiceStatus, string> = {
  unpaid: 'bg-red-100 text-red-800', partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-zinc-200 text-zinc-700',
};
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function StudentFinancePage() {
  const { institution, institutionId } = useTenant();
  const currency = institution?.currency || 'NGN';

  const students = useMyStudents();
  const [studentId, setStudentId] = useState('');
  useEffect(() => { if (!studentId && students.data?.length === 1) setStudentId(students.data[0].id); }, [students.data, studentId]);

  const student = students.data?.find((s) => s.id === studentId);
  const { data: invoices, isLoading } = useStudentInvoices(studentId);
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const active = (invoices ?? []).filter((i) => i.status !== 'cancelled');
    return {
      billed: active.reduce((s, i) => s + (Number(i.total) - Number(i.discount)), 0),
      paid: active.reduce((s, i) => s + Number(i.amount_paid), 0),
      balance: active.reduce((s, i) => s + Number(i.balance), 0),
    };
  }, [invoices]);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  const assemble = (inv: StudentInvoice, p: Payment): () => ReceiptCore => () => ({
    institution: { name: institution!.name, address: institution!.address, contact: institution!.phone || institution!.email, logoUrl: institution!.logo_url },
    receiptNo: p.reference, date: p.paid_at,
    student: { name: `${student!.last_name} ${student!.first_name}`, admissionNumber: student!.admission_number },
    invoice: { reference: inv.reference, title: inv.title, balance: Number(inv.balance) },
    amount: Number(p.amount), method: titleCase(p.method), currency,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Fees &amp; payments</h1>
        <p className="text-sm text-muted-foreground">Invoices, balances and receipts — {institution?.name}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm space-y-1.5">
            <Label>Student</Label>
            <select className={selectClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.data?.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.admission_number}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {studentId && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Billed</p><p className="text-lg font-semibold">{formatMoney(summary.billed, currency)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Paid</p><p className="text-lg font-semibold text-emerald-600">{formatMoney(summary.paid, currency)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-semibold text-red-600">{formatMoney(summary.balance, currency)}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="space-y-2 pt-6">
              {isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
              {!isLoading && !invoices?.length && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
              {invoices?.map((inv) => (
                <div key={inv.id} className="rounded-lg border">
                  <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setOpenId(openId === inv.id ? null : inv.id)}>
                    <span className="flex items-center gap-2">
                      <ChevronRight className={`h-4 w-4 transition-transform ${openId === inv.id ? 'rotate-90' : ''}`} />
                      <span>
                        <span className="font-medium">{inv.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{inv.reference}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">{formatMoney(Number(inv.balance), currency)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status]}`}>{titleCase(inv.status)}</span>
                    </span>
                  </button>

                  {openId === inv.id && (
                    <div className="space-y-3 border-t bg-muted/30 px-3 py-3">
                      <div className="rounded-md border bg-background">
                        {inv.items.map((it) => (
                          <div key={it.id} className="flex justify-between border-b px-3 py-1.5 text-sm last:border-b-0">
                            <span>{it.description}</span><span>{formatMoney(Number(it.amount), currency)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between px-3 py-1.5 text-sm font-medium">
                          <span>Total</span><span>{formatMoney(Number(inv.total), currency)}</span>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Payments</p>
                        {inv.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded yet.</p>}
                        <div className="space-y-1">
                          {inv.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5 text-sm">
                              <span>{formatMoney(Number(p.amount), currency)} · {titleCase(p.method)}
                                <span className="text-xs text-muted-foreground"> · {new Date(p.paid_at).toLocaleDateString()}</span>
                              </span>
                              <ReceiptButton paymentId={p.id} assemble={assemble(inv, p)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
