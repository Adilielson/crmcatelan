import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, Loader2, AlertTriangle } from "lucide-react";
import {
  listTenantAiCredentials,
  upsertTenantAiCredential,
  toggleTenantAiCredential,
} from "@/lib/ai-credentials.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TenantRow = {
  id: string;
  name: string;
  credentials: Array<{
    id: string;
    provider: string;
    key_hint: string;
    model_default: string;
    monthly_budget_usd: number;
    is_active: boolean;
    last_used_at: string | null;
  }>;
  usage: { total_tokens: number; total_cost_usd: number; calls: number } | null;
};

export function AiCredentialsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTenantAiCredentials);
  const upsertFn = useServerFn(upsertTenantAiCredential);
  const toggleFn = useServerFn(toggleTenantAiCredential);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-ai-credentials"],
    queryFn: () => listFn(),
  });

  const [openTenant, setOpenTenant] = useState<TenantRow | null>(null);

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["tenant-ai-credentials"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const tenants = (data?.tenants ?? []) as TenantRow[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Credenciais IA por Ótica
          </CardTitle>
          <CardDescription>
            Cada ótica usa sua própria chave da OpenAI. Quando não há chave configurada
            ou o orçamento mensal estoura, o sistema usa a chave master de fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-left min-w-[800px] text-sm">
              <thead className="bg-muted/50 text-[10px] text-muted-foreground uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Ótica</th>
                  <th className="px-4 py-3">Chave OpenAI</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Orçamento/mês</th>
                  <th className="px-4 py-3">Consumo no mês</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => {
                  const cred = t.credentials.find((c) => c.provider === "openai");
                  const usedUsd = Number(t.usage?.total_cost_usd ?? 0);
                  const tokens = Number(t.usage?.total_tokens ?? 0);
                  const budget = cred?.monthly_budget_usd ?? 0;
                  const pct = budget > 0 ? Math.round((usedUsd / budget) * 100) : 0;
                  const over = budget > 0 && usedUsd >= budget;
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {cred ? cred.key_hint : <span className="text-muted-foreground italic">— usa master —</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">{cred?.model_default ?? "gpt-4o-mini"}</td>
                      <td className="px-4 py-3 text-xs">{cred ? `US$ ${budget.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-col">
                          <span>US$ {usedUsd.toFixed(4)}</span>
                          <span className="text-muted-foreground">{tokens.toLocaleString()} tokens</span>
                          {cred && (
                            <span className={over ? "text-red-500" : "text-muted-foreground"}>{pct}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {cred ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={cred.is_active}
                              onCheckedChange={(v) =>
                                toggleMut.mutate({ id: cred.id, isActive: v })
                              }
                            />
                            {over && (
                              <Badge variant="outline" className="text-red-500 border-red-300 gap-1">
                                <AlertTriangle className="w-3 h-3" /> estourado
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">sem chave</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setOpenTenant(t)}>
                          {cred ? "Editar" : <><Plus className="w-3 h-3 mr-1" /> Adicionar</>}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {openTenant && (
        <CredentialDialog
          tenant={openTenant}
          onClose={() => setOpenTenant(null)}
          onSave={async (vals) => {
            try {
              await upsertFn({ data: { tenantId: openTenant.id, provider: "openai", ...vals } });
              toast.success("Chave salva com segurança no Vault.");
              setOpenTenant(null);
              qc.invalidateQueries({ queryKey: ["tenant-ai-credentials"] });
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}
    </div>
  );
}

function CredentialDialog({
  tenant,
  onClose,
  onSave,
}: {
  tenant: TenantRow;
  onClose: () => void;
  onSave: (v: { apiKey: string; modelDefault: string; monthlyBudgetUsd: number }) => void;
}) {
  const existing = tenant.credentials.find((c) => c.provider === "openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(existing?.model_default ?? "gpt-4o-mini");
  const [budget, setBudget] = useState<number>(Number(existing?.monthly_budget_usd ?? 10));
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Credencial OpenAI — {tenant.name}</DialogTitle>
          <DialogDescription>
            A chave fica criptografada no Vault do Supabase. Apenas as 4 últimas letras são exibidas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Chave da API OpenAI {existing && <span className="text-xs text-muted-foreground">(atual: {existing.key_hint})</span>}</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Pegue em platform.openai.com/api-keys. Não pré-preenchemos por segurança.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo padrão</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini (recomendado)</SelectItem>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Orçamento mensal (US$)</Label>
              <Input
                type="number"
                step="0.5"
                min={0}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || apiKey.length < 20}
            onClick={async () => {
              setSaving(true);
              await onSave({ apiKey, modelDefault: model, monthlyBudgetUsd: budget });
              setSaving(false);
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
