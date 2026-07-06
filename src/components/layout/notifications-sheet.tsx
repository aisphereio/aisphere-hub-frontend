'use client';

import { Bell, Check, Circle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, useNotificationMarkRead } from '@/hooks/use-ops';
import { useT } from '@/lib/i18n';
import { fmtTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Notification } from '@/lib/api/types';

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsSheet({ open, onOpenChange }: NotificationsSheetProps) {
  const t = useT();
  const { data: notifications = [], isLoading, refetch } = useNotifications(
    { pageNo: 1, pageSize: 50 },
    { enabled: open },
  );
  const markReadMutation = useNotificationMarkRead();

  const unread = notifications.filter((n: Notification) => !n.read);
  const read = notifications.filter((n: Notification) => n.read);

  const handleMarkRead = async (id: string) => {
    try {
      await markReadMutation.mutateAsync(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      for (const n of unread) {
        await markReadMutation.mutateAsync(n.id);
      }
      toast.success('All marked as read');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-violet-500" />
            {t('ops.notifications') || 'Notifications'}
            {unread.length > 0 && (
              <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-violet-600">
                {unread.length} {t('common.unread') || 'unread'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('ops.notificationsDesc') || 'Recent system notifications'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => refetch()}>
            {t('skills.refresh')}
          </Button>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleMarkAllRead}
              disabled={markReadMutation.isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              {t('common.markAllRead') || 'Mark all read'}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">{t('common.loading')}</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-xs">{t('ops.noNotifications') || 'No notifications'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Unread first */}
              {unread.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-violet-500/5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    {t('common.unread') || 'Unread'} · {unread.length}
                  </div>
                  {unread.map((n: Notification) => (
                    <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} />
                  ))}
                </>
              )}
              {read.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {t('common.read') || 'Read'} · {read.length}
                  </div>
                  {read.map((n: Notification) => (
                    <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} faded />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface NotificationRowProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  faded?: boolean;
}

function NotificationRow({ notification, onMarkRead, faded }: NotificationRowProps) {
  const t = useT();
  const n = notification;
  return (
    <div
      className={`px-4 py-3 hover:bg-accent/40 transition-colors group ${faded ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        <Circle
          className={`h-2 w-2 mt-1.5 shrink-0 ${n.read ? 'text-transparent' : 'fill-violet-500 text-violet-500'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium leading-tight">{n.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            {n.eventType && <Badge variant="outline" className="text-[9px] h-3.5 px-1">{n.eventType}</Badge>}
            {n.targetName && <span className="truncate font-mono">{n.targetName}</span>}
            {n.createTime && <span>· {fmtTime(n.createTime)}</span>}
          </div>
        </div>
        {!n.read && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onMarkRead(n.id)}
          >
            <Check className="h-3 w-3 mr-1" />
            {t('common.markRead') || 'Mark read'}
          </Button>
        )}
      </div>
    </div>
  );
}
