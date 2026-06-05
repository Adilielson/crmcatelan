import React, { useState } from 'react';
import { UserPlus, Search, Filter, MoreHorizontal, Shield, Building2, Clock, Mail, Phone, Lock } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserStore } from '@/store/useUserStore';

const UserManagement = () => {
  const { users, addUser, updateUser, deleteUser } = useUserStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    role: 'seller' as const,
    units: [] as string[]
  });

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    addUser({
      ...newUser,
      status: 'pending',
      units: newUser.role === 'admin' ? ['Todas as Unidades'] : ['Unidade Sul'] // Mock logic
    });
    setNewUser({ full_name: '', email: '', role: 'seller', units: [] });
    setIsInviteModalOpen(false);
  };

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
    return <Badge variant={variants[status] || 'outline'}>
      {status === 'active' ? 'Ativo' : status === 'pending' ? 'Pendente' : 'Inativo'}
    </Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Gerencie acessos, permissões e horários da sua equipe.</p>
        </div>
        
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#e0c200] hover:bg-[#c7a700] text-black font-semibold">
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleInviteUser}>
              <DialogHeader>
                <DialogTitle>Convidar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Insira os detalhes do novo colaborador. Um convite será preparado com status pendente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nome</Label>
                  <Input 
                    id="name" 
                    className="col-span-3" 
                    required 
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    className="col-span-3" 
                    required 
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Perfil</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(v: any) => setNewUser({...newUser, role: v})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="manager">Gerente de Unidade</SelectItem>
                      <SelectItem value="seller">Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-[#e0c200] hover:bg-[#c7a700] text-black">Convidar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
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
                        <Shield className="mr-2 h-4 w-4" /> Permissões
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4" /> Unidades
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Clock className="mr-2 h-4 w-4" /> Horários
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Lock className="mr-2 h-4 w-4" /> Resetar Senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.status !== 'inactive' ? (
                        <DropdownMenuItem 
                          className="text-destructive cursor-pointer"
                          onClick={() => updateUser(user.id, { status: 'inactive' })}
                        >
                          Inativar Usuário
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          className="text-green-600 cursor-pointer"
                          onClick={() => updateUser(user.id, { status: 'active' })}
                        >
                          Reativar Usuário
                        </DropdownMenuItem>
                      )}
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

