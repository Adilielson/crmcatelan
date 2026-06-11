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
  senderName: string | null;
  senderAvatarUrl: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
}

export interface WhatsAppConversation {
  phone: string;
  name: string | null;
  avatarUrl: string | null;
  lastText: string;
  lastAt: string;
  unread: number;
  messages: WhatsAppMessage[];
}

interface LogRow {
  id: string;
  recipient_phone: string;
  message_type: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_storage_path: string | null;
}

const MEDIA_BUCKET = 'whatsapp-media';

async function resolveMediaUrl(row: Pick<LogRow, 'media_storage_path' | 'media_url'>): Promise<string | null> {
  if (row.media_storage_path) {
    const { data } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(row.media_storage_path, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  }
  return row.media_url;
}

function mapRowSync(row: LogRow, resolvedUrl: string | null): WhatsAppMessage {
  return {
    id: row.id,
    phone: row.recipient_phone,
    text: row.error_message ?? '',
    type: row.message_type,
    status: row.status,
    at: row.sent_at,
    fromMe: row.status === 'sent',
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url,
    mediaUrl: resolvedUrl,
    mediaMime: row.media_mime,
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
  // Brasil: 55 + DDD(2) + 9 dígitos = 13
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  // Brasil sem 9: 55 + DDD(2) + 8 = 12
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  // Local com DDD: 11 dígitos
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function getContactInitials(name: string | null, phone: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? '');
    return (a + b).toUpperCase();
  }
  return formatPhoneLast4(phone).slice(0, 2);
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
      .select('id, recipient_phone, message_type, status, error_message, sent_at, sender_name, sender_avatar_url, media_url, media_mime, media_storage_path')
      .eq('tenant_id', tenant.id)
      .order('sent_at', { ascending: true })
      .limit(500);
    if (!error && data) {
      const rows = data as LogRow[];
      const resolved = await Promise.all(rows.map((r) => resolveMediaUrl(r)));
      setMessages(rows.map((r, i) => mapRowSync(r, resolved[i])));
    }
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: novas mensagens
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
        async (payload) => {
          const row = payload.new as LogRow;
          const resolved = await resolveMediaUrl(row);
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, mapRowSync(row, resolved)]
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id]);


  // Agrupa por número, escolhendo o nome/avatar mais recente disponível
  const conversations: WhatsAppConversation[] = (() => {
    const map = new Map<string, WhatsAppConversation>();
    for (const m of messages) {
      const c = map.get(m.phone) ?? {
        phone: m.phone,
        name: null,
        avatarUrl: null,
        lastText: '',
        lastAt: m.at,
        unread: 0,
        messages: [],
      };
      c.messages.push(m);
      if (m.senderName) c.name = m.senderName;
      if (m.senderAvatarUrl) c.avatarUrl = m.senderAvatarUrl;
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
