import React, { useState } from 'react';
import { UserPlus, Search, Filter, MoreHorizontal, Shield, Building2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data based on schema
  const users = [
    {
      id: '1',
      full_name: 'Admin Principal',
      email: 'admin@castelar.com',
      role: 'admin',
      status: 'active',
      units: ['Unidade Matriz'],
      last_login: '2024-06-05T10:00:00Z',
    },
    {
      id: '2',
      full_name: 'Gerente Comercial',
      email: 'gerente@castelar.com',
      role: 'manager',
      status: 'active',
      units: ['Unidade Sul', 'Unidade Norte'],
      last_login: '2024-06-04T15:30:00Z',
    },
    {
      id: '3',
      full_name: 'Vendedor 01',
      email: 'vendedor@castelar.com',
      role: 'seller',
      status: 'pending',
      units: ['Unidade Sul'],
      last_login: null,
    }
  ];

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      admin: { label: 'Administrador', variant: 'default' },
      manager: { label: 'Gerente', variant: 'secondary' },
      seller: { label: 'Atendente', variant: 'outline' },
    };
    const r = roles[role] || { label: role, variant: 'outline' };
    return <Badge variant={r.variant}>{r.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: 'default',
      pending: 'secondary',
      inactive: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status === 'active' ? 'Ativo' : status === 'pending' ? 'Pendente' : 'Inativo'}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Gerencie acessos, permissões e horários da sua equipe.</p>
        </div>
        <Button className="bg-[#e0c200] hover:bg-[#c7a700] text-black font-semibold">
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar Novo Usuário
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Unidade(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{user.full_name}</span>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.units.map(u => (
                      <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString('pt-BR') : 'Nunca'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" /> Editar Permissões
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4" /> Vincular Unidades
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Clock className="mr-2 h-4 w-4" /> Horário de Atendimento
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive cursor-pointer">
                        Inativar Usuário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
