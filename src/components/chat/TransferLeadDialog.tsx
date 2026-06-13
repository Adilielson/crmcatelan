import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DBLead } from '@/hooks/use-leads';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

export function TransferLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: DBLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();
  const [target, setTarget] = useState<string>('');

  useEffect(() => {
    if (!open) setTarget('');
  }, [open]);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['team-members', tenantId],
    enabled: !!tenantId && open,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, role')
        .eq('tenant_id', tenantId!)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((m: TeamMember) => !!m.full_name) as TeamMember[];
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!lead) throw new Error('Lead não selecionado');
      const { error } = await (supabase as any)
        .from('leads')
        .update({ assigned_user_id: userId, status: 'in_progress' })
        .eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Lead transferido');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao transferir'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Transferir Atendimento
          </DialogTitle>
          <DialogDescription>
            {lead?.full_name
              ? `Encaminhar ${lead.full_name} para outro atendente.`
              : 'Encaminhar conversa para outro atendente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-12 rounded-xl font-bold text-sm">
              <SelectValue placeholder={isLoading ? 'Carregando equipe…' : 'Selecionar atendente'} />
            </SelectTrigger>
            <SelectContent>
              {team
                .filter((m) => m.id !== currentUserId)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}{' '}
                    <span className="text-xs text-gray-400">· {m.role}</span>
                  </SelectItem>
                ))}
              {team.length === 0 && !isLoading && (
                <div className="px-3 py-4 text-xs text-gray-400">
                  Nenhum atendente disponível.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!target || transferMutation.isPending}
            onClick={() => transferMutation.mutate(target)}
          >
            Confirmar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
