import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from './use-auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface WhatsAppMessage {
  id: string;
  phone: string;
  text: string;
  type: string;
  status: string; // 'received' | 'sent' | 'failed'
  at: string;
  fromMe: boolean;
}

export interface WhatsAppConversation {
  phone: string;
  lastText: string;
  lastAt: string;
  unread: number;
  messages: WhatsAppMessage[];
}

function mapRow(row: {
  id: string;
  recipient_phone: string;
  message_type: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}): WhatsAppMessage {
  return {
    id: row.id,
    phone: row.recipient_phone,
    text: row.error_message ?? '',
    type: row.message_type,
    status: row.status,
    at: row.sent_at,
    fromMe: row.status === 'sent',
  };
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatChatTime(iso: string) {
  return timeLabel(iso);
}

export function formatPhoneLast4(phone: string) {
  const d = phone.replace(/\D+/g, '');
  return d.slice(-4);
}

export function formatPhoneDisplay(phone: string) {
  const d = phone.replace(/\D+/g, '');
  if (d.length >= 12) {
    const cc = d.slice(0, d.length - 11);
    const ddd = d.slice(-11, -9);
    const p1 = d.slice(-9, -4);
    const p2 = d.slice(-4);
    return `+${cc} (${ddd}) ${p1}-${p2}`;
  }
  if (d.length >= 10) {
    const ddd = d.slice(0, 2);
    const p1 = d.slice(2, d.length - 4);
    const p2 = d.slice(-4);
    return `(${ddd}) ${p1}-${p2}`;
  }
  return phone;
}

export function useWhatsAppChat() {
  const { tenant } = useAuthStore();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const { data, error } = await db
      .from('whatsapp_message_logs')
      .select('id, recipient_phone, message_type, status, error_message, sent_at')
      .eq('tenant_id', tenant.id)
      .order('sent_at', { ascending: true })
      .limit(500);
    if (!error && data) {
      setMessages((data as Parameters<typeof mapRow>[0][]).map(mapRow));
    }
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: novas mensagens recebidas/enviadas
  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabase
      .channel(`whatsapp-msg-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_message_logs',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const row = payload.new as Parameters<typeof mapRow>[0];
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, mapRow(row)]
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id]);

  // Agrupa por número
  const conversations: WhatsAppConversation[] = (() => {
    const map = new Map<string, WhatsAppConversation>();
    for (const m of messages) {
      const c = map.get(m.phone) ?? {
        phone: m.phone,
        lastText: '',
        lastAt: m.at,
        unread: 0,
        messages: [],
      };
      c.messages.push(m);
      if (m.at >= c.lastAt) {
        c.lastAt = m.at;
        c.lastText = m.text || `[${m.type}]`;
      }
      if (!m.fromMe) c.unread += 1;
      map.set(m.phone, c);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.lastAt < b.lastAt ? 1 : -1
    );
  })();

  return { conversations, loading, reload: load };
}
