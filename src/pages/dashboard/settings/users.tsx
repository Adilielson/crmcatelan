import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { UserPlus, Search, MoreHorizontal, Copy, KeyRound, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  listTeam, createTeamMember, updateTeamMember, regenerateTeamMemberPassword,
} from '@/lib/team.functions';
import { useAuthStore } from '@/hooks/use-auth';

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  phone: string | null;
  notification_phone: string | null;
  last_login_at: string | null;
};

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Atendente',
  super_admin: 'Super Admin',
};

export default function UserManagement() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const fetchList = useServerFn(listTeam);
  const createFn = useServerFn(createTeamMember);
  const updateFn = useServerFn(updateTeamMember);
  const regenFn = useServerFn(regenerateTeamMemberPassword);

  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', notification_phone: '', role: 'seller' as 'admin' | 'manager' | 'seller',
  });
  const [credentialDialog, setCredentialDialog] = useState<{
    open: boolean; email: string; password: string;
  }>({ open: false, email: '', password: '' });
  const [copied, setCopied] = useState(false);

  const canManage = user && ['admin', 'manager', 'super_admin'].includes(user.role);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => fetchList(),
    enabled: !!canManage,
  });

  const createMut = useMutation({
    mutationFn: (input: typeof form) => createFn({ data: input }),
    onSuccess: (res) => {
      toast.success('Colaborador cadastrado');
      setCredentialDialog({ open: true, email: res.email, password: res.password });
      setOpenCreate(false);
      setForm({ full_name: '', email: '', phone: '', notification_phone: '', role: 'seller' });
      qc.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: (m: Member) =>
      updateFn({ data: { id: m.id, status: m.status === 'active' ? 'inactive' : 'active' } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenMut = useMutation({
    mutationFn: (id: string) => regenFn({ data: { id } }),
    onSuccess: (res, id) => {
      const m = (members as Member[]).find((x) => x.id === id);
      setCredentialDialog({ open: true, email: m?.email ?? '', password: res.password });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (members as Member[]).filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q) ||
      (m.phone ?? '').includes(q)
    );
  });

  const copyPassword = async () => {
    await navigator.clipboard.writeText(credentialDialog.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Apenas administradores e gerentes podem gerenciar a equipe.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header responsivo */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black sm:text-3xl">Equipe</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie os colaboradores da sua loja.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <UserPlus className="mr-2 h-4 w-4" /> Cadastrar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate(form);
              }}
            >
              <DialogHeader>
                <DialogTitle>Cadastrar colaborador</DialogTitle>
                <DialogDescription>
                  Os dados de acesso serão exibidos uma única vez após o cadastro.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name" required maxLength={120}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email" type="email" required maxLength={255}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Celular * (com DDD, só números)</Label>
                  <Input
                    id="phone" required placeholder="11999998888"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para notificações de leads, agendamentos e follow-ups.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Perfil *</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v: 'admin' | 'manager' | 'seller') => setForm({ ...form, role: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {user?.role === 'admin' || user?.role === 'super_admin' ? (
                        <SelectItem value="admin">Administrador</SelectItem>
                      ) : null}
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="seller">Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Cadastrando...' : 'Cadastrar colaborador'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou celular..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista — tabela no desktop, cards no mobile */}
      <div className="hidden rounded-lg border bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum colaborador encontrado.</TableCell></TableRow>
            ) : filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">{m.full_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell>{m.phone ?? '—'}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel[m.role] ?? m.role}</Badge></TableCell>
                <TableCell>
                  <Badge variant={m.status === 'active' ? 'default' : 'destructive'}>
                    {m.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowMenu m={m} onToggle={() => toggleStatusMut.mutate(m)} onRegen={() => regenMut.mutate(m.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cards mobile */}
      <div className="space-y-3 sm:hidden">
        {isLoading && <div className="text-center text-muted-foreground">Carregando...</div>}
        {!isLoading && filtered.length === 0 && <div className="text-center text-muted-foreground">Nenhum colaborador.</div>}
        {filtered.map((m) => (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-white p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{m.full_name ?? '—'}</div>
              <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              <div className="mt-1 text-xs">{m.phone ?? '—'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{roleLabel[m.role] ?? m.role}</Badge>
                <Badge variant={m.status === 'active' ? 'default' : 'destructive'}>
                  {m.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
            <RowMenu m={m} onToggle={() => toggleStatusMut.mutate(m)} onRegen={() => regenMut.mutate(m.id)} />
          </div>
        ))}
      </div>

      {/* Dialog credenciais */}
      <Dialog open={credentialDialog.open} onOpenChange={(o) => !o && setCredentialDialog({ ...credentialDialog, open: false })}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Senha gerada</DialogTitle>
            <DialogDescription>
              Copie e envie ao colaborador por um canal seguro. Esta senha não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>E-mail</Label>
              <Input readOnly value={credentialDialog.email} className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Senha temporária</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={credentialDialog.password} className="font-mono" />
                <Button type="button" onClick={copyPassword} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentialDialog({ ...credentialDialog, open: false })}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowMenu({ m, onToggle, onRegen }: { m: Member; onToggle: () => void; onRegen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuItem onClick={onRegen}>
          <KeyRound className="mr-2 h-4 w-4" /> Gerar nova senha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggle} className={m.status === 'active' ? 'text-destructive' : 'text-green-600'}>
          {m.status === 'active' ? 'Desativar' : 'Reativar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
