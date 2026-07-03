import { Loader2, BedDouble } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../../providers/app-providers';
import { useMyAllocations } from './hostel-api';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function MyHostelPage() {
  const { institution, institutionId } = useTenant();
  const allocations = useMyAllocations();

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Hostel</h1>
        <p className="text-sm text-muted-foreground">Accommodation — {institution?.name}</p>
      </header>

      {allocations.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!allocations.isLoading && !allocations.data?.length && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hostel bed allocated.</CardContent></Card>
      )}

      {allocations.data?.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50"><BedDouble className="h-6 w-6 text-sky-600" /></span>
            <div>
              <p className="font-medium">{a.room?.hostel?.name ?? 'Hostel'}</p>
              <p className="text-sm text-muted-foreground">
                Room {a.room?.room_number}{a.room?.floor ? ` · floor ${a.room.floor}` : ''}
                {a.room?.hostel?.gender ? ` · ${cap(a.room.hostel.gender)}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Since {new Date(a.allocated_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
