import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { format, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, MessageSquare, Clock, AlertCircle, User, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTodayFollowups, useRespondToFollowup } from '@/hooks/use-followups';
import { useLeads } from '@/hooks/use-leads';
import { FollowupContextBlock } from './FollowupContextBlock';
import { FollowupAiDialog } from './FollowupAiDialog';
import { toast } from 'sonner';

const TEMPLATE_LABEL: Record<string, string> = {
  followup_d1: 'D+1 — Pós-exame',
  followup_d3: 'D+3 — Lembrete suave',
  followup_d7: 'D+7 — Condição especial',
  followup_d15: 'D+15 — Ligação de reativação',
  followup_d30: 'D+30 — Novidades',
  followup_d60: 'D+60 — Reengajamento',
  followup_d120: 'D+120 — Check-in 4 meses',
  followup_d180: 'D+180 — Revisão 6 meses',
};

export function TodayFollowupsTab() {
  const { data: followups = [], isLoading } = useTodayFollowups();
  const { data: leads = [] } = useLeads();
  const respond = useRespondToFollowup();
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<{ followupId: string; leadPhone: string | null; leadName: string } | null>(null);

  const openAi = (followupId: string, leadPhone: string | null, leadName: string) => {
    setAiTarget({ followupId, leadPhone, leadName });
    setAiOpen(true);
  };

  const leadMap = useMemo(() => {
    const m = new Map<string, (typeof leads)[number]>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  const calls = followups.filter((f) => f.channel === 'call');
  const whatsapps = followups.filter((f) => f.channel === 'whatsapp');

  const openChat = (phone?: string | null) => {
    if (!phone) {
      toast.error('Lead sem telefone cadastrado');
      return;
    }
    navigate({ to: '/chat', search: { phone } });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-gray-500">Carregando...</div>;
  }

  if (followups.length === 0) {
    return (
      <div className="bg-white border border-[#E3E6EB] rounded-[24px] p-12 text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h3 className="font-black text-ink text-lg mb-1">Nenhum follow-up para hoje</h3>
        <p className="text-sm text-gray-500">Os toques automáticos do dia já foram enviados ou não há leads em follow-up.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ligações pendentes */}
      <div className="bg-white border border-[#E3E6EB] rounded-[24px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E3E6EB] flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl">
              <Phone className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-black text-ink text-sm uppercase tracking-widest">Ligações para fazer</h3>
              <p className="text-xs text-gray-500 mt-0.5">Toques que exigem ação manual do atendente</p>
            </div>
          </div>
          <Badge className="bg-red-100 text-red-700 border-red-200 font-black">{calls.length}</Badge>
        </div>
        <div className="divide-y divide-[#E3E6EB] max-h-[600px] overflow-y-auto">
          {calls.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">Nenhuma ligação pendente</div>
          ) : (
            calls.map((f) => {
              const lead = leadMap.get(f.lead_id);
              const overdue = isPast(new Date(f.scheduled_at)) && !isToday(new Date(f.scheduled_at));
              return (
                <div key={f.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-ink">{lead?.full_name ?? 'Lead removido'}</h4>
                        <p className="text-[11px] text-gray-500 font-medium">{lead?.phone ?? 'Sem telefone'}</p>
                      </div>
                    </div>
                    {overdue && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] font-black">ATRASADO</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(f.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    <span className="text-gray-300">•</span>
                    <span className="font-bold">{TEMPLATE_LABEL[f.template_key] ?? f.template_key}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead?.phone && (
                      <a href={`tel:${lead.phone}`}>
                        <Button size="sm" className="h-9 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl">
                          <Phone className="w-3.5 h-3.5 mr-1.5" /> LIGAR
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!lead}
                      onClick={() => lead && openAi(f.id, lead.phone ?? null, lead.full_name)}
                      className="h-9 text-[10px] font-black uppercase tracking-wider rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> SCRIPT IA
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openChat(lead?.phone)}
                      className="h-9 text-[10px] font-black uppercase tracking-wider rounded-xl"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> WHATSAPP
                    </Button>
                    <Button
                      size="sm"
                      disabled={respond.isPending || !lead}
                      onClick={() => lead && respond.mutate({ followupId: f.id, leadId: lead.id })}
                      className="h-9 bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> RESPONDIDO
                    </Button>
                  </div>
                  {lead && <FollowupContextBlock leadId={lead.id} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* WhatsApp programados */}
      <div className="bg-white border border-[#E3E6EB] rounded-[24px] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E3E6EB] flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-ink text-sm uppercase tracking-widest">WhatsApp automático</h3>
              <p className="text-xs text-gray-500 mt-0.5">Enviados pelo robô diariamente às 09:00 UTC</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-black">{whatsapps.length}</Badge>
        </div>
        <div className="divide-y divide-[#E3E6EB] max-h-[600px] overflow-y-auto">
          {whatsapps.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">Nenhum WhatsApp programado para hoje</div>
          ) : (
            whatsapps.map((f) => {
              const lead = leadMap.get(f.lead_id);
              return (
                <div key={f.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-ink">{lead?.full_name ?? 'Lead removido'}</h4>
                        <p className="text-[11px] text-gray-500 font-medium">{lead?.phone ?? 'Sem telefone'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black">{TEMPLATE_LABEL[f.template_key] ?? f.template_key}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 ml-11">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Envio: {format(new Date(f.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!lead}
                        onClick={() => lead && openAi(f.id, lead.phone ?? null, lead.full_name)}
                        className="h-8 text-[10px] font-black uppercase tracking-wider rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" /> GERAR IA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={respond.isPending || !lead}
                        onClick={() => lead && respond.mutate({ followupId: f.id, leadId: lead.id })}
                        className="h-8 text-[10px] font-black uppercase tracking-wider rounded-xl border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> RESPONDIDO
                      </Button>
                    </div>
                  </div>
                  {lead && <FollowupContextBlock leadId={lead.id} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      <FollowupAiDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        followupId={aiTarget?.followupId ?? null}
        initialLeadPhone={aiTarget?.leadPhone ?? null}
        initialLeadName={aiTarget?.leadName}
      />
    </div>
  );
}
