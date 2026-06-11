import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Inbox, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const Route = createFileRoute('/fila')({
  component: FilaAtendimento,
});

interface QueueLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
}

function FilaAtendimento() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const queryKey = ['fila', tenantId] as const;

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey,
    enabled: !!tenantId,
    queryFn: async (): Promise<QueueLead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, source, created_at')
        .eq('tenant_id', tenantId!)
        .eq('status', 'open')
        .is('assigned_user_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as QueueLead[];
    },
  });

  const pickMutation = useMutation({
    mutationFn: async (lead: QueueLead) => {
      if (!userId) throw new Error('Usuário não identificado');
      const { error } = await (supabase as any)
        .from('leads')
        .update({ assigned_user_id: userId, status: 'in_progress' })
        .eq('id', lead.id);
      if (error) throw error;
      return lead;
    },
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Lead atribuído a você');
      navigate({ to: '/chat', search: { phone: lead.phone ?? undefined } });
    },
    onError: (e: any) => toast.error(`Erro ao pegar lead: ${e.message}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((l) =>
      [l.full_name, l.phone, l.source]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Fila de Atendimento</h1>
          <p className="text-sm text-[#6B7280]">
            Leads aguardando um responsável — atendidos por ordem de chegada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou origem"
              className="w-72 pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-[#6B7280]">Carregando fila…</div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="rounded-full bg-[#F6F7F9] p-4">
            <Inbox className="h-8 w-8 text-[#9CA3AF]" />
          </div>
          <p className="text-base font-bold text-ink">
            Nenhum lead aguardando atendimento
          </p>
          <p className="max-w-sm text-sm text-[#6B7280]">
            Quando novos contatos chegarem sem responsável, eles aparecem aqui.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <Card key={lead.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-ink">
                    {lead.full_name?.trim() || lead.phone || 'Sem nome'}
                  </p>
                  <p className="truncate text-sm text-[#6B7280]">
                    {lead.phone || '—'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {lead.source || 'direto'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span className="uppercase tracking-wider">Entrou em</span>
                <span className="font-semibold text-ink">
                  {format(new Date(lead.created_at), "dd/MM, HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <Button
                className="mt-2 w-full"
                onClick={() => pickMutation.mutate(lead)}
                disabled={pickMutation.isPending}
              >
                Pegar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
