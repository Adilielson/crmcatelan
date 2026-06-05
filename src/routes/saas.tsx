import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { 
  Building2, 
  CreditCard, 
  Activity, 
  Cpu, 
  ShieldCheck, 
  Users, 
  Search, 
  Filter, 
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Zap,
  Lock,
  History,
  AlertCircle,
  ExternalLink,
  Ban
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts'

export const Route = createFileRoute('/saas')({
  component: SaaSAdmin,
})

const iaPerformanceData = [
  { name: 'Ótica Castelar', tokens: 45000, conversion: 32, performance: 88 },
  { name: 'Ótica Visão', tokens: 32000, conversion: 28, performance: 82 },
  { name: 'Luz & Brilho', tokens: 28000, conversion: 24, performance: 75 },
  { name: 'Ótica Real', tokens: 15000, conversion: 18, performance: 60 },
  { name: 'Foco Visual', tokens: 8000, conversion: 12, performance: 45 },
]

const auditLogs = [
  { id: 1, user: 'Admin Root', action: 'Alteração de Plano', target: 'Ótica Castelar', date: '2024-06-05 14:20', ip: '192.168.1.1' },
  { id: 2, user: 'Suporte Dev', action: 'Impersonate Login', target: 'Ótica Visão', date: '2024-06-05 13:45', ip: '192.168.1.5' },
  { id: 3, user: 'Admin Root', action: 'Bloqueio de IA', target: 'Ótica Real', date: '2024-06-05 11:10', ip: '192.168.1.1' },
  { id: 4, user: 'Sistema', action: 'Auto-Pause (Limit)', target: 'Foco Visual', date: '2024-06-05 09:30', ip: 'internal' },
]

function SaaSAdmin() {
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Painel Super Admin
          </h1>
          <p className="text-muted-foreground">Gestão global do ecossistema Castelar CRM.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <History className="w-4 h-4" /> Logs Globais
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Nova Ótica
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total de Óticas" 
          value="24" 
          trend="+3 este mês" 
          icon={<Building2 className="w-4 h-4 text-primary" />} 
        />
        <StatsCard 
          title="MRR Total" 
          value="R$ 12.400" 
          trend="+12%" 
          icon={<CreditCard className="w-4 h-4 text-green-600" />} 
        />
        <StatsCard 
          title="Tokens IA (Mês)" 
          value="840k" 
          trend="+45k hoje" 
          icon={<Cpu className="w-4 h-4 text-purple-600" />} 
        />
        <StatsCard 
          title="Saúde do Sistema" 
          value="99.9%" 
          trend="Estável" 
          icon={<Activity className="w-4 h-4 text-blue-600" />} 
          statusColor="text-green-600"
        />
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="tenants">Óticas (Tenants)</TabsTrigger>
          <TabsTrigger value="plans">Planos & Limites</TabsTrigger>
          <TabsTrigger value="ia-monitor">Monitoramento IA</TabsTrigger>
          <TabsTrigger value="security">Segurança & Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestão de Multi-tenancy</CardTitle>
                <CardDescription>Visualize e gerencie todas as óticas clientes.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar ótica ou CNPJ..." 
                    className="pl-9 w-[300px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase font-medium">
                    <tr>
                      <th className="px-6 py-3">Ótica</th>
                      <th className="px-6 py-3">Plano</th>
                      <th className="px-6 py-3">Usuários</th>
                      <th className="px-6 py-3">Consumo IA</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    <TenantRow 
                      name="Ótica Castelar Matriz" 
                      plan="Enterprise" 
                      users="12 / 20" 
                      ia="45.2k tokens" 
                      status="Ativo"
                    />
                    <TenantRow 
                      name="Ótica Visão Perfeita" 
                      plan="Pro" 
                      users="5 / 5" 
                      ia="32.8k tokens" 
                      status="Ativo"
                      alertIA
                    />
                    <TenantRow 
                      name="Luz & Brilho" 
                      plan="Basic" 
                      users="2 / 2" 
                      ia="12.1k tokens" 
                      status="Atraso"
                    />
                    <TenantRow 
                      name="Ótica Real (Demo)" 
                      plan="Trial" 
                      users="1 / 3" 
                      ia="850 tokens" 
                      status="Inativo"
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlanCard 
              name="Basic" 
              price="R$ 199/mês" 
              limits={{ users: 2, leads: 100, ia: 'Padrão' }}
              activeCount={12}
            />
            <PlanCard 
              name="Pro" 
              price="R$ 499/mês" 
              limits={{ users: 10, leads: 500, ia: 'Avançado' }}
              activeCount={8}
              highlight
            />
            <PlanCard 
              name="Enterprise" 
              price="Sob Consulta" 
              limits={{ users: 'Ilimitado', leads: 'Ilimitado', ia: 'Custom' }}
              activeCount={4}
            />
          </div>
        </TabsContent>

        <TabsContent value="ia-monitor" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Performance de IA por Ótica</CardTitle>
                <CardDescription>Ranking de conversão e eficiência dos agendamentos via IA.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iaPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="performance" name="Performance (%)" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      {iaPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.performance > 70 ? '#6366f1' : entry.performance > 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alertas de Estouro</CardTitle>
                  <CardDescription>Monitoramento de quotas em tempo real.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-900 uppercase">Bloqueio Automático</p>
                      <p className="text-xs text-red-800">Ótica Foco Visual atingiu 110% da quota. IA pausada.</p>
                      <Button variant="link" className="h-auto p-0 text-xs text-red-900 font-bold mt-1">Liberar Quota →</Button>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-900 uppercase">Aviso de Consumo</p>
                      <p className="text-xs text-amber-800">Ótica Visão atingiu 90% da quota mensal.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custo Médio Token</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">R$ 0,08</div>
                  <p className="text-xs text-muted-foreground mt-1">Margem bruta: 65%</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria de Segurança</CardTitle>
              <CardDescription>Rastreabilidade completa de ações administrativas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-full">
                        <History className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{log.user}</span>
                          <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Alvo: <span className="font-medium text-foreground">{log.target}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{log.date}</p>
                      <p className="text-xs text-muted-foreground">{log.ip}</p>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" className="w-full text-xs">Carregar mais registros...</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
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
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          {trend.includes('+') ? (
            <ArrowUpRight className="w-3 h-3 text-green-600" />
          ) : trend.includes('-') ? (
            <ArrowDownRight className="w-3 h-3 text-red-600" />
          ) : null}
          {trend}
        </p>
      </CardContent>
    </Card>
  )
}

function TenantRow({ name, plan, users, ia, status, alertIA }: any) {
  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">ID: tenant_{name.toLowerCase().replace(/ /g, '_')}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant="outline">{plan}</Badge>
      </td>
      <td className="px-6 py-4 text-xs font-medium">{users}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${alertIA ? 'text-amber-600 font-bold' : ''}`}>{ia}</span>
          {alertIA && <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />}
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge 
          className={
            status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 
            status === 'Atraso' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-gray-50 text-gray-700 border-gray-200'
          }
        >
          {status}
        </Badge>
      </td>
      <td className="px-6 py-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2">
              <ExternalLink className="w-3.5 h-3.5" /> Ver Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-primary font-bold">
              <Zap className="w-3.5 h-3.5" /> Impersonate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <Lock className="w-3.5 h-3.5" /> Editar Limites
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-red-600">
              <Ban className="w-3.5 h-3.5" /> Bloquear Acesso
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function PlanCard({ name, price, limits, activeCount, highlight }: any) {
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
        <Button variant={highlight ? 'default' : 'outline'} className="w-full">Editar Plano</Button>
      </CardContent>
    </Card>
  )
}
