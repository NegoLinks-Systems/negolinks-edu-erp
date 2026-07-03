import { Bell } from 'lucide-react';
import { useUnreadCount } from './notifications-api';

/** Small bell for the app header/nav. Links to the inbox route and shows
 *  the live unread count (polled). Wire the href to your router if needed. */
export default function NotificationBell({ href = '/inbox' }: { href?: string }) {
  const { data: unread } = useUnreadCount();
  const count = unread ?? 0;

  return (
    <a href={href} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </a>
  );
}
