import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { 
  Building2, 
  CreditCard, 
  Activity, 
  Cpu, 
  ShieldCheck, 
  Search, 
  Filter, 
  MoreVertical,
  Plus,
  Zap,
  Lock,
  History,
  AlertCircle,
  ExternalLink,
  Ban,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export const Route = createFileRoute('/saas')({
  component: SaaSAdmin,
})

// Mock data based on new PRD fields
const initialTenants = [
  { 
    id: '1', 
    name: 'Ótica Castelar Matriz', 
    cnpj: '12.345.678/0001-90',
    plan: 'enterprise', 
    users: 12, 
    user_limit: 20,
    ia_used: 45200, 
    ia_quota: 100000,
    status: 'ativo',
    responsible: 'João Castelar',
    slug: 'castelar-matriz'
  },
  { 
    id: '2', 
    name: 'Ótica Visão Perfeita', 
    cnpj: '98.765.432/0001-11',
    plan: 'pro', 
    users: 5, 
    user_limit: 5,
    ia_used: 98000, 
    ia_quota: 100000,
    status: 'ativo',
    responsible: 'Maria Silva',
    slug: 'visao-perfeita'
  },
  { 
    id: '3', 
    name: 'Luz & Brilho', 
    cnpj: '45.678.901/0001-22',
    plan: 'basic', 
    users: 2, 
    user_limit: 2,
    ia_used: 12100, 
    ia_quota: 20000,
    status: 'inadimplente',
    responsible: 'Carlos Luz',
    slug: 'luz-brilho'
  }
]

function SaaSAdmin() {
  const [tenants, setTenants] = useState(initialTenants)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [search, setSearch] = useState('')

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault()
    // Simulated logic for duplicate CNPJ check
    const formData = new FormData(e.target as HTMLFormElement)
    const cnpj = formData.get('cnpj') as string
    
    if (tenants.some(t => t.cnpj === cnpj)) {
      toast.error("Erro: CNPJ já cadastrado no sistema.")
      return
    }

    toast.success("Ótica cadastrada com sucesso! Tenant ID gerado.")
    setIsCreateOpen(false)
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.cnpj.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground">Gestão global de inquilinos e infraestrutura.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <History className="w-4 h-4" /> Auditoria
          </Button>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Nova Ótica
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <form onSubmit={handleCreateTenant}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Ótica</DialogTitle>
                  <DialogDescription>
                    Insira as informações da nova unidade cliente. O Tenant ID será gerado automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 grid-cols-2">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Nome Fantasia</Label>
                    <Input id="name" name="name" placeholder="Ex: Ótica do Povo" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="responsible">Responsável</Label>
                    <Input id="responsible" name="responsible" placeholder="Nome do contato" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano</Label>
                    <Select name="plan" defaultValue="basic">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="limit">Limite de Usuários</Label>
                    <Input id="limit" name="limit" type="number" defaultValue="5" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="whatsapp">Token WhatsApp API (Opcional)</Label>
                    <Input id="whatsapp" name="whatsapp" type="password" placeholder="Token de integração" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit">Finalizar Cadastro</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Óticas" value={tenants.length.toString()} trend="+3 este mês" icon={<Building2 className="w-4 h-4 text-primary" />} />
        <StatsCard title="MRR Total" value="R$ 12.400" trend="+12%" icon={<CreditCard className="w-4 h-4 text-green-600" />} />
        <StatsCard title="Tokens IA (Mês)" value="840k" trend="+45k hoje" icon={<Cpu className="w-4 h-4 text-purple-600" />} />
        <StatsCard title="Saúde do Sistema" value="99.9%" trend="Estável" icon={<Activity className="w-4 h-4 text-blue-600" />} statusColor="text-green-600" />
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="tenants">Lista de Óticas</TabsTrigger>
          <TabsTrigger value="plans">Planos & Config</TabsTrigger>
          <TabsTrigger value="ia">Performance IA</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestão de Clientes (Tenants)</CardTitle>
                <CardDescription>Visualize o status e limites de cada ótica.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome ou CNPJ..." 
                    className="pl-9 w-[300px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase font-medium">
                    <tr>
                      <th className="px-6 py-3">Ótica</th>
                      <th className="px-6 py-3">CNPJ / Responsável</th>
                      <th className="px-6 py-3">Plano / Status</th>
                      <th className="px-6 py-3">Limites (Usuários/IA)</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredTenants.map(tenant => (
                      <TenantRow key={tenant.id} tenant={tenant} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Outras abas mantidas como mock por enquanto conforme ETAPA 2 anterior */}
      </Tabs>
    </div>
  )
}

function TenantRow({ tenant }: { tenant: any }) {
  const isIAOverLimit = tenant.ia_used >= tenant.ia_quota
  const isUsersAtLimit = tenant.users >= tenant.user_limit

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold">{tenant.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">slug: {tenant.slug}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-xs font-medium">{tenant.cnpj}</p>
        <p className="text-[10px] text-muted-foreground">{tenant.responsible}</p>
      </td>
      <td className="px-6 py-4 space-y-1">
        <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
        <br />
        <Badge 
          className={
            tenant.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200' : 
            tenant.status === 'inadimplente' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-red-50 text-red-700 border-red-200'
          }
        >
          {tenant.status.toUpperCase()}
        </Badge>
      </td>
      <td className="px-6 py-4 space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className={`text-xs ${isUsersAtLimit ? 'text-amber-600 font-bold' : ''}`}>
            {tenant.users} / {tenant.user_limit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span className={`text-xs ${isIAOverLimit ? 'text-red-600 font-bold' : ''}`}>
            {(tenant.ia_used / 1000).toFixed(1)}k / {(tenant.ia_quota / 1000).toFixed(1)}k
          </span>
          {isIAOverLimit && <Lock className="w-3 h-3 text-red-600" />}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Gestão da Ótica</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 text-primary font-bold">
              <Zap className="w-3.5 h-3.5" /> Acessar (Impersonate)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <ExternalLink className="w-3.5 h-3.5" /> Editar Cadastro
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Lock className="w-3.5 h-3.5" /> Ajustar Quotas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-red-600">
              <Ban className="w-3.5 h-3.5" /> Bloquear Acesso
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function StatsCard({ title, value, trend, icon, statusColor = "text-foreground" }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 bg-muted/50 rounded-lg">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColor}`}>{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">{trend}</p>
      </CardContent>
    </Card>
  )
}

