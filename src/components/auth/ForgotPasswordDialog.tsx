import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = '' }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Enviamos um e-mail com o link para redefinir sua senha.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (loading) return;
    onOpenChange(v);
    if (!v) {
      setSent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#f5c518]" />
            Recuperar senha
          </DialogTitle>
          <DialogDescription>
            {sent
              ? 'Cheque sua caixa de entrada. Se o e-mail existir, você vai receber um link para criar uma nova senha.'
              : 'Informe o e-mail da sua conta. Enviaremos um link para você definir uma nova senha.'}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#f5c518] text-[#0f172a] hover:bg-[#d4a900]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar link'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} className="bg-[#f5c518] text-[#0f172a] hover:bg-[#d4a900]">
              Entendi
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
