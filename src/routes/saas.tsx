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
  XCircle,
  Users
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

        <TabsContent value="plans" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlanCard 
              name="Basic" 
              price="R$ 199/mês" 
              limits={{ users: 2, leads: 100, ia: '20k tokens' }}
              features={['Agenda', 'Kanban Básico']}
              activeCount={12}
            />
            <PlanCard 
              name="Pro" 
              price="R$ 499/mês" 
              limits={{ users: 10, leads: 1000, ia: '100k tokens' }}
              features={['Marketing', 'IA SDR Full', 'Kanban Avançado']}
              activeCount={8}
              highlight
            />
            <PlanCard 
              name="Enterprise" 
              price="R$ 1.200/mês" 
              limits={{ users: 50, leads: 10000, ia: '500k tokens' }}
              features={['Relatórios Custom', 'Suporte VIP', 'API Access']}
              activeCount={4}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monitoramento de Performance IA (ROI)</CardTitle>
              <CardDescription>Visão consolidada de consumo e lucratividade dos tokens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-indigo-50/30">
                  <p className="text-xs font-semibold text-indigo-600 uppercase">Faturamento Tokens</p>
                  <p className="text-2xl font-bold">R$ 4.250,00</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Margem média: 65%</p>
                </div>
                <div className="p-4 border rounded-lg bg-green-50/30">
                  <p className="text-xs font-semibold text-green-600 uppercase">Lucro Bruto IA</p>
                  <p className="text-2xl font-bold">R$ 2.760,00</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Após custos da OpenAI</p>
                </div>
                <div className="p-4 border rounded-lg bg-amber-50/30">
                  <p className="text-xs font-semibold text-amber-600 uppercase">Eficiência SDR</p>
                  <p className="text-2xl font-bold">84%</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Taxa de agendamento assistido</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 text-[10px] text-muted-foreground uppercase font-bold">
                    <tr>
                      <th className="px-4 py-2">Ótica</th>
                      <th className="px-4 py-2">Tokens Usados</th>
                      <th className="px-4 py-2">Custo Base</th>
                      <th className="px-4 py-2">Faturado</th>
                      <th className="px-4 py-2">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    <tr>
                      <td className="px-4 py-3 font-medium">Ótica Castelar</td>
                      <td className="px-4 py-3">45.200</td>
                      <td className="px-4 py-3">R$ 18,08</td>
                      <td className="px-4 py-3">R$ 45,20</td>
                      <td className="px-4 py-3 text-green-600 font-bold">60%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium">Ótica Visão</td>
                      <td className="px-4 py-3">32.800</td>
                      <td className="px-4 py-3">R$ 13,12</td>
                      <td className="px-4 py-3">R$ 32,80</td>
                      <td className="px-4 py-3 text-green-600 font-bold">60%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Trilha de Auditoria do SaaS</CardTitle>
                  <CardDescription>Histórico completo de ações administrativas e segurança.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-3.5 h-3.5" /> Filtrar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <AuditLogRow 
                    user="Admin Root" 
                    action="Upgrade de Plano" 
                    target="Ótica Castelar" 
                    date="Hoje, 14:20" 
                    severity="info"
                    metadata="Pro → Enterprise"
                  />
                  <AuditLogRow 
                    user="Suporte Dev" 
                    action="Login via Impersonate" 
                    target="Ótica Visão" 
                    date="Hoje, 13:45" 
                    severity="warning"
                    metadata="Sessão de suporte técnica"
                  />
                  <AuditLogRow 
                    user="Sistema" 
                    action="Bloqueio de Quota IA" 
                    target="Foco Visual" 
                    date="Hoje, 09:12" 
                    severity="critical"
                    metadata="Limite de tokens excedido (110%)"
                  />
                  <AuditLogRow 
                    user="Admin Root" 
                    action="Reset de Senha Admin" 
                    target="Unidade Sul" 
                    date="Ontem, 18:30" 
                    severity="info"
                  />
                </div>
                <Button variant="ghost" className="w-full mt-4 text-xs">Ver histórico completo →</Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Segurança Global</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Modo Manutenção</span>
                      <p className="text-[10px] text-muted-foreground">Bloqueia acesso de inquilinos</p>
                    </div>
                    <Button variant="outline" size="sm">Ativar</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Forçar 2FA</span>
                      <p className="text-[10px] text-muted-foreground">Obrigatório para Admins</p>
                    </div>
                    <Button variant="ghost" size="sm">Config</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-100 bg-red-50/20">
                <CardHeader>
                  <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Alertas Críticos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-2 border border-red-100 rounded bg-white">
                      <p className="text-[10px] font-bold text-red-700">TENTATIVA DE BRUTE FORCE</p>
                      <p className="text-[10px] text-muted-foreground">IP 192.168.1.1 bloqueado após 5 tentativas.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

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


function PlanCard({ name, price, limits, features, activeCount, highlight }: any) {
  return (
    <Card className={highlight ? 'border-primary ring-1 ring-primary' : ''}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <Badge variant={highlight ? 'default' : 'secondary'}>{name}</Badge>
          <span className="text-xs text-muted-foreground">{activeCount} ativos</span>
        </div>
        <CardTitle className="text-2xl pt-2">{price}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usuários:</span>
            <span className="font-semibold">{limits.users}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Leads/mês:</span>
            <span className="font-semibold">{limits.leads}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Suporte IA:</span>
            <span className="font-semibold">{limits.ia}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Features:</p>
          <div className="flex flex-wrap gap-1">
            {features.map((f: string) => (
              <Badge key={f} variant="outline" className="text-[9px] px-1 py-0">{f}</Badge>
            ))}
          </div>
        </div>
        <Button variant={highlight ? 'default' : 'outline'} className="w-full">Editar Plano</Button>
      </CardContent>
    </Card>
  )
}


