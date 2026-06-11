import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
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
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Calendar,
  Clock,
  DollarSign,
  TrendingDown,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
import { toast } from "sonner"
import { supabase } from '@/integrations/supabase/client'
import { useAuthStore } from '@/hooks/use-auth'
import { AiCredentialsTab } from '@/components/saas/AiCredentialsTab'

export const Route = createFileRoute('/saas')({
  component: SaaSAdmin,
})

const revenueData = [
  { month: 'Jan', mrr: 8200, profit: 5400 },
  { month: 'Fev', mrr: 9100, profit: 6000 },
  { month: 'Mar', mrr: 10500, profit: 7100 },
  { month: 'Abr', mrr: 11200, profit: 7800 },
  { month: 'Mai', mrr: 12400, profit: 8600 },
]

function SaaSAdmin() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('30d')

  // Check super_admin role
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      toast.error("Acesso negado. Apenas Super Admins podem acessar esta área.")
      navigate({ to: '/' })
    }
  }, [user, navigate])

  const fetchTenants = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          profiles(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTenants(data || [])
    } catch (error: any) {
      toast.error("Erro ao carregar inquilinos: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const name = formData.get('name') as string
    const cnpj = formData.get('cnpj') as string
    const responsible = formData.get('responsible') as string
    const plan = formData.get('plan') as string
    const limit = parseInt(formData.get('limit') as string)

    try {
      const { error } = await (supabase
        .from('tenants') as any)
        .insert({
          name,
          cnpj,
          contato_responsavel: responsible,
          plan,
          limite_usuarios: limit,
          status: 'trial',
          slug: name.toLowerCase().replace(/ /g, '-')
        })



      if (error) {
        if (error.code === '23505') {
          toast.error("Erro: CNPJ já cadastrado no sistema.")
        } else {
          throw error
        }
        return
      }

      toast.success("Ótica cadastrada com sucesso!")
      setIsCreateOpen(false)
      fetchTenants()
    } catch (error: any) {
      toast.error("Erro ao criar ótica: " + error.message)
    }
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.cnpj && t.cnpj.includes(search))
  )

  const planDistribution = [
    { name: 'Basic', value: tenants.filter(t => t.plan === 'basic').length, color: '#94a3b8' },
    { name: 'Pro', value: tenants.filter(t => t.plan === 'pro').length, color: '#6366f1' },
    { name: 'Enterprise', value: tenants.filter(t => t.plan === 'enterprise').length, color: '#1e1b4b' },
  ]

  if (loading && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card p-8 rounded-[14px] border border-border shadow-card">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-primary/10 rounded-2xl shadow-inner">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight font-jakarta mb-1 uppercase tracking-tight">Super Admin Hub</h1>
            <p className="text-gray-500 font-medium">Gestão global de infraestrutura e ecossistema SaaS.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px] bg-background border-border h-12 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-inner">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-white">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="ytd">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-12 px-6 bg-background border-border text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm">
            <History className="w-4 h-4 mr-2" /> Auditoria
          </Button>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 bg-primary hover:bg-yellow-bright text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95">
                <Plus className="w-5 h-5 mr-2" /> NOVA ÓTICA
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatsCard title="Inquilinos Ativos" value={tenants.filter(t => t.status === 'active').length} trend="Total na base" icon={<Building2 className="w-5 h-5 text-primary shadow-[0_0_15px_rgba(255,196,0,0.3)]" />} />
        <StatsCard title="MRR Estimado" value={`R$ ${(tenants.reduce((acc, t) => acc + (t.plan === 'enterprise' ? 1200 : t.plan === 'pro' ? 499 : 199), 0)).toLocaleString()}`} trend="Baseado em planos" icon={<CreditCard className="w-5 h-5 text-success shadow-[0_0_15px_rgba(31,164,99,0.3)]" />} />
        <StatsCard title="IA Tokens Total" value={`${(tenants.reduce((acc, t) => acc + (t.ia_token_used || 0), 0) / 1000).toFixed(0)}k`} trend="Consumo do mês" icon={<Cpu className="w-5 h-5 text-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.3)]" />} />
        <StatsCard title="Usuários Ativos" value={tenants.reduce((acc, t) => acc + (t.profiles?.[0]?.count || 0), 0)} trend="Em toda a rede" icon={<Users className="w-5 h-5 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]" />} />
        <StatsCard title="SLA Médio" value="99.9%" trend="Disponibilidade" icon={<Activity className="w-5 h-5 text-success shadow-[0_0_15px_rgba(31,164,99,0.3)]" />} />
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="bg-card border border-border mb-8 w-full justify-start h-16 p-2 rounded-[14px] shadow-inner overflow-x-auto overflow-y-hidden scrollbar-hide">
          <TabsTrigger value="dashboard" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-full flex items-center gap-2 px-8 transition-all">Visão Geral</TabsTrigger>
          <TabsTrigger value="tenants" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-full flex items-center gap-2 px-8 transition-all">Lista de Óticas</TabsTrigger>
          <TabsTrigger value="plans" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-full flex items-center gap-2 px-8 transition-all">Planos {'&'} Config</TabsTrigger>
          <TabsTrigger value="ia" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-full flex items-center gap-2 px-8 transition-all">Performance IA</TabsTrigger>
          <TabsTrigger value="security" className="text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:text-primary data-[state=active]:bg-white/5 rounded-xl h-full flex items-center gap-2 px-8 transition-all">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Crescimento Mensal de Receita (MRR)</CardTitle>
                <CardDescription>Evolução do faturamento recorrente.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="mrr" name="MRR" stroke="#6366f1" fillOpacity={1} fill="url(#colorMrr)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Planos</CardTitle>
                <CardDescription>Percentual por nível de assinatura.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex flex-col justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {planDistribution.map((plan) => (
                    <div key={plan.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                        <span className="text-muted-foreground">{plan.name}</span>
                      </div>
                      <span className="font-bold">{plan.value} Óticas</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle>Gestão de Clientes (Tenants)</CardTitle>
                <CardDescription>Visualize o status e limites de cada ótica.</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-[300px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome ou CNPJ..." 
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
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
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                          Nenhum inquilino encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map(tenant => (
                        <TenantRow key={tenant.id} tenant={tenant} onUpdate={fetchTenants} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlanCard 
              name="BASIC" 
              price="R$ 199/mês" 
              limits={{ users: 2, leads: 100, ia: '20k tokens' }}
              features={['Agenda', 'Kanban Básico']}
              activeCount={tenants.filter(t => t.plan === 'basic').length}
            />
            <PlanCard 
              name="PRO" 
              price="R$ 499/mês" 
              limits={{ users: 10, leads: 1000, ia: '100k tokens' }}
              features={['Marketing', 'IA SDR Full', 'Kanban Avançado']}
              activeCount={tenants.filter(t => t.plan === 'pro').length}
              highlight
            />
            <PlanCard 
              name="ENTERPRISE" 
              price="R$ 1.200/mês" 
              limits={{ users: 50, leads: 10000, ia: '500k tokens' }}
              features={['Relatórios Custom', 'Suporte VIP', 'API Access']}
              activeCount={tenants.filter(t => t.plan === 'enterprise').length}
            />
          </div>
        </TabsContent>

        <TabsContent value="ia" className="space-y-6 pt-4">
           <Card>
            <CardHeader>
              <CardTitle>Monitoramento de Performance IA (ROI)</CardTitle>
              <CardDescription>Visão consolidada de consumo e lucratividade dos tokens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-muted/50 text-[10px] text-muted-foreground uppercase font-bold">
                    <tr>
                      <th className="px-4 py-2">Ótica</th>
                      <th className="px-4 py-2">Tokens Usados</th>
                      <th className="px-4 py-2">Custo Base (Est.)</th>
                      <th className="px-4 py-2">Quota Atual</th>
                      <th className="px-4 py-2">Status Consumo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3">{(t.ia_token_used || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">R$ {((t.ia_token_used || 0) * 0.0004).toFixed(2)}</td>
                        <td className="px-4 py-3">{(t.ia_token_quota || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn(
                            (t.ia_token_used || 0) > (t.ia_token_quota || 0) * 0.9 ? "text-red-600 border-red-200" : "text-green-600 border-green-200"
                          )}>
                            {Math.round(((t.ia_token_used || 0) / (t.ia_token_quota || 1)) * 100)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Globais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Modo Manutenção</p>
                  <p className="text-sm text-muted-foreground">Impede o login de todos os usuários (exceto Super Admins).</p>
                </div>
                <Button variant="outline">Ativar</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">Forçar Logout Global</p>
                  <p className="text-sm text-muted-foreground">Invalida todas as sessões ativas imediatamente.</p>
                </div>
                <Button variant="destructive">Executar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TenantRow({ tenant, onUpdate }: { tenant: any, onUpdate: () => void }) {
  const isIAOverLimit = (tenant.ia_token_used || 0) >= (tenant.ia_token_quota || 0)
  const isUsersAtLimit = (tenant.profiles?.[0]?.count || 0) >= (tenant.limite_usuarios || 0)

  const handleToggleStatus = async (newStatus: string) => {
    try {
      const { error } = await (supabase
        .from('tenants') as any)
        .update({ status: newStatus })
        .eq('id', tenant.id)



      if (error) throw error
      toast.success(`Status alterado para ${newStatus}`)
      onUpdate()
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message)
    }
  }

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold">{tenant.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">slug: {tenant.slug}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-xs font-medium">{tenant.cnpj || 'Sem CNPJ'}</p>
        <p className="text-[10px] text-muted-foreground">{tenant.contato_responsavel || 'Sem contato'}</p>
      </td>
      <td className="px-6 py-4 space-y-1">
        <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
        <br />
        <Badge 
          className={cn(
            "capitalize",
            tenant.status === 'active' || tenant.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200' : 
            tenant.status === 'overdue' || tenant.status === 'inadimplente' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-red-50 text-red-700 border-red-200'
          )}
        >
          {tenant.status}
        </Badge>
      </td>
      <td className="px-6 py-4 space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className={cn("text-xs", isUsersAtLimit ? 'text-amber-600 font-bold' : '')}>
            {tenant.profiles?.[0]?.count || 0} / {tenant.limite_usuarios || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-muted-foreground" />
          <span className={cn("text-xs", isIAOverLimit ? 'text-red-600 font-bold' : '')}>
            {((tenant.ia_token_used || 0) / 1000).toFixed(1)}k / {((tenant.ia_token_quota || 0) / 1000).toFixed(1)}k
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
            <DropdownMenuItem className="gap-2" onClick={() => handleToggleStatus('active')}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Ativar
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => handleToggleStatus('overdue')}>
              <AlertCircle className="w-3.5 h-3.5" /> Marcar Atraso
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-red-600" onClick={() => handleToggleStatus('inactive')}>
              <Ban className="w-3.5 h-3.5" /> Bloquear Acesso
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function StatsCard({ title, value, trend, icon }: any) {
  return (
    <Card className="bg-card border-border hover:border-primary/40 transition-all duration-500 shadow-card group hover:-translate-y-2 relative overflow-hidden rounded-[14px]">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{title}</p>
          <div className="p-2.5 bg-background border border-border rounded-xl shadow-inner group-hover:bg-primary/5 transition-colors">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(31,164,99,0.5)]" />
          {trend}
        </p>
      </CardContent>
    </Card>
  )
}

function PlanCard({ name, price, limits, features, activeCount, highlight }: any) {
  return (
    <Card className={cn(
      "shadow-card border-border rounded-[14px] overflow-hidden transition-all duration-500 hover:-translate-y-2 relative",
      highlight ? 'border-primary shadow-primary/20 bg-gradient-to-br from-card to-primary/5' : 'bg-card'
    )}>
      {highlight && (
        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
          <Zap className="w-24 h-24 text-primary" />
        </div>
      )}
      <CardHeader className="pb-6 border-b border-border/50 bg-gray-50/50">
        <div className="flex justify-between items-start">
          <Badge className={cn(
            "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-xl border-none shadow-sm",
            highlight ? "bg-primary text-primary-foreground" : "bg-card text-gray-400"
          )}>{name}</Badge>
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{activeCount} ativos</span>
        </div>
        <CardTitle className="text-3xl font-black text-white tracking-tighter pt-4 uppercase tracking-tighter">{price}</CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <div className="space-y-3">
          {[
            { label: 'Usuários', value: limits.users },
            { label: 'Leads/mês', value: limits.leads },
            { label: 'Suporte IA', value: limits.ia },
          ].map((limit) => (
            <div key={limit.label} className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">{limit.label}:</span>
              <span className="font-black text-white">{limit.value}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-4 border-t border-border/50">
          <p className="text-[9px] font-black uppercase text-gray-600 tracking-[0.2em]">Recursos Premium:</p>
          <div className="flex flex-wrap gap-1.5">
            {features.map((f: string) => (
              <Badge key={f} variant="outline" className="text-[9px] px-2 py-0.5 font-black uppercase tracking-tighter border-border bg-background text-gray-400">
                {f}
              </Badge>
            ))}
          </div>
        </div>
        <Button className={cn(
          "w-full h-11 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95",
          highlight ? "bg-primary hover:bg-yellow-bright text-primary-foreground shadow-primary/20" : "bg-card hover:bg-white/5 text-white border border-border"
        )}>
          EDITAR PLANO
        </Button>
      </CardContent>
    </Card>
  )
}
