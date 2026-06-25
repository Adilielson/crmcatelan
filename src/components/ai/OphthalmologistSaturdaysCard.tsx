import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, nextSaturday, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, CalendarCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, DEV_TENANT_ID } from '@/hooks/use-auth';
import { toast } from 'sonner';

function nextSaturdays(count = 16): string[] {
  const out: string[] = [];
  let d = nextSaturday(startOfDay(new Date()));
  for (let i = 0; i < count; i++) {
    out.push(format(d, 'yyyy-MM-dd'));
    d = addDays(d, 7);
  }
  return out;
}

export function OphthalmologistSaturdaysCard() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id) ?? DEV_TENANT_ID;
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualDate, setManualDate] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data, error } = await supabase
        .from('ai_configs')
        .select('ophthalmologist_saturdays')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!error) {
        const arr = (data as any)?.ophthalmologist_saturdays;
        setDates(Array.isArray(arr) ? (arr as string[]).sort() : []);
      }
      setLoading(false);
    })();
  }, [tenantId]);

  const suggestions = useMemo(() => nextSaturdays(16), []);

  const persist = async (next: string[]) => {
    if (!tenantId) return;
    setSaving(true);
    const sorted = Array.from(new Set(next)).sort();
    setDates(sorted);
    const { error } = await supabase
      .from('ai_configs')
      .update({ ophthalmologist_saturdays: sorted as any })
      .eq('tenant_id', tenantId);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar sábados: ' + error.message);
    } else {
      toast.success('Sábados do Oftalmologista atualizados');
    }
  };

  const toggle = (d: string) => {
    persist(dates.includes(d) ? dates.filter((x) => x !== d) : [...dates, d]);
  };

  const remove = (d: string) => persist(dates.filter((x) => x !== d));

  const addManual = () => {
    if (!manualDate) return;
    const dt = parseISO(manualDate);
    if (dt.getDay() !== 6) {
      toast.error('Selecione uma data que seja sábado');
      return;
    }
    persist([...dates, manualDate]);
    setManualDate('');
  };

  return (
    <Card className="shadow-card border-border bg-white rounded-[14px]">
      <CardHeader className="pb-4 border-b border-border/50 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">
            Sábados do Oftalmologista
          </CardTitle>
        </div>
        <CardDescription>
          Marque os sábados em que o oftalmologista atende (revezamento). A IA só
          oferecerá agendamento nessas datas. Endereço do exame:{' '}
          <strong>R. Jorn. Valdir Lago, 1288 – Aero Rancho</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        {loading ? (
          <div className="text-xs text-gray-400">Carregando…</div>
        ) : (
          <>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                Próximos sábados (clique para marcar)
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((d) => {
                  const active = dates.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggle(d)}
                      disabled={saving}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                      }`}
                    >
                      {format(parseISO(d), "dd 'de' MMM", { locale: ptBR })}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                  Adicionar sábado específico
                </div>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <Button onClick={addManual} disabled={!manualDate || saving} className="gap-1">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                Sábados marcados ({dates.length})
              </div>
              {dates.length === 0 ? (
                <div className="text-xs text-gray-400 italic">
                  Nenhum sábado marcado — a IA não oferecerá sábados para oftalmologista.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <Badge
                      key={d}
                      variant="outline"
                      className="gap-1.5 pl-3 pr-1 py-1 text-xs font-bold"
                    >
                      {format(parseISO(d), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                      <button
                        type="button"
                        onClick={() => remove(d)}
                        disabled={saving}
                        className="ml-1 p-0.5 rounded hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
