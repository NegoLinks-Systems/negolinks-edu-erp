import { Loader2, BookOpen, AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../../providers/app-providers';
import { useMyLoans, useLibrarySettings, computeFine, type LoanRow } from './library-api';
import { formatMoney } from '../finance/finance-api';

const today = () => new Date().toISOString().slice(0, 10);

export default function MyLibraryPage() {
  const { institution, institutionId } = useTenant();
  const currency = institution?.currency || 'NGN';
  const loans = useMyLoans();
  const settings = useLibrarySettings(institutionId ?? '');
  const finePerDay = settings.data?.fine_per_day ?? 0;

  const active = (loans.data ?? []).filter((l) => !l.returned_at);
  const history = (loans.data ?? []).filter((l) => l.returned_at);

  const Row = ({ l }: { l: LoanRow }) => {
    const overdue = !l.returned_at && l.due_date < today();
    const fine = overdue ? computeFine(l.due_date, finePerDay).fine : l.fine_amount;
    return (
      <div className="flex items-start gap-3 rounded-md border px-3 py-2">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{l.book?.title ?? 'Book'}</p>
          <p className="text-xs text-muted-foreground">
            {l.returned_at ? `Returned ${l.returned_at}` : `Due ${l.due_date}`}
            {overdue && <span className="ml-1 inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> overdue</span>}
            {Number(fine) > 0 && ` · fine ${formatMoney(Number(fine), currency)}${l.returned_at && l.fine_paid ? ' (paid)' : ''}`}
          </p>
        </div>
      </div>
    );
  };

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">My library</h1>
        <p className="text-sm text-muted-foreground">Books you’ve borrowed — {institution?.name}</p>
      </header>

      {loans.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}

      {!loans.isLoading && (
        <>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm font-medium">Currently borrowed</p>
              {active.length === 0 ? <p className="text-sm text-muted-foreground">No books on loan.</p> : active.map((l) => <Row key={l.id} l={l} />)}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="space-y-2 pt-6">
                <p className="text-sm font-medium">History</p>
                {history.map((l) => <Row key={l.id} l={l} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
