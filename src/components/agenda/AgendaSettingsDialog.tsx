import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Plus, Ban, Stethoscope } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  useBlockedDates,
  useAddBlockedDate,
  useDeleteBlockedDate,
  trimSec,
} from '@/hooks/use-agenda-settings';
import { ExamHoursTab } from './ExamHoursTab';


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AgendaSettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Programação da Agenda</DialogTitle>
          <DialogDescription>
            Defina os horários de atendimento por tipo de exame e bloqueie datas específicas.
            O horário de funcionamento da loja e o fuso são configurados em <b>Informações Gerais</b>.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="exams" className="mt-2">
          <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="exams"><Stethoscope className="w-3.5 h-3.5 mr-1.5" /> <span className="hidden sm:inline">Horários por </span>Exame</TabsTrigger>
            <TabsTrigger value="blocks"><Ban className="w-3.5 h-3.5 mr-1.5" /> <span className="hidden sm:inline">Dias </span>Bloqueados</TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            <ExamHoursTab />
          </TabsContent>
          <TabsContent value="blocks">
            <BlockedDatesTab />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function BlockedDatesTab() {
  const { data: blocks = [], isLoading } = useBlockedDates();
  const add = useAddBlockedDate();
  const del = useDeleteBlockedDate();

  const [form, setForm] = useState({
    blocked_date: format(new Date(), 'yyyy-MM-dd'),
    all_day: true,
    block_start: '09:00',
    block_end: '12:00',
    reason: '',
  });

  const submit = () => {
    if (!form.blocked_date) return;
    add.mutate(
      {
        blocked_date: form.blocked_date,
        all_day: form.all_day,
        block_start: form.all_day ? undefined : form.block_start,
        block_end: form.all_day ? undefined : form.block_end,
        reason: form.reason || undefined,
      },
      {
        onSuccess: () => setForm((f) => ({ ...f, reason: '' })),
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* Form de novo bloqueio */}
      <div className="p-4 rounded-xl border border-dashed border-[#E3E6EB] bg-gray-50/50 space-y-3">
        <div className="text-xs font-black text-ink uppercase tracking-widest">Adicionar bloqueio</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-gray-500">Data</Label>
            <Input type="date" value={form.blocked_date} onChange={(e) => setForm({ ...form, blocked_date: e.target.value })} className="h-9" />
          </div>
          <div className="col-span-3 flex items-end gap-2 pb-1">
            <Checkbox
              id="all-day"
              checked={form.all_day}
              onCheckedChange={(v) => setForm({ ...form, all_day: !!v })}
            />
            <Label htmlFor="all-day" className="text-xs font-medium">Dia inteiro</Label>
          </div>
          {!form.all_day && (
            <>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-gray-500">Início</Label>
                <Input type="time" value={form.block_start} onChange={(e) => setForm({ ...form, block_start: e.target.value })} className="h-9" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-gray-500">Fim</Label>
                <Input type="time" value={form.block_end} onChange={(e) => setForm({ ...form, block_end: e.target.value })} className="h-9" />
              </div>
            </>
          )}
          <div className={`${form.all_day ? 'col-span-6' : 'col-span-12'} space-y-1`}>
            <Label className="text-[10px] uppercase tracking-wider text-gray-500">Motivo (opcional)</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Feriado, treinamento, etc." className="h-9" />
          </div>
        </div>
        <Button onClick={submit} disabled={add.isPending} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar bloqueio
        </Button>
      </div>

      {/* Lista de bloqueios */}
      <div className="space-y-2">
        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Bloqueios cadastrados</div>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">Carregando…</div>
        ) : blocks.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400 border border-dashed rounded-xl">Nenhum dia bloqueado.</div>
        ) : (
          blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E3E6EB] hover:bg-gray-50/50 transition">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <Ban className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <div className="text-sm font-black text-ink">
                    {format(new Date(b.blocked_date + 'T00:00:00'), 'dd/MM/yyyy')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.all_day ? (
                      <Badge variant="outline" className="text-[9px]">Dia inteiro</Badge>
                    ) : (
                      <span>{trimSec(b.block_start)} – {trimSec(b.block_end)}</span>
                    )}
                    {b.reason && <span className="ml-2">• {b.reason}</span>}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(b.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
