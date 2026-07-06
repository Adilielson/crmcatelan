/** @jsxImportSource react */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, MessageSquare, MapPin, DollarSign, MessageCircle, MoreVertical, AlertCircle, PlusCircle, Database, Pencil, Trash2, Plus, Bell, Check, Clock, X as XIcon, ChevronLeft, ChevronRight, Settings2, AlarmClock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DBLead, LeadStage, useLeads, useSeedSampleLeads, useUpdateLead } from '@/hooks/use-leads';
import { useAgenda } from '@/hooks/use-agenda';
import { useAuthStore } from '@/hooks/use-auth';
import { useKanbanColumns, useDeleteKanbanColumn, KanbanColumn } from '@/hooks/use-kanban-columns';
import { useTenantProfiles, firstName } from '@/hooks/use-tenant-profiles';
import { useLeadReminders, LeadReminder, REMINDER_LABEL, REMINDER_STATUS_LABEL } from '@/hooks/use-lead-reminders';

import { LeadFormDialog } from './LeadFormDialog';
import { LeadDetailSheet } from './LeadDetailSheet';
import { LeadValueDialog } from './LeadValueDialog';
import { LeadLocationDialog } from './LeadLocationDialog';
import { KanbanColumnDialog } from './KanbanColumnDialog';
import { KanbanColumnsSettingsDialog } from './KanbanColumnsSettingsDialog';
import { RegisterPurchaseDialog } from '@/components/leads/RegisterPurchaseDialog';
import { LostLeadDialog } from '@/components/leads/LostLeadDialog';
import { ConsultationSummaryDialog } from './ConsultationSummaryDialog';
import { NewAppointmentDialog } from '@/components/agenda/NewAppointmentDialog';
import { NoShowReasonDialog, type NoShowReasonKey } from './NoShowReasonDialog';
import { supabase } from '@/integrations/supabase/client';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const sourceIcon = (s: string | null) => {
  switch (s) {
    case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-500" />;
    case 'instagram': return <InstagramIcon className="text-pink-500" />;
    case 'google': return <MessageSquare className="w-4 h-4 text-blue-500" />;
    default: return <MessageSquare className="w-4 h-4 text-slate-500" />;
  }
};

// Colunas removidas do quadro (viraram tela /resultados)
const HIDDEN_SYSTEM_KEYS = new Set(['showed_up', 'lost']);

