import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // O link do e-mail traz um token no hash (#access_token=...&type=recovery).
  // O supabase-js processa isso automaticamente e dispara PASSWORD_RECOVERY.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('A senha precisa ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('A senha precisa ter letras e números.');
      return;
    }
    if (password !== confirm) {
      toast.error('A confirmação não confere.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Senha redefinida! Faça login com a nova senha.');
      await supabase.auth.signOut();
      navigate({ to: '/login' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao redefinir a senha.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#17171B] border border-[#23232B] rounded-[24px] p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-[#FFC400]/10 rounded-xl">
              <KeyRound className="w-6 h-6 text-[#FFC400]" />
            </div>
            <div>
              <h1 className="text-white font-black text-lg uppercase tracking-tight">Nova senha</h1>
              <p className="text-slate-500 text-xs">Ótica Catelan CRM</p>
            </div>
          </div>

          {!ready ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#FFC400] animate-spin" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                Este link é inválido ou expirou. Solicite um novo link de recuperação na tela de login.
              </p>
              <Button
                onClick={() => navigate({ to: '/login' })}
                className="w-full h-12 bg-[#FFC400] hover:bg-[#FFD60A] text-[#1a1500] font-black uppercase tracking-widest rounded-[12px]"
              >
                Voltar para login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-slate-400 text-sm mb-2">Escolha uma nova senha para sua conta.</p>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-400 text-xs font-black uppercase tracking-widest">
                  Nova senha
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="bg-[#0E0E11] border-[#23232B] text-white h-12 rounded-[12px] focus:border-[#FFC400]"
                />
                <p className="text-xs text-slate-500">Mínimo 8 caracteres, com letras e números.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-400 text-xs font-black uppercase tracking-widest">
                  Confirmar senha
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="bg-[#0E0E11] border-[#23232B] text-white h-12 rounded-[12px] focus:border-[#FFC400]"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#FFC400] hover:bg-[#FFD60A] text-[#1a1500] font-black text-sm uppercase tracking-widest rounded-[12px] shadow-lg shadow-[#FFC400]/20 mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'REDEFINIR SENHA'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
