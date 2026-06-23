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
const PAGE_SIZE = 1000;

// Cache de URLs assinadas por message id, evita gerar novas URLs a cada poll
// (caso contrário o <audio src> muda de string e o player reinicia, cortando
// a reprodução no meio).
interface CachedUrl { url: string; expiresAt: number }
const signedUrlCache = new Map<string, CachedUrl>();
const SIGNED_URL_TTL_SEC = 60 * 60; // 1h
const SIGNED_URL_REFRESH_BEFORE_MS = 5 * 60 * 1000; // renova 5min antes

async function resolveMediaUrl(row: Pick<LogRow, 'id' | 'media_storage_path' | 'media_url'>): Promise<string | null> {
  if (row.media_storage_path) {
    const cached = signedUrlCache.get(row.id);
    if (cached && cached.expiresAt - Date.now() > SIGNED_URL_REFRESH_BEFORE_MS) {
      return cached.url;
    }
    const { data } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(row.media_storage_path, SIGNED_URL_TTL_SEC);
    if (data?.signedUrl) {
      signedUrlCache.set(row.id, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
      });
      return data.signedUrl;
    }
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

export function mediaLabel(type: string | null | undefined, mime?: string | null): string {
  const t = (type || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (t.includes('audio') || m.startsWith('audio/')) return '🎤 Áudio';
  if (t.includes('image') || t.includes('sticker') || m.startsWith('image/')) return '📷 Imagem';
  if (t.includes('video') || m.startsWith('video/')) return '🎬 Vídeo';
  if (t.includes('document') || t.includes('file')) return '📄 Documento';
  if (t.includes('location')) return '📍 Localização';
  if (t.includes('contact')) return '👤 Contato';
  return 'Mensagem';
}

export function useWhatsAppChat() {
  const { tenant } = useAuthStore();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!tenant?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const allRows: LogRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from('whatsapp_message_logs')
        .select('id, recipient_phone, message_type, status, error_message, sent_at, sender_name, sender_avatar_url, media_url, media_mime, media_storage_path')
        .eq('tenant_id', tenant.id)
        .order('sent_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) break;
      const page = (data ?? []) as LogRow[];
      allRows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    if (allRows.length) {
      const rows = allRows.sort((a, b) => (a.sent_at > b.sent_at ? 1 : -1));
      const resolved = await Promise.all(rows.map((r) => resolveMediaUrl(r)));
      setMessages(rows.map((r, i) => mapRowSync(r, resolved[i])));
    } else {
      setMessages([]);
    }
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  // Fallback de sincronização: se o realtime perder algum evento enquanto a aba
  // está em segundo plano, a lista se atualiza sozinha sem depender de reload.
  useEffect(() => {
    if (!tenant?.id) return;
    const id = window.setInterval(() => { void load(true); }, 15_000);
    return () => window.clearInterval(id);
  }, [tenant?.id, load]);

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
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, mapRowSync(row, resolved)].sort((a, b) => (a.at > b.at ? 1 : -1))
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
      // Apenas mensagens recebidas (do lead) definem o nome/avatar do contato.
      // Mensagens enviadas têm sender_name do atendente/IA ("Atendente", "IA SDR", etc.).
      if (!m.fromMe && m.senderName) c.name = m.senderName;
      if (!m.fromMe && m.senderAvatarUrl) c.avatarUrl = m.senderAvatarUrl;
      if (m.at >= c.lastAt) {
        c.lastAt = m.at;
        c.lastText = m.text || mediaLabel(m.type, m.mediaMime);
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
