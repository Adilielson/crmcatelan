import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, MessageSquare, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DBLead } from '@/hooks/use-leads';
import { LeadValueDialog } from '@/components/kanban/LeadValueDialog';
import { NewAppointmentDialog } from '@/components/agenda/NewAppointmentDialog';


/**
 * Atalhos rápidos do lead — Agendar, Conversar, Valor.
 * O atalho "Agendar" abre o mesmo formulário completo usado na Agenda
 * (NewAppointmentDialog) e, ao confirmar, move automaticamente o lead
 * para a etapa "Agendado" do Kanban.
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

  const [valueOpen, setValueOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const openChat = () => {
    if (onOpenChat) return onOpenChat();
    navigate({ to: '/chat', search: { phone: lead.phone ?? '' } });
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

      <NewAppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultLeadId={lead.id}
        lockLead
        moveLeadToScheduled
      />
    </>
  );
}
