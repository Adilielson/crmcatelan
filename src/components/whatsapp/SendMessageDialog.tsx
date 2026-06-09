import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { toast } from 'sonner';
import { MessageSquare, Image, Send } from 'lucide-react';

type MessageType = 'text' | 'image';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  defaultMessage?: string;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  defaultPhone = '',
  defaultMessage = '',
}: SendMessageDialogProps) {
  const { sendText, sendImage, isLoading, hasToken } = useWhatsApp();

  const [phone, setPhone] = useState(defaultPhone);
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [textContent, setTextContent] = useState(defaultMessage);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');

  const handleSend = async () => {
    if (!phone.trim()) {
      toast.error('Informe o número de destino.');
      return;
    }
    try {
      if (messageType === 'text') {
        if (!textContent.trim()) { toast.error('Informe o texto da mensagem.'); return; }
        await sendText(phone.trim(), textContent.trim());
      } else {
        if (!imageUrl.trim()) { toast.error('Informe a URL da imagem.'); return; }
        await sendImage(phone.trim(), imageUrl.trim(), caption.trim() || undefined);
      }
      toast.success('Mensagem enviada!');
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const resetForm = () => {
    setPhone(defaultPhone);
    setTextContent(defaultMessage);
    setImageUrl('');
    setCaption('');
    setMessageType('text');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1A1A1A] font-black">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Enviar Mensagem WhatsApp
          </DialogTitle>
        </DialogHeader>

        {!hasToken && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-700 font-medium">
            Configure o token da instância Uazapi em Configurações → WhatsApp antes de enviar.
          </div>
        )}

        <div className="space-y-4">
          {/* Número destino */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
              Número (com DDI)
            </Label>
            <Input
              placeholder="+5511999998888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Tipo de mensagem */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
              Tipo de mensagem
            </Label>
            <Select
              value={messageType}
              onValueChange={(v) => setMessageType(v as MessageType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#6B7280]" /> Texto
                  </span>
                </SelectItem>
                <SelectItem value="image">
                  <span className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-[#6B7280]" /> Imagem
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos por tipo */}
          {messageType === 'text' ? (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                Mensagem
              </Label>
              <Textarea
                placeholder="Digite a mensagem..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                disabled={isLoading}
                className="min-h-[100px] resize-none"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                  URL da imagem
                </Label>
                <Input
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280]">
                  Legenda (opcional)
                </Label>
                <Input
                  placeholder="Legenda da imagem..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); resetForm(); }}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || !hasToken}
            className="bg-[#FFC400] text-[#1a1500] font-black text-xs hover:bg-[#FFD60A] gap-2"
          >
            <Send className="w-4 h-4" />
            {isLoading ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
