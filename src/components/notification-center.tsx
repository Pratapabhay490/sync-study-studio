import { Bell, BellRing, Check, Trash2 } from "lucide-react";
import { useNotifications } from "@/lib/notifications-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export function NotificationCenter() {
  const { notifications, unread, pushEnabled, enablePush, disablePush, sendTestPush, markAllRead, markRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-2xl bg-card text-foreground shadow-clay-sm transition active:scale-95 hover:-translate-y-0.5"
          aria-label="Notifications"
        >
          {unread > 0 ? <BellRing className="h-4 w-4 animate-pulse" /> : <Bell className="h-4 w-4" />}
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-gradient-primary px-1 text-[10px] font-bold text-white shadow-clay-sm">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="clay w-80 border-0 p-0">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <div>
            <div className="font-display text-sm font-bold">Notifications</div>
            <div className="text-[11px] text-muted-foreground">{unread} unread</div>
          </div>
          <div className="flex gap-1">
            {!pushEnabled ? (
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={enablePush}>
                Enable push
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={sendTestPush} title="Send yourself a test push">
                Test
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Mark all read" onClick={markAllRead}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Clear" onClick={clearAll}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary/10 text-primary">🔔</div>
              You're all caught up.
            </div>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      if (n.subjectId) navigate({ to: "/subjects/$id", params: { id: n.subjectId } });
                    }}
                    className={`w-full rounded-2xl p-3 text-left transition hover:shadow-clay-sm hover:-translate-y-0.5 ${n.read ? "bg-transparent" : "bg-primary/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{n.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{n.body}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                          {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
