import { Badge } from '@/components/ui/badge';
import { Brain, History, ClipboardList, StickyNote, Phone, Mail, DollarSign, Tag, Activity } from 'lucide-react';
import { DBLead, stageLabel } from '@/hooks/use-leads';
import { useLeadHistory } from '@/hooks/use-lead-history';
import { useConsultationSummary } from '@/hooks/use-consultation-summary';
import { PrescriptionCard } from '@/components/leads/PrescriptionCard';
import { LeadQuickActions } from '@/components/leads/LeadQuickActions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  try {
    return format(new Date(s), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  } catch {
    return s;
  }
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-ink text-[10px] font-bold uppercase tracking-wide">
      {stageLabel(stage)}
    </span>
  );
}

/**
 * Painel unificado do lead — usado no Kanban (LeadDetailSheet) e no Chat.
 * Mostra dados, IA, resumo da consulta e histórico completo de etapas.
 */
export function LeadProfilePanel({ lead, compact = false }: { lead: DBLead; compact?: boolean }) {
  const { data: history = [] } = useLeadHistory(lead.id);
  const { data: summary } = useConsultationSummary(lead.id);

  return (
    <div className={cn('space-y-5', compact && 'space-y-4')}>
      {/* Cabeçalho */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-jakarta font-black text-base text-ink truncate">{lead.full_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StageBadge stage={lead.status} />
              {lead.source && (
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {lead.source}
                </span>
              )}
            </div>
          </div>
          {lead.score_ia != null && (
            <Badge className="bg-primary/10 text-primary border-none font-black shrink-0">
              IA {lead.score_ia}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1.5 pt-2 text-xs text-gray-600">
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium">{lead.phone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium truncate">{lead.email}</span>
            </div>
          )}
          {lead.sales_value != null && lead.sales_value > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-bold text-ink">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.sales_value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* IA Insights */}
      {(lead.ia_summary || lead.score_ia != null || (lead.ia_tags && lead.ia_tags.length > 0)) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Brain className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Análise IA</h4>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2">
            {lead.ia_summary && (
              <p className="text-xs leading-relaxed text-ink">{lead.ia_summary}</p>
            )}
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {lead.ia_sentimento && (
                <span className="px-2 py-0.5 rounded-md bg-gray-50 text-gray-700">
                  Sentimento: <span className="capitalize text-ink">{lead.ia_sentimento}</span>
                </span>
              )}
              {lead.ia_urgencia && (
                <span className="px-2 py-0.5 rounded-md bg-gray-50 text-gray-700">
                  Urgência: <span className="capitalize text-danger">{lead.ia_urgencia}</span>
                </span>
              )}
            </div>
            {lead.ia_tags && lead.ia_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lead.ia_tags.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-bold">
                    <Tag className="w-2.5 h-2.5 mr-1" />
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {(lead.ia_receita_grau || lead.ia_receita_validade) && (
              <div className="pt-2 border-t border-gray-100 text-[11px] space-y-0.5">
                {lead.ia_receita_grau && (
                  <div><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Grau:</span> <span className="font-bold text-ink">{lead.ia_receita_grau}</span></div>
                )}
                {lead.ia_receita_validade && (
                  <div><span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Validade:</span> <span className="font-bold text-ink">{lead.ia_receita_validade}</span></div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo da consulta */}
      {summary && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Resumo da consulta</h4>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 space-y-1.5">
            {summary.needs_glasses && (
              <div>
                <span className="font-bold capitalize">{summary.needs_glasses}</span>
                {summary.lens_type && <span> • {summary.lens_type}</span>}
              </div>
            )}
            {summary.prescription_valid_until && (
              <div className="text-[10px]">Receita até {summary.prescription_valid_until}</div>
            )}
            {summary.treatments && summary.treatments.length > 0 && (
              <div>Tratamentos: {summary.treatments.join(', ')}</div>
            )}
            {summary.price_range_presented && (
              <div>Valor apresentado: <span className="font-bold">{summary.price_range_presented}</span></div>
            )}
            {summary.products_shown && (
              <div>Mostrado: {summary.products_shown}</div>
            )}
            {summary.no_close_reason && (
              <div className="pt-1 border-t border-amber-200">
                <span className="font-bold">Não fechou:</span> {summary.no_close_reason}
                {summary.no_close_reason_detail && <span className="italic"> — "{summary.no_close_reason_detail}"</span>}
              </div>
            )}
            {summary.professional_notes && (
              <div className="pt-1 border-t border-amber-200 italic">"{summary.professional_notes}"</div>
            )}
          </div>
        </div>
      )}

      {/* Notas do atendente */}
      {lead.notes && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <StickyNote className="w-3.5 h-3.5 text-gray-500" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Observações</h4>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 text-xs text-ink whitespace-pre-wrap leading-relaxed">
            {lead.notes}
          </div>
        </div>
      )}

      {/* Receita (foto + OCR) */}
      <PrescriptionCard lead={lead} />

      {/* Histórico de etapas */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <History className="w-3.5 h-3.5 text-gray-500" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Histórico do lead
          </h4>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <ol className="relative border-l border-gray-200 ml-1 space-y-4">
            {history.length === 0 && (
              <li className="ml-4 text-[11px] text-gray-400 font-medium">
                Nenhuma mudança de etapa registrada ainda.
              </li>
            )}
            {history.map((h) => (
              <li key={h.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow" />
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {fmtDateTime(h.created_at)}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                  <StageBadge stage={h.stage_from} />
                  <span className="text-gray-400">→</span>
                  <StageBadge stage={h.stage_to} />
                </div>
                {h.duration && (
                  <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Permaneceu {h.duration}
                  </div>
                )}
              </li>
            ))}
            {/* Marco de criação */}
            <li className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {fmtDateTime(lead.created_at)}
              </div>
              <div className="text-xs text-ink font-bold mt-0.5">Lead criado</div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
