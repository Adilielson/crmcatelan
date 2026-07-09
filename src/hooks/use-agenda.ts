import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { useNotificationStore } from '@/store/useNotificationStore';

export type AppointmentStatus = 'pendente' | 'confirmado' | 'realizado' | 'no-show' | 'cancelado';
export type AppointmentOrigin = 'manual' | 'automatizado_ia' | 'link_externo';

export interface Appointment {
  id: string;
  leadId: string;
  leadName: string;
  date: string;          // yyyy-MM-dd
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  status: AppointmentStatus;
  examType: string;
  medicalNotes?: string;
  reminderSent: boolean;
  professionalId: string;
  unit: string;
  origin: AppointmentOrigin;
  value: number;
  cancellationReason?: string;
  confirmationUrl?: string;
  propensityScore: number;
  notificationChannel: 'whatsapp' | 'sms' | 'email';
  rescheduleCount: number;
  checkinAt?: string;
  checkoutAt?: string;
  roomId?: string;
  needsTransport: boolean;
  customField?: string;
}

const UI_TO_DB: Record<AppointmentStatus, string> = {
  pendente: 'pending',
  confirmado: 'confirmed',
  realizado: 'completed',
  'no-show': 'no_show',
  cancelado: 'cancelled',
};
const DB_TO_UI: Record<string, AppointmentStatus> = Object.fromEntries(
  Object.entries(UI_TO_DB).map(([k, v]) => [v, k as AppointmentStatus]),
) as Record<string, AppointmentStatus>;

function pad(n: number) { return String(n).padStart(2, '0'); }
function splitLocal(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
function joinLocal(date: string, time: string) {
  // Treat as local time
  return new Date(`${date}T${time}:00`).toISOString();
}

function rowToAppt(row: any): Appointment {
  const s = splitLocal(row.scheduled_at);
  const e = row.end_at ? splitLocal(row.end_at) : { date: s.date, time: s.time };
  return {
    id: row.id,
    leadId: row.lead_id ?? '',
    leadName: row.lead_name ?? '',
    date: s.date,
    startTime: s.time,
    endTime: e.time,
    status: DB_TO_UI[row.status] ?? 'pendente',
    examType: row.type_exam ?? 'Consulta',
    medicalNotes: row.notes ?? undefined,
    reminderSent: !!row.reminder_sent,
    professionalId: row.professional_id ?? '',
    unit: row.unit_name ?? '',
    origin: (row.origin ?? 'manual') as AppointmentOrigin,
    value: Number(row.value ?? 0),
    propensityScore: Number(row.propensity_score ?? 0),
    notificationChannel: (row.notification_channel ?? 'whatsapp') as 'whatsapp' | 'sms' | 'email',
    rescheduleCount: Number(row.reschedule_count ?? 0),
    needsTransport: !!row.needs_transport,
    cancellationReason: row.cancellation_reason ?? undefined,
    checkinAt: row.checkin_at ?? undefined,
    checkoutAt: row.checkout_at ?? undefined,
  };
}

const WORKING_HOURS = { start: '08:00', end: '18:00', lunchStart: '12:00', lunchEnd: '13:00' };

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return (aStart >= bStart && aStart < bEnd) ||
         (aEnd > bStart && aEnd <= bEnd) ||
         (aStart <= bStart && aEnd >= bEnd);
}

export function useAgenda() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);

  const query = useQuery({
    queryKey: ['appointments', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenantId!)
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(rowToAppt);
    },
  });

  const appointments = query.data ?? [];

  const checkConflict = (date: string, start: string, end: string, excludeId?: string) =>
    appointments.some((a) =>
      a.id !== excludeId &&
      a.date === date &&
      a.status !== 'cancelado' &&
      overlaps(start, end, a.startTime, a.endTime),
    );

  const insertMut = useMutation({
    mutationFn: async (data: Omit<Appointment, 'id'>) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const row = {
        tenant_id: tenantId,
        lead_id: data.leadId || null,
        lead_name: data.leadName,
        scheduled_at: joinLocal(data.date, data.startTime),
        end_at: joinLocal(data.date, data.endTime),
        status: UI_TO_DB[data.status],
        type_exam: data.examType,
        notes: data.medicalNotes ?? null,
        value: data.value,
        notification_channel: data.notificationChannel,
        reminder_sent: data.reminderSent,
        reschedule_count: data.rescheduleCount,
        needs_transport: data.needsTransport,
        propensity_score: data.propensityScore,
        unit_name: data.unit,
        origin: data.origin,
      };
      const { error } = await (supabase as any).from('appointments').insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', tenantId] }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Appointment> }) => {
      const current = appointments.find((a) => a.id === id);
      if (!current) throw new Error('Appointment not found');
      const merged = { ...current, ...updates };
      const patch: Record<string, unknown> = {};
      if (updates.date || updates.startTime) patch.scheduled_at = joinLocal(merged.date, merged.startTime);
      if (updates.date || updates.endTime)   patch.end_at = joinLocal(merged.date, merged.endTime);
      if (updates.status) patch.status = UI_TO_DB[updates.status];
      if (updates.examType !== undefined) patch.type_exam = updates.examType;
      if (updates.medicalNotes !== undefined) patch.notes = updates.medicalNotes;
      if (updates.value !== undefined) patch.value = updates.value;
      if (updates.notificationChannel) patch.notification_channel = updates.notificationChannel;
      if (updates.reminderSent !== undefined) patch.reminder_sent = updates.reminderSent;
      if (updates.rescheduleCount !== undefined) patch.reschedule_count = updates.rescheduleCount;
      if (updates.needsTransport !== undefined) patch.needs_transport = updates.needsTransport;
      if (updates.cancellationReason !== undefined) patch.cancellation_reason = updates.cancellationReason;
      if (updates.unit !== undefined) patch.unit_name = updates.unit;
      if (updates.checkinAt !== undefined) patch.checkin_at = updates.checkinAt;
      if (updates.checkoutAt !== undefined) patch.checkout_at = updates.checkoutAt;
      if (Object.keys(patch).length === 0) return;
      const { error } = await (supabase as any).from('appointments').update(patch).eq('id', id);
      if (error) throw error;

      // side effects (notifications) — fire and forget
      if (updates.status === 'no-show') {
        useNotificationStore.getState().addNotification({
          title: 'Alerta de No-show',
          message: `Follow-up necessário para ${current.leadName} (atraso > 15min).`,
          category: 'lead_alert',
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', tenantId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', tenantId] }),
  });

  return {
    appointments,
    workingHours: WORKING_HOURS,
    isLoading: query.isLoading,
    checkConflict,
    addAppointment: async (data: Omit<Appointment, 'id'>): Promise<boolean> => {
      if (checkConflict(data.date, data.startTime, data.endTime)) return false;
      await insertMut.mutateAsync(data);
      return true;
    },
    updateAppointment: async (id: string, updates: Partial<Appointment>) => {
      if (updates.date || updates.startTime || updates.endTime) {
        const current = appointments.find((a) => a.id === id);
        if (current) {
          const date = updates.date ?? current.date;
          const start = updates.startTime ?? current.startTime;
          const end = updates.endTime ?? current.endTime;
          if (checkConflict(date, start, end, id)) return;
        }
      }
      await updateMut.mutateAsync({ id, updates });
    },
    deleteAppointment: async (id: string) => { await deleteMut.mutateAsync(id); },
  };
}
