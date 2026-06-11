import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { Sparkles, Copy, MessageSquare, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { generateFollowupMessage } from '@/lib/followup-ai.functions';
import { useWhatsApp } from '@/hooks/useWhatsApp';

interface FollowupAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followupId: string | null;
  initialLeadPhone?: string | null;
  initialLeadName?: string;
}

export function FollowupAiDialog({
  open,
  onOpenChange,
  followupId,
  initialLeadPhone,
  initialLeadName,
}: FollowupAiDialogProps) {
  const generateFn = useServerFn(generateFollowupMessage);
  const { sendText, isConnected: waConnected } = useWhatsApp();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [meta, setMeta] = useState<{
    leadName?: string;
    leadPhone?: string | null;
    channel?: string;
    hasContext?: boolean;
  }>({});

  const mutation = useMutation({
    mutationFn: async (id: string) => generateFn({ data: { followupId: id } }),
    onSuccess: (res) => {
      setMessage(res.message);
      setMeta({
        leadName: res.leadName,
        leadPhone: res.leadPhone,
        channel: res.channel,
        hasContext: res.hasContext,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao gerar mensagem'),
  });

  useEffect(() => {
    if (open && followupId) {
      setMessage('');
      setMeta({});
      mutation.mutate(followupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, followupId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    toast.success('Mensagem copiada');
  };

  const handleSendWhatsApp = async () => {
    const phone = meta.leadPhone ?? initialLeadPhone;
    if (!phone) {
      toast.error('Lead sem telefone cadastrado');
      return;
    }
    if (!waConnected) {
      toast.error('WhatsApp não está conectado');
      return;
    }
    try {
      await sendText({ number: phone, text: message });
      toast.success('Mensagem enviada via WhatsApp');
      onOpenChange(false);
    } catch (e: any) {
      // toast já é exibido dentro do useWhatsApp
    }
  };

  const handleOpenChat = () => {
    const phone = meta.leadPhone ?? initialLeadPhone;
    if (!phone) {
      toast.error('Lead sem telefone cadastrado');
      return;
    }
    navigator.clipboard.writeText(message).catch(() => {});
    toast.success('Mensagem copiada — cole no chat');
    onOpenChange(false);
    navigate({ to: '/chat', search: { phone } });
  };

  const channelLabel = meta.channel === 'call' ? 'Ligação' : 'WhatsApp';
  const leadName = meta.leadName ?? initialLeadName ?? 'Lead';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            Reimpacto IA — {leadName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold">
              {channelLabel}
            </Badge>
            {meta.hasContext === false && (
              <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50">
                <AlertCircle className="w-3 h-3 mr-1" />
                Sem resumo de consulta — mensagem genérica
              </Badge>
            )}
            {meta.hasContext && (
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50">
                Personalizada pelo resumo da consulta
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="font-bold">Gerando mensagem personalizada...</span>
              <span className="text-xs text-gray-400">Lendo resumo da consulta e adaptando ao momento do toque</span>
            </div>
          ) : (
            <>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="font-medium text-sm leading-relaxed resize-none"
                placeholder="A mensagem da IA aparecerá aqui..."
              />
              <p className="text-[10px] text-gray-400 font-medium">
                💡 Você pode editar antes de enviar. A IA usa o resumo da consulta para adaptar o tom à objeção do lead.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => followupId && mutation.mutate(followupId)}
            disabled={mutation.isPending}
            className="font-bold text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${mutation.isPending ? 'animate-spin' : ''}`} />
            Gerar outra
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!message || mutation.isPending}
            className="font-bold text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copiar
          </Button>
          {meta.channel !== 'call' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenChat}
                disabled={!message || mutation.isPending}
                className="font-bold text-xs"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Abrir no Chat
              </Button>
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={!message || mutation.isPending || !waConnected}
                className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Enviar agora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
