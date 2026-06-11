import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getUserPermissions, updateUserPermissions } from '@/lib/permissions.functions';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/permissions';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userName: string;
}

type Effective = boolean; // valor efetivo computado
type OverrideMap = Record<ModuleKey, boolean | null>;

export function UserPermissionsDialog({ open, onOpenChange, userId, userName }: Props) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getUserPermissions);
  const saveFn = useServerFn(updateUserPermissions);

  const { data, isLoading } = useQuery({
    queryKey: ['user-perms', userId],
    queryFn: () => fetchFn({ data: { userId: userId! } }),
    enabled: !!userId && open,
  });

  const [overrides, setOverrides] = useState<OverrideMap>({} as OverrideMap);

  useEffect(() => {
    if (data) setOverrides({ ...(data.overrides as OverrideMap) });
  }, [data]);

  const effectiveFor = (k: ModuleKey): Effective => {
    const ov = overrides[k];
    if (ov === null || ov === undefined) return !!data?.roleDefaults[k];
    return ov;
  };

  const toggle = (k: ModuleKey) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const current = effectiveFor(k);
      const newVal = !current;
      // se o novo valor coincide com o default do papel, remove override
      if (data && newVal === data.roleDefaults[k]) next[k] = null;
      else next[k] = newVal;
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { userId: userId!, overrides } }),
    onSuccess: () => {
      toast.success('Permissões atualizadas');
      qc.invalidateQueries({ queryKey: ['user-perms', userId] });
      qc.invalidateQueries({ queryKey: ['my-permissions'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões de {userName}</DialogTitle>
          <DialogDescription>
            Papel atual: <Badge variant="outline">{data?.role ?? '—'}</Badge>. Ative ou desative módulos
            individualmente. Quando o valor for igual ao padrão do papel, nenhuma exceção é gravada.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-1 py-2">
            {MODULE_CATALOG.map((m) => {
              const k = m.key as ModuleKey;
              const eff = effectiveFor(k);
              const isOverride = overrides[k] !== null && overrides[k] !== undefined;
              return (
                <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Padrão do papel: {data.roleDefaults[k] ? 'permitido' : 'bloqueado'}</span>
                      {isOverride && <Badge variant="secondary" className="h-4 text-[10px]">exceção</Badge>}
                    </div>
                  </div>
                  <Switch checked={eff} onCheckedChange={() => toggle(k)} />
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !data}>
            {saveMut.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
