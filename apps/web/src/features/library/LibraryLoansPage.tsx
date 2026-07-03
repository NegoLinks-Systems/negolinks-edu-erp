import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { useTenant } from '../../providers/app-providers';
import { useLoans, useReturnBook, useLibrarySettings, computeFine, type LoanRow } from './library-api';
import { formatMoney } from '../finance/finance-api';

const today = () => new Date().toISOString().slice(0, 10);
const borrowerName = (l: LoanRow) =>
  l.student ? `${l.student.first_name} ${l.student.last_name}` : l.staff ? `${l.staff.first_name} ${l.staff.last_name}` : '—';
const borrowerKind = (l: LoanRow) => (l.student ? `Student · ${l.student.admission_number}` : 'Staff');

function ReturnDialog({ loan, finePerDay, currency, institutionId, onClose }: {
  loan: LoanRow; finePerDay: number; currency: string; institutionId: string; onClose: () => void;
}) {
  const ret = useReturnBook(institutionId);
  const { fine, daysOverdue } = computeFine(loan.due_date, finePerDay);
  const [paid, setPaid] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Return “{loan.book?.title}”</DialogTitle>
          <DialogDescription>Borrowed by {borrowerName(loan)}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span>{loan.due_date}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Days overdue</span><span>{daysOverdue}</span></div>
          <div className="flex justify-between font-medium"><span>Fine</span><span className={fine > 0 ? 'text-red-600' : ''}>{formatMoney(fine, currency)}</span></div>
          {fine > 0 && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="paid">Fine paid now</Label>
              <Switch id="paid" checked={paid} onCheckedChange={setPaid} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => ret.mutate(
            { id: loan.id, fine_amount: fine, fine_paid: fine > 0 ? paid : true },
            { onSuccess: () => { toast.success('Book returned'); onClose(); }, onError: (e: Error) => toast.error(e.message) },
          )} disabled={ret.isPending}>{ret.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LibraryLoansPage() {
  const { institution, institutionId, hasRole, isSuperAdmin } = useTenant();
  const canManage = isSuperAdmin || hasRole('librarian', 'institution_admin', 'principal');
  const currency = institution?.currency || 'NGN';

  const [filter, setFilter] = useState<'active' | 'overdue' | 'all'>('active');
  const loans = useLoans(institutionId ?? '', filter);
  const settings = useLibrarySettings(institutionId ?? '');
  const finePerDay = settings.data?.fine_per_day ?? 0;
  const [returning, setReturning] = useState<LoanRow | null>(null);

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }
  if (!canManage) {
    return <div className="py-16 text-center text-sm text-muted-foreground">You don’t have access to library loans.</div>;
  }

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'active', label: 'On loan' }, { key: 'overdue', label: 'Overdue' }, { key: 'all', label: 'All' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Loans</h1>
        <p className="text-sm text-muted-foreground">Issued books and fines — {institution?.name}</p>
      </header>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === t.key ? 'bg-primary text-primary-foreground' : 'border'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {loans.isLoading && <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {!loans.isLoading && !loans.data?.length && <p className="text-sm text-muted-foreground">Nothing here.</p>}
          {loans.data?.map((l) => {
            const overdue = !l.returned_at && l.due_date < today();
            const liveFine = overdue ? computeFine(l.due_date, finePerDay).fine : 0;
            return (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.book?.title ?? 'Unknown book'}</p>
                  <p className="text-xs text-muted-foreground">{borrowerName(l)} · {borrowerKind(l)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Due {l.due_date}
                    {l.returned_at
                      ? ` · returned ${l.returned_at}${l.fine_amount > 0 ? ` · fine ${formatMoney(l.fine_amount, currency)} ${l.fine_paid ? '(paid)' : '(unpaid)'}` : ''}`
                      : overdue
                        ? <span className="ml-1 inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> overdue · fine {formatMoney(liveFine, currency)}</span>
                        : ' · on loan'}
                  </p>
                </div>
                {!l.returned_at && (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setReturning(l)}>
                    <RotateCcw className="mr-1 h-4 w-4" /> Return
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {returning && <ReturnDialog loan={returning} finePerDay={finePerDay} currency={currency} institutionId={institutionId} onClose={() => setReturning(null)} />}
    </div>
  );
}
