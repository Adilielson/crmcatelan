import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { toast } from 'sonner';
import {
  MessageSquare,
  Wifi,
  WifiOff,
  QrCode,
  LogOut,
  ShieldCheck,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  Phone,
} from 'lucide-react';

const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

export function WhatsAppConfig() {
  const {
    isLoading,
    isConnected,
    qrCode,
    hasToken,
    tokenDisplay,
    connectedPhone,
    connectedName,
    saveInstanceToken,
    checkStatus,
    fetchQRCode,
    disconnect,
  } = useWhatsApp();

  // Formata exibição do número (ex: +55 27 99617-1689) ou retorna apenas os 4 finais
  const formatPhone = (p: string | null) => {
    if (!p) return null;
    const d = p.replace(/\D+/g, '');
    if (d.length < 4) return p;
    const last4 = d.slice(-4);
    if (d.length >= 12) {
      const cc = d.slice(0, d.length - 11);
      const ddd = d.slice(-11, -9);
      const part1 = d.slice(-9, -4);
      return `+${cc} (${ddd}) ${part1}-${last4}`;
    }
    return `••• •••• ${last4}`;
  };
  const phoneFormatted = formatPhone(connectedPhone);
  const last4 = connectedPhone ? connectedPhone.replace(/\D+/g, '').slice(-4) : null;

  const [tokenInput, setTokenInput] = useState('');
  const [showTokenText, setShowTokenText] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Quando QR é exibido, faz polling a cada 10s para detectar conexão
  useEffect(() => {
    if (!showQR || isConnected) return;
    const interval = setInterval(async () => {
      try {
        const connected = await checkStatus();
        if (connected) {
          setShowQR(false);
          toast.success('WhatsApp conectado!');
        }
      } catch { /* silencioso */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, [showQR, isConnected, checkStatus]);

  // Fecha QR quando conectar
  useEffect(() => {
    if (isConnected) setShowQR(false);
  }, [isConnected]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      toast.error('Informe o token da instância.');
      return;
    }
    try {
      await saveInstanceToken(tokenInput.trim());
      setTokenInput('');
      setEditMode(false);
      toast.success('Token salvo. Webhook registrado automaticamente.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o token.');
    }
  };

  const handleCheckStatus = async () => {
    try {
      const connected = await checkStatus();
      toast.success(connected ? 'Instância conectada.' : 'Instância desconectada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao verificar status.');
    }
  };

  const handleFetchQR = async () => {
    try {
      await fetchQRCode();
      setShowQR(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao obter QR Code.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Instância desconectada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar.');
    }
  };

  const showInputForm = !hasToken || editMode;

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-8 rounded-[20px] border border-[#E5E7EB] shadow-sm">
        <div className="p-3 bg-green-50 rounded-[14px]">
          <MessageSquare className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1A1A1A] tracking-tight">WhatsApp — Uazapi</h1>
          <p className="text-sm text-[#6B7280] font-medium mt-0.5">
            Conecte sua instância WhatsApp para envio e recebimento de mensagens via CRM.
          </p>
        </div>
        <div className="ml-auto">
          {isConnected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5 px-3 py-1 font-bold text-xs">
              <Wifi className="w-3.5 h-3.5" /> Conectado
            </Badge>
          ) : (
            <Badge className="bg-red-50 text-red-600 border-red-200 gap-1.5 px-3 py-1 font-bold text-xs">
              <WifiOff className="w-3.5 h-3.5" /> Desconectado
            </Badge>
          )}
        </div>
      </div>

      {/* Número conectado */}
      {isConnected && connectedPhone && (
        <div className="flex items-center gap-4 bg-gradient-to-br from-green-50 to-emerald-50/40 border border-green-200 rounded-[16px] p-5">
          <div className="p-3 bg-white rounded-[12px] shadow-sm border border-green-100">
            <Phone className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-700/70">Número conectado</p>
            <p className="text-lg font-black text-[#1A1A1A] tracking-tight font-mono">{phoneFormatted}</p>
            {connectedName && (
              <p className="text-xs text-[#6B7280] font-medium truncate">{connectedName}</p>
            )}
          </div>
          {last4 && (
            <Badge className="bg-green-600 text-white border-0 font-black text-xs px-3 py-1.5 tabular-nums">
              ••• {last4}
            </Badge>
          )}
        </div>
      )}

      {/* Alerta de segurança */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
        <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800">Armazenamento seguro</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            O token é salvo exclusivamente no banco de dados. Todas as chamadas à API uazapi
            passam pela Edge Function do servidor — nunca pelo navegador.
          </p>
        </div>
      </div>

      {/* URL base — read-only */}
      <Card className="border-[#E5E7EB] shadow-sm rounded-[14px]">
        <CardHeader className="pb-3 border-b border-[#F3F4F6]">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
            <Lock className="w-4 h-4" /> URL da API
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            Endpoint fixo (não editável)
          </Label>
          <Input
            value={UAZAPI_BASE_URL}
            readOnly
            className="bg-[#F6F7F9] border-[#E5E7EB] text-[#6B7280] font-mono text-sm cursor-default select-all"
          />
          <p className="text-[11px] text-[#9CA3AF]">
            URL definida em código — não pode ser alterada pelo usuário.
          </p>
        </CardContent>
      </Card>

      {/* Token da instância */}
      <Card className="border-[#E5E7EB] shadow-sm rounded-[14px]">
        <CardHeader className="pb-3 border-b border-[#F3F4F6]">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
            <Lock className="w-4 h-4" /> Token da Instância
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {!showInputForm ? (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                Token atual
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  value={tokenDisplay}
                  readOnly
                  type="password"
                  className="bg-[#F6F7F9] border-[#E5E7EB] text-[#6B7280] font-mono text-sm cursor-default"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="shrink-0"
                >
                  Alterar
                </Button>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">
                O valor real nunca é exibido — somente a máscara de segurança.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
                {hasToken ? 'Novo token' : 'Token da instância'}
              </Label>
              <div className="relative">
                <Input
                  type={showTokenText ? 'text' : 'password'}
                  placeholder="Cole o token da instância Uazapi aqui"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="pr-10"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  onClick={() => setShowTokenText((v) => !v)}
                >
                  {showTokenText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveToken}
                  disabled={isLoading || !tokenInput.trim()}
                  className="bg-[#FFC400] text-[#1a1500] font-black text-xs hover:bg-[#FFD60A]"
                >
                  {isLoading ? (
                    <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...</>
                  ) : (
                    'Salvar Token'
                  )}
                </Button>
                {hasToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditMode(false); setTokenInput(''); }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controle da instância */}
      <Card className="border-[#E5E7EB] shadow-sm rounded-[14px]">
        <CardHeader className="pb-3 border-b border-[#F3F4F6]">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Controle da Instância
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleCheckStatus}
              disabled={isLoading || !hasToken}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Verificar Status
            </Button>

            <Button
              variant="outline"
              onClick={handleFetchQR}
              disabled={isLoading || !hasToken}
              className="gap-2"
            >
              <QrCode className="w-4 h-4" />
              {isConnected ? 'Ver QR Code' : 'Conectar / QR Code'}
            </Button>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isLoading || !hasToken || !isConnected}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Desconectar
            </Button>
          </div>

          {!hasToken && (
            <p className="text-xs text-[#9CA3AF] mt-3">
              Configure o token da instância acima para habilitar as ações.
            </p>
          )}
          {hasToken && !isConnected && (
            <p className="text-xs text-amber-600 mt-3 font-medium">
              Clique em "Conectar / QR Code" para escanear o QR Code com o WhatsApp e conectar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* QR Code */}
      {showQR && (
        <Card className="border-[#E5E7EB] shadow-sm rounded-[14px]">
          <CardHeader className="pb-3 border-b border-[#F3F4F6]">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
              <QrCode className="w-4 h-4" /> QR Code — Escaneie no WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            {isConnected ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wifi className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm font-bold text-green-700">WhatsApp Conectado!</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="p-4 bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52"
                  />
                </div>
                <div className="text-center max-w-xs space-y-1">
                  <p className="text-xs font-bold text-[#1A1A1A]">Como escanear:</p>
                  <p className="text-xs text-[#6B7280]">
                    WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo
                  </p>
                  <p className="text-xs text-amber-600 font-medium mt-2 flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Verificando conexão automaticamente...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleFetchQR} disabled={isLoading}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar QR
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowQR(false)}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-[#6B7280]">
                  A instância já está conectada ou o QR Code não está disponível.
                </p>
                <Button variant="outline" size="sm" onClick={handleFetchQR} disabled={isLoading} className="mt-3">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
