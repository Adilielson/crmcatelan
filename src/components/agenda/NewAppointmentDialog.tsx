import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAgenda } from "@/hooks/use-agenda";
import { useLeads, useUpdateLead } from "@/hooks/use-leads";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import {
  useBusinessHours,
  useBlockedDates,
  checkAvailability,
} from "@/hooks/use-agenda-settings";
import { listConsultationTypes } from "@/lib/bi.functions";

type CT = { id: string; name: string; default_value: number; is_active: boolean };

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultLeadId?: string;
  /** Travar o lead (atalhos contextuais) — esconde o select de lead. */
  lockLead?: boolean;
  /** Após criar o agendamento, mover o lead para a etapa "Agendado" do Kanban. */
  moveLeadToScheduled?: boolean;
  onCreated?: () => void;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultLeadId,
  lockLead = false,
  moveLeadToScheduled = false,
  onCreated,
}: NewAppointmentDialogProps) {
  const { addAppointment } = useAgenda();
  const { data: leads = [] } = useLeads();
  const updateLead = useUpdateLead();
  const { sendText, isConnected: waConnected } = useWhatsApp();
  const { data: businessHours = [] } = useBusinessHours();
  const { data: blockedDates = [] } = useBlockedDates();
  const listTypes = useServerFn(listConsultationTypes);

  const [types, setTypes] = useState<CT[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    leadId: defaultLeadId ?? "",
    date: format(defaultDate ?? new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    examTypeId: "",
    examTypeName: "",
    notes: "",
    customField: "",
  });
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Load consultation types when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTypes(true);
    listTypes()
      .then((rows) => {
        if (cancelled) return;
        const active = (rows as CT[]).filter((t) => t.is_active);
        setTypes(active);
        // Default to first active type if nothing selected
        setFormData((f) =>
          f.examTypeId
            ? f
            : {
                ...f,
                examTypeId: active[0]?.id ?? "",
                examTypeName: active[0]?.name ?? "",
              },
        );
      })
      .catch((e) => toast.error("Erro ao carregar tipos: " + (e instanceof Error ? e.message : String(e))))
      .finally(() => !cancelled && setLoadingTypes(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Sync defaultLeadId / defaultDate when opening
  useEffect(() => {
    if (!open) return;
    setFormData((f) => ({
      ...f,
      leadId: defaultLeadId ?? f.leadId,
      date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : f.date,
    }));
  }, [open, defaultDate, defaultLeadId]);

  // Reset form on close
  useEffect(() => {
    if (open) return;
    setFormData({
      leadId: defaultLeadId ?? "",
      date: format(defaultDate ?? new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      examTypeId: "",
      examTypeName: "",
      notes: "",
      customField: "",
    });
    setSendWhatsApp(false);
  }, [open, defaultDate, defaultLeadId]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === formData.leadId),
    [leads, formData.leadId],
  );

  async function handleSubmit() {
    if (!selectedLead) {
      toast.error("Selecione um lead válido");
      return;
    }
    if (!formData.examTypeName) {
      toast.error("Selecione o tipo de exame / consulta");
      return;
    }

    const avail = checkAvailability(
      formData.date,
      formData.startTime,
      formData.endTime,
      businessHours,
      blockedDates,
    );
    if (!avail.ok) {
      toast.error(avail.reason ?? "Horário indisponível");
      return;
    }

    setSaving(true);
    try {
      const examValue =
        types.find((t) => t.id === formData.examTypeId)?.default_value ?? 0;

      const success = await addAppointment({
        leadId: selectedLead.id,
        leadName: selectedLead.full_name,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        status: "pendente",
        examType: formData.examTypeName,
        medicalNotes: formData.notes,
        reminderSent: false,
        professionalId: "dr-claudio",
        unit: "",
        origin: "manual",
        value: examValue,
        propensityScore: 0.85,
        notificationChannel: "whatsapp",
        rescheduleCount: 0,
        needsTransport: false,
        customField: formData.customField,
      });

      if (!success) {
        toast.error("Conflito de horário detectado!");
        return;
      }

      toast.success("Agendamento realizado com sucesso!");

      // Mover lead para a coluna "Agendado" do Kanban quando solicitado.
      if (moveLeadToScheduled) {
        try {
          await updateLead.mutateAsync({
            id: selectedLead.id,
            updates: { status: "scheduled", custom_column_id: null },
          });
        } catch {
          toast.warning("Agendamento criado, mas falha ao mover o lead.");
        }
      }

      // REAL WhatsApp dispatch — no longer mocked
      const phone = selectedLead.phone;
      if (phone && waConnected) {
        try {
          const dateBr = format(new Date(formData.date + "T00:00:00"), "dd/MM/yyyy");
          await sendText(
            phone,
            `Olá ${selectedLead.full_name}! Seu agendamento de *${formData.examTypeName}* foi marcado para ${dateBr} às ${formData.startTime}. Em breve enviaremos a confirmação. 💛`,
          );
          toast.info("Mensagem enviada via WhatsApp");
        } catch {
          toast.warning("Agendado, mas falha ao enviar WhatsApp");
        }
      } else if (phone && !waConnected) {
        toast.warning("WhatsApp não conectado — mensagem não enviada");
      }

      onCreated?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento Oftalmológico</DialogTitle>
          <DialogDescription>
            Preencha os dados do lead e selecione o horário disponível na agenda mestre.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {lockLead ? (
            selectedLead && (
              <div className="space-y-2">
                <Label>Lead</Label>
                <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedLead.full_name}</span>
                  {selectedLead.phone && (
                    <span className="text-xs text-muted-foreground">📱 {selectedLead.phone}</span>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <Label>Lead</Label>
              <Select
                value={formData.leadId}
                onValueChange={(v) => setFormData({ ...formData, leadId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Exame / Consulta</Label>
            <Select
              value={formData.examTypeId}
              onValueChange={(v) => {
                const t = types.find((x) => x.id === v);
                setFormData({
                  ...formData,
                  examTypeId: v,
                  examTypeName: t?.name ?? "",
                });
              }}
              disabled={loadingTypes || types.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingTypes
                      ? "Carregando..."
                      : types.length === 0
                        ? "Nenhum tipo cadastrado em Configurações"
                        : "Selecione o tipo"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.default_value > 0 ? ` — R$ ${t.default_value.toFixed(2)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Campo Customizável (Informações Adicionais)</Label>
            <Input
              placeholder="Convênio, indicações, etc."
              value={formData.customField}
              onChange={(e) => setFormData({ ...formData, customField: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações Médicas</Label>
            <Textarea
              placeholder="Histórico breve ou queixas..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Confirmar e Enviar WhatsApp"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
