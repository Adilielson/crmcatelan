import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from './use-auth';

const TOKEN_MASK = '••••••••••••••••';

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
  const initDone = useRef(false);

  // Carrega token e status persistido ao montar
  useEffect(() => {
    if (!tenant?.id || initDone.current) return;
    initDone.current = true;
    (async () => {
      const { data } = await supabase
        .from('whatsapp_config')
        .select('instance_token, is_connected')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (data?.instance_token) {
        setHasToken(true);
        setIsConnected(!!data.is_connected);
      }
    })();
  }, [tenant?.id]);

  const saveInstanceToken = useCallback(
    async (rawToken: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      setIsLoading(true);
      try {
        const { error } = await supabase.from('whatsapp_config').upsert(
          {
            tenant_id: tenant.id,
            instance_token: rawToken,
            is_active: true,
            is_connected: false,
            webhook_registered: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );
        if (error) throw new Error(`Supabase: ${error.message} (${error.code})`);
        setHasToken(true);

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
      const result = await callManage('check-status', tenant.id);
      const connected = !!result.connected;
      setIsConnected(connected);
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
        await supabase.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'text',
          status: 'sent',
          error_message: null,
        });
      } catch (err) {
        await supabase.from('whatsapp_message_logs').insert({
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
    async (phone: string, imageUrl: string, caption?: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      try {
        await callManage('send-image', tenant.id, { phone, imageUrl, caption });
        await supabase.from('whatsapp_message_logs').insert({
          tenant_id: tenant.id,
          recipient_phone: phone,
          message_type: 'image',
          status: 'sent',
          error_message: null,
        });
      } catch (err) {
        await supabase.from('whatsapp_message_logs').insert({
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

  return {
    isLoading,
    isConnected,
    qrCode,
    hasToken,
    tokenDisplay: hasToken ? TOKEN_MASK : '',
    saveInstanceToken,
    checkStatus,
    fetchQRCode,
    disconnect,
    sendText,
    sendImage,
  };
}
