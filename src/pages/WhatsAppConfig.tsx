import React, { useState } from 'react';
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
} from 'lucide-react';

const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

export function WhatsAppConfig() {
  const {
    isLoading,
    isConnected,
    qrCode,
    hasToken,
    tokenDisplay,
    saveInstanceToken,
    checkStatus,
    fetchQRCode,
    disconnect,
  } = useWhatsApp();

  const [tokenInput, setTokenInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      toast.error('Informe o token da instância.');
      return;
    }
    try {
      await saveInstanceToken(tokenInput.trim());
      setTokenInput('');
      setShowInput(false);
      toast.success('Token salvo com segurança no servidor.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o token.');
    }
  };

  const handleCheckStatus = async () => {
    try {
      await checkStatus();
      toast.success(isConnected ? 'Instância conectada.' : 'Instância desconectada.');
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleFetchQR = async () => {
    try {
      await fetchQRCode();
      setShowQR(true);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success('Instância desconectada.');
    } catch (err) {
      toast.error(String(err));
    }
  };

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
            Conecte sua instância WhatsApp para envio de mensagens via CRM.
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

      {/* Alerta de segurança */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
        <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800">Armazenamento seguro</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            O token é salvo exclusivamente no banco de dados com RLS ativo. Nunca é armazenado no
            navegador, localStorage ou exposto ao frontend.
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
          {hasToken && !showInput ? (
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
                  onClick={() => setShowInput(true)}
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
                  type={showInput ? 'text' : 'password'}
                  placeholder="Cole o token da instância Uazapi aqui"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  onClick={() => setShowInput((v) => !v)}
                >
                  {showInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveToken}
                  disabled={isLoading || !tokenInput.trim()}
                  className="bg-[#FFC400] text-[#1a1500] font-black text-xs hover:bg-[#FFD60A]"
                >
                  {isLoading ? 'Salvando...' : 'Salvar Token'}
                </Button>
                {hasToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowInput(false); setTokenInput(''); }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
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
              Gerar QR Code
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
        </CardContent>
      </Card>

      {/* QR Code */}
      {showQR && qrCode && (
        <Card className="border-[#E5E7EB] shadow-sm rounded-[14px]">
          <CardHeader className="pb-3 border-b border-[#F3F4F6]">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-[#6B7280] flex items-center gap-2">
              <QrCode className="w-4 h-4" /> QR Code — Escaneie no WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm">
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-48 h-48"
              />
            </div>
            <p className="text-xs text-[#6B7280] text-center max-w-xs">
              Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → Escaneie
              este QR Code.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowQR(false)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