export function KanbanBoard() {
  const navigate = useNavigate();
  const { data: allLeads = [], isLoading } = useLeads();
  const { data: allColumns = [] } = useKanbanColumns();
  const { data: profiles = [] } = useTenantProfiles();
  const { data: remindersByLead } = useLeadReminders();
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? ''));
    return m;
  }, [profiles]);
  const updateLead = useUpdateLead();
  const deleteColumn = useDeleteKanbanColumn();
  const seed = useSeedSampleLeads();
  const { appointments, addAppointment, updateAppointment } = useAgenda();

  // Esconde do quadro colunas de Fechado/Perdido e leads já resolvidos.
  const columns = useMemo(
    () => allColumns.filter((c) => !HIDDEN_SYSTEM_KEYS.has(c.system_key ?? '')),
    [allColumns],
  );
  const leads = useMemo(
    () => allLeads.filter((l) => l.status !== 'showed_up' && l.status !== 'lost'),
    [allLeads],
  );

  // Map: leadId -> latest active appointment (not terminal, not checked-in yet)
  const pendingApptByLead = useMemo(() => {
    const m = new Map<string, typeof appointments[number]>();
    for (const a of appointments) {
      if (!a.leadId) continue;
      if (a.checkinAt) continue;
      if (a.status === 'realizado' || a.status === 'cancelado' || a.status === 'no-show') continue;
      const cur = m.get(a.leadId);
      if (!cur || new Date(`${a.date}T${a.startTime}`).getTime() > new Date(`${cur.date}T${cur.startTime}`).getTime()) {
        m.set(a.leadId, a);
      }
    }
    return m;
  }, [appointments]);
  const userRole = useAuthStore((s) => s.user?.role ?? null);
  const canManageColumns = userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager';


  const [newOpen, setNewOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<DBLead | null>(null);
  const [valueLead, setValueLead] = useState<DBLead | null>(null);
  const [locationLead, setLocationLead] = useState<DBLead | null>(null);
  const [scheduleLead, setScheduleLead] = useState<DBLead | null>(null);
  const [lossLead, setLossLead] = useState<DBLead | null>(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
  
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [columnsSettingsOpen, setColumnsSettingsOpen] = useState(false);
  const [deletingColumn, setDeletingColumn] = useState<KanbanColumn | null>(null);
  const [closingLead, setClosingLead] = useState<DBLead | null>(null);
  const [followupLead, setFollowupLead] = useState<DBLead | null>(null);
  const [noShowLead, setNoShowLead] = useState<DBLead | null>(null);
  const [rescheduleLead, setRescheduleLead] = useState<DBLead | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, columns.length]);

  const scrollByColumn = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCol = el.querySelector<HTMLElement>('[data-kanban-col]');
    const step = firstCol ? firstCol.offsetWidth + 32 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  const leadsForColumn = (col: KanbanColumn): DBLead[] => {
    if (col.is_system && col.system_key === 'noshow_recovery') {
      // Special: leads.status enum doesn't have 'noshow_recovery' — we place leads here via custom_column_id.
      return leads.filter((l) => l.custom_column_id === col.id);
    }
    if (col.is_system && col.system_key) {
      return leads.filter((l) => l.custom_column_id == null && l.status === col.system_key);
    }
    return leads.filter((l) => l.custom_column_id === col.id);
  };

  const handleDrop = async (leadId: string, col: KanbanColumn) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Custom column: just set custom_column_id
    if (!col.is_system) {
      if (lead.custom_column_id === col.id) return;
      await updateLead.mutateAsync({ id: leadId, updates: { custom_column_id: col.id } });
      toast.success(`Lead movido para ${col.name}`);
      return;
    }

    // Recuperação No-Show — trata como coluna especial (via custom_column_id)
    if (col.system_key === 'noshow_recovery') {
      if (lead.custom_column_id === col.id) return;
      await updateLead.mutateAsync({ id: leadId, updates: { custom_column_id: col.id } });
      toast.success(`Lead movido para ${col.name}`);
      return;
    }

    const newStage = col.system_key as LeadStage;
    if (lead.custom_column_id == null && lead.status === newStage) return;

    if (newStage === 'scheduled') {
      setScheduleLead(lead);
      return;
    }
    if (newStage === 'lost') {
      setLossLead(lead);
      return;
    }
    if (newStage === 'showed_up') {
      setClosingLead(lead);
      return;
    }
    if (newStage === 'followup') {
      setFollowupLead(lead);
      return;
    }
    await updateLead.mutateAsync({ id: leadId, updates: { status: newStage, custom_column_id: null } });
    toast.success(`Lead movido para ${col.name}`);
  };

  const handleDeleteColumn = async () => {
    if (!deletingColumn) return;
    await deleteColumn.mutateAsync(deletingColumn.id);
    setDeletingColumn(null);
  };

  const nextPosition = useMemo(() => {
    const max = columns.reduce((m, c) => Math.max(m, c.position), 0);
    return max + 10;
  }, [columns]);

  const confirmSchedule = async () => {
    if (!scheduleLead || !scheduleData.date || !scheduleData.time) return;
    const [hh, mm] = scheduleData.time.split(':');
    const endTime = `${String(parseInt(hh) + 1).padStart(2, '0')}:${mm}`;
    const ok = await addAppointment({
      leadId: scheduleLead.id,
      leadName: scheduleLead.full_name,
      date: scheduleData.date,
      startTime: scheduleData.time,
      endTime,
      status: 'pendente',
      examType: 'Consulta Oftalmológica',
      reminderSent: false,
      professionalId: 'dr-claudio',
      unit: 'Loja Centro',
      origin: 'manual',
      value: scheduleLead.sales_value ?? 150,
      propensityScore: 0.85,
      notificationChannel: 'whatsapp',
      rescheduleCount: 0,
      needsTransport: false,
    });
    if (!ok) {
      toast.error('Conflito de horário na agenda');
      return;
    }
    await updateLead.mutateAsync({ id: scheduleLead.id, updates: { status: 'scheduled' } });
    toast.success('Agendamento criado e lead movido!');
    setScheduleLead(null);
    setScheduleData({ date: '', time: '' });
  };

  const confirmLoss = async ({ reason, note }: { reason: string; note: string }) => {
    if (!lossLead || !reason) return;
    const summary = note ? `${reason} — ${note}` : reason;
    await updateLead.mutateAsync({
      id: lossLead.id,
      updates: {
        status: 'lost',
        custom_column_id: null,
        lost_reason: reason,
        lost_reason_note: note || null,
        notes: `${lossLead.notes ?? ''}\n[Perdido: ${summary}]`.trim(),
      },
    });
    toast.error('Lead marcado como perdido');
    setLossLead(null);
  };

  const openChat = (lead: DBLead) => {
    navigate({ to: '/chat', search: { phone: lead.phone ?? '' } as any });
  };

  const openAgenda = (lead: DBLead) => {
    setScheduleLead(lead);
    setScheduleData({ date: '', time: '' });
  };

  const handleMarkAttended = async (lead: DBLead) => {
    const appt = pendingApptByLead.get(lead.id);
    if (!appt) return;
    await updateAppointment(appt.id, { checkinAt: new Date().toISOString(), status: 'confirmado' });
    await updateLead.mutateAsync({ id: lead.id, updates: { status: 'checked_in', custom_column_id: null } });
    toast.success(`${lead.full_name} marcado como presente`);
  };

  const confirmNoShow = async (reason: NoShowReasonKey, outcome: 'recovery' | 'lost') => {
    const lead = noShowLead;
    if (!lead) return;
    const appt = pendingApptByLead.get(lead.id);
    if (appt) {
      await updateAppointment(appt.id, { status: 'no-show' });
      await (supabase as any)
        .from('appointments')
        .update({ noshow_reason: reason })
        .eq('id', appt.id);
    }

    if (outcome === 'lost') {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: {
          status: 'lost',
          custom_column_id: null,
          lost_reason: reason,
          lost_reason_note: `No-show: ${reason}`,
        },
      });
      toast.error('Lead marcado como perdido');
    } else {
      // Move to Recuperação No-Show custom column? Use status='in_progress' as fallback, and rely on system_key mapping.
      // The new kanban column uses system_key 'noshow_recovery' — but leads.status enum may not include it.
      // Keep status untouched; move via custom_column_id.
      const recoveryCol = columns.find((c) => c.system_key === 'noshow_recovery');
      if (recoveryCol) {
        // Column is is_system with system_key — leadsForColumn filters by status match. To display in that column,
        // we need to set status = the system_key OR add a custom_column_id path. Since noshow_recovery isn't in the
        // leads status enum, we fall back to keeping the lead's status but assigning custom_column_id to the recovery column.
        // But leadsForColumn only picks custom_column_id when col.is_system=false. We need to override the col to non-system OR
        // change the query. Simpler: mark lead custom_column_id to the recovery column and treat it as override.
        await updateLead.mutateAsync({
          id: lead.id,
          updates: {
            custom_column_id: recoveryCol.id,
            noshow_recovery_step: 0,
          } as any,
        });
      }

      // Enqueue recovery cadence
      if (appt) {
        const now = Date.now();
        const rows = [
          { kind: 'recovery_t0',   at: now },
          { kind: 'recovery_t48h', at: now + 48 * 3600 * 1000 },
          { kind: 'recovery_t7d',  at: now + 7 * 24 * 3600 * 1000 },
        ];
        await (supabase as any).from('noshow_alerts').insert(
          rows.map((r) => ({
            tenant_id: lead.tenant_id,
            appointment_id: appt.id,
            lead_id: lead.id,
            kind: r.kind,
            scheduled_at: new Date(r.at).toISOString(),
            status: 'pending',
          })),
        );
      }
      toast.success('Lead movido para Recuperação No-Show');
    }
    setNoShowLead(null);
  };


  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 sm:p-6 rounded-[14px] border border-[#E3E6EB] shadow-sm gap-4">
        <div className="flex flex-col min-w-0">
          <h3 className="text-sm font-black text-[#6C727C] uppercase tracking-[0.2em] font-jakarta">Fluxo de Vendas</h3>
          <p className="text-xs font-bold text-ink mt-1 truncate">{leads.length} lead(s) — Ótica Catelan Matriz</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 md:w-auto">
          {leads.length === 0 && !isLoading && (
            <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending} className="col-span-2 md:col-span-1 h-11 px-3 md:px-5 font-bold text-xs uppercase tracking-wider border-[#E3E6EB] rounded-[14px] whitespace-nowrap">
              <Database className="w-4 h-4 mr-2 shrink-0" /> Importar exemplos
            </Button>
          )}
          {canManageColumns && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumnsSettingsOpen(true)}
              className="h-11 px-3 md:px-5 font-bold text-[11px] md:text-xs uppercase tracking-wider border-[#E3E6EB] rounded-[14px] whitespace-nowrap"
            >
              <Settings2 className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Configurar Etapas</span>
            </Button>
          )}
          <Button onClick={() => setNewOpen(true)} size="sm" className="h-11 px-3 md:px-8 font-black text-[11px] md:text-xs uppercase tracking-[0.1em] bg-[#FFC400] text-[#1a1500] hover:bg-[#FFD60A] shadow-md shadow-[#FFC400]/10 rounded-[14px] whitespace-nowrap">
            <PlusCircle className="w-4 h-4 mr-2 shrink-0" /> Novo Lead
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400 font-bold">Carregando leads...</div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-4 md:gap-8 overflow-x-auto pb-8 scrollbar-hide -mx-4 px-4 h-[calc(100dvh-320px)] md:h-[calc(100vh-280px)] snap-x snap-mandatory md:snap-none scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {columns.map((col) => {
              const colLeads = leadsForColumn(col);
              const isCheckedIn = col.system_key === 'checked_in';
              return (
                <div key={col.id} data-kanban-col className="w-[88vw] sm:w-[300px] md:w-auto md:min-w-[320px] shrink-0 md:shrink md:flex-1 flex flex-col gap-4 md:gap-5 snap-start min-w-0">
                  <div className="flex justify-between items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-[16px] sm:rounded-[20px] bg-white border border-[#E3E6EB] shadow-sm relative overflow-hidden min-w-0">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: col.color }}
                    />
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="font-black uppercase tracking-[0.15em] text-[11px] text-[#A7ADB8] font-jakarta truncate">{col.name}</span>
                      {isCheckedIn && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                          Qualificado
                        </span>
                      )}
                      <div className="bg-[#F6F7F9] text-ink text-[10px] px-2.5 py-1 rounded-full font-black min-w-[28px] text-center border border-[#E3E6EB] shrink-0">
                        {colLeads.length}
                      </div>
                    </div>
                    {canManageColumns ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F6F7F9] text-[#A7ADB8] hover:text-ink">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingColumn(col); setColumnDialogOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" /> {col.is_system ? 'Mudar cor' : 'Editar'}
                          </DropdownMenuItem>
                          {!col.is_system && (
                            <DropdownMenuItem
                              onClick={() => setDeletingColumn(col)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F6F7F9] text-[#A7ADB8] hover:text-ink"><MoreVertical className="w-4 h-4" /></Button>
                    )}
                  </div>

                  <div
                    className="bg-transparent rounded-[20px] min-h-[400px] flex flex-col gap-4 overflow-y-auto scrollbar-hide pr-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('leadId');
                      if (id) handleDrop(id, col);
                    }}
                  >
                    {colLeads.length === 0 ? (
                      <div className="text-center py-8 text-[10px] uppercase tracking-widest text-gray-300 font-bold">Vazio</div>
                    ) : colLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        assigneeName={lead.assigned_user_id ? (profileMap.get(lead.assigned_user_id) ?? null) : null}
                        reminders={remindersByLead?.get(lead.id) ?? []}
                        pendingAppt={pendingApptByLead.get(lead.id) ?? null}
                        onClick={() => setDetailLead(lead)}
                        onCalendar={() => openAgenda(lead)}
                        onChat={() => openChat(lead)}
                        onLocation={() => setLocationLead(lead)}
                        onValue={() => setValueLead(lead)}
                        onMarkAttended={() => handleMarkAttended(lead)}
                        onMarkNoShow={() => setNoShowLead(lead)}
                        onReschedule={() => { setRescheduleLead(lead); setScheduleLead(lead); setScheduleData({ date: '', time: '' }); }}
                        onMarkWon={() => setClosingLead(lead)}
                        onMarkLost={() => setLossLead(lead)}
                      />
                    ))}

                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop-only navigation arrows */}
          <button
            type="button"
            aria-label="Coluna anterior"
            onClick={() => scrollByColumn(-1)}
            className={cn(
              "hidden md:flex absolute left-1 top-[calc(50%-1rem)] -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/90 backdrop-blur-md border border-[#E3E6EB] shadow-lg text-ink hover:bg-white hover:scale-105 hover:shadow-xl active:scale-95 transition-all duration-200",
              !canScrollLeft && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="Próxima coluna"
            onClick={() => scrollByColumn(1)}
            className={cn(
              "hidden md:flex absolute right-1 top-[calc(50%-1rem)] -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-[#FFC400] border border-[#FFC400] shadow-lg shadow-[#FFC400]/30 text-[#1a1500] hover:bg-[#FFD60A] hover:scale-105 hover:shadow-xl hover:shadow-[#FFC400]/40 active:scale-95 transition-all duration-200",
              !canScrollRight && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      )}

      <LeadFormDialog open={newOpen} onOpenChange={setNewOpen} />
      <LeadDetailSheet lead={detailLead} open={!!detailLead} onOpenChange={(v) => !v && setDetailLead(null)} />
      <LeadValueDialog lead={valueLead} open={!!valueLead} onOpenChange={(v) => !v && setValueLead(null)} />
      <LeadLocationDialog lead={locationLead} open={!!locationLead} onOpenChange={(v) => !v && setLocationLead(null)} />
      <RegisterPurchaseDialog lead={closingLead} open={!!closingLead} onOpenChange={(v) => !v && setClosingLead(null)} closeLead />
      <ConsultationSummaryDialog
        lead={followupLead}
        open={!!followupLead}
        onOpenChange={(v) => !v && setFollowupLead(null)}
        moveToFollowupOnSave
      />

      {/* Agenda dialog — usa o mesmo formulário da aba Agenda */}
      <NewAppointmentDialog
        open={!!scheduleLead}
        onOpenChange={(v: boolean) => { if (!v) { setScheduleLead(null); setScheduleData({ date: '', time: '' }); } }}
        defaultLeadId={scheduleLead?.id}
        lockLead
        moveLeadToScheduled
      />

      {/* Loss dialog */}
      <LostLeadDialog
        open={!!lossLead}
        leadName={lossLead?.full_name ?? null}
        isSubmitting={updateLead.isPending}
        onOpenChange={(v) => !v && setLossLead(null)}
        onConfirm={confirmLoss}
      />

      {/* No-Show dialog — motivo obrigatório */}
      <NoShowReasonDialog
        open={!!noShowLead}
        leadName={noShowLead?.full_name ?? null}
        isSubmitting={updateLead.isPending}
        onOpenChange={(v) => !v && setNoShowLead(null)}
        onConfirm={confirmNoShow}
      />


      {/* Column create/edit dialog (per-column from dropdown menu) */}
      <KanbanColumnDialog
        open={columnDialogOpen}
        onOpenChange={(v) => { setColumnDialogOpen(v); if (!v) setEditingColumn(null); }}
        editing={editingColumn}
        nextPosition={nextPosition}
      />

      {/* Columns settings (list + reorder + add) */}
      <KanbanColumnsSettingsDialog
        open={columnsSettingsOpen}
        onOpenChange={setColumnsSettingsOpen}
        columns={columns}
      />


      {/* Delete column confirmation */}
      <Dialog open={!!deletingColumn} onOpenChange={(v) => !v && setDeletingColumn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir coluna "{deletingColumn?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Os leads que estão nesta coluna voltarão para <strong>Leads Prontos</strong>. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingColumn(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteColumn} disabled={deleteColumn.isPending}>
              Excluir coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadCard({
  lead,
  assigneeName,
  reminders,
  pendingAppt,
  onClick,
  onCalendar,
  onChat,
  onLocation,
  onValue,
  onMarkAttended,
  onMarkNoShow,
  onReschedule,
  onMarkWon,
  onMarkLost,
}: {
  lead: DBLead;
  assigneeName: string | null;
  reminders: LeadReminder[];
  pendingAppt: import('@/hooks/use-agenda').Appointment | null;
  onClick: () => void;
  onCalendar: () => void;
  onChat: () => void;
  onLocation: () => void;
  onValue: () => void;
  onMarkAttended: () => void;
  onMarkNoShow: () => void;
  onReschedule: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}) {
  const [showAllReminders, setShowAllReminders] = useState(false);
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const daysInStage = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
  const slaTone =
    daysInStage >= 7 ? 'bg-red-50 text-red-700 border-red-200'
    : daysInStage >= 3 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const isScheduled = lead.status === 'scheduled';
  const isAi = !lead.assigned_user_id;
  const attendantLabel = isAi ? 'SDR' : firstName(assigneeName) || 'Vendedor';

  // Aguardando check-in: appointment com scheduled_at já passado e sem checkin
  const apptStartMs = pendingAppt
    ? new Date(`${pendingAppt.date}T${pendingAppt.startTime}:00`).getTime()
    : null;
  const minutesElapsed = apptStartMs ? Math.floor((Date.now() - apptStartMs) / 60000) : null;
  const awaitingCheckin = pendingAppt && minutesElapsed !== null && minutesElapsed >= 0;
  const awaitingTone =
    !awaitingCheckin ? '' :
    minutesElapsed! >= 60 ? 'bg-red-50 text-red-700 border-red-300 animate-pulse' :
    minutesElapsed! >= 30 ? 'bg-orange-50 text-orange-700 border-orange-300' :
    'bg-amber-50 text-amber-700 border-amber-200';

  const hasReminders = reminders.length > 0;
  const recentReminders = reminders.slice(-5).reverse();
  const hasMore = reminders.length > 5;
  const wasConfirmed = reminders.some((r) => r.status === 'confirmed');
  const hasPending = reminders.some((r) => r.status === 'pending');
  const reminderTone = wasConfirmed
    ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
    : hasPending
    ? 'text-amber-600 border-amber-300 bg-amber-50'
    : 'text-gray-500 border-[#E3E6EB] bg-white';

  const actions: Array<{ icon: typeof Calendar; title: string; onClick: () => void; highlight?: boolean }> = [
    { icon: Calendar, title: 'Agendar', onClick: onCalendar, highlight: isScheduled },
    { icon: MessageSquare, title: 'Abrir conversa', onClick: onChat },
    { icon: MapPin, title: 'Unidade', onClick: onLocation },
    { icon: DollarSign, title: 'Editar valor', onClick: onValue },
  ];


  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
      onClick={onClick}
      className="bg-white p-4 sm:p-6 rounded-[16px] sm:rounded-[20px] border border-[#E3E6EB] shadow-[0_4px_12px_rgba(0,0,0,0.02)] cursor-pointer active:cursor-grabbing hover:border-[#FFC400]/50 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group relative min-w-0"
    >
      <AnimatePresence>
        {(lead.score_ia ?? 0) >= 80 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-[12px] border-2 border-[#FFC400]/40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {(lead.score_ia ?? 0) >= 80 && (
        <div className="absolute -top-2 -right-2 bg-[#FFC400] text-[#1a1500] text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow-sm">
          IA {lead.score_ia}
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1 min-w-0 flex-1">
          <h4 className="font-black text-[13px] line-clamp-1 uppercase tracking-tight font-jakarta text-ink group-hover:text-primary transition-colors">{lead.full_name}</h4>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3 opacity-60 text-ink" />
            <span className="text-[12px] font-black text-ink">R$ {(lead.sales_value ?? 0).toLocaleString('pt-BR')}</span>
          </div>
          {lead.phone && <p className="text-[10px] text-gray-400 font-medium truncate">{lead.phone}</p>}
          <p className="text-[9px] text-gray-400 font-medium">
            1º contato: {new Date(lead.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={cn('inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide', slaTone)}>
              {daysInStage === 0 ? 'Hoje' : `${daysInStage}d na etapa`}
            </span>
            <span
              title={isAi ? 'Em atendimento pela IA (SDR)' : `Em atendimento por ${assigneeName ?? attendantLabel}`}
              className={cn(
                'inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide max-w-[120px] truncate',
                isAi
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', isAi ? 'bg-violet-500' : 'bg-sky-500')} />
              <span className="truncate">{attendantLabel}</span>
            </span>
          </div>
        </div>
        <div className="p-2 rounded-[12px] border bg-white border-[#E3E6EB]">
          {sourceIcon(lead.source)}
        </div>
      </div>

      {awaitingCheckin && (
        <div className={cn('mb-3 p-3 rounded-xl border', awaitingTone)}>
          <div className="flex items-center gap-2 mb-2">
            <AlarmClock className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Aguardando check-in — {minutesElapsed}min
            </span>
          </div>
          <p className="text-[10px] opacity-80 mb-2">
            Agendado para {pendingAppt!.startTime}. Confirme a presença abaixo.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={stop(onMarkAttended)}
              className="text-[10px] font-black uppercase tracking-wide py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              ✅ Compareceu
            </button>
            <button
              onClick={stop(onMarkNoShow)}
              className="text-[10px] font-black uppercase tracking-wide py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
            >
              ❌ Não veio
            </button>
            <button
              onClick={stop(onReschedule)}
              className="text-[10px] font-black uppercase tracking-wide py-1.5 rounded-lg bg-white border border-current hover:bg-gray-50 transition"
            >
              🔄 Remarcar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => {
          const Icon = action.icon;
          const highlight = action.highlight;
          return (
            <button
              key={action.title}
              onClick={stop(action.onClick)}
              title={highlight ? `${action.title} (agendado)` : action.title}
              className={cn(
                'p-2.5 rounded-[12px] transition-all border bg-white',
                highlight
                  ? 'text-blue-600 border-blue-300 shadow-[0_0_0_2px_rgba(59,130,246,0.12)] animate-pulse-soft'
                  : 'text-gray-500 hover:text-[#FFC400] hover:border-[#FFC400]/30 border-[#E3E6EB]',
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', highlight && 'text-blue-600')} />
            </button>
          );
        })}

        {hasReminders && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                title="Histórico de lembretes"
                className={cn(
                  'relative p-2.5 rounded-[12px] transition-all border',
                  reminderTone,
                  hasPending && !wasConfirmed && 'animate-pulse-soft',
                )}
              >
                <Bell className="w-3.5 h-3.5" />
                {wasConfirmed && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" strokeWidth={3} />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b bg-gray-50/60">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Lembretes do agendamento</p>
                <p className="text-[10px] text-gray-500">
                  {wasConfirmed ? 'Lead confirmou a presença' : hasPending ? 'Aguardando envio/resposta' : 'Histórico recente'}
                </p>
              </div>
              <ul className="max-h-72 overflow-y-auto scrollbar-hide divide-y">
                {recentReminders.map((r) => {
                  const when = r.sent_at ?? r.scheduled_at;
                  const dt = new Date(when);
                  const tone =
                    r.status === 'confirmed' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : r.status === 'sent' ? 'text-sky-700 bg-sky-50 border-sky-200'
                    : r.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : r.status === 'failed' ? 'text-red-700 bg-red-50 border-red-200'
                    : 'text-gray-600 bg-gray-50 border-gray-200';
                  const Icon = r.status === 'confirmed' ? Check : r.status === 'sent' ? Check : r.status === 'failed' ? XIcon : Clock;
                  return (
                    <li key={r.id} className="px-3 py-2 flex items-start gap-2">
                      <span className={cn('mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border', tone)}>
                        <Icon className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-gray-800 truncate">{REMINDER_LABEL[r.kind]}</p>
                          <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded border', tone)}>
                            {REMINDER_STATUS_LABEL[r.status]}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {r.status === 'pending' && ' (programado)'}
                        </p>
                        {r.error_message && r.status === 'failed' && (
                          <p className="text-[10px] text-red-600 mt-0.5 line-clamp-2">{r.error_message}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllReminders(true); }}
                  className="w-full text-center py-2 text-[10px] font-bold text-primary hover:bg-gray-50 border-t transition-colors"
                >
                  Ver todos {reminders.length} lembretes
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
        {hasReminders && (
          <Dialog open={showAllReminders} onOpenChange={(v) => { setShowAllReminders(v); }}>
            <DialogContent className="sm:max-w-md p-0" onClick={(e) => e.stopPropagation()}>
              <DialogHeader className="px-4 py-3 border-b">
                <DialogTitle className="text-sm font-bold">Histórico completo — {lead.full_name}</DialogTitle>
              </DialogHeader>
              <ul className="max-h-[60vh] overflow-y-auto scrollbar-hide divide-y">
                {[...reminders].reverse().map((r) => {
                  const when = r.sent_at ?? r.scheduled_at;
                  const dt = new Date(when);
                  const tone =
                    r.status === 'confirmed' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : r.status === 'sent' ? 'text-sky-700 bg-sky-50 border-sky-200'
                    : r.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : r.status === 'failed' ? 'text-red-700 bg-red-50 border-red-200'
                    : 'text-gray-600 bg-gray-50 border-gray-200';
                  const Icon = r.status === 'confirmed' ? Check : r.status === 'sent' ? Check : r.status === 'failed' ? XIcon : Clock;
                  return (
                    <li key={r.id} className="px-3 py-2 flex items-start gap-2">
                      <span className={cn('mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border', tone)}>
                        <Icon className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-gray-800 truncate">{REMINDER_LABEL[r.kind]}</p>
                          <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded border', tone)}>
                            {REMINDER_STATUS_LABEL[r.status]}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {r.status === 'pending' && ' (programado)'}
                        </p>
                        {r.error_message && r.status === 'failed' && (
                          <p className="text-[10px] text-red-600 mt-0.5 line-clamp-2">{r.error_message}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </DialogContent>
          </Dialog>
        )}
      </div>

    </div>
  );
}
