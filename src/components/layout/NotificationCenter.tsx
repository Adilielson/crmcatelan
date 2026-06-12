import React, { useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  Brain,
  TrendingDown,
  Circle,
  Clock
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useNotificationStore, Notification } from '@/store/useNotificationStore';
import { useAuthStore } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';

export const NotificationCenter = () => {
  const { notifications, markAsRead, markAllAsRead, setNotifications, upsertNotification } = useNotificationStore();
  const user = useAuthStore((s) => s.user);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase.from('notifications') as any)
        .select('id, title, message, category, read_at, created_at, link')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled && data) {
        setNotifications(data as unknown as Notification[]);
      }
    })();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${user.id}` },
        (payload) => {
          upsertNotification(payload.new as unknown as Notification);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, setNotifications, upsertNotification]);

  const getIcon = (category: Notification['category']) => {
    switch (category) {
      case 'ai_training': return <Brain className="w-4 h-4 text-blue-500" />;
      case 'performance': return <TrendingDown className="w-4 h-4 text-amber-500" />;
      case 'system_error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'lead_alert':
      case 'sla_warning': return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-ink hover:bg-gray-100">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white border-border shadow-card" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-bold text-sm text-ink">Notificações</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 gap-1"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3 h-3" /> Ler todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma notificação por aqui.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  className={cn(
                    "p-4 border-b border-border hover:bg-gray-50 transition-colors flex gap-3 cursor-pointer relative",
                    !n.read_at && "bg-primary/5"
                  )}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="shrink-0 mt-1">
                    {getIcon(n.category)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-xs font-bold leading-none", !n.read_at ? "text-slate-900" : "text-slate-500")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-normal">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.read_at && (
                    <div className="absolute top-4 right-4">
                      <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="link" size="sm" className="text-xs">Ver todas as notificações</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
