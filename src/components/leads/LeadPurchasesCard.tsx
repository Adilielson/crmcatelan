import { useMemo, useState } from 'react';
import { DollarSign, Plus, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useLeadPurchases, purchaseStats } from '@/hooks/use-lead-purchases';
import { useTenantProfiles } from '@/hooks/use-tenant-profiles';
import { RegisterPurchaseDialog } from './RegisterPurchaseDialog';
import type { DBLead } from '@/hooks/use-leads';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function LeadPurchasesCard({ lead }: { lead: DBLead }) {
  const { data: purchases = [], isLoading } = useLeadPurchases(lead.id);
  const { data: profiles = [] } = useTenantProfiles();
  const [open, setOpen] = useState(false);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name ?? ''));
    return m;
  }, [profiles]);

  const stats = useMemo(() => purchaseStats(purchases), [purchases]);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">LTV & Compras</h4>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase tracking-wider" onClick={() => setOpen(true)}>
            <Plus className="w-3 h-3 mr-1" /> Registrar
          </Button>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <KPI label="LTV total" value={brl(stats.total)} highlight />
            <KPI label="Compras" value={String(stats.count)} />
            <KPI label="Ticket médio" value={brl(stats.avg)} />
          </div>

          {isLoading ? (
            <div className="text-[11px] text-gray-400">Carregando...</div>
          ) : purchases.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic">Nenhuma compra registrada ainda.</div>
          ) : (
            <ul className="divide-y divide-emerald-100">
              {purchases.map((p) => (
                <li key={p.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink">{brl(Number(p.amount))}</div>
                    {p.product_description && (
                      <div className="text-[11px] text-gray-600 truncate">{p.product_description}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {format(new Date(p.purchase_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      {p.attendant_id && <> • {profileMap.get(p.attendant_id) ?? '—'}</>}
                      {p.payment_method && <> • {p.payment_method}</>}
                      {p.installments && p.installments > 1 && <> • {p.installments}x</>}
                    </div>
                  </div>
                  <DollarSign className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <RegisterPurchaseDialog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}

function KPI({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</div>
      <div className={highlight ? 'text-sm font-black text-emerald-700 mt-0.5' : 'text-sm font-bold text-ink mt-0.5'}>{value}</div>
    </div>
  );
}
