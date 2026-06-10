/** @jsxImportSource react */
import React, { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Calendar, MessageSquare, MapPin, DollarSign, MessageCircle, MoreVertical, AlertCircle, PlusCircle, Database, Pencil, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { LeadFormDialog } from './LeadFormDialog';
import { LeadDetailSheet } from './LeadDetailSheet';
import { LeadValueDialog } from './LeadValueDialog';
import { LeadLocationDialog } from './LeadLocationDialog';
import { KanbanColumnDialog } from './KanbanColumnDialog';

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

export function KanbanBoard() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeads();
  const { data: columns = [] } = useKanbanColumns();
  const updateLead = useUpdateLead();
  const deleteColumn = useDeleteKanbanColumn();
  const seed = useSeedSampleLeads();
  const { addAppointment } = useAgenda();
  const userRole = useAuthStore((s) => s.user?.role ?? null);
  const canManageColumns = userRole === 'admin' || userRole === 'super_admin';

  const [newOpen, setNewOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<DBLead | null>(null);
  const [valueLead, setValueLead] = useState<DBLead | null>(null);
  const [locationLead, setLocationLead] = useState<DBLead | null>(null);
  const [scheduleLead, setScheduleLead] = useState<DBLead | null>(null);
  const [lossLead, setLossLead] = useState<DBLead | null>(null);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
  const [lossReason, setLossReason] = useState('');
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<KanbanColumn | null>(null);

  const leadsForColumn = (col: KanbanColumn): DBLead[] => {
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

  const confirmLoss = async () => {
    if (!lossLead || !lossReason) return;
    await updateLead.mutateAsync({
      id: lossLead.id,
      updates: { status: 'lost', notes: `${lossLead.notes ?? ''}\n[Perdido: ${lossReason}]`.trim() },
    });
    toast.error('Lead marcado como perdido');
    setLossLead(null);
    setLossReason('');
  };

  const openChat = (lead: DBLead) => {
    navigate({ to: '/chat', search: { phone: lead.phone ?? '' } as any });
  };

  const openAgenda = (lead: DBLead) => {
    setScheduleLead(lead);
    setScheduleData({ date: '', time: '' });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-[14px] border border-[#E3E6EB] shadow-sm gap-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-black text-[#6C727C] uppercase tracking-[0.2em] font-jakarta">Fluxo de Vendas</h3>
          <p className="text-xs font-bold text-ink mt-1">{leads.length} lead(s) — Ótica Catelan Matriz</p>
        </div>
        <div className="flex gap-3">
          {leads.length === 0 && !isLoading && (
            <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending} className="h-11 px-5 font-bold text-xs uppercase tracking-wider border-[#E3E6EB] rounded-[14px]">
              <Database className="w-4 h-4 mr-2" /> Importar exemplos
            </Button>
          )}
          {canManageColumns && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingColumn(null); setColumnDialogOpen(true); }}
              className="h-11 px-5 font-bold text-xs uppercase tracking-wider border-[#E3E6EB] rounded-[14px]"
            >
              <Plus className="w-4 h-4 mr-2" /> Nova Coluna
            </Button>
          )}
          <Button variant="outline" size="sm" className="relative h-11 px-6 font-bold text-xs uppercase tracking-wider border-[#E3E6EB] bg-white text-ink shadow-sm rounded-[14px] hover:bg-[#F6F7F9]">
            <AlertCircle className="w-4 h-4 mr-2 text-[#FFC400]" />
            Notificações
          </Button>
          <Button onClick={() => setNewOpen(true)} size="sm" className="h-11 px-8 font-black text-xs uppercase tracking-[0.1em] bg-[#FFC400] text-[#1a1500] hover:bg-[#FFD60A] shadow-md shadow-[#FFC400]/10 rounded-[14px]">
            <PlusCircle className="w-4 h-4 mr-2" /> Novo Lead
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400 font-bold">Carregando leads...</div>
      ) : (
        <div className="flex gap-8 overflow-x-auto pb-8 scrollbar-hide -mx-4 px-4 h-[calc(100vh-280px)]">
          {columns.map((col) => {
            const colLeads = leadsForColumn(col);
            const isCheckedIn = col.system_key === 'checked_in';
            return (
              <div key={col.id} className="min-w-[320px] flex-1 flex flex-col gap-5">
                <div className="flex justify-between items-center px-6 py-4 rounded-[20px] bg-white border border-[#E3E6EB] shadow-sm relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: col.color }}
                  />
                  <div className="flex items-center gap-3">
                    <span className="font-black uppercase tracking-[0.15em] text-[11px] text-[#A7ADB8] font-jakarta">{col.name}</span>
                    {isCheckedIn && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        Qualificado
                      </span>
                    )}
                    <div className="bg-[#F6F7F9] text-ink text-[10px] px-2.5 py-1 rounded-full font-black min-w-[28px] text-center border border-[#E3E6EB]">
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
                      onClick={() => setDetailLead(lead)}
                      onCalendar={() => openAgenda(lead)}
                      onChat={() => openChat(lead)}
                      onLocation={() => setLocationLead(lead)}
                      onValue={() => setValueLead(lead)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadFormDialog open={newOpen} onOpenChange={setNewOpen} />
      <LeadDetailSheet lead={detailLead} open={!!detailLead} onOpenChange={(v) => !v && setDetailLead(null)} />
      <LeadValueDialog lead={valueLead} open={!!valueLead} onOpenChange={(v) => !v && setValueLead(null)} />
      <LeadLocationDialog lead={locationLead} open={!!locationLead} onOpenChange={(v) => !v && setLocationLead(null)} />

      {/* Agenda dialog */}
      <Dialog open={!!scheduleLead} onOpenChange={(v) => !v && setScheduleLead(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Agendar — {scheduleLead?.full_name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input type="date" value={scheduleData.date} onChange={(e) => setScheduleData((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Input type="time" value={scheduleData.time} onChange={(e) => setScheduleData((p) => ({ ...p, time: e.target.value }))} />
            </div>
            {scheduleLead?.phone && <p className="text-xs text-gray-500">📱 {scheduleLead.phone}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleLead(null)}>Cancelar</Button>
            <Button onClick={confirmSchedule}>Confirmar Agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss dialog */}
      <Dialog open={!!lossLead} onOpenChange={(v) => !v && setLossLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo da Perda — {lossLead?.full_name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Selecione o motivo</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preço alto">Preço alto</SelectItem>
                  <SelectItem value="Fechou com concorrente">Fechou com concorrente</SelectItem>
                  <SelectItem value="Não responde mais">Não responde mais</SelectItem>
                  <SelectItem value="Sem perfil">Sem perfil</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossLead(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss} disabled={!lossReason}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column create/edit dialog */}
      <KanbanColumnDialog
        open={columnDialogOpen}
        onOpenChange={(v) => { setColumnDialogOpen(v); if (!v) setEditingColumn(null); }}
        editing={editingColumn}
        nextPosition={nextPosition}
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
  onClick,
  onCalendar,
  onChat,
  onLocation,
  onValue,
}: {
  lead: DBLead;
  onClick: () => void;
  onCalendar: () => void;
  onChat: () => void;
  onLocation: () => void;
  onValue: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const actions = [
    { icon: Calendar, title: 'Agendar', onClick: onCalendar },
    { icon: MessageSquare, title: 'Abrir conversa', onClick: onChat },
    { icon: MapPin, title: 'Unidade', onClick: onLocation },
    { icon: DollarSign, title: 'Editar valor', onClick: onValue },
  ];

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
      onClick={onClick}
      className="bg-white p-6 rounded-[20px] border border-[#E3E6EB] shadow-[0_4px_12px_rgba(0,0,0,0.02)] cursor-pointer active:cursor-grabbing hover:border-[#FFC400]/50 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group relative"
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
        </div>
        <div className="p-2 rounded-[12px] border bg-white border-[#E3E6EB]">
          {sourceIcon(lead.source)}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={stop(action.onClick)}
            title={action.title}
            className="p-2.5 rounded-[12px] transition-all border bg-white text-gray-500 hover:text-[#FFC400] hover:border-[#FFC400]/30 border-[#E3E6EB]"
          >
            <action.icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
