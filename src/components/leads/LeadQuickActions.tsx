import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, MessageSquare, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DBLead, useUpdateLead } from '@/hooks/use-leads';
import { useAgenda } from '@/hooks/use-agenda';
import { LeadValueDialog } from '@/components/kanban/LeadValueDialog';
import { LeadLocationDialog } from '@/components/kanban/LeadLocationDialog';

/**
 * Atalhos rápidos do lead — Agendar, Conversar, Localização, Valor.
 * Componente reutilizado no Kanban, Chat (desktop) e visões mobile.
 *
 * Owns its own dialogs to evitar duplicação de lógica entre telas.
 */
export function LeadQuickActions({
  lead,
  variant = 'compact',
  hideChat = false,
  onOpenChat,
  className,
}: {
  lead: DBLead;
  /** 'compact' = só ícone (kanban card). 'labeled' = ícone + texto (painel/sheets). */
  variant?: 'compact' | 'labeled';
  /** Esconder o botão "Conversar" quando o usuário já está no chat. */
  hideChat?: boolean;
  /** Override de navegação do chat (ex: mobile usa /m/chat/$phone). */
  onOpenChat?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const updateLead = useUpdateLead();
  const { addAppointment } = useAgenda();

  const [valueOpen, setValueOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });

  const openChat = () => {
    if (onOpenChat) return onOpenChat();
    navigate({ to: '/chat', search: { phone: lead.phone ?? '' } });
  };

  const confirmSchedule = async () => {
    if (!scheduleData.date || !scheduleData.time) return;
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
    await updateLead.mutateAsync({ id: lead.id, updates: { status: 'scheduled' } });
    toast.success('Agendamento criado e lead movido!');
    setScheduleOpen(false);
    setScheduleData({ date: '', time: '' });
  };

  const actions = [
    { key: 'schedule', icon: Calendar, label: 'Agendar', onClick: () => setScheduleOpen(true) },
    !hideChat && {
      key: 'chat',
      icon: MessageSquare,
      label: 'Conversar',
      onClick: openChat,
    },
    { key: 'value', icon: DollarSign, label: 'Valor', onClick: () => setValueOpen(true) },
  ].filter(Boolean) as { key: string; icon: typeof Calendar; label: string; onClick: () => void }[];

  return (
    <>
      <div
        className={cn(
          variant === 'compact'
            ? 'flex items-center gap-2 flex-wrap'
            : 'grid grid-cols-2 gap-2 sm:grid-cols-4',
          className,
        )}
      >
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
            }}
            title={a.label}
            className={cn(
              'transition-all border bg-white text-gray-600 hover:text-[#FFC400] hover:border-[#FFC400]/40 border-[#E3E6EB] rounded-[12px]',
              variant === 'compact'
                ? 'p-2.5'
                : 'flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-[10px] font-black uppercase tracking-wider',
            )}
          >
            <a.icon className={cn(variant === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
            {variant === 'labeled' && <span>{a.label}</span>}
          </button>
        ))}
      </div>

      {/* Diálogos owned */}
      <LeadValueDialog lead={valueOpen ? lead : null} open={valueOpen} onOpenChange={setValueOpen} />
      <LeadLocationDialog
        lead={locationOpen ? lead : null}
        open={locationOpen}
        onOpenChange={setLocationOpen}
      />

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agendar — {lead.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={scheduleData.time}
                onChange={(e) => setScheduleData((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            {lead.phone && <p className="text-xs text-gray-500">📱 {lead.phone}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmSchedule}>Confirmar Agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
