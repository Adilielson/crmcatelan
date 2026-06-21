import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, PanelRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DBLead, LeadStage, useUpdateLead } from '@/hooks/use-leads';
import { useKanbanColumns, KanbanColumn } from '@/hooks/use-kanban-columns';
import { useAgenda } from '@/hooks/use-agenda';
import { LeadQuickActions } from '@/components/leads/LeadQuickActions';
import { LostLeadDialog } from '@/components/leads/LostLeadDialog';
import { TransferLeadDialog } from './TransferLeadDialog';
import { NewAppointmentDialog } from '@/components/agenda/NewAppointmentDialog';

/**
 * Toolbar com ações rápidas exibida abaixo do header da conversa em /chat.
 * - Select de status (move o lead entre colunas do Kanban do tenant)
 *   • "Agendado" exige data/hora antes de mover
 *   • "Perdido" exige motivo antes de mover
 * - Transferir para outro atendente
 * - Agendar / Local / Valor (via LeadQuickActions)
 */
export function ChatQuickActionsBar({
  lead,
  className,
}: {
  lead: DBLead;
  className?: string;
}) {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();
  const { data: columns = [] } = useKanbanColumns();
  const { addAppointment } = useAgenda();
  const updateLead = useUpdateLead();
  const [transferOpen, setTransferOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
  const [lossOpen, setLossOpen] = useState(false);
  const isAiHandling = !lead.assigned_user_id;

  const toggleAi = useMutation({
    mutationFn: async (takeOver: boolean) => {
      const updates: Record<string, unknown> = takeOver
        ? { assigned_user_id: currentUserId, status: 'in_progress' }
        : { assigned_user_id: null };
      const { error } = await (supabase as any)
        .from('leads')
        .update(updates)
        .eq('id', lead.id);
      if (error) throw error;
      return takeOver;
    },
    onSuccess: (takeOver) => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success(takeOver ? 'Você assumiu a conversa — IA pausada' : 'Conversa devolvida para a IA');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alternar atendimento'),
  });

  // Valor atual do select: id da coluna custom OU system_key
  const currentValue =
    lead.custom_column_id ??
    columns.find((c) => c.is_system && c.system_key === lead.status)?.system_key ??
    lead.status;

  const updateStatus = useMutation({
    mutationFn: async (col: KanbanColumn) => {
      const updates: Record<string, unknown> = {};
      if (col.is_system && col.system_key) {
        updates.status = col.system_key as LeadStage;
        updates.custom_column_id = null;
      } else {
        updates.custom_column_id = col.id;
      }
      const { error } = await (supabase as any)
        .from('leads')
        .update(updates)
        .eq('id', lead.id);
      if (error) throw error;
      return col;
    },
    onSuccess: (col) => {
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success(`Movido para ${col.name}`);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao mover lead'),
  });

  const handleStatusChange = (value: string) => {
    const col = columns.find((c) =>
      c.is_system ? c.system_key === value : c.id === value,
    );
    if (!col) return;
    if (col.is_system && col.system_key === 'scheduled') {
      setScheduleOpen(true);
      return;
    }
    if (col.is_system && col.system_key === 'lost') {
      setLossOpen(true);
      return;
    }
    updateStatus.mutate(col);
  };

  const confirmSchedule = async () => {
    if (!scheduleData.date || !scheduleData.time) {
      toast.error('Informe data e horário do agendamento');
      return;
    }
    const [hh, mm] = scheduleData.time.split(':');
    const endTime = `${String(parseInt(hh) + 1).padStart(2, '0')}:${mm}`;
    const ok = await addAppointment({
      leadId: lead.id,
      leadName: lead.full_name,
      date: scheduleData.date,
      startTime: scheduleData.time,
      endTime,
      status: 'pendente',
      examType: 'Consulta Oftalmológica',
      reminderSent: false,
      professionalId: 'dr-claudio',
      unit: 'Loja Centro',
      origin: 'manual',
      value: lead.sales_value ?? 150,
      propensityScore: 0.85,
      notificationChannel: 'whatsapp',
      rescheduleCount: 0,
      needsTransport: false,
    });
    if (!ok) {
      toast.error('Conflito de horário na agenda');
      return;
    }
    await updateLead.mutateAsync({ id: lead.id, updates: { status: 'scheduled', custom_column_id: null } });
    qc.invalidateQueries({ queryKey: ['leads', tenantId] });
    toast.success('Agendamento criado e lead movido!');
    setScheduleOpen(false);
    setScheduleData({ date: '', time: '' });
  };

  const confirmLoss = async ({ reason, note }: { reason: string; note: string }) => {
    if (!reason) {
      toast.error('Selecione o motivo da perda');
      return;
    }
    const summary = note ? `${reason} — ${note}` : reason;
    await updateLead.mutateAsync({
      id: lead.id,
      updates: {
        status: 'lost',
        custom_column_id: null,
        lost_reason: reason,
        lost_reason_note: note || null,
        notes: `${lead.notes ?? ''}\n[Perdido: ${summary}]`.trim(),
      },
    });
    qc.invalidateQueries({ queryKey: ['leads', tenantId] });
    toast.error('Lead marcado como perdido');
    setLossOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1.5 border-b border-[#E3E6EB] bg-white/90 px-3 py-2 backdrop-blur-xl overflow-x-auto no-scrollbar',
          className,
        )}
      >
        {/* Status */}
        <Select value={String(currentValue)} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-9 w-[130px] sm:w-[170px] shrink-0 rounded-xl border-gray-100 bg-gray-50 text-xs font-bold">
            <ChevronsUpDown className="mr-1 h-3.5 w-3.5 text-gray-400 shrink-0" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem
                key={c.id}
                value={c.is_system && c.system_key ? c.system_key : c.id}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assumir / Devolver IA */}
        <Button
          variant="outline"
          size="sm"
          disabled={toggleAi.isPending}
          onClick={() => toggleAi.mutate(isAiHandling)}
          className={cn(
            'h-9 shrink-0 rounded-xl border-gray-100 bg-gray-50 px-2.5 sm:px-3 text-xs font-bold',
            isAiHandling
              ? 'hover:border-primary/30 hover:text-primary'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300',
          )}
          title={isAiHandling ? 'Assumir conversa (pausa a IA)' : 'Devolver atendimento para a IA'}
        >
          {isAiHandling ? (
            <>
              <Hand className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Assumir</span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Devolver p/ IA</span>
            </>
          )}
        </Button>

        {/* Transferir */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-xl border-gray-100 bg-gray-50 px-2.5 sm:px-3 text-xs font-bold hover:border-primary/30 hover:text-primary"
          onClick={() => setTransferOpen(true)}
          title="Transferir atendimento"
        >
          <UserPlus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Transferir</span>
        </Button>

        {/* Agendar / Local / Valor */}
        <LeadQuickActions lead={lead} variant="compact" hideChat className="!gap-1.5 shrink-0" />
      </div>

      <TransferLeadDialog
        lead={transferOpen ? lead : null}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      {/* Agenda dialog — usa o mesmo formulário da aba Agenda */}
      <NewAppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultLeadId={lead.id}
        lockLead
        moveLeadToScheduled
        onCreated={() => qc.invalidateQueries({ queryKey: ['leads', tenantId] })}
      />

      {/* Loss dialog (motivo obrigatório) */}
      <LostLeadDialog
        open={lossOpen}
        leadName={lead.full_name}
        isSubmitting={updateLead.isPending}
        onOpenChange={setLossOpen}
        onConfirm={confirmLoss}
      />
    </>
  );
}
