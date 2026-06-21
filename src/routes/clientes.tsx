import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Plus, Search, Upload, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { stageLabel } from '@/hooks/use-leads';
import { toast } from 'sonner';

export const Route = createFileRoute('/clientes')({
  component: Clientes,
});

interface ClientLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  ia_urgencia: string | null;
  updated_at: string;
}

function initials(name: string | null, phone: string | null) {
  const n = (name || '').trim();
  if (n) {
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('');
  }
  if (phone) return phone.slice(-2);
  return '?';
}

function temperatureFromUrgencia(v: string | null) {
  const k = (v || '').toLowerCase();
  if (k === 'alta' || k === 'high') {
    return { label: 'Quente', className: 'bg-orange-100 text-orange-700 border-orange-200' };
  }
  if (k === 'media' || k === 'média' || k === 'medium') {
    return { label: 'Morno', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  }
  return { label: 'Frio', className: 'bg-blue-100 text-blue-700 border-blue-200' };
}

const SOURCE_OPTIONS = ['whatsapp', 'instagram', 'google', 'facebook', 'direct', 'outro'];

function Clientes() {
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    channel: 'whatsapp',
    source: '',
  });

  const queryKey = ['clientes', tenantId] as const;

  const { data = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenantId,
    queryFn: async (): Promise<ClientLead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, status, source, ia_urgencia, updated_at')
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientLead[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não identificado');
      if (!form.full_name.trim()) throw new Error('Informe o nome');
      const { error } = await (supabase as any).from('leads').insert({
        tenant_id: tenantId,
        assigned_user_id: userId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        source: (form.source.trim() || form.channel).toLowerCase(),
        status: 'open',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success('Lead criado');
      setCreateOpen(false);
      setForm({ full_name: '', phone: '', channel: 'whatsapp', source: '' });
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });

      const NAME_KEYS = ['nome', 'name', 'full_name', 'cliente'];
      const PHONE_KEYS = ['telefone', 'phone', 'celular', 'whatsapp', 'fone'];

      const pick = (row: Record<string, unknown>, keys: string[]) => {
        const lowerMap: Record<string, unknown> = {};
        Object.keys(row).forEach((k) => {
          lowerMap[k.toLowerCase().trim()] = row[k];
        });
        for (const k of keys) {
          if (lowerMap[k] != null && String(lowerMap[k]).trim() !== '') {
            return String(lowerMap[k]).trim();
          }
        }
        return '';
      };

      const payload = rows
        .map((r) => ({
          tenant_id: tenantId,
          assigned_user_id: userId,
          full_name: pick(r, NAME_KEYS) || null,
          phone: pick(r, PHONE_KEYS) || null,
          source: 'import',
          status: 'open' as const,
        }))
        .filter((p) => p.full_name || p.phone);

      if (payload.length === 0) {
        throw new Error('Nenhuma linha com nome ou telefone encontrada');
      }

      const { error } = await (supabase as any).from('leads').insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['leads', tenantId] });
      toast.success(`${count} leads importados`);
    },
    onError: (e: any) => toast.error(`Erro na importação: ${e.message}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((l) =>
      [l.full_name, l.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-ink">Clientes</h1>
          <p className="text-sm text-[#6B7280]">Base completa de leads do tenant.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importMutation.mutate(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <Upload />
            Importar Excel
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Plus />
                Novo lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo lead</DialogTitle>
                <DialogDescription>
                  Cadastre manualmente um cliente na base.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="5527999999999"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Canal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o} className="capitalize">
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Origem (opcional)</Label>
                  <Input
                    value={form.source}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, source: e.target.value }))
                    }
                    placeholder="Ex.: campanha-promo-junho"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="w-full pl-9"
            />
          </div>
          <span className="text-xs uppercase tracking-widest text-[#6B7280]">
            {filtered.length} leads
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#6B7280]">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Nenhum cliente encontrado.</p>
        ) : (
          <div className="-mx-4 sm:-mx-6 overflow-x-auto">
            <div className="min-w-[640px] px-4 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead>Última conversa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const t = temperatureFromUrgencia(l.ia_urgencia);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFC400]/15 text-xs font-black text-[#1a1500]">
                              {initials(l.full_name, l.phone)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-ink">
                                {l.full_name?.trim() || 'Sem nome'}
                              </p>
                              <p className="truncate text-xs text-[#6B7280]">
                                {l.phone || '—'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{stageLabel(l.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${t.className}`}
                          >
                            {t.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280]">
                          {formatDistanceToNow(new Date(l.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigate({
                                to: '/chat',
                                search: { phone: l.phone ?? undefined },
                              })
                            }
                          >
                            Abrir
                            <ArrowRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
