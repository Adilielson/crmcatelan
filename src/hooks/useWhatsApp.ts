import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from './use-auth';

const TOKEN_MASK = '••••••••••••••••';

// Cast necessário: supabase-js v2 + TS 5.9 não infere corretamente tabelas
// adicionadas manualmente ao types.ts — resulta em tipo 'never'.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Todas as chamadas ao uazapi passam pela Edge Function (evita CORS)
async function callManage(
  action: string,
  tenantId: string,
  extra?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('whatsapp-manage', {
    body: { action, tenant_id: tenantId, ...extra },
  });
  if (error) {
    let msg = error.message || `Erro na função: ${action}`;
    try {
      const ctx =
        typeof error.context === 'string'
          ? JSON.parse(error.context)
          : error.context;
      if (ctx?.error) msg = ctx.error;
    } catch { /* ignore */ }
    // Mensagem amigável quando o número não está no WhatsApp
    if (msg.toLowerCase().includes('not on whatsapp') || msg.toLowerCase().includes('is not on whatsapp')) {
      msg = 'Este número não possui WhatsApp.';
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, unknown>;
}

export function useWhatsApp() {
  const { tenant } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const initDone = useRef(false);

  // Carrega status persistido (token nunca é exposto ao navegador)
  useEffect(() => {
    if (!tenant?.id || initDone.current) return;
    initDone.current = true;
    (async () => {
      const { data, error } = await db.rpc('get_whatsapp_config_status', { _tenant_id: tenant.id });
      if (error) {
        console.warn('[whatsapp] get_whatsapp_config_status:', error.message);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.has_token) {
        setHasToken(true);
        setIsConnected(!!row.is_connected);
        setConnectedPhone(row.connected_phone ?? null);
        setConnectedName(row.connected_name ?? null);
      }
    })();
  }, [tenant?.id]);

  const saveInstanceToken = useCallback(
    async (rawToken: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      setIsLoading(true);
      try {
        const { error } = await db.rpc('upsert_whatsapp_instance_token', {
          _tenant_id: tenant.id,
          _instance_token: rawToken,
        }) as { error: { message: string; code?: string } | null };
        if (error) throw new Error(`Supabase: ${error.message}${error.code ? ` (${error.code})` : ''}`);
        setHasToken(true);
        setIsConnected(false);
        setConnectedPhone(null);
        setConnectedName(null);

        // Registra webhook automaticamente após salvar
        try {
          await callManage('register-webhook', tenant.id);
        } catch (e) {
          console.warn('[whatsapp] webhook registration:', e);
        }

        // Verifica status automaticamente
        try {
          const result = await callManage('check-status', tenant.id);
          setIsConnected(!!result.connected);
        } catch (e) {
          console.warn('[whatsapp] auto check-status:', e);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [tenant?.id]
  );

  const checkStatus = useCallback(async (): Promise<boolean> => {
    if (!tenant?.id) return false;
    setIsLoading(true);
    try {
      const result = await callManage('check-status', tenant.id) as { connected?: boolean; phone?: string | null; name?: string | null };
      const connected = !!result.connected;
      setIsConnected(connected);
      if (connected) {
        if (result.phone) setConnectedPhone(result.phone);
        if (result.name) setConnectedName(result.name);
      }
      return connected;
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const fetchQRCode = useCallback(async (): Promise<void> => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const result = await callManage('qrcode', tenant.id);
      const connected = !!result.connected;
      setIsConnected(connected);
      setQrCode(connected ? null : (result.qrcode as string | null) ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      await callManage('disconnect', tenant.id);
      setIsConnected(false);
      setQrCode(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const sendText = useCallback(
    async (phone: string, text: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      try {
        await callManage('send-text', tenant.id, { phone, message: text });
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'text',
          status: 'sent',
          error_message: text,
        });
      } catch (err) {
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'text',
          status: 'failed',
          error_message: String(err),
        });
        throw err;
      }
    },
    [tenant?.id]
  );

  const sendImage = useCallback(
    async (phone: string, imageUrl: string, caption?: string, mime?: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      try {
        await callManage('send-image', tenant.id, { phone, imageUrl, caption });
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'image',
          status: 'sent',
          error_message: caption ?? null,
          media_url: imageUrl,
          media_mime: mime ?? 'image/jpeg',
        });
      } catch (err) {
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'image',
          status: 'failed',
          error_message: String(err),
        });
        throw err;
      }
    },
    [tenant?.id]
  );

  const sendAudio = useCallback(
    async (phone: string, audioUrl: string, mime?: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      try {
        await callManage('send-audio', tenant.id, { phone, audioUrl });
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'audio',
          status: 'sent',
          error_message: null,
          media_url: audioUrl,
          media_mime: mime ?? 'audio/ogg',
        });
      } catch (err) {
        await db.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'audio',
          status: 'failed',
          error_message: String(err),
        });
        throw err;
      }
    },
    [tenant?.id]
  );

  return {
    isLoading,
    isConnected,
    qrCode,
    hasToken,
    tokenDisplay: hasToken ? TOKEN_MASK : '',
    connectedPhone,
    connectedName,
    saveInstanceToken,
    checkStatus,
    fetchQRCode,
    disconnect,
    sendText,
    sendImage,
    sendAudio,
  };
}
