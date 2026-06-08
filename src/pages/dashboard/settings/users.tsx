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
      units: (newUser.role as string) === 'admin' ? ['Todas as Unidades'] : ['Unidade Sul'] // Mock logic
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
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white p-10 rounded-[24px] border border-[#E3E6EB] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 rounded-full bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Gestão de Talentos</span>
          </div>
          <h1 className="text-[36px] font-black text-ink tracking-tight font-jakarta leading-none mb-3">Controle de Usuários</h1>
          <p className="text-[15px] text-gray-500 font-medium">Administre níveis de acesso, permissões e horários operacionais da sua equipe.</p>
        </div>
        
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-yellow-bright text-[#1a1500] font-black text-[11px] h-14 px-8 rounded-[16px] shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] uppercase tracking-widest border-none">
              <UserPlus className="mr-3 h-5 w-5" />
              CONVIDAR NOVO USUÁRIO
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

      <div className="flex items-center gap-4 bg-white p-6 rounded-[20px] border border-[#E3E6EB] shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#A7ADB8] transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Buscar por nome, e-mail ou unidade..." 
            className="pl-12 h-14 bg-[#F6F7F9] border-none rounded-[14px] text-sm font-bold text-ink placeholder:text-[#A7ADB8] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-14 px-8 border-[#E3E6EB] text-[#A7ADB8] hover:text-ink hover:bg-[#F6F7F9] font-black text-[11px] uppercase tracking-widest rounded-[14px]">
          <Filter className="mr-3 h-4 w-4" />
          FILTROS AVANÇADOS
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-gray-50/50">
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Unidade(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-b border-border last:border-0 hover:bg-gray-50/50 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-ink">{user.full_name}</span>
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

