import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PlugZap,
  Clock,
  Cpu,
} from "lucide-react";
import {
  listTenantAiCredentials,
  upsertTenantAiCredential,
  toggleTenantAiCredential,
  testTenantAiCredential,
} from "@/lib/ai-credentials.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Credential = {
  id: string;
  provider: string;
  key_hint: string;
  model_default: string;
  monthly_budget_usd: number;
  is_active: boolean;
  last_used_at: string | null;
};

type TenantRow = {
  id: string;
  name: string;
  credentials: Credential[];
  usage: { total_tokens: number; total_cost_usd: number; total_calls: number } | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AiCredentialsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTenantAiCredentials);
  const upsertFn = useServerFn(upsertTenantAiCredential);
  const toggleFn = useServerFn(toggleTenantAiCredential);
  const testFn = useServerFn(testTenantAiCredential);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-ai-credentials"],
    queryFn: () => listFn(),
  });

  const [openTenant, setOpenTenant] = useState<TenantRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["tenant-ai-credentials"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleTest = async (tenant: TenantRow) => {
    setTestingId(tenant.id);
    try {
      const res = await testFn({ data: { tenantId: tenant.id } });
      if (res.ok) {
        toast.success(
          `${tenant.name}: conexão OK${res.source === "master" ? " (via chave master)" : ""}`,
        );
      } else {
        toast.error(`${tenant.name}: ${res.message}`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha no teste");
    } finally {
      setTestingId(null);
    }
  };

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tenants.map((t) => {
              const cred = t.credentials.find((c) => c.provider === "openai");
              const usedUsd = Number(t.usage?.total_cost_usd ?? 0);
              const tokens = Number(t.usage?.total_tokens ?? 0);
              const calls = Number(t.usage?.total_calls ?? 0);
              const budget = Number(cred?.monthly_budget_usd ?? 0);
              const pct = budget > 0 ? Math.min(100, Math.round((usedUsd / budget) * 100)) : 0;
              const over = budget > 0 && usedUsd >= budget;

              // Status conexão:
              // - sem chave: vermelho
              // - desativada: cinza
              // - ativa + estourada: âmbar (cai pro master)
              // - ativa: verde
              let statusBadge;
              if (!cred) {
                statusBadge = (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" /> Sem chave
                  </Badge>
                );
              } else if (!cred.is_active) {
                statusBadge = (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="w-3 h-3" /> Desativada
                  </Badge>
                );
              } else if (over) {
                statusBadge = (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                    <AlertTriangle className="w-3 h-3" /> Orçamento estourado
                  </Badge>
                );
              } else {
                statusBadge = (
                  <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Conectada
                  </Badge>
                );
              }

              return (
                <div
                  key={t.id}
                  className="border rounded-lg p-4 flex flex-col gap-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="mt-1">{statusBadge}</div>
                    </div>
                    {cred && (
                      <Switch
                        checked={cred.is_active}
                        onCheckedChange={(v) => toggleMut.mutate({ id: cred.id, isActive: v })}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Chave</div>
                      <div className="font-mono">{cred?.key_hint ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Modelo
                      </div>
                      <div>{cred?.model_default ?? "gpt-4o-mini (master)"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Consumo no mês</div>
                      <div className="font-medium">US$ {usedUsd.toFixed(4)}</div>
                      <div className="text-muted-foreground">
                        {tokens.toLocaleString("pt-BR")} tokens · {calls} chamadas
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Orçamento</div>
                      <div className="font-medium">
                        {cred ? `US$ ${budget.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>

                  {cred && budget > 0 && (
                    <div className="space-y-1">
                      <Progress
                        value={pct}
                        className={over ? "[&>div]:bg-red-500" : pct > 80 ? "[&>div]:bg-amber-500" : ""}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{pct}% usado</span>
                        <span>
                          US$ {usedUsd.toFixed(2)} / US$ {budget.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Último uso: {formatDateTime(cred?.last_used_at ?? null)}
                  </div>

                  <div className="flex gap-2 pt-1 mt-auto">
                    {cred ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={testingId === t.id}
                          onClick={() => handleTest(t)}
                        >
                          {testingId === t.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <PlugZap className="w-3 h-3" />
                          )}
                          Testar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setOpenTenant(t)}
                        >
                          Editar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setOpenTenant(t)}
                      >
                        <Plus className="w-3 h-3" /> Adicionar chave
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {tenants.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma ótica cadastrada.
            </p>
          )}
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
            <Label>
              Chave da API OpenAI{" "}
              {existing && (
                <span className="text-xs text-muted-foreground">(atual: {existing.key_hint})</span>
              )}
            </Label>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
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
