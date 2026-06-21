import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Target, Loader2, Plus, Trash2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listConsultationTypes,
  upsertConsultationType,
  deleteConsultationType,
  getRevenueGoal,
  upsertRevenueGoal,
} from "@/lib/bi.functions";

type CT = { id: string; name: string; default_value: number; is_active: boolean };
type Tier = "bronze" | "gold" | "diamond";

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function GoalsSettings() {
  const list = useServerFn(listConsultationTypes);
  const upsertCT = useServerFn(upsertConsultationType);
  const delCT = useServerFn(deleteConsultationType);
  const getGoal = useServerFn(getRevenueGoal);
  const upsertGoal = useServerFn(upsertRevenueGoal);

  const [types, setTypes] = useState<CT[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [newType, setNewType] = useState({ name: "", default_value: "" });

  const [month, setMonth] = useState(currentMonthISO().slice(0, 7));
  const [goal, setGoal] = useState({ bronze: 0, gold: 0, diamond: 0, active_tier: "bronze" as Tier });
  const [loadingGoal, setLoadingGoal] = useState(true);
  const [savingGoal, setSavingGoal] = useState(false);

  async function reloadTypes() {
    setLoadingTypes(true);
    try {
      const rows = await list();
      setTypes(rows as CT[]);
    } catch (e) {
      toast.error("Erro ao carregar tipos: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingTypes(false);
    }
  }

  async function reloadGoal() {
    setLoadingGoal(true);
    try {
      const row = await getGoal({ data: { month: `${month}-01`, unit_id: null } });
      if (row) {
        setGoal({
          bronze: Number(row.bronze) || 0,
          gold: Number(row.gold) || 0,
          diamond: Number(row.diamond) || 0,
          active_tier: (row.active_tier as Tier) ?? "bronze",
        });
      } else {
        setGoal({ bronze: 0, gold: 0, diamond: 0, active_tier: "bronze" });
      }
    } catch (e) {
      toast.error("Erro ao carregar meta: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingGoal(false);
    }
  }

  useEffect(() => {
    reloadTypes();
  }, []);
  useEffect(() => {
    reloadGoal();
  }, [month]);

  async function saveType(ct: CT) {
    try {
      await upsertCT({
        data: {
          id: ct.id,
          name: ct.name,
          default_value: Number(ct.default_value) || 0,
          is_active: ct.is_active,
        },
      });
      toast.success("Tipo atualizado");
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function addType() {
    const name = newType.name.trim();
    const value = Number(newType.default_value) || 0;
    if (!name) return toast.error("Informe o nome");
    try {
      await upsertCT({ data: { name, default_value: value, is_active: true } });
      setNewType({ name: "", default_value: "" });
      await reloadTypes();
      toast.success("Tipo criado");
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removeType(id: string) {
    if (!confirm("Excluir esse tipo de consulta?")) return;
    try {
      await delCT({ data: { id } });
      await reloadTypes();
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function saveGoal() {
    setSavingGoal(true);
    try {
      await upsertGoal({
        data: {
          month: `${month}-01`,
          unit_id: null,
          bronze: Number(goal.bronze) || 0,
          gold: Number(goal.gold) || 0,
          diamond: Number(goal.diamond) || 0,
          active_tier: goal.active_tier,
        },
      });
      toast.success("Meta salva");
    } catch (e) {
      toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Consultation types */}
      <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
        <h3 className="text-sm font-black text-ink flex items-center gap-3 uppercase tracking-widest mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Target className="w-5 h-5 text-primary" />
          </div>
          Tipos de Consulta
        </h3>
        <p className="text-[11px] text-gray-500 mb-6">
          Defina os tipos de consulta oferecidos e o valor padrão de cada um. Usado nos cálculos de
          receita e nas metas.
        </p>

        {loadingTypes ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {types.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl"
              >
                <Input
                  value={ct.name}
                  onChange={(e) =>
                    setTypes((arr) => arr.map((x) => (x.id === ct.id ? { ...x, name: e.target.value } : x)))
                  }
                  className="flex-1 h-10"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={ct.default_value}
                    onChange={(e) =>
                      setTypes((arr) =>
                        arr.map((x) =>
                          x.id === ct.id ? { ...x, default_value: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    className="w-28 h-10 text-right"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ct.is_active}
                    onCheckedChange={(v) =>
                      setTypes((arr) => arr.map((x) => (x.id === ct.id ? { ...x, is_active: v } : x)))
                    }
                  />
                  <span className="text-[10px] uppercase font-bold text-gray-500">Ativo</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => saveType(ct)} className="h-10">
                  Salvar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeType(ct.id)}
                  className="h-10 w-10 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {types.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">Nenhum tipo cadastrado.</p>
            )}
          </div>
        )}

        <div className="mt-6 p-4 border border-dashed border-border rounded-xl flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Novo tipo
            </Label>
            <Input
              placeholder="Ex.: Adaptação de Lente de Contato"
              value={newType.name}
              onChange={(e) => setNewType((n) => ({ ...n, name: e.target.value }))}
              className="h-10 mt-2"
            />
          </div>
          <div className="w-32">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Valor (R$)
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={newType.default_value}
              onChange={(e) => setNewType((n) => ({ ...n, default_value: e.target.value }))}
              className="h-10 mt-2 text-right"
            />
          </div>
          <Button onClick={addType} className="h-10 gap-2">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </section>

      {/* Revenue goals */}
      <section className="bg-white border border-border rounded-[14px] p-8 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-black text-ink flex items-center gap-3 uppercase tracking-widest">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Award className="w-5 h-5 text-primary" />
            </div>
            Metas de Receita Mensais
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Mês
            </Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 w-44"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mb-6">
          Bronze é o piso aceitável, Ouro é a meta principal, Diamante é a meta de excelência. O
          tier ativo é o desafio do mês — a meta individual de cada atendente é calculada
          automaticamente (tier ativo ÷ atendentes ativos).
        </p>

        {loadingGoal ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["bronze", "gold", "diamond"] as Tier[]).map((tier) => (
                <button
                  type="button"
                  key={tier}
                  onClick={() => setGoal((g) => ({ ...g, active_tier: tier }))}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    goal.active_tier === tier
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {tier === "bronze" ? "Bronze" : tier === "gold" ? "Ouro" : "Diamante"}
                    </span>
                    {goal.active_tier === tier && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                        ATIVO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={goal[tier]}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setGoal((g) => ({ ...g, [tier]: Number(e.target.value) }))
                      }
                      className="h-11 text-lg font-black text-ink text-right"
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={saveGoal} disabled={savingGoal} className="h-10">
                {savingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Metas"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
