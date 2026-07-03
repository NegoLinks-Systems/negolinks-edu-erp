import { Loader2, Bell, Check, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications, useMarkRead, useMarkAllRead } from './notifications-api';

const CATEGORY_STYLE: Record<string, string> = {
  fee: 'bg-red-100 text-red-700', result: 'bg-violet-100 text-violet-700',
  attendance: 'bg-emerald-100 text-emerald-700', exam: 'bg-amber-100 text-amber-700',
  library: 'bg-sky-100 text-sky-700', event: 'bg-pink-100 text-pink-700', general: 'bg-zinc-200 text-zinc-700',
};

const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function InboxPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = (data ?? []).filter((notif) => !notif.read_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {markAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Mark all read
          </Button>
        )}
      </header>

      {isLoading && <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
      {!isLoading && !data?.length && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-6 w-6 opacity-50" />No notifications yet.</CardContent></Card>
      )}

      <div className="space-y-2">
        {data?.map((notif) => (
          <Card key={notif.id} className={notif.read_at ? '' : 'border-l-4 border-l-primary'}>
            <CardContent className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLE[notif.category] ?? CATEGORY_STYLE.general}`}>{notif.category}</span>
                  <p className="truncate text-sm font-medium">{notif.title}</p>
                </div>
                {notif.body && <p className="mt-1 text-sm text-muted-foreground">{notif.body}</p>}
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{ago(notif.created_at)}</span>
                  {notif.link && <a href={notif.link} className="inline-flex items-center gap-1 text-xs font-medium text-primary">View <ArrowRight className="h-3 w-3" /></a>}
                </div>
              </div>
              {!notif.read_at && (
                <Button variant="ghost" size="icon" title="Mark read" onClick={() => markRead.mutate([notif.id])}><Check className="h-4 w-4" /></Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
