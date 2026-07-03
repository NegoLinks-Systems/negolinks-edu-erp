import { Loader2, Bus, MapPin, Phone } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../../providers/app-providers';
import { useMyTransport } from './transport-api';
import { formatMoney } from '../finance/finance-api';

export default function MyTransportPage() {
  const { institution, institutionId } = useTenant();
  const currency = institution?.currency || 'NGN';
  const assignments = useMyTransport();

  if (!institutionId) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No institution linked to your account.</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold">Transport</h1>
        <p className="text-sm text-muted-foreground">Bus route — {institution?.name}</p>
      </header>

      {assignments.isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!assignments.isLoading && !assignments.data?.length && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Not assigned to a transport route.</CardContent></Card>
      )}

      {assignments.data?.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50"><Bus className="h-6 w-6 text-amber-600" /></span>
              <div>
                <p className="font-medium">{a.route?.name ?? 'Route'}</p>
                <p className="text-sm text-muted-foreground">{formatMoney(Number(a.route?.fare ?? 0), currency)} / term</p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {a.stop?.name && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {a.stop.name}{a.stop.pickup_time ? ` · ${a.stop.pickup_time}` : ''}</p>}
              {a.route?.vehicle?.name && <p className="flex items-center gap-2"><Bus className="h-4 w-4 text-muted-foreground" /> {a.route.vehicle.name}{a.route.vehicle.plate_number ? ` · ${a.route.vehicle.plate_number}` : ''}</p>}
              {a.route?.vehicle?.driver_name && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {a.route.vehicle.driver_name}{a.route.vehicle.driver_phone ? ` · ${a.route.vehicle.driver_phone}` : ''}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
