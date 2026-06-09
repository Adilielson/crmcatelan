import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from './use-auth';
import * as uazapi from '@/services/uazapi/uazapiService';

// Valor fixo exibido ao caller — o token real nunca sai do Supabase para o estado da UI.
const TOKEN_MASK = '••••••••••••••••';

type WhatsAppConfigRow = { instance_token: string };
type WhatsAppLogInsert = {
  tenant_id: string;
  recipient_phone: string;
  message_type: 'text' | 'image' | 'document';
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function loadTokenFromSupabase(tenantId: string): Promise<string | null> {
  const { data } = await db
    .from('whatsapp_config')
    .select('instance_token')
    .eq('tenant_id', tenantId)
    .single() as { data: WhatsAppConfigRow | null };
  return data?.instance_token ?? null;
}

async function logMessage(
  tenantId: string,
  phone: string,
  type: 'text' | 'image' | 'document',
  status: 'sent' | 'failed' | 'pending',
  errorMessage?: string
) {
  const payload: WhatsAppLogInsert = {
    tenant_id: tenantId,
    recipient_phone: phone,
    message_type: type,
    status,
    error_message: errorMessage ?? null,
  };
  await db.from('whatsapp_message_logs').insert(payload);
}

export function useWhatsApp() {
  const { tenant } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);

  // Carrega estado do token ao montar — garante persistência entre navegações
  useEffect(() => {
    if (!tenant?.id) return;
    loadTokenFromSupabase(tenant.id).then(token => {
      if (token) setHasToken(true);
    });
  }, [tenant?.id]);

  const saveInstanceToken = useCallback(
    async (rawToken: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      setIsLoading(true);
      try {
        const { error } = await db.from('whatsapp_config').upsert(
          {
            tenant_id: tenant.id,
            instance_token: rawToken,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );
        if (error) throw new Error(`Supabase: ${error.message}`);
        setHasToken(true);
      } finally {
        setIsLoading(false);
      }
    },
    [tenant?.id]
  );

  const checkStatus = useCallback(async (): Promise<void> => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const token = await loadTokenFromSupabase(tenant.id);
      if (!token) throw new Error('Token não configurado.');
      setHasToken(true);
      const status = await uazapi.checkInstanceStatus(token);
      setIsConnected(!!status.connected);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const fetchQRCode = useCallback(async (): Promise<void> => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const token = await loadTokenFromSupabase(tenant.id);
      if (!token) throw new Error('Token não configurado.');
      const result = await uazapi.getQRCode(token);
      setQrCode(result.base64 ?? result.qrcode ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const token = await loadTokenFromSupabase(tenant.id);
      if (!token) throw new Error('Token não configurado.');
      await uazapi.disconnectInstance(token);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const sendText = useCallback(
    async (phone: string, text: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      const token = await loadTokenFromSupabase(tenant.id);
      if (!token) throw new Error('Token não configurado.');
      try {
        await uazapi.sendTextMessage(token, phone, text);
        await logMessage(tenant.id, phone, 'text', 'sent');
      } catch (err) {
        await logMessage(tenant.id, phone, 'text', 'failed', String(err));
        throw err;
      }
    },
    [tenant?.id]
  );

  const sendImage = useCallback(
    async (phone: string, imageUrl: string, caption?: string): Promise<void> => {
      if (!tenant?.id) throw new Error('Sem tenant ativo.');
      const token = await loadTokenFromSupabase(tenant.id);
      if (!token) throw new Error('Token não configurado.');
      try {
        await uazapi.sendImageMessage(token, phone, imageUrl, caption);
        await logMessage(tenant.id, phone, 'image', 'sent');
      } catch (err) {
        await logMessage(tenant.id, phone, 'image', 'failed', String(err));
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
    // Token real nunca exposto — somente máscara visual
    tokenDisplay: hasToken ? TOKEN_MASK : '',
    saveInstanceToken,
    checkStatus,
    fetchQRCode,
    disconnect,
    sendText,
    sendImage,
  };
}
